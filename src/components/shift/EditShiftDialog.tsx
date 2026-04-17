import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { Shift, ShiftMember, ShiftAbsence, ShiftSubteam } from "@/types/shift";
import { AbsenceSelector } from "./AbsenceSelector";
import { SubteamComposer, flattenSubteams } from "./SubteamComposer";
import { TEAM_NAMES } from "./shiftConstants";
import { useAllShiftMembers } from "@/hooks/useTeamMembers";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift: Shift;
  onUpdate: (updates: Partial<Pick<Shift, "team_name" | "shift_date" | "start_time" | "end_time" | "iseo" | "absences" | "oip_subteams" | "delegado_subteams" | "iseo_subteams">>) => Promise<void>;
}

const OIP_CARGOS = ["OIP"];
const DELEGADO_CARGOS = ["Autoridade Policial", "Delegado", "Autoridade"];
const ISEO_CARGOS = ["OIP", "Autoridade Policial", "Delegado", "Autoridade"];

export function EditShiftDialog({ open, onOpenChange, shift, onUpdate }: Props) {
  const [teamName, setTeamName] = useState(shift.team_name);
  const [shiftDate, setShiftDate] = useState(shift.shift_date);
  const [startHour, setStartHour] = useState(
    new Date(shift.start_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false })
  );
  const [endHour, setEndHour] = useState(
    shift.end_time
      ? new Date(shift.end_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false })
      : ""
  );
  const [saving, setSaving] = useState(false);
  const [oipSubteams, setOipSubteams] = useState<ShiftSubteam[]>(shift.oip_subteams || []);
  const [delSubteams, setDelSubteams] = useState<ShiftSubteam[]>(shift.delegado_subteams || []);
  const [iseoSubteams, setIseoSubteams] = useState<ShiftSubteam[]>(shift.iseo_subteams || []);
  const [absences, setAbsences] = useState<ShiftAbsence[]>(shift.absences || []);

  const { users } = useAllShiftMembers(open);

  useEffect(() => {
    if (!open) return;
    setTeamName(shift.team_name);
    setShiftDate(shift.shift_date);
    setStartHour(new Date(shift.start_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false }));
    setEndHour(shift.end_time ? new Date(shift.end_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false }) : "");
    setOipSubteams(shift.oip_subteams || []);
    setDelSubteams(shift.delegado_subteams || []);
    setIseoSubteams(shift.iseo_subteams || []);
    setAbsences(shift.absences || []);
  }, [open, shift]);

  const flatOip = flattenSubteams(oipSubteams);
  const flatDel = flattenSubteams(delSubteams);
  const flatIseo = flattenSubteams(iseoSubteams);
  const allSelectedNames = [
    ...flatOip.map((m) => m.name),
    ...flatDel.map((m) => m.name),
    ...flatIseo.map((m) => m.name),
  ];

  const handleSave = async () => {
    if (!teamName.trim()) { toast.error("Selecione a equipe"); return; }
    setSaving(true);
    try {
      const startTime = new Date(`${shiftDate}T${startHour}:00`).toISOString();
      let endTime: string | undefined;
      if (endHour) {
        const end = new Date(`${shiftDate}T${endHour}:00`);
        if (end <= new Date(`${shiftDate}T${startHour}:00`)) {
          end.setDate(end.getDate() + 1);
        }
        endTime = end.toISOString();
      }
      await onUpdate({
        team_name: teamName,
        shift_date: shiftDate,
        start_time: startTime,
        end_time: endTime || null,
        iseo: flatIseo,
        absences,
        oip_subteams: oipSubteams,
        delegado_subteams: delSubteams,
        iseo_subteams: iseoSubteams,
      });
      toast.success("Plantão atualizado!");
      onOpenChange(false);
    } catch {
      toast.error("Erro ao atualizar plantão");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Plantão</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Equipe</Label>
              <Select value={teamName} onValueChange={setTeamName}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar equipe..." />
                </SelectTrigger>
                <SelectContent>
                  {TEAM_NAMES.map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={shiftDate} onChange={(e) => setShiftDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Horário de Início</Label>
              <Input type="time" value={startHour} onChange={(e) => setStartHour(e.target.value)} />
            </div>
            <div>
              <Label>Horário de Término</Label>
              <Input type="time" value={endHour} onChange={(e) => setEndHour(e.target.value)} placeholder="Padrão: +24h" />
            </div>
          </div>

          <SubteamComposer
            category="OIP"
            title="Subequipes de OIPs"
            subteams={oipSubteams}
            setSubteams={setOipSubteams}
            users={users}
            allSelectedNames={allSelectedNames}
            allowedCargos={OIP_CARGOS}
          />

          <SubteamComposer
            category="Delegado"
            title="Subequipes de Delegados"
            subteams={delSubteams}
            setSubteams={setDelSubteams}
            users={users}
            allSelectedNames={allSelectedNames}
            allowedCargos={DELEGADO_CARGOS}
          />

          <SubteamComposer
            category="ISEO"
            title="Subequipes ISEO (8h, qualquer cargo)"
            subteams={iseoSubteams}
            setSubteams={setIseoSubteams}
            users={users}
            allSelectedNames={allSelectedNames}
            allowedCargos={ISEO_CARGOS}
          />

          <AbsenceSelector
            absences={absences}
            setAbsences={setAbsences}
            scheduledMembers={allSelectedNames}
          />

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
