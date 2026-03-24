import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Download, Plus, Lock, FileText, Sheet } from "lucide-react";
import { toast } from "sonner";
import type { Shift, ShiftOccurrence } from "@/types/shift";
import { REGIONALS } from "@/types/shift";

interface Props {
  shift: Shift;
  occurrences: ShiftOccurrence[];
  onAddObservation: (text: string) => Promise<void>;
  onCloseShift: () => Promise<void>;
}

export function ResumoTab({ shift, occurrences, onAddObservation, onCloseShift }: Props) {
  const [newObs, setNewObs] = useState("");
  const [closing, setClosing] = useState(false);

  const occByRegional = useMemo(() => {
    const grouped: Record<string, ShiftOccurrence[]> = {};
    occurrences.forEach((occ) => {
      const key = occ.regional || "Sem Regional";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(occ);
    });
    // Sort by regional order
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
    toast.info("Gerando DOCX... (funcionalidade em desenvolvimento)");
  };

  const handleExportXLSX = async () => {
    toast.info("Gerando XLSX... (funcionalidade em desenvolvimento)");
  };

  return (
    <div className="space-y-4">
      {/* Header info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Informações do Plantão</CardTitle>
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
                  <li key={i}>{a.name}</li>
                ))}
              </ul>
            </div>
          )}
          {shift.investigators.length > 0 && (
            <div>
              <strong>OIPs:</strong>
              <ul className="list-disc list-inside ml-2">
                {shift.investigators.map((inv, i) => (
                  <li key={i}>{inv.name}{inv.nf ? ` - NF ${inv.nf}` : ""}</li>
                ))}
              </ul>
            </div>
          )}
          {shift.iseo.length > 0 && (
            <div>
              <strong>ISEO:</strong>
              <ul className="list-disc list-inside ml-2">
                {shift.iseo.map((is, i) => (
                  <li key={i}>{is.name}{is.nf ? ` - NF ${is.nf}` : ""}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Observations */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Observações Administrativas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {shift.observations.length > 0 ? (
            <ol className="list-decimal list-inside text-sm space-y-1">
              {shift.observations.map((obs, i) => (
                <li key={i}>{obs}</li>
              ))}
            </ol>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhuma observação registrada.</p>
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
          <CardTitle className="text-sm">Prévia da PO — Ocorrências por Regional</CardTitle>
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
            <p className="text-xs text-muted-foreground">Nenhuma ocorrência para exibir.</p>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={handleExportDOCX} className="gap-2">
          <FileText className="w-4 h-4" /> Exportar PO (DOCX)
        </Button>
        <Button variant="outline" onClick={handleExportXLSX} className="gap-2">
          <Sheet className="w-4 h-4" /> Exportar Planilha (XLSX)
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
