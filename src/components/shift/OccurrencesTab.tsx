import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Edit, X } from "lucide-react";
import { toast } from "sonner";
import type { Shift, ShiftOccurrence } from "@/types/shift";
import { PROCEDURE_TYPES, REGIONALS } from "@/types/shift";
import { Switch } from "@/components/ui/switch";

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

export function OccurrencesTab({ shift, occurrences, onAdd, onUpdate, onDelete }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<ShiftOccurrence>>(emptyForm());
  const [saving, setSaving] = useState(false);

  const investigators = shift.investigators.map((i) => i.name);
  const authorities = shift.authorities.map((a) => a.name);

  const openNew = () => {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (occ: ShiftOccurrence) => {
    setForm(occ);
    setEditingId(occ.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.bu_number?.trim()) {
      toast.error("Informe o número do BU");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await onUpdate(editingId, form);
        toast.success("Ocorrência atualizada");
      } else {
        await onAdd({ ...form, tramitation_time: new Date().toISOString() });
        toast.success("Ocorrência registrada");
      }
      setShowForm(false);
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof ShiftOccurrence, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{occurrences.length} ocorrência(s)</p>
        {shift.status === "active" && (
          <Button size="sm" onClick={openNew} className="gap-1.5">
            <Plus className="w-4 h-4" /> Registrar
          </Button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="p-2 text-left font-medium text-muted-foreground">BU</th>
              <th className="p-2 text-left font-medium text-muted-foreground">Horário</th>
              <th className="p-2 text-left font-medium text-muted-foreground">Tipo</th>
              <th className="p-2 text-left font-medium text-muted-foreground">OIP</th>
              <th className="p-2 text-left font-medium text-muted-foreground">Autoridade</th>
              <th className="p-2 text-left font-medium text-muted-foreground">Regional</th>
              <th className="p-2 text-left font-medium text-muted-foreground">Rel.</th>
              <th className="p-2 text-left font-medium text-muted-foreground">Oitivas</th>
              <th className="p-2 text-left font-medium text-muted-foreground">Obs</th>
              <th className="p-2 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {occurrences.map((occ) => (
              <tr key={occ.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                <td className="p-2 font-mono text-xs">{occ.bu_number}</td>
                <td className="p-2 text-xs">
                  {occ.tramitation_time
                    ? new Date(occ.tramitation_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                    : "—"}
                </td>
                <td className="p-2">
                  <div className="flex gap-1 flex-wrap">
                    {occ.procedure_type && <Badge variant="secondary" className="text-[10px]">{occ.procedure_type}</Badge>}
                    {occ.procedure_type_2 && <Badge variant="outline" className="text-[10px]">{occ.procedure_type_2}</Badge>}
                  </div>
                </td>
                <td className="p-2 text-xs truncate max-w-[120px]">{occ.investigator || "—"}</td>
                <td className="p-2 text-xs truncate max-w-[100px]">{occ.authority || "—"}</td>
                <td className="p-2 text-xs truncate max-w-[140px]">{occ.regional || "—"}</td>
                <td className="p-2 text-xs">{occ.has_report ? "SIM" : "NÃO"}</td>
                <td className="p-2 text-xs text-center">{occ.num_hearings}</td>
                <td className="p-2 text-xs truncate max-w-[120px] text-muted-foreground">{occ.observations || ""}</td>
                <td className="p-2">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(occ)}>
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => onDelete(occ.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {occurrences.length === 0 && (
              <tr>
                <td colSpan={10} className="p-8 text-center text-muted-foreground text-sm">
                  Nenhuma ocorrência registrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Ocorrência" : "Nova Ocorrência"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nº BU</Label>
                <Input value={form.bu_number || ""} onChange={(e) => set("bu_number", e.target.value)} placeholder="60805037" />
              </div>
              <div>
                <Label>Tipo Procedimento</Label>
                <Select value={form.procedure_type || ""} onValueChange={(v) => set("procedure_type", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {PROCEDURE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo 2 (opcional)</Label>
                <Select value={form.procedure_type_2 || ""} onValueChange={(v) => set("procedure_type_2", v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum</SelectItem>
                    {PROCEDURE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo 3 (opcional)</Label>
                <Select value={form.procedure_type_3 || ""} onValueChange={(v) => set("procedure_type_3", v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum</SelectItem>
                    {PROCEDURE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>OIP</Label>
                <Select value={form.investigator || ""} onValueChange={(v) => set("investigator", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {investigators.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Autoridade</Label>
                <Select value={form.authority || ""} onValueChange={(v) => set("authority", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {authorities.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Regional</Label>
              <Select value={form.regional || ""} onValueChange={(v) => set("regional", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {REGIONALS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={form.has_report || false} onCheckedChange={(v) => set("has_report", v)} />
                <Label>Relatório</Label>
              </div>
              <div>
                <Label>Oitivas</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.num_hearings || 0}
                  onChange={(e) => set("num_hearings", parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
            <div>
              <Label>Conduzido(s) / Autuado(s)</Label>
              <Input value={form.conducted_names || ""} onChange={(e) => set("conducted_names", e.target.value)} />
            </div>
            <div>
              <Label>Vítima(s)</Label>
              <Input value={form.victim_names || ""} onChange={(e) => set("victim_names", e.target.value)} />
            </div>
            <div>
              <Label>Tipificação</Label>
              <Input value={form.tipification || ""} onChange={(e) => set("tipification", e.target.value)} placeholder="Art. 33 da Lei 11.343/06" />
            </div>
            <div>
              <Label>Status PO</Label>
              <Input value={form.po_status || ""} onChange={(e) => set("po_status", e.target.value)} placeholder="Anexado, tramitado e comunicado" />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={form.observations || ""} onChange={(e) => set("observations", e.target.value)} rows={2} />
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Salvando..." : editingId ? "Atualizar" : "Registrar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
