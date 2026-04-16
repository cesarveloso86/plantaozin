import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import type { ShiftMember } from "@/types/shift";

interface UserProfile {
  id: string;
  full_name: string;
  nickname?: string | null;
  nf: string | null;
  cargo: string | null;
  role: string;
  is_operational?: boolean;
}

interface MemberSelectorProps {
  label: string;
  members: ShiftMember[];
  setMembers: React.Dispatch<React.SetStateAction<ShiftMember[]>>;
  users: UserProfile[];
  allSelectedNames: string[];
  filterFuncao?: string;
}

const labelOf = (u: UserProfile) =>
  u.nickname && u.nickname.trim() ? `${u.full_name} (${u.nickname})` : u.full_name;

export function MemberSelector({ label, members, setMembers, users, allSelectedNames, filterFuncao }: MemberSelectorProps) {
  const addMember = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user || members.some((m) => m.name === user.full_name)) return;
    setMembers((prev) => [...prev, {
      name: user.full_name,
      nf: user.nf || undefined,
      nickname: user.nickname || undefined,
    }]);
  };

  const removeMember = (name: string) => {
    setMembers((prev) => prev.filter((m) => m.name !== name));
  };

  const setSubstituting = (name: string, value: string) => {
    setMembers((prev) =>
      prev.map((m) => m.name === name ? { ...m, substituting: value || undefined } : m)
    );
  };

  const availableUsers = users.filter((u) => !allSelectedNames.includes(u.full_name));

  const filteredUsers = filterFuncao
    ? availableUsers.filter((u) => u.cargo === filterFuncao)
    : availableUsers;

  const otherUsers = filterFuncao
    ? availableUsers.filter((u) => u.cargo !== filterFuncao)
    : [];

  const getSubstituteOptions = (memberName: string) =>
    users.filter((u) => u.full_name !== memberName);

  // Resolve nickname for a selected member: prefer member.nickname, fall back to source user.
  const nicknameOf = (m: ShiftMember) => {
    if (m.nickname && m.nickname.trim()) return m.nickname;
    const u = users.find((x) => x.full_name === m.name);
    return u?.nickname && u.nickname.trim() ? u.nickname : null;
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select onValueChange={addMember} value="">
        <SelectTrigger>
          <SelectValue placeholder="Selecionar membro..." />
        </SelectTrigger>
        <SelectContent>
          {filteredUsers.length > 0 && (
            <>
              {filterFuncao && (
                <SelectItem value="__header_match" disabled className="text-xs text-muted-foreground">
                  — {filterFuncao} —
                </SelectItem>
              )}
              {filteredUsers.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {labelOf(u)}{u.nf ? ` — NF ${u.nf}` : ""}
                </SelectItem>
              ))}
            </>
          )}
          {otherUsers.length > 0 && (
            <>
              <SelectItem value="__header_other" disabled className="text-xs text-muted-foreground">
                — Outros —
              </SelectItem>
              {otherUsers.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {labelOf(u)}{u.nf ? ` — NF ${u.nf}` : ""}{u.cargo ? ` [${u.cargo}]` : ""}
                </SelectItem>
              ))}
            </>
          )}
          {!filterFuncao && availableUsers.length === 0 && (
            <SelectItem value="__empty" disabled className="text-xs text-muted-foreground">
              Nenhum usuário disponível
            </SelectItem>
          )}
        </SelectContent>
      </Select>
      {members.length > 0 && (
        <div className="space-y-1.5 mt-1">
          {members.map((m) => {
            const apelido = nicknameOf(m);
            return (
              <div key={m.name} className="flex items-center gap-2">
                <Badge variant="secondary" className="gap-1 pr-1 shrink-0">
                  {m.name}{apelido ? ` (${apelido})` : ""}{m.nf ? ` — NF ${m.nf}` : ""}
                  <button onClick={() => removeMember(m.name)} className="ml-1 hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
                <Select
                  value={m.substituting || ""}
                  onValueChange={(v) => setSubstituting(m.name, v === "__clear" ? "" : v)}
                >
                  <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
                    <SelectValue placeholder="Substituto de..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__clear" className="text-xs text-muted-foreground">Nenhum</SelectItem>
                    {getSubstituteOptions(m.name).map((u) => (
                      <SelectItem key={u.id} value={u.full_name}>
                        {labelOf(u)}{u.nf ? ` — NF ${u.nf}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
