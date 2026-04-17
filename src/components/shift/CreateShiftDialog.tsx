import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { ShiftMember, ShiftAbsence, ShiftSubteam } from "@/types/shift";
import { AbsenceSelector } from "./AbsenceSelector";
import { SubteamComposer, flattenSubteams } from "./SubteamComposer";
import { TEAM_NAMES } from "./shiftConstants";
import { useAllShiftMembers } from "@/hooks/useTeamMembers";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (params: {
    team_name: string;
    shift_date: string;
    start_time: string;
    end_time?: string;
    iseo: ShiftMember[];
    absences?: ShiftAbsence[];
    oip_subteams: ShiftSubteam[];
    delegado_subteams: ShiftSubteam[];
    iseo_subteams: ShiftSubteam[];
  }) => Promise<unknown>;
}

const OIP_CARGOS = ["OIP"];
const DELEGADO_CARGOS = ["Autoridade Policial", "Delegado", "Autoridade"];
const ISEO_CARGOS = ["OIP", "Autoridade Policial", "Delegado", "Autoridade"];

export function CreateShiftDialog({ open, onOpenChange, onCreate }: Props) {
  const [teamName, setTeamName] = useState("");
  const [shiftDate, setShiftDate] = useState(new Date().toISOString().split("T")[0]);
  const [startHour, setStartHour] = useState("10:00");
  const [saving, setSaving] = useState(false);
  const [oipSubteams, setOipSubteams] = useState<ShiftSubteam[]>([]);
  const [delSubteams, setDelSubteams] = useState<ShiftSubteam[]>([]);
  const [iseoSubteams, setIseoSubteams] = useState<ShiftSubteam[]>([]);
  const [absences, setAbsences] = useState<ShiftAbsence[]>([]);

  const { users } = useAllShiftMembers(open);

  const flatOip = flattenSubteams(oipSubteams);
  const flatDel = flattenSubteams(delSubteams);
  const flatIseo = flattenSubteams(iseoSubteams);
  const allSelectedNames = [
    ...flatOip.map((m) => m.name),
    ...flatDel.map((m) => m.name),
    ...flatIseo.map((m) => m.name),
  ];

  const handleCreate = async () => {
    if (!teamName.trim()) {
      toast.error("Selecione a equipe");
      return;
    }
    setSaving(true);
    try {
      const startTime = new Date(`${shiftDate}T${startHour}:00`).toISOString();
      const endDate = new Date(`${shiftDate}T${startHour}:00`);
      endDate.setHours(endDate.getHours() + 24);
      const endTime = endDate.toISOString();
      await onCreate({
        team_name: teamName,
        shift_date: shiftDate,
        start_time: startTime,
        end_time: endTime,
        iseo: flatIseo,
        absences,
        oip_subteams: oipSubteams,
        delegado_subteams: delSubteams,
        iseo_subteams: iseoSubteams,
      });
      toast.success("Plantão criado com sucesso!");
      onOpenChange(false);
      setTeamName("");
      setOipSubteams([]);
      setDelSubteams([]);
      setIseoSubteams([]);
      setAbsences([]);
    } catch {
      toast.error("Erro ao criar plantão");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Plantão</DialogTitle>
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
          <div>
            <Label>Horário de Início</Label>
            <Input type="time" value={startHour} onChange={(e) => setStartHour(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">Término padrão: +24h</p>
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

          <Button onClick={handleCreate} disabled={saving} className="w-full">
            {saving ? "Criando..." : "Criar Plantão"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
