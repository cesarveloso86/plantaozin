import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Edit, SkipForward, Send, Users, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import type { Shift, ShiftOccurrence } from "@/types/shift";
import { PROCEDURE_TYPES, REGIONALS } from "@/types/shift";
import { Switch } from "@/components/ui/switch";

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

function getNextRoundRobin(members: string[], occurrences: ShiftOccurrence[], pending: PendingItem[], field: "investigator" | "authority"): string {
  if (members.length === 0) return "";
  const counts: Record<string, number> = {};
  members.forEach((m) => (counts[m] = 0));
  occurrences.forEach((o) => {
    const val = o[field];
    if (val && counts[val] !== undefined) counts[val]++;
  });
  pending.forEach((p) => {
    const val = p[field];
    if (val && counts[val] !== undefined) counts[val]++;
  });
  let min = Infinity;
  let pick = members[0];
  for (const m of members) {
    if (counts[m] < min) { min = counts[m]; pick = m; }
  }
  return pick;
}

function getNextInList(members: string[], current: string): string {
  if (members.length === 0) return "";
  const idx = members.indexOf(current);
  return members[(idx + 1) % members.length];
}

export function OccurrencesTab({ shift, occurrences, onAdd, onUpdate, onDelete }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<ShiftOccurrence>>(emptyForm());
  const [saving, setSaving] = useState(false);

  // Staging queue
  const [pendingQueue, setPendingQueue] = useState<PendingItem[]>([]);
  const [newBu, setNewBu] = useState("");
  const [newTime, setNewTime] = useState("");

  const investigators = shift.investigators.map((i) => i.name);
  const authorities = shift.authorities.map((a) => a.name);

  const suggestedInvestigator = useMemo(
    () => getNextRoundRobin(investigators, occurrences, pendingQueue, "investigator"),
    [investigators, occurrences, pendingQueue]
  );
  const suggestedAuthority = useMemo(
    () => getNextRoundRobin(authorities, occurrences, pendingQueue, "authority"),
    [authorities, occurrences, pendingQueue]
  );

  // --- Staging queue actions ---
  const addToQueue = () => {
    if (!newBu.trim()) { toast.error("Informe o número do BU"); return; }
    if (pendingQueue.some((p) => p.bu_number === newBu.trim()) || occurrences.some((o) => o.bu_number === newBu.trim())) {
      toast.error("BU já existe na fila ou nas ocorrências");
      return;
    }

    const currentSuggestedInvestigator = getNextRoundRobin(investigators, occurrences, pendingQueue, "investigator");
    const currentSuggestedAuthority = getNextRoundRobin(authorities, occurrences, pendingQueue, "authority");

    const timeVal = newTime || new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    setPendingQueue((prev) => [
      ...prev,
      { bu_number: newBu.trim(), tramitation_time: timeVal, investigator: currentSuggestedInvestigator, authority: currentSuggestedAuthority },
    ]);
    setNewBu("");
    setNewTime("");
  };

  const removePending = (idx: number) => {
    setPendingQueue((prev) => prev.filter((_, i) => i !== idx));
  };

  const skipPending = (idx: number) => {
    setPendingQueue((prev) =>
      prev.map((p, i) =>
        i === idx
          ? { ...p, investigator: getNextInList(investigators, p.investigator), authority: getNextInList(authorities, p.authority) }
          : p
      )
    );
  };

  const registerPending = (item: PendingItem) => {
    const today = shift.shift_date;
    const isoTime = new Date(`${today}T${item.tramitation_time}:00`).toISOString();
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

  const mergeOrCreate = async (data: Partial<ShiftOccurrence>) => {
    if (!data.bu_number) return;
    const existing = occurrences.find((o) => o.bu_number === data.bu_number);
    if (existing) {
      const mergeFields: Partial<ShiftOccurrence> = {};
      if (data.tipification && !existing.tipification) mergeFields.tipification = data.tipification;
      if (data.conducted_names && !existing.conducted_names) mergeFields.conducted_names = data.conducted_names;
      if (data.victim_names && !existing.victim_names) mergeFields.victim_names = data.victim_names;
      if (data.suspect_names && !existing.suspect_names) mergeFields.suspect_names = data.suspect_names;
      if (data.procedure_type && !existing.procedure_type) mergeFields.procedure_type = data.procedure_type;
      if (data.regional && !existing.regional) mergeFields.regional = data.regional;
      if (data.observations && !existing.observations) mergeFields.observations = data.observations;
      if (data.po_status && !existing.po_status) mergeFields.po_status = data.po_status;
      if (Object.keys(mergeFields).length > 0) {
        await onUpdate(existing.id, mergeFields);
        toast.success(`BU ${data.bu_number} mesclado com dados da análise`);
      } else {
        toast.info(`BU ${data.bu_number} já possui todos os dados`);
      }
    } else {
      const pendingIdx = pendingQueue.findIndex((p) => p.bu_number === data.bu_number);
      if (pendingIdx >= 0) {
        const pending = pendingQueue[pendingIdx];
        const isoTime = new Date(`${shift.shift_date}T${pending.tramitation_time}:00`).toISOString();
        await onAdd({
          ...data,
          tramitation_time: isoTime,
          investigator: pending.investigator,
          authority: pending.authority,
        });
        setPendingQueue((prev) => prev.filter((_, i) => i !== pendingIdx));
        toast.success(`BU ${data.bu_number} registrado da fila com dados da análise`);
      } else {
        await onAdd({
          ...data,
          tramitation_time: new Date().toISOString(),
          investigator: suggestedInvestigator,
          authority: suggestedAuthority,
        });
        toast.success("Ocorrência criada via análise");
      }
    }
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
    if (!form.bu_number?.trim()) { toast.error("Informe o número do BU"); return; }
    setSaving(true);
    try {
      if (editingId) {
        await onUpdate(editingId, form);
        toast.success("Ocorrência atualizada");
      } else {
        const existing = occurrences.find((o) => o.bu_number === form.bu_number);
        if (existing) {
          const mergeFields: Partial<ShiftOccurrence> = { ...form };
          delete mergeFields.tramitation_time;
          delete mergeFields.investigator;
          delete mergeFields.authority;
          await onUpdate(existing.id, mergeFields);
          toast.success(`BU ${form.bu_number} mesclado`);
        } else {
          await onAdd({ ...form, tramitation_time: form.tramitation_time || new Date().toISOString() });
          toast.success("Ocorrência registrada");
        }
        setPendingQueue((prev) => prev.filter((p) => p.bu_number !== form.bu_number));
      }
      setShowForm(false);
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async (occ: ShiftOccurrence) => {
    const nextInv = getNextInList(investigators, occ.investigator || "");
    const nextAuth = getNextInList(authorities, occ.authority || "");
    try {
      await onUpdate(occ.id, { investigator: nextInv, authority: nextAuth });
      toast.success("Dupla remanejada");
    } catch { toast.error("Erro ao pular vez"); }
  };

  const handleInlineChange = async (occId: string, field: "investigator" | "authority", value: string) => {
    try { await onUpdate(occId, { [field]: value }); } catch { toast.error("Erro ao atualizar"); }
  };

  const set = (key: keyof ShiftOccurrence, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-6">
      {/* ── Fila de Distribuição ── */}
      {shift.status === "active" && (
        <Card className="border-primary/20 bg-accent/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Fila de Distribuição
              </CardTitle>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Próxima dupla:</span>
                <Badge variant="default" className="text-sm px-3 py-1">{suggestedInvestigator || "—"}</Badge>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <Badge variant="secondary" className="text-sm px-3 py-1">{suggestedAuthority || "—"}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Inline add */}
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Label className="text-sm font-medium">Nº BU</Label>
                <Input value={newBu} onChange={(e) => setNewBu(e.target.value)} placeholder="99999999" className="h-10 text-sm"
                  onKeyDown={(e) => { if (e.key === "Enter") addToQueue(); }} />
              </div>
              <div className="w-[140px]">
                <Label className="text-sm font-medium">Horário</Label>
                <Input type="time" step="1" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="h-10 text-sm" />
              </div>
              <Button size="default" variant="outline" onClick={addToQueue} className="h-10 gap-2 shrink-0">
                <Plus className="w-4 h-4" /> Adicionar à Fila
              </Button>
            </div>

            {/* Pending items */}
            {pendingQueue.length > 0 && (
              <div className="space-y-2 max-h-[280px] overflow-y-auto">
                <p className="text-sm font-medium text-muted-foreground">Na fila ({pendingQueue.length})</p>
                {pendingQueue.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-background rounded-lg px-4 py-3 border border-border shadow-sm">
                    <span className="font-mono font-bold text-base min-w-[90px]">{item.bu_number}</span>
                    <span className="text-sm text-muted-foreground min-w-[50px]">{item.tramitation_time}</span>
                    <Select value={item.investigator} onValueChange={(v) => setPendingQueue((prev) => prev.map((p, i) => i === idx ? { ...p, investigator: v } : p))}>
                      <SelectTrigger className="h-9 text-sm w-[160px]"><SelectValue placeholder="OIP" /></SelectTrigger>
                      <SelectContent>{investigators.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={item.authority} onValueChange={(v) => setPendingQueue((prev) => prev.map((p, i) => i === idx ? { ...p, authority: v } : p))}>
                      <SelectTrigger className="h-9 text-sm w-[160px]"><SelectValue placeholder="Autoridade" /></SelectTrigger>
                      <SelectContent>{authorities.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                    </Select>
                    <div className="flex gap-1 ml-auto shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Pular Vez" onClick={() => skipPending(idx)}>
                        <SkipForward className="w-4 h-4" />
                      </Button>
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

            {/* Recent registered occurrences */}
            {occurrences.length > 0 && (
              <div className="space-y-2 max-h-[220px] overflow-y-auto border-t border-border pt-3 mt-3">
                <p className="text-sm font-medium text-muted-foreground">Últimas registradas</p>
                {occurrences.slice().reverse().slice(0, 5).map((occ) => (
                  <div key={occ.id} className="flex items-center gap-3 bg-background rounded-lg px-4 py-2.5 border border-border">
                    <span className="font-mono font-bold text-sm min-w-[90px]">{occ.bu_number}</span>
                    <span className="text-sm text-muted-foreground min-w-[50px]">
                      {occ.tramitation_time ? new Date(occ.tramitation_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                    </span>
                    <Select value={occ.investigator || ""} onValueChange={(v) => handleInlineChange(occ.id, "investigator", v)}>
                      <SelectTrigger className="h-9 text-sm w-[160px]"><SelectValue placeholder="OIP" /></SelectTrigger>
                      <SelectContent>{investigators.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={occ.authority || ""} onValueChange={(v) => handleInlineChange(occ.id, "authority", v)}>
                      <SelectTrigger className="h-9 text-sm w-[160px]"><SelectValue placeholder="Autoridade" /></SelectTrigger>
                      <SelectContent>{authorities.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 ml-auto" title="Pular Vez" onClick={() => handleSkip(occ)}>
                      <SkipForward className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Tabela de Ocorrências ── */}
      <div className="flex justify-between items-center">
        <p className="text-base text-muted-foreground">{occurrences.length} ocorrência(s)</p>
        {shift.status === "active" && (
          <Button size="default" onClick={openNew} className="gap-2">
            <Plus className="w-4 h-4" /> Registrar
          </Button>
        )}
      </div>

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
              <th className="p-2.5 text-left font-medium text-muted-foreground">Obs</th>
              <th className="p-2.5 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {occurrences.map((occ) => (
              <tr key={occ.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                <td className="p-2.5 font-mono font-semibold">{occ.bu_number}</td>
                <td className="p-2.5">
                  {occ.tramitation_time ? new Date(occ.tramitation_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                </td>
                <td className="p-2.5">
                  <div className="flex gap-1 flex-wrap">
                    {occ.procedure_type && <Badge variant="secondary">{occ.procedure_type}</Badge>}
                    {occ.procedure_type_2 && <Badge variant="outline">{occ.procedure_type_2}</Badge>}
                  </div>
                </td>
                <td className="p-2.5 truncate max-w-[140px]">{occ.investigator || "—"}</td>
                <td className="p-2.5 truncate max-w-[120px]">{occ.authority || "—"}</td>
                <td className="p-2.5 truncate max-w-[160px]">{occ.regional || "—"}</td>
                <td className="p-2.5">{occ.has_report ? "SIM" : "NÃO"}</td>
                <td className="p-2.5 text-center">{occ.num_hearings}</td>
                <td className="p-2.5 truncate max-w-[140px] text-muted-foreground">{occ.observations || ""}</td>
                <td className="p-2.5">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(occ)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(occ.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
            {occurrences.length === 0 && (
              <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">Nenhuma ocorrência registrada ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-lg">{editingId ? "Editar Ocorrência" : "Nova Ocorrência"}</DialogTitle></DialogHeader>
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
                  <SelectContent>{investigators.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Autoridade</Label>
                <Select value={form.authority || ""} onValueChange={(v) => set("authority", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{authorities.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
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
                <Input type="number" min={0} value={form.num_hearings || 0} onChange={(e) => set("num_hearings", parseInt(e.target.value) || 0)} />
              </div>
            </div>
            <div><Label className="text-sm">Conduzido(s) / Autuado(s)</Label><Input value={form.conducted_names || ""} onChange={(e) => set("conducted_names", e.target.value)} /></div>
            <div><Label className="text-sm">Vítima(s)</Label><Input value={form.victim_names || ""} onChange={(e) => set("victim_names", e.target.value)} /></div>
            <div><Label className="text-sm">Tipificação</Label><Input value={form.tipification || ""} onChange={(e) => set("tipification", e.target.value)} placeholder="Art. 33 da Lei 11.343/06" /></div>
            <div><Label className="text-sm">Status PO</Label><Input value={form.po_status || ""} onChange={(e) => set("po_status", e.target.value)} placeholder="Anexado, tramitado e comunicado" /></div>
            <div><Label className="text-sm">Observações</Label><Textarea value={form.observations || ""} onChange={(e) => set("observations", e.target.value)} rows={2} /></div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Salvando..." : editingId ? "Atualizar" : "Registrar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
