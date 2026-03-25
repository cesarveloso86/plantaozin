import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { ShiftMember } from "@/types/shift";
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
  onCreate: (params: {
    team_name: string;
    shift_date: string;
    start_time: string;
    end_time?: string;
    authorities: ShiftMember[];
    investigators: ShiftMember[];
    iseo: ShiftMember[];
  }) => Promise<any>;
}

export function CreateShiftDialog({ open, onOpenChange, onCreate }: Props) {
  const [teamName, setTeamName] = useState("");
  const [shiftDate, setShiftDate] = useState(new Date().toISOString().split("T")[0]);
  const [startHour, setStartHour] = useState("10:00");
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [authorities, setAuthorities] = useState<ShiftMember[]>([]);
  const [investigators, setInvestigators] = useState<ShiftMember[]>([]);
  const [iseo, setIseo] = useState<ShiftMember[]>([]);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, nf, cargo, role")
        .order("full_name");
      setUsers((data as unknown as UserProfile[]) || []);
    };
    load();
  }, [open]);

  const allSelectedNames = [
    ...authorities.map((m) => m.name),
    ...investigators.map((m) => m.name),
    ...iseo.map((m) => m.name),
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
        authorities,
        investigators,
        iseo,
      });
      toast.success("Plantão criado com sucesso!");
      onOpenChange(false);
      setTeamName("");
      setAuthorities([]);
      setInvestigators([]);
      setIseo([]);
    } catch (err) {
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
          <MemberSelector label="Autoridades Policiais" members={authorities} setMembers={setAuthorities} users={users} allSelectedNames={allSelectedNames} filterFuncao="Autoridade Policial" />
          <MemberSelector label="OIPs — Oficiais Investigadores" members={investigators} setMembers={setInvestigators} users={users} allSelectedNames={allSelectedNames} filterFuncao="OIP" />
          <MemberSelector label="ISEO (opcional)" members={iseo} setMembers={setIseo} users={users} allSelectedNames={allSelectedNames} />
          <Button onClick={handleCreate} disabled={saving} className="w-full">
            {saving ? "Criando..." : "Criar Plantão"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
