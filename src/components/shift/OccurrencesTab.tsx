import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Edit, SkipForward, Send, Users, Clock } from "lucide-react";
import { toast } from "sonner";
import type { Shift, ShiftOccurrence } from "@/types/shift";
import { PROCEDURE_TYPES, REGIONALS } from "@/types/shift";
import { Switch } from "@/components/ui/switch";
import { predictQueue, getAvailableMembers, nextSkipping } from "@/lib/availability";

interface PendingItem {
  bu_number: string;
  tramitation_time: string;
  investigator: string;
  authority: string;
}

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

  const [pendingQueue, setPendingQueue] = useState<PendingItem[]>([]);
  const [newBu, setNewBu] = useState("");
  const [newTime, setNewTime] = useState("");

  // Skip histórico por slot (idx do pendingQueue) — pulados vão para o final.
  const [skippedInvByIdx, setSkippedInvByIdx] = useState<Record<number, string[]>>({});
  const [skippedAuthByIdx, setSkippedAuthByIdx] = useState<Record<number, string[]>>({});

  // Helper: BU normalizado
  const normBu = (s: string) => (s || "").trim().toUpperCase();
  const findExistingBu = (bu: string) => {
    const n = normBu(bu);
    if (!n) return null;
    return occurrences.find((o) => normBu(o.bu_number) === n) || null;
  };
  const findInPending = (bu: string) => {
    const n = normBu(bu);
    return pendingQueue.find((p) => normBu(p.bu_number) === n) || null;
  };

  // Split by status
  const inAttendance = useMemo(
    () => occurrences.filter((o) => o.status === "em_atendimento"),
    [occurrences],
  );
  const completed = useMemo(
    () => occurrences.filter((o) => o.status !== "em_atendimento"),
    [occurrences],
  );

  const editingOcc = editingId ? occurrences.find((o) => o.id === editingId) : null;
  const isInAttendance = editingOcc?.status === "em_atendimento";

  const allInvestigators = shift.investigators;
  const allAuthorities = shift.authorities;
  const investigatorNames = allInvestigators.map((i) => i.name);
  const authorityNames = allAuthorities.map((a) => a.name);

  const nicknameMap = new Map<string, string>();
  [...shift.investigators, ...shift.authorities, ...shift.iseo].forEach((m) => {
    if (m.nickname && m.nickname.trim()) nicknameMap.set(m.name, m.nickname);
  });
  const displayLabel = (fullName: string) => nicknameMap.get(fullName) || fullName;

  const now = new Date();
  const availableInv = useMemo(() => getAvailableMembers(allInvestigators, now).map(m => m.name), [allInvestigators]);
  const availableAuth = useMemo(() => getAvailableMembers(allAuthorities, now).map(m => m.name), [allAuthorities]);

  // Predictive queue (next 5 for each role) — usa só completed para carga real
  const predictedInv = useMemo(
    () => predictQueue(allInvestigators, completed, pendingQueue, "investigator", 5, now),
    [allInvestigators, completed, pendingQueue],
  );
  const predictedAuth = useMemo(
    () => predictQueue(allAuthorities, completed, pendingQueue, "authority", 5, now),
    [allAuthorities, completed, pendingQueue],
  );

  const suggestedInvestigator = predictedInv[0] || "";
  const suggestedAuthority = predictedAuth[0] || "";

  const addToQueue = () => {
    const bu = normBu(newBu);
    if (!bu) { toast.error("Informe o número do BU"); return; }
    if (findInPending(bu)) { toast.error(`BU ${bu} já está em distribuição.`); return; }
    const dup = findExistingBu(bu);
    if (dup) {
      const where = dup.status === "em_atendimento" ? "em distribuição" : "já atendida";
      toast.error(`BU ${bu} já está ${where} neste plantão.`);
      return;
    }

    const nextInv = predictQueue(allInvestigators, completed, pendingQueue, "investigator", 1, now)[0] || "";
    const nextAuth = predictQueue(allAuthorities, completed, pendingQueue, "authority", 1, now)[0] || "";

    const timeVal = newTime || new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    setPendingQueue((prev) => [
      ...prev,
      { bu_number: bu, tramitation_time: timeVal, investigator: nextInv, authority: nextAuth },
    ]);
    setNewBu("");
    setNewTime("");
  };

  const removePending = (idx: number) => {
    setPendingQueue((prev) => prev.filter((_, i) => i !== idx));
    setSkippedInvByIdx((prev) => { const c = { ...prev }; delete c[idx]; return c; });
    setSkippedAuthByIdx((prev) => { const c = { ...prev }; delete c[idx]; return c; });
  };

  const skipPendingInv = (idx: number) => {
    setPendingQueue((prev) => {
      const item = prev[idx];
      if (!item) return prev;
      const skipped = [...(skippedInvByIdx[idx] || []), item.investigator].filter(Boolean);
      setSkippedInvByIdx((s) => ({ ...s, [idx]: skipped }));
      const next = nextSkipping(allInvestigators, item.investigator, now, skipped);
      return prev.map((p, i) => i === idx ? { ...p, investigator: next } : p);
    });
  };
  const skipPendingAuth = (idx: number) => {
    setPendingQueue((prev) => {
      const item = prev[idx];
      if (!item) return prev;
      const skipped = [...(skippedAuthByIdx[idx] || []), item.authority].filter(Boolean);
      setSkippedAuthByIdx((s) => ({ ...s, [idx]: skipped }));
      const next = nextSkipping(allAuthorities, item.authority, now, skipped);
      return prev.map((p, i) => i === idx ? { ...p, authority: next } : p);
    });
  };

  const registerPending = (item: PendingItem) => {
    const today = shift.shift_date;
    const isoTime = new Date(`${today}T${item.tramitation_time}`).toISOString();
    setForm({
      ...emptyForm(),
      bu_number: item.bu_number,
      tramitation_time: isoTime,
      investigator: item.investigator,
      authority: item.authority,
    });
    setEditingId(null);
    setShowForm(true);
  };

  const openNew = () => {
    setForm({ ...emptyForm(), investigator: suggestedInvestigator, authority: suggestedAuthority });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (occ: ShiftOccurrence) => {
    setForm(occ);
    setEditingId(occ.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    const bu = normBu(form.bu_number || "");
    if (!bu) { toast.error("Informe o número do BU"); return; }
    setSaving(true);
    try {
      if (editingId) {
        const updates = { ...form };
        if (isInAttendance) updates.status = "atendida";
        await onUpdate(editingId, updates);
        toast.success(isInAttendance ? "Atendimento concluído" : "Ocorrência atualizada");
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
          await onAdd({ ...form, bu_number: bu, status: "atendida", tramitation_time: form.tramitation_time || new Date().toISOString() });
          toast.success("Ocorrência registrada");
        }
        // Limpa pending + skip-state da posição
        setPendingQueue((prev) => {
          const idx = prev.findIndex((p) => normBu(p.bu_number) === bu);
          if (idx < 0) return prev;
          setSkippedInvByIdx((s) => { const c = { ...s }; delete c[idx]; return c; });
          setSkippedAuthByIdx((s) => { const c = { ...s }; delete c[idx]; return c; });
          return prev.filter((_, i) => i !== idx);
        });
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
    const next = nextSkipping(allInvestigators, occ.investigator || "", now);
    try { await onUpdate(occ.id, { investigator: next }); toast.success("OIP remanejado"); } catch { toast.error("Erro"); }
  };
  const handleSkipAuth = async (occ: ShiftOccurrence) => {
    const next = nextSkipping(allAuthorities, occ.authority || "", now);
    try { await onUpdate(occ.id, { authority: next }); toast.success("Autoridade remanejada"); } catch { toast.error("Erro"); }
  };

  const handleInlineChange = async (occId: string, field: "investigator" | "authority", value: string) => {
    try { await onUpdate(occId, { [field]: value }); } catch { toast.error("Erro ao atualizar"); }
  };

  const set = (key: keyof ShiftOccurrence, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const fmtTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "—";

  return (
    <div className="space-y-4">
      <Tabs defaultValue="distribuicao" className="w-full">
        <TabsList>
          <TabsTrigger value="distribuicao">Em Distribuição ({pendingQueue.length + inAttendance.length})</TabsTrigger>
          <TabsTrigger value="atendidas">Já Atendidas ({completed.length})</TabsTrigger>
        </TabsList>

        {/* ── Aba: Em Distribuição ── */}
        <TabsContent value="distribuicao" className="space-y-4 mt-4">
          {shift.status === "active" && (
            <Card className="border-primary/20 bg-accent/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Fila Preditiva — Disponíveis Agora
                  <Badge variant="outline" className="ml-2 gap-1 font-normal">
                    <Clock className="w-3 h-3" />
                    {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Round-robin entre quem está em janela ativa, ponderado por menor carga (ocorrências já atendidas). Empate segue a ordem de cadastro do plantão.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Próximos OIPs ({availableInv.length} disponível{availableInv.length !== 1 ? "is" : ""})</p>
                    <div className="flex flex-wrap gap-1.5">
                      {predictedInv.length > 0 ? predictedInv.map((n, i) => (
                        <Badge key={i} variant={i === 0 ? "default" : "secondary"} className="text-xs">
                          {i + 1}. {displayLabel(n)}
                        </Badge>
                      )) : <span className="text-xs text-muted-foreground">Nenhum OIP disponível neste horário</span>}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Próximas Autoridades ({availableAuth.length} disponível{availableAuth.length !== 1 ? "is" : ""})</p>
                    <div className="flex flex-wrap gap-1.5">
                      {predictedAuth.length > 0 ? predictedAuth.map((n, i) => (
                        <Badge key={i} variant={i === 0 ? "default" : "secondary"} className="text-xs">
                          {i + 1}. {displayLabel(n)}
                        </Badge>
                      )) : <span className="text-xs text-muted-foreground">Nenhuma Autoridade disponível neste horário</span>}
                    </div>
                  </div>
                </div>

                {/* Inline add */}
                <div className="flex gap-3 items-end pt-2 border-t border-border">
                  <div className="flex-1">
                    <Label className="text-sm font-medium">Nº BU</Label>
                    <Input value={newBu} onChange={(e) => setNewBu(e.target.value)} placeholder="99999999" className="h-10 text-sm"
                      onKeyDown={(e) => { if (e.key === "Enter") addToQueue(); }} />
                  </div>
                  <div className="w-[160px]">
                    <Label className="text-sm font-medium">Horário</Label>
                    <Input type="time" step="1" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="h-10 text-sm" />
                  </div>
                  <Button size="default" variant="outline" onClick={addToQueue} className="h-10 gap-2 shrink-0">
                    <Plus className="w-4 h-4" /> Adicionar à Fila
                  </Button>
                </div>

                {/* Pending */}
                {pendingQueue.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Aguardando registro ({pendingQueue.length})</p>
                    {pendingQueue.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-background rounded-lg px-3 py-2 border border-border flex-wrap">
                        <span className="font-mono font-bold text-sm min-w-[90px]">{item.bu_number}</span>
                        <span className="text-xs text-muted-foreground min-w-[70px]">{item.tramitation_time}</span>
                        <div className="flex items-center gap-1">
                          <Select value={item.investigator} onValueChange={(v) => setPendingQueue((prev) => prev.map((p, i) => i === idx ? { ...p, investigator: v } : p))}>
                            <SelectTrigger className="h-9 text-sm w-[150px]"><SelectValue placeholder="OIP" /></SelectTrigger>
                            <SelectContent>{investigatorNames.map((n) => <SelectItem key={n} value={n}>{displayLabel(n)}</SelectItem>)}</SelectContent>
                          </Select>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Pular OIP" onClick={() => skipPendingInv(idx)}>
                            <SkipForward className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-1">
                          <Select value={item.authority} onValueChange={(v) => setPendingQueue((prev) => prev.map((p, i) => i === idx ? { ...p, authority: v } : p))}>
                            <SelectTrigger className="h-9 text-sm w-[150px]"><SelectValue placeholder="Autoridade" /></SelectTrigger>
                            <SelectContent>{authorityNames.map((n) => <SelectItem key={n} value={n}>{displayLabel(n)}</SelectItem>)}</SelectContent>
                          </Select>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Pular Autoridade" onClick={() => skipPendingAuth(idx)}>
                            <SkipForward className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <div className="flex gap-1 ml-auto shrink-0">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Registrar" onClick={() => registerPending(item)}>
                            <Send className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Remover" onClick={() => removePending(idx)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Em Atendimento (vindos da análise/IA, aguardando preenchimento) */}
          {inAttendance.length > 0 && (
            <Card className="border-primary/40 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  Em Atendimento ({inAttendance.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {inAttendance.map((occ) => (
                  <div key={occ.id} className="flex items-center gap-2 bg-background rounded-lg px-3 py-2 border border-border flex-wrap">
                    <Badge variant="outline" className="border-primary/60 text-primary text-xs shrink-0">
                      Em atendimento
                    </Badge>
                    <span className="font-mono font-bold text-sm min-w-[90px]">{occ.bu_number || "—"}</span>
                    <span className="text-xs text-muted-foreground min-w-[70px]">{fmtTime(occ.tramitation_time)}</span>
                    {occ.regional && <span className="text-xs text-muted-foreground truncate max-w-[160px]">{occ.regional}</span>}
                    <div className="flex items-center gap-1">
                      <Select value={occ.investigator || ""} onValueChange={(v) => handleInlineChange(occ.id, "investigator", v)}>
                        <SelectTrigger className="h-9 text-sm w-[150px]"><SelectValue placeholder="OIP" /></SelectTrigger>
                        <SelectContent>{investigatorNames.map((n) => <SelectItem key={n} value={n}>{displayLabel(n)}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Pular OIP" onClick={() => handleSkipInv(occ)}>
                        <SkipForward className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-1">
                      <Select value={occ.authority || ""} onValueChange={(v) => handleInlineChange(occ.id, "authority", v)}>
                        <SelectTrigger className="h-9 text-sm w-[150px]"><SelectValue placeholder="Autoridade" /></SelectTrigger>
                        <SelectContent>{authorityNames.map((n) => <SelectItem key={n} value={n}>{displayLabel(n)}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Pular Autoridade" onClick={() => handleSkipAuth(occ)}>
                        <SkipForward className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="flex gap-1 ml-auto shrink-0">
                      <Button variant="default" size="sm" className="h-8 gap-1" title="Continuar atendimento" onClick={() => openEdit(occ)}>
                        <Edit className="w-3.5 h-3.5" /> Continuar
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Remover" onClick={() => onDelete(occ.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end">
            {shift.status === "active" && (
              <Button size="default" onClick={openNew} className="gap-2">
                <Plus className="w-4 h-4" /> Registrar Manualmente
              </Button>
            )}
          </div>
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
                    <td className="p-2.5">{fmtTime(occ.tramitation_time)}</td>
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
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(occ.id)}><Trash2 className="w-4 h-4" /></Button>
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
              <div><Label className="text-sm">Nº BU</Label><Input value={form.bu_number || ""} onChange={(e) => set("bu_number", e.target.value)} placeholder="99999999" /></div>
              <div>
                <Label className="text-sm">Tipo Procedimento</Label>
                <Select value={form.procedure_type || ""} onValueChange={(v) => set("procedure_type", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{PROCEDURE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Tipo 2 (opcional)</Label>
                <Select value={form.procedure_type_2 || "__none__"} onValueChange={(v) => set("procedure_type_2", v === "__none__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent><SelectItem value="__none__">Nenhum</SelectItem>{PROCEDURE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Tipo 3 (opcional)</Label>
                <Select value={form.procedure_type_3 || "__none__"} onValueChange={(v) => set("procedure_type_3", v === "__none__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent><SelectItem value="__none__">Nenhum</SelectItem>{PROCEDURE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">OIP</Label>
                <Select value={form.investigator || ""} onValueChange={(v) => set("investigator", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{investigatorNames.map((n) => <SelectItem key={n} value={n}>{displayLabel(n)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Autoridade</Label>
                <Select value={form.authority || ""} onValueChange={(v) => set("authority", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{authorityNames.map((n) => <SelectItem key={n} value={n}>{displayLabel(n)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-sm">Regional</Label>
              <Select value={form.regional || ""} onValueChange={(v) => set("regional", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{REGIONALS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={form.has_report || false} onCheckedChange={(v) => set("has_report", v)} />
                <Label className="text-sm">Relatório</Label>
              </div>
              <div>
                <Label className="text-sm">Oitivas</Label>
                <div className="flex items-center gap-1 h-10 border border-input rounded-md px-2 bg-background">
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => set("num_hearings", Math.max(0, (form.num_hearings || 0) - 1))} disabled={!form.num_hearings}>
                    <span className="text-base leading-none">−</span>
                  </Button>
                  <span className="font-mono w-8 text-center text-sm">{form.num_hearings || 0}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => set("num_hearings", (form.num_hearings || 0) + 1)}>
                    <span className="text-base leading-none">+</span>
                  </Button>
                </div>
              </div>
            </div>
            <div><Label className="text-sm">Conduzido(s) / Autuado(s)</Label><Input value={form.conducted_names || ""} onChange={(e) => set("conducted_names", e.target.value)} /></div>
            <div><Label className="text-sm">Vítima(s)</Label><Input value={form.victim_names || ""} onChange={(e) => set("victim_names", e.target.value)} /></div>
            <div><Label className="text-sm">Tipificação</Label><Input value={form.tipification || ""} onChange={(e) => set("tipification", e.target.value)} placeholder="Art. 33 da Lei 11.343/06" /></div>
            <div><Label className="text-sm">Status PO</Label><Input value={form.po_status || ""} onChange={(e) => set("po_status", e.target.value)} placeholder="Anexado, tramitado e comunicado" /></div>
            <div><Label className="text-sm">Observações</Label><Textarea value={form.observations || ""} onChange={(e) => set("observations", e.target.value)} rows={2} /></div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving
                ? "Salvando..."
                : editingId
                  ? (isInAttendance ? "Concluir Atendimento" : "Atualizar")
                  : "Registrar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
