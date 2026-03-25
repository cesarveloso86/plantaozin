import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Shift, ShiftMember } from "@/types/shift";
import { MemberSelector } from "./MemberSelector";
import { TEAM_NAMES } from "./shiftConstants";

interface UserProfile {
  id: string;
  full_name: string;
  nf: string | null;
  cargo: string | null;
  role: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift: Shift;
  onUpdate: (updates: Partial<Pick<Shift, "team_name" | "shift_date" | "start_time" | "end_time" | "authorities" | "investigators" | "iseo">>) => Promise<void>;
}

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
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [authorities, setAuthorities] = useState<ShiftMember[]>(shift.authorities);
  const [investigators, setInvestigators] = useState<ShiftMember[]>(shift.investigators);
  const [iseo, setIseo] = useState<ShiftMember[]>(shift.iseo);

  useEffect(() => {
    if (!open) return;
    setTeamName(shift.team_name);
    setShiftDate(shift.shift_date);
    setStartHour(new Date(shift.start_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false }));
    setEndHour(shift.end_time ? new Date(shift.end_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false }) : "");
    setAuthorities(shift.authorities);
    setInvestigators(shift.investigators);
    setIseo(shift.iseo);
    const load = async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, nf, cargo, role").order("full_name");
      setUsers((data as unknown as UserProfile[]) || []);
    };
    load();
  }, [open, shift]);

  const allSelectedNames = [
    ...authorities.map((m) => m.name),
    ...investigators.map((m) => m.name),
    ...iseo.map((m) => m.name),
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
        authorities,
        investigators,
        iseo,
      });
      toast.success("Plantão atualizado!");
      onOpenChange(false);
    } catch (err) {
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
          <MemberSelector label="Autoridades Policiais" members={authorities} setMembers={setAuthorities} users={users} allSelectedNames={allSelectedNames} filterFuncao="Autoridade Policial" />
          <MemberSelector label="OIPs — Oficiais Investigadores" members={investigators} setMembers={setInvestigators} users={users} allSelectedNames={allSelectedNames} filterFuncao="OIP" />
          <MemberSelector label="ISEO (opcional)" members={iseo} setMembers={setIseo} users={users} allSelectedNames={allSelectedNames} />
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
