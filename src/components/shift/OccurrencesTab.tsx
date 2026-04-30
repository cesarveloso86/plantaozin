import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Edit, SkipForward, Clock } from "lucide-react";
import { toast } from "sonner";
import type { Shift, ShiftOccurrence, ShiftMember, ShiftSubteam } from "@/types/shift";
import { PROCEDURE_TYPES, REGIONALS } from "@/types/shift";
import { Switch } from "@/components/ui/switch";
import { predictQueue, predictSubteamQueue, nextSkipping } from "@/lib/availability";
import { useNow } from "@/hooks/useNow";


interface Props {
  shift: Shift;
  occurrences: ShiftOccurrence[];
  onAdd: (occ: Partial<ShiftOccurrence>) => Promise<void>;
  onUpdate: (id: string, updates: Partial<ShiftOccurrence>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}


const emptyForm = (): Partial<ShiftOccurrence> => ({
  bu_number: "",
  status: "em_atendimento",
  procedure_type: "",
  investigator: "",
  authority: "",
  regional: "",
  has_report: false,
  num_hearings: 0,
  observations: "",
  conducted_names: "",
  victim_names: "",
  tipification: "",
  po_status: "",
});

export function OccurrencesTab({ shift, occurrences, onAdd, onUpdate, onDelete }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<ShiftOccurrence>>(emptyForm());
  const [saving, setSaving] = useState(false);

  const [newBu, setNewBu] = useState("");
  const [newTime, setNewTime] = useState("");
  const [adding, setAdding] = useState(false);

  // Estado independente para a aba "Sem Oitiva".
  const [newBuSO, setNewBuSO] = useState("");
  const [newTimeSO, setNewTimeSO] = useState("");
  const [addingSO, setAddingSO] = useState(false);

  // Skip histórico por ocorrência em atendimento (id).
  const [skippedInvByOcc, setSkippedInvByOcc] = useState<Record<string, string[]>>({});
  const [skippedAuthByOcc, setSkippedAuthByOcc] = useState<Record<string, string[]>>({});

  // Geração de depoimentos foi movida para "Meu Histórico" (acesso unificado por OIP/Autoridade).

  // Helper: BU normalizado
  const normBu = (s: string) => (s || "").trim().toUpperCase();
  const findExistingBu = (bu: string) => {
    const n = normBu(bu);
    if (!n) return null;
    return occurrences.find((o) => normBu(o.bu_number) === n) || null;
  };

  // Split by status
  const inAttendance = useMemo(
    () => occurrences.filter((o) => o.status === "em_atendimento"),
    [occurrences],
  );
  const semOitiva = useMemo(
    () => occurrences.filter((o) => o.status === "sem_oitiva"),
    [occurrences],
  );
  const completed = useMemo(
    () => occurrences.filter((o) => o.status === "atendida"),
    [occurrences],
  );

  const editingOcc = editingId ? occurrences.find((o) => o.id === editingId) : null;
  const isInAttendance = editingOcc?.status === "em_atendimento";

  const allInvestigators = shift.investigators;
  const allAuthorities = shift.authorities;
  const investigatorNames = allInvestigators.map((i) => i.name);
  const authorityNames = allAuthorities.map((a) => a.name);

  const nicknameMap = useMemo(() => {
    const map = new Map<string, string>();
    [...shift.investigators, ...shift.authorities, ...shift.iseo].forEach((m) => {
      if (m.nickname?.trim()) map.set(m.name, m.nickname);
    });
    return map;
  }, [shift.investigators, shift.authorities, shift.iseo]);
  const displayLabel = useCallback(
    (fullName: string) => nicknameMap.get(fullName) ?? fullName,
    [nicknameMap],
  );

  const now = useNow(30_000);

  // Fila preditiva por subequipe (v5). Fallback: fila plana legada.
  const oipSubteams = shift.oip_subteams || [];
  const delSubteams = shift.delegado_subteams || [];

  // Ocorrências que contam para a fila "Em Distribuição" (exclui sem_oitiva).
  const mainQueueOccs = useMemo(
    () => occurrences.filter((o) => o.status !== "sem_oitiva"),
    [occurrences],
  );

  const predictedInvSub = useMemo(
    () => predictSubteamQueue(oipSubteams, mainQueueOccs, [], "investigator", 5, now),
    [oipSubteams, mainQueueOccs, now],
  );
  const predictedAuthSub = useMemo(
    () => predictSubteamQueue(delSubteams, mainQueueOccs, [], "authority", 5, now),
    [delSubteams, mainQueueOccs, now],
  );

  const predictedInv = useMemo(
    () => predictedInvSub.length > 0
      ? predictedInvSub.map((p) => p.memberPick)
      : predictQueue(allInvestigators, mainQueueOccs, [], "investigator", 5, now),
    [predictedInvSub, allInvestigators, mainQueueOccs, now],
  );
  const predictedAuth = useMemo(
    () => predictedAuthSub.length > 0
      ? predictedAuthSub.map((p) => p.memberPick)
      : predictQueue(allAuthorities, mainQueueOccs, [], "authority", 5, now),
    [predictedAuthSub, allAuthorities, mainQueueOccs, now],
  );

  const suggestedInvestigator = predictedInv[0] || "";
  const suggestedAuthority = predictedAuth[0] || "";

  // Fila preditiva independente para "Sem Oitiva" — só conta ocorrências sem_oitiva.
  const predictedInvSubSO = useMemo(
    () => predictSubteamQueue(oipSubteams, semOitiva, [], "investigator", 5, now),
    [oipSubteams, semOitiva, now],
  );
  const predictedAuthSubSO = useMemo(
    () => predictSubteamQueue(delSubteams, semOitiva, [], "authority", 5, now),
    [delSubteams, semOitiva, now],
  );
  const predictedInvSO = useMemo(
    () => predictedInvSubSO.length > 0
      ? predictedInvSubSO.map((p) => p.memberPick)
      : predictQueue(allInvestigators, semOitiva, [], "investigator", 5, now),
    [predictedInvSubSO, allInvestigators, semOitiva, now],
  );
  const predictedAuthSO = useMemo(
    () => predictedAuthSubSO.length > 0
      ? predictedAuthSubSO.map((p) => p.memberPick)
      : predictQueue(allAuthorities, semOitiva, [], "authority", 5, now),
    [predictedAuthSubSO, allAuthorities, semOitiva, now],
  );
  const suggestedInvestigatorSO = predictedInvSO[0] || "";
  const suggestedAuthoritySO = predictedAuthSO[0] || "";

  const dupMsg = (status: string) =>
    status === "em_atendimento" ? "em distribuição"
    : status === "sem_oitiva" ? "em sem oitiva"
    : "já atendida";

  /** Adiciona a ocorrência DIRETO ao card "Em Atendimento" com OIP/Autoridade
   * já preenchidos pela fila preditiva. */
  const addToQueue = async () => {
    const bu = normBu(newBu);
    if (!bu) { toast.error("Informe o número do BU"); return; }
    const dup = findExistingBu(bu);
    if (dup) {
      toast.error(`BU ${bu} já está ${dupMsg(dup.status)} neste plantão.`);
      return;
    }

    const today = shift.shift_date;
    const timeVal = newTime || new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    const tramitationIso = new Date(`${today}T${timeVal}`).toISOString();

    setAdding(true);
    try {
      await onAdd({
        status: "em_atendimento",
        bu_number: bu,
        tramitation_time: tramitationIso,
        investigator: suggestedInvestigator,
        authority: suggestedAuthority,
      });
      toast.success(`BU ${bu} em atendimento`);
      setNewBu("");
      setNewTime("");
    } catch {
      toast.error("Erro ao adicionar à fila");
    } finally {
      setAdding(false);
    }
  };

  /** Adiciona a ocorrência à fila "Sem Oitiva" (procedimentos sem ordem rígida). */
  const addToQueueSO = async () => {
    const bu = normBu(newBuSO);
    if (!bu) { toast.error("Informe o número do BU"); return; }
    const dup = findExistingBu(bu);
    if (dup) {
      toast.error(`BU ${bu} já está ${dupMsg(dup.status)} neste plantão.`);
      return;
    }

    const today = shift.shift_date;
    const timeVal = newTimeSO || new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    const tramitationIso = new Date(`${today}T${timeVal}`).toISOString();

    setAddingSO(true);
    try {
      await onAdd({
        status: "sem_oitiva",
        bu_number: bu,
        tramitation_time: tramitationIso,
        investigator: suggestedInvestigatorSO,
        authority: suggestedAuthoritySO,
      });
      toast.success(`BU ${bu} adicionado em Sem Oitiva`);
      setNewBuSO("");
      setNewTimeSO("");
    } catch {
      toast.error("Erro ao adicionar à fila");
    } finally {
      setAddingSO(false);
    }
  };

  // Helper: próximo nome respeitando carga + lista de skipados (rotação 1→2→3).
  const pickNextWithSkip = useCallback(
    (
      members: ShiftMember[],
      subteams: ShiftSubteam[],
      field: "investigator" | "authority",
      skipped: string[],
    ): string => {
      const skipSet = new Set(skipped);
      const skippedSubteamIds: string[] = [];
      for (const s of subteams) {
        const available = s.members.filter((m) => !skipSet.has(m.name));
        if (available.length === 0) skippedSubteamIds.push(s.id);
      }
      const sub = predictSubteamQueue(subteams, occurrences, [], field, 1, now, skippedSubteamIds);
      if (sub[0]?.memberPick && !skipSet.has(sub[0].memberPick)) return sub[0].memberPick;
      const flat = predictQueue(members, occurrences, [], field, 1, now, skipped);
      if (flat[0]) return flat[0];
      return nextSkipping(members, skipped[skipped.length - 1] || "", now, skipped);
    },
    [occurrences, now],
  );


  const openEdit = (occ: ShiftOccurrence) => {
    setForm(occ);
    setEditingId(occ.id);
    setShowForm(true);
  };

  const handleSave = async (finalize = true) => {
    const bu = normBu(form.bu_number || "");
    if (!bu) { toast.error("Informe o número do BU"); return; }
    setSaving(true);
    try {
      if (editingId) {
        const updates = { ...form };
        if (isInAttendance && finalize) updates.status = "atendida";
        else if (isInAttendance) updates.status = "em_atendimento";
        await onUpdate(editingId, updates);
        toast.success(isInAttendance ? (finalize ? "Atendimento concluído" : "Progresso salvo") : "Ocorrência atualizada");
      } else {
        const existing = findExistingBu(bu);
        if (existing) {
          // Se já está atendida, bloqueia. Se está em atendimento, mescla e conclui.
          if (existing.status !== "em_atendimento") {
            toast.error(`BU ${bu} já foi atendido neste plantão.`);
            setSaving(false);
            return;
          }
          const mergeFields: Partial<ShiftOccurrence> = { ...form };
          delete mergeFields.tramitation_time;
          delete mergeFields.investigator;
          delete mergeFields.authority;
          mergeFields.status = "atendida";
          await onUpdate(existing.id, mergeFields);
          toast.success(`BU ${bu} mesclado e atendido`);
        } else {
          await onAdd({ ...form, bu_number: bu, status: "atendida" });
          toast.success("Ocorrência registrada");
        }
      }

      setShowForm(false);
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleHearings = async (occ: ShiftOccurrence, delta: number) => {
    const next = Math.max(0, (occ.num_hearings || 0) + delta);
    try { await onUpdate(occ.id, { num_hearings: next }); } catch { toast.error("Erro"); }
  };

  const handleSkipInv = async (occ: ShiftOccurrence) => {
    const skipped = [...(skippedInvByOcc[occ.id] || []), occ.investigator || ""].filter(Boolean);
    const next = pickNextWithSkip(allInvestigators, oipSubteams, "investigator", skipped);
    setSkippedInvByOcc((s) => ({ ...s, [occ.id]: skipped }));
    try { await onUpdate(occ.id, { investigator: next }); toast.success("OIP remanejado"); } catch { toast.error("Erro"); }
  };
  const handleSkipAuth = async (occ: ShiftOccurrence) => {
    const skipped = [...(skippedAuthByOcc[occ.id] || []), occ.authority || ""].filter(Boolean);
    const next = pickNextWithSkip(allAuthorities, delSubteams, "authority", skipped);
    setSkippedAuthByOcc((s) => ({ ...s, [occ.id]: skipped }));
    try { await onUpdate(occ.id, { authority: next }); toast.success("Autoridade remanejada"); } catch { toast.error("Erro"); }
  };

  const handleInlineChange = async (occId: string, field: "investigator" | "authority", value: string) => {
    try { await onUpdate(occId, { [field]: value }); } catch { toast.error("Erro ao atualizar"); }
  };

  /** Converte um valor "HH:mm[:ss]" em ISO usando shift_date; vazio → null. */
  const handleInlineTime = async (occId: string, timeStr: string) => {
    try {
      const iso = timeStr
        ? new Date(`${shift.shift_date}T${timeStr.length === 5 ? `${timeStr}:00` : timeStr}`).toISOString()
        : null;
      await onUpdate(occId, { tramitation_time: iso });
    } catch { toast.error("Erro ao atualizar horário"); }
  };

  /** Extrai "HH:mm:ss" de um ISO para uso em <input type="time"> */
  const isoToTimeInput = (iso: string | null): string => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      const ss = String(d.getSeconds()).padStart(2, "0");
      return `${hh}:${mm}:${ss}`;
    } catch { return ""; }
  };

  const setField = useCallback(
    <K extends keyof ShiftOccurrence>(key: K, value: ShiftOccurrence[K]) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    [],
  );

  return (
    <div className="space-y-4">
      <Tabs defaultValue="distribuicao" className="w-full">
        <TabsList>
          <TabsTrigger value="distribuicao">Em Distribuição ({inAttendance.length})</TabsTrigger>
          <TabsTrigger value="atendidas">Já Atendidas ({completed.length})</TabsTrigger>
        </TabsList>

        {/* ── Aba: Em Distribuição ── */}
        <TabsContent value="distribuicao" className="space-y-4 mt-4">
          {(shift.status === "active" || inAttendance.length > 0) && (
            <Card className="border-primary/40 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  Em Atendimento ({inAttendance.length})
                  <Badge variant="outline" className="ml-2 gap-1 font-normal">
                    <Clock className="w-3 h-3" />
                    {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground w-[150px]">BU</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground w-[120px]">Hora</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">OIP</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Autoridade</th>
                        <th className="px-3 py-2 w-[140px]"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Ocorrências reais já em atendimento */}
                      {inAttendance.map((occ) => (
                        <tr key={occ.id} className="border-b border-border hover:bg-background/50">
                          <td className="px-3 py-2 font-mono font-bold">{occ.bu_number || "—"}</td>
                          <td className="px-3 py-2">
                            <Input
                              type="time"
                              step="1"
                              defaultValue={isoToTimeInput(occ.tramitation_time)}
                              onBlur={(e) => {
                                const cur = isoToTimeInput(occ.tramitation_time);
                                if (e.target.value !== cur) handleInlineTime(occ.id, e.target.value);
                              }}
                              className="h-8 text-sm w-[110px] px-2"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              <Select value={occ.investigator || ""} onValueChange={(v) => handleInlineChange(occ.id, "investigator", v)}>
                                <SelectTrigger className="h-9 text-base"><SelectValue placeholder="OIP" /></SelectTrigger>
                                <SelectContent>{investigatorNames.map((n) => <SelectItem key={n} value={n} className="text-base">{displayLabel(n)}</SelectItem>)}</SelectContent>
                              </Select>
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Pular OIP" onClick={() => handleSkipInv(occ)}>
                                <SkipForward className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              <Select value={occ.authority || ""} onValueChange={(v) => handleInlineChange(occ.id, "authority", v)}>
                                <SelectTrigger className="h-9 text-base"><SelectValue placeholder="Autoridade" /></SelectTrigger>
                                <SelectContent>{authorityNames.map((n) => <SelectItem key={n} value={n} className="text-base">{displayLabel(n)}</SelectItem>)}</SelectContent>
                              </Select>
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Pular Autoridade" onClick={() => handleSkipAuth(occ)}>
                                <SkipForward className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1 justify-end">
                              <Button variant="default" size="sm" className="h-8 gap-1" title="Continuar atendimento" onClick={() => openEdit(occ)}>
                                <Edit className="w-3.5 h-3.5" /> Continuar
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Remover">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remover ocorrência?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      BU {occ.bu_number} será removido permanentemente. Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      onClick={() => onDelete(occ.id)}
                                    >
                                      Remover
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {/* Linha "Próximo": input de BU + hora + OIP/Autoridade pré-preenchidos */}
                      {shift.status === "active" && (predictedInv.length > 0 || predictedAuth.length > 0) && (
                        <tr className="border-b border-dashed border-primary/40 bg-accent/10">
                          <td className="px-3 py-2">
                            <Input
                              value={newBu}
                              onChange={(e) => setNewBu(e.target.value)}
                              placeholder="Nº BU"
                              className="h-9 text-base font-mono"
                              onKeyDown={(e) => { if (e.key === "Enter") addToQueue(); }}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="time"
                              step="1"
                              value={newTime}
                              onChange={(e) => setNewTime(e.target.value)}
                              className="h-9 text-sm w-[110px] px-2"
                              title="Horário (opcional)"
                            />
                          </td>
                          <td className="px-3 py-2 text-base font-medium">
                            {suggestedInvestigator ? displayLabel(suggestedInvestigator) : "—"}
                          </td>
                          <td className="px-3 py-2 text-base font-medium">
                            {suggestedAuthority ? displayLabel(suggestedAuthority) : "—"}
                          </td>
                          <td className="px-3 py-2">
                            <Button size="sm" onClick={addToQueue} disabled={adding || !newBu.trim()} className="h-9 gap-1 w-full">
                              <Plus className="w-4 h-4" /> {adding ? "..." : "Confirmar"}
                            </Button>
                          </td>
                        </tr>
                      )}

                      {/* Slots seguintes (preview da fila preditiva, sem input) */}
                      {shift.status === "active" && predictedInv.slice(1, 4).map((inv, i) => {
                        const auth = predictedAuth[i + 1] || "";
                        const subInv = predictedInvSub[i + 1];
                        const subAuth = predictedAuthSub[i + 1];
                        return (
                          <tr key={`slot-${i}`} className="border-b border-border/40 opacity-60">
                            <td className="px-3 py-1.5 text-xs text-muted-foreground italic">—</td>
                            <td className="px-3 py-1.5 text-xs text-muted-foreground italic">—</td>
                            <td className="px-3 py-1.5 text-base">
                              {subInv ? displayLabel(subInv.memberPick) : (inv ? displayLabel(inv) : "—")}
                            </td>
                            <td className="px-3 py-1.5 text-base">
                              {subAuth ? displayLabel(subAuth.memberPick) : (auth ? displayLabel(auth) : "—")}
                            </td>
                            <td className="px-3 py-1.5"></td>
                          </tr>
                        );
                      })}

                      {inAttendance.length === 0 && predictedInv.length === 0 && predictedAuth.length === 0 && (
                        <tr><td colSpan={5} className="p-6 text-center text-muted-foreground text-sm">Nenhum servidor disponível neste horário.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Aba: Já Atendidas ── */}
        <TabsContent value="atendidas" className="space-y-4 mt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="p-2.5 text-left font-medium text-muted-foreground">BU</th>
                  <th className="p-2.5 text-left font-medium text-muted-foreground">Horário</th>
                  <th className="p-2.5 text-left font-medium text-muted-foreground">Tipo</th>
                  <th className="p-2.5 text-left font-medium text-muted-foreground">OIP</th>
                  <th className="p-2.5 text-left font-medium text-muted-foreground">Autoridade</th>
                  <th className="p-2.5 text-left font-medium text-muted-foreground">Regional</th>
                  <th className="p-2.5 text-left font-medium text-muted-foreground">Rel.</th>
                  <th className="p-2.5 text-left font-medium text-muted-foreground">Oitivas</th>
                  <th className="p-2.5 w-32"></th>
                </tr>
              </thead>
              <tbody>
                {completed.map((occ) => (
                  <tr key={occ.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="p-2.5 font-mono font-semibold">{occ.bu_number}</td>
                    <td className="p-2.5">
                      <Input
                        type="time"
                        step="1"
                        defaultValue={isoToTimeInput(occ.tramitation_time)}
                        onBlur={(e) => {
                          const cur = isoToTimeInput(occ.tramitation_time);
                          if (e.target.value !== cur) handleInlineTime(occ.id, e.target.value);
                        }}
                        className="h-8 text-xs w-[110px] px-2"
                      />
                    </td>
                    <td className="p-2.5">
                      <div className="flex gap-1 flex-wrap">
                        {occ.procedure_type && <Badge variant="secondary">{occ.procedure_type}</Badge>}
                        {occ.procedure_type_2 && <Badge variant="outline">{occ.procedure_type_2}</Badge>}
                      </div>
                    </td>
                    <td className="p-2.5">
                      <div className="flex items-center gap-1">
                        <Select value={occ.investigator || ""} onValueChange={(v) => handleInlineChange(occ.id, "investigator", v)}>
                          <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>{investigatorNames.map((n) => <SelectItem key={n} value={n}>{displayLabel(n)}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Pular OIP" onClick={() => handleSkipInv(occ)}>
                          <SkipForward className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                    <td className="p-2.5">
                      <div className="flex items-center gap-1">
                        <Select value={occ.authority || ""} onValueChange={(v) => handleInlineChange(occ.id, "authority", v)}>
                          <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>{authorityNames.map((n) => <SelectItem key={n} value={n}>{displayLabel(n)}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Pular Autoridade" onClick={() => handleSkipAuth(occ)}>
                          <SkipForward className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                    <td className="p-2.5 truncate max-w-[160px]">{occ.regional || "—"}</td>
                    <td className="p-2.5">{occ.has_report ? "SIM" : "NÃO"}</td>
                    <td className="p-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleHearings(occ, -1)} disabled={!occ.num_hearings}>
                          <span className="text-base leading-none">−</span>
                        </Button>
                        <span className="font-mono w-6 text-center">{occ.num_hearings}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleHearings(occ, 1)}>
                          <span className="text-base leading-none">+</span>
                        </Button>
                      </div>
                    </td>
                    <td className="p-2.5">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={() => openEdit(occ)}><Edit className="w-4 h-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="w-4 h-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover ocorrência?</AlertDialogTitle>
                              <AlertDialogDescription>
                                BU {occ.bu_number} será removido permanentemente. Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => onDelete(occ.id)}
                              >
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                ))}
                {completed.length === 0 && (
                  <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Nenhuma ocorrência atendida ainda.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              {editingId
                ? (isInAttendance ? "Continuar Atendimento" : "Editar Ocorrência")
                : "Nova Ocorrência"}
              {isInAttendance && (
                <Badge variant="outline" className="border-primary/60 text-primary text-xs">Em atendimento</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-sm">Nº BU</Label><Input value={form.bu_number || ""} onChange={(e) => setField("bu_number", e.target.value)} placeholder="99999999" /></div>
              <div>
                <Label className="text-sm">Tipo Procedimento</Label>
                <Select value={form.procedure_type || ""} onValueChange={(v) => setField("procedure_type", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{PROCEDURE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Tipo 2 (opcional)</Label>
                <Select value={form.procedure_type_2 || "__none__"} onValueChange={(v) => setField("procedure_type_2", v === "__none__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent><SelectItem value="__none__">Nenhum</SelectItem>{PROCEDURE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Tipo 3 (opcional)</Label>
                <Select value={form.procedure_type_3 || "__none__"} onValueChange={(v) => setField("procedure_type_3", v === "__none__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent><SelectItem value="__none__">Nenhum</SelectItem>{PROCEDURE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">OIP</Label>
                <Select value={form.investigator || ""} onValueChange={(v) => setField("investigator", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{investigatorNames.map((n) => <SelectItem key={n} value={n}>{displayLabel(n)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Autoridade</Label>
                <Select value={form.authority || ""} onValueChange={(v) => setField("authority", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{authorityNames.map((n) => <SelectItem key={n} value={n}>{displayLabel(n)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-sm">Regional</Label>
              <Select value={form.regional || ""} onValueChange={(v) => setField("regional", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{REGIONALS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={form.has_report || false} onCheckedChange={(v) => setField("has_report", v)} />
                <Label className="text-sm">Relatório</Label>
              </div>
              <div>
                <Label className="text-sm">Oitivas</Label>
                <div className="flex items-center gap-1 h-10 border border-input rounded-md px-2 bg-background">
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setField("num_hearings", Math.max(0, (form.num_hearings || 0) - 1))} disabled={!form.num_hearings}>
                    <span className="text-base leading-none">−</span>
                  </Button>
                  <span className="font-mono w-8 text-center text-sm">{form.num_hearings || 0}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setField("num_hearings", (form.num_hearings || 0) + 1)}>
                    <span className="text-base leading-none">+</span>
                  </Button>
                </div>
              </div>
            </div>
            <div><Label className="text-sm">Conduzido(s) / Autuado(s)</Label><Input value={form.conducted_names || ""} onChange={(e) => setField("conducted_names", e.target.value)} /></div>
            <div><Label className="text-sm">Vítima(s)</Label><Input value={form.victim_names || ""} onChange={(e) => setField("victim_names", e.target.value)} /></div>
            <div><Label className="text-sm">Tipificação</Label><Input value={form.tipification || ""} onChange={(e) => setField("tipification", e.target.value)} placeholder="Art. 33 da Lei 11.343/06" /></div>
            <div><Label className="text-sm">Status PO</Label><Input value={form.po_status || ""} onChange={(e) => setField("po_status", e.target.value)} placeholder="Anexado, tramitado e comunicado" /></div>
            <div><Label className="text-sm">Observações</Label><Textarea value={form.observations || ""} onChange={(e) => setField("observations", e.target.value)} rows={2} /></div>
            {isInAttendance ? (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleSave(false)} disabled={saving} className="flex-1">
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
                <Button onClick={() => handleSave(true)} disabled={saving} className="flex-1">
                  {saving ? "Salvando..." : "Concluir Atendimento"}
                </Button>
              </div>
            ) : (
              <Button onClick={() => handleSave(true)} disabled={saving} className="w-full">
                {saving ? "Salvando..." : editingId ? "Atualizar" : "Registrar"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
