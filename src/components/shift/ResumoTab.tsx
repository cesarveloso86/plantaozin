import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Lock, FileText, Sheet, Loader2, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import type { Shift, ShiftOccurrence } from "@/types/shift";
import { REGIONALS } from "@/types/shift";
import { exportPODocx } from "@/lib/exportDocx";
import { exportShiftXlsx } from "@/lib/exportXlsx";

interface Props {
  shift: Shift;
  occurrences: ShiftOccurrence[];
  onAddObservation: (text: string) => Promise<void>;
  onUpdateObservation?: (idx: number, text: string) => Promise<void>;
  onDeleteObservation?: (idx: number) => Promise<void>;
  onCloseShift: () => Promise<void>;
}

export function ResumoTab({ shift, occurrences, onAddObservation, onUpdateObservation, onDeleteObservation, onCloseShift }: Props) {
  const [newObs, setNewObs] = useState("");
  const [closing, setClosing] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const occByRegional = useMemo(() => {
    // Prévia da PO mostra somente ocorrências atendidas.
    const finalOccs = occurrences.filter((o) => o.status !== "em_atendimento");
    const grouped: Record<string, ShiftOccurrence[]> = {};
    finalOccs.forEach((occ) => {
      const key = occ.regional || "Sem Regional";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(occ);
    });
    const sorted: Record<string, ShiftOccurrence[]> = {};
    [...REGIONALS, "Sem Regional"].forEach((r) => {
      if (grouped[r]) sorted[r] = grouped[r];
    });
    return sorted;
  }, [occurrences]);

  const handleAddObs = async () => {
    if (!newObs.trim()) return;
    await onAddObservation(newObs.trim());
    setNewObs("");
    toast.success("Observação adicionada");
  };

  const startEdit = (idx: number, text: string) => {
    setEditingIdx(idx);
    setEditText(text);
  };

  const saveEdit = async () => {
    if (editingIdx === null || !onUpdateObservation) return;
    if (!editText.trim()) { toast.error("Texto vazio"); return; }
    await onUpdateObservation(editingIdx, editText.trim());
    toast.success("Observação atualizada");
    setEditingIdx(null);
    setEditText("");
  };

  const cancelEdit = () => {
    setEditingIdx(null);
    setEditText("");
  };

  const handleDelete = async (idx: number) => {
    if (!onDeleteObservation) return;
    await onDeleteObservation(idx);
    toast.success("Observação removida");
  };

  const handleClose = async () => {
    setClosing(true);
    try {
      await onCloseShift();
      toast.success("Plantão encerrado");
    } finally {
      setClosing(false);
    }
  };

  const handleExportDOCX = async () => {
    setExportingDocx(true);
    try {
      await exportPODocx(shift, occurrences);
      toast.success("PO exportada com sucesso!");
    } catch (err) {
      toast.error("Erro ao gerar DOCX");
      console.error(err);
    } finally {
      setExportingDocx(false);
    }
  };

  const handleExportXLSX = async () => {
    setExportingXlsx(true);
    try {
      await exportShiftXlsx(shift, occurrences);
      toast.success("Planilha exportada com sucesso!");
    } catch (err) {
      toast.error("Erro ao gerar XLSX");
      console.error(err);
    } finally {
      setExportingXlsx(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Informações do Plantão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><strong>Equipe:</strong> {shift.team_name}</p>
          <p>
            <strong>Período:</strong>{" "}
            {new Date(shift.start_time).toLocaleString("pt-BR")}
            {shift.end_time && ` até ${new Date(shift.end_time).toLocaleString("pt-BR")}`}
          </p>
          {shift.authorities.length > 0 && (
            <div>
              <strong>Autoridades:</strong>
              <ul className="list-disc list-inside ml-2">
                {shift.authorities.map((a, i) => (
                  <li key={i}>
                    {a.name}
                    {a.substituting && <span className="text-muted-foreground"> (substituindo {a.substituting})</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {shift.investigators.length > 0 && (
            <div>
              <strong>OIPs:</strong>
              <ul className="list-disc list-inside ml-2">
                {shift.investigators.map((inv, i) => (
                  <li key={i}>
                    {inv.name}{inv.nf ? ` - NF ${inv.nf}` : ""}
                    {inv.substituting && <span className="text-muted-foreground"> (substituindo {inv.substituting})</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {shift.iseo.length > 0 && (
            <div>
              <strong>ISEO:</strong>
              <ul className="list-disc list-inside ml-2">
                {shift.iseo.map((is, i) => (
                  <li key={i}>
                    {is.name}{is.nf ? ` - NF ${is.nf}` : ""}
                    {is.substituting && <span className="text-muted-foreground"> (substituindo {is.substituting})</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Observations */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Observações Administrativas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {shift.observations.length > 0 ? (
            <ol className="text-sm space-y-2">
              {shift.observations.map((obs, i) => (
                <li key={i} className="flex items-start gap-2 group">
                  <span className="text-muted-foreground shrink-0 mt-1.5">{i + 1}.</span>
                  {editingIdx === i ? (
                    <div className="flex-1 flex items-start gap-1.5">
                      <Textarea
                        rows={2}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="flex-1 text-sm"
                      />
                      <div className="flex flex-col gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit}>
                          <Check className="w-4 h-4 text-emerald-600" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="flex-1 leading-relaxed">{obs}</span>
                      {shift.status === "active" && onUpdateObservation && onDeleteObservation && (
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(i, obs)} title="Editar">
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(i)} title="Excluir">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma observação registrada.</p>
          )}
          {shift.status === "active" && (
            <div className="flex gap-2 pt-2">
              <Textarea
                rows={2}
                value={newObs}
                onChange={(e) => setNewObs(e.target.value)}
                placeholder="Adicionar observação..."
                className="flex-1"
              />
              <Button size="sm" onClick={handleAddObs} disabled={!newObs.trim()}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Occurrences by Regional (PO preview) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Prévia da PO — Ocorrências por Regional</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(occByRegional).map(([regional, occs]) => (
            <div key={regional}>
              <Badge variant="secondary" className="mb-2">{regional}</Badge>
              <ol className="list-decimal list-inside text-sm space-y-1.5 ml-1">
                {occs.map((occ) => (
                  <li key={occ.id}>
                    <span className="font-medium">{occ.procedure_type}</span>
                    {occ.procedure_type_2 && ` + ${occ.procedure_type_2}`}
                    {" "}BU {occ.bu_number}
                    {occ.po_status && ` - ${occ.po_status.toUpperCase()}`}
                    {occ.conducted_names && (
                      <><br /><span className="ml-5 text-muted-foreground">Conduzido(s): {occ.conducted_names}</span></>
                    )}
                    {occ.victim_names && (
                      <><br /><span className="ml-5 text-muted-foreground">Vítima(s): {occ.victim_names}</span></>
                    )}
                    {occ.tipification && (
                      <><br /><span className="ml-5 text-muted-foreground">Tipificação: {occ.tipification}</span></>
                    )}
                    {occ.observations && (
                      <><br /><span className="ml-5 text-muted-foreground italic">{occ.observations}</span></>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          ))}
          {Object.keys(occByRegional).length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma ocorrência para exibir.</p>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={handleExportDOCX} disabled={exportingDocx} className="gap-2">
          {exportingDocx ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          Exportar PO (DOCX)
        </Button>
        <Button variant="outline" onClick={handleExportXLSX} disabled={exportingXlsx} className="gap-2">
          {exportingXlsx ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sheet className="w-4 h-4" />}
          Exportar Planilha (XLSX)
        </Button>
        {shift.status === "active" && (
          <Button variant="destructive" onClick={handleClose} disabled={closing} className="gap-2 ml-auto">
            <Lock className="w-4 h-4" /> {closing ? "Encerrando..." : "Encerrar Plantão"}
          </Button>
        )}
      </div>
    </div>
  );
}
