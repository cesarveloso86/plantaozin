import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus } from "lucide-react";
import type { ShiftAbsence } from "@/types/shift";
import { ABSENCE_REASONS } from "./shiftConstants";

interface Props {
  absences: ShiftAbsence[];
  setAbsences: (absences: ShiftAbsence[]) => void;
  /** Todos os servidores cadastrados na unidade (não apenas os escalados). */
  availableNames: string[];
}

export function AbsenceSelector({ absences, setAbsences, availableNames }: Props) {
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");

  const add = () => {
    if (!name || !reason) return;
    setAbsences([...absences, { name, reason }]);
    setName("");
    setReason("");
  };

  const remove = (idx: number) => {
    setAbsences(absences.filter((_, i) => i !== idx));
  };

  const absentNames = absences.map((a) => a.name);
  const available = availableNames.filter((m) => !absentNames.includes(m));

  return (
    <div>
      <Label className="text-sm font-semibold">Registro de Ausências</Label>
      <p className="text-xs text-muted-foreground mb-1">Qualquer servidor da unidade pode ser marcado como ausente, mesmo se não estiver escalado.</p>
      <div className="flex gap-2 mt-1">
        <Select value={name} onValueChange={setName}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder={available.length > 0 ? "Servidor" : "Nenhum disponível"} />
          </SelectTrigger>
          <SelectContent>
            {available.length > 0
              ? available.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)
              : <SelectItem value="__empty" disabled>Nenhum servidor disponível</SelectItem>}
          </SelectContent>
        </Select>
        <Select value={reason} onValueChange={setReason}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Motivo" />
          </SelectTrigger>
          <SelectContent>
            {ABSENCE_REASONS.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" size="icon" variant="outline" onClick={add} disabled={!name || !reason || available.length === 0}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      {absences.length > 0 && (
        <div className="mt-2 space-y-1">
          {absences.map((a, i) => (
            <div key={i} className="flex items-center gap-2 text-sm bg-muted/50 rounded px-2 py-1">
              <span className="flex-1">{a.name} — <span className="text-muted-foreground">{a.reason}</span></span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => remove(i)}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
