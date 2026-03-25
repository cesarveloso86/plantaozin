import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Shift, ShiftMember } from "@/types/shift";
import { X } from "lucide-react";

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
      const { data } = await supabase.from("profiles").select("id, full_name, nf, funcao, role").order("full_name");
      setUsers((data as unknown as UserProfile[]) || []);
    };
    load();
  }, [open, shift]);

  const addMember = (userId: string, list: ShiftMember[], setList: React.Dispatch<React.SetStateAction<ShiftMember[]>>) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    if (list.some((m) => m.name === user.full_name)) { toast.error("Membro já adicionado"); return; }
    setList((prev) => [...prev, { name: user.full_name, nf: user.nf || undefined }]);
  };

  const removeMember = (name: string, setList: React.Dispatch<React.SetStateAction<ShiftMember[]>>) => {
    setList((prev) => prev.filter((m) => m.name !== name));
  };

  const setSubstituting = (name: string, value: string, setList: React.Dispatch<React.SetStateAction<ShiftMember[]>>) => {
    setList((prev) => prev.map((m) => m.name === name ? { ...m, substituting: value || undefined } : m));
  };

  const handleSave = async () => {
    if (!teamName.trim()) { toast.error("Informe o nome da equipe"); return; }
    setSaving(true);
    try {
      const startTime = new Date(`${shiftDate}T${startHour}:00`).toISOString();
      let endTime: string | undefined;
      if (endHour) {
        // If end hour is provided, calculate from shift date
        const end = new Date(`${shiftDate}T${endHour}:00`);
        // If end is before start, it's the next day
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

  const MemberSelector = ({ label, members, setMembers, filterFuncao }: { label: string; members: ShiftMember[]; setMembers: React.Dispatch<React.SetStateAction<ShiftMember[]>>; filterFuncao?: string }) => {
    const filteredUsers = users.filter((u) => {
      if (members.some((m) => m.name === u.full_name)) return false;
      if (filterFuncao && u.funcao !== filterFuncao) return false;
      return true;
    });
    const allUsers = users.filter((u) => !members.some((m) => m.name === u.full_name));
    return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select onValueChange={(v) => addMember(v, members, setMembers)}>
        <SelectTrigger><SelectValue placeholder="Selecionar membro..." /></SelectTrigger>
        <SelectContent>
          {filteredUsers.length > 0 && (
            <>
              {filterFuncao && <SelectItem value="__header_match" disabled className="text-xs text-muted-foreground">— {filterFuncao} —</SelectItem>}
              {filteredUsers.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.full_name}{u.nf ? ` — NF ${u.nf}` : ""}</SelectItem>
              ))}
            </>
          )}
          {filterFuncao && allUsers.filter((u) => u.funcao !== filterFuncao).length > 0 && (
            <>
              <SelectItem value="__header_other" disabled className="text-xs text-muted-foreground">— Outros —</SelectItem>
              {allUsers.filter((u) => u.funcao !== filterFuncao).map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.full_name}{u.nf ? ` — NF ${u.nf}` : ""}{u.funcao ? ` [${u.funcao}]` : ""}</SelectItem>
              ))}
            </>
          )}
          {!filterFuncao && allUsers.map((u) => (
            <SelectItem key={u.id} value={u.id}>{u.full_name}{u.nf ? ` — NF ${u.nf}` : ""}{u.funcao ? ` [${u.funcao}]` : ""}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {members.length > 0 && (
        <div className="space-y-1.5 mt-1">
          {members.map((m) => (
            <div key={m.name} className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1 pr-1 shrink-0">
                {m.name}{m.nf ? ` (${m.nf})` : ""}
                <button onClick={() => removeMember(m.name, setMembers)} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button>
              </Badge>
              <Input
                placeholder="Substituto de..."
                value={m.substituting || ""}
                onChange={(e) => setSubstituting(m.name, e.target.value, setMembers)}
                className="h-7 text-xs flex-1 min-w-0"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
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
              <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} />
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
          <MemberSelector label="Autoridades Policiais" members={authorities} setMembers={setAuthorities} filterFuncao="Autoridade Policial" />
          <MemberSelector label="OIPs — Oficiais Investigadores" members={investigators} setMembers={setInvestigators} filterFuncao="OIP" />
          <MemberSelector label="ISEO (opcional)" members={iseo} setMembers={setIseo} filterFuncao="ISEO" />
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
