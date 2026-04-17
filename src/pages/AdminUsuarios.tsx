import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Loader2, Shield, User, Search, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ALLOWED_EMAIL_DOMAIN, isValidInstitutionalEmail } from "@/lib/constants";
import { maskNF, maskPhone } from "@/lib/masks";
import { TEAM_NAMES } from "@/components/shift/shiftConstants";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type MemberSource = "profile" | "operational";

interface UnifiedMember {
  id: string;
  source: MemberSource;
  full_name: string;
  nickname: string | null;
  nf: string | null;
  cargo: string | null;
  email: string | null;
  telefone: string | null;
  lotacao: string | null;
  equipe: string | null;
  is_active: boolean;
  db_role: string | null; // only for profiles
  created_at: string;
}

interface MemberFormState {
  full_name: string;
  nickname: string;
  nf: string;
  cargo: string;
  email: string;
  telefone: string;
  lotacao: string;
  equipe: string;
}

const emptyForm: MemberFormState = {
  full_name: "",
  nickname: "",
  nf: "",
  cargo: "",
  email: "",
  telefone: "",
  lotacao: "Central de Teleflagrante",
  equipe: "",
};

// Top-level: declared OUTSIDE the page component to keep stable identity
// across re-renders (otherwise inputs lose focus on every keystroke).
const FormFields = ({ value, onChange, includeEmail, emailReadOnly }: {
  value: MemberFormState;
  onChange: (next: MemberFormState) => void;
  includeEmail: boolean;
  emailReadOnly?: boolean;
}) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <div className="sm:col-span-2 space-y-1.5">
      <Label>Nome completo</Label>
      <Input value={value.full_name} onChange={(e) => onChange({ ...value, full_name: e.target.value })} placeholder="Nome completo" />
    </div>
    <div className="space-y-1.5">
      <Label>Apelido</Label>
      <Input value={value.nickname} onChange={(e) => onChange({ ...value, nickname: e.target.value })} placeholder="Apelido" />
    </div>
    <div className="space-y-1.5">
      <Label>NF</Label>
      <Input value={value.nf} onChange={(e) => onChange({ ...value, nf: maskNF(e.target.value) })} placeholder="123456" inputMode="numeric" />
    </div>
    {includeEmail && (
      <div className="sm:col-span-2 space-y-1.5">
        <Label>E-mail{emailReadOnly && <span className="text-xs text-muted-foreground ml-2">(não editável)</span>}</Label>
        <Input
          type="email"
          value={value.email}
          onChange={(e) => onChange({ ...value, email: e.target.value })}
          placeholder={`usuario${ALLOWED_EMAIL_DOMAIN}`}
          readOnly={emailReadOnly}
          disabled={emailReadOnly}
        />
      </div>
    )}
    <div className="space-y-1.5">
      <Label>Telefone</Label>
      <Input value={value.telefone} onChange={(e) => onChange({ ...value, telefone: maskPhone(e.target.value) })} placeholder="(27) 99999-9999" inputMode="tel" />
    </div>
    <div className="space-y-1.5">
      <Label>Cargo</Label>
      <Select value={value.cargo || "__none"} onValueChange={(v) => onChange({ ...value, cargo: v === "__none" ? "" : v })}>
        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">Sem cargo</SelectItem>
          <SelectItem value="Autoridade Policial">Autoridade Policial</SelectItem>
          <SelectItem value="OIP">OIP — Oficial Investigador</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div className="space-y-1.5">
      <Label>Lotação</Label>
      <Input value={value.lotacao} onChange={(e) => onChange({ ...value, lotacao: e.target.value })} placeholder="Unidade de lotação" />
    </div>
    <div className="space-y-1.5">
      <Label>Equipe</Label>
      <Select value={value.equipe || "__none"} onValueChange={(v) => onChange({ ...value, equipe: v === "__none" ? "" : v })}>
        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">Sem equipe</SelectItem>
          {TEAM_NAMES.map((t) => (
            <SelectItem key={t} value={t}>{t}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  </div>
);

const AdminUsuarios = () => {
  const { isAdmin, loading: authLoading, user } = useAuth();
  const [members, setMembers] = useState<UnifiedMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Dialog state
  const [showCreate, setShowCreate] = useState(false);
  const [createWithLogin, setCreateWithLogin] = useState(false);
  const [form, setForm] = useState<MemberFormState>(emptyForm);
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editing, setEditing] = useState<UnifiedMember | null>(null);
  const [editForm, setEditForm] = useState<MemberFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    loadAll();
  }, [isAdmin]);

  const loadAll = async () => {
    setLoading(true);
    const [profilesRes, teamRes, rolesRes, emailsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, nickname, nf, cargo, telefone, lotacao, equipe, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("team_members")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*"),
      supabase.functions.invoke("admin-list-emails", { body: {} }),
    ]);

    const roleMap = new Map<string, string>();
    (rolesRes.data || []).forEach((r: any) => roleMap.set(r.user_id, r.role));

    const emailMap: Record<string, string> = (emailsRes.data as any)?.emails || {};

    const profileRows: UnifiedMember[] = ((profilesRes.data as any[]) || []).map((p) => ({
      id: p.id,
      source: "profile",
      full_name: p.full_name || "Sem nome",
      nickname: p.nickname ?? null,
      nf: p.nf ?? null,
      cargo: p.cargo ?? null,
      email: emailMap[p.id] ?? null,
      telefone: p.telefone ?? null,
      lotacao: p.lotacao ?? null,
      equipe: p.equipe ?? null,
      is_active: true,
      db_role: roleMap.get(p.id) || "analista",
      created_at: p.created_at,
    }));

    const opRows: UnifiedMember[] = ((teamRes.data as any[]) || []).map((t) => ({
      id: t.id,
      source: "operational",
      full_name: t.full_name,
      nickname: t.nickname ?? null,
      nf: t.nf ?? null,
      cargo: t.cargo ?? null,
      email: t.email ?? null,
      telefone: t.telefone ?? null,
      lotacao: t.lotacao ?? null,
      equipe: t.equipe ?? null,
      is_active: t.is_active,
      db_role: null,
      created_at: t.created_at,
    }));

    setMembers([...profileRows, ...opRows]);
    setLoading(false);
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: newRole } as any);
    if (error) {
      toast.error("Erro ao alterar permissão: " + error.message);
      return;
    }
    setMembers((prev) => prev.map((m) => (m.id === userId ? { ...m, db_role: newRole } : m)));
    toast.success("Permissão alterada");
  };

  const openEdit = (m: UnifiedMember) => {
    setEditing(m);
    setEditForm({
      full_name: m.full_name,
      nickname: m.nickname || "",
      nf: m.nf || "",
      cargo: m.cargo || "",
      email: m.email || "",
      telefone: m.telefone ? maskPhone(m.telefone) : "",
      lotacao: m.lotacao || "",
      equipe: m.equipe || "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const payload = {
      full_name: editForm.full_name.trim(),
      nickname: editForm.nickname.trim() || null,
      nf: editForm.nf.trim() || null,
      cargo: editForm.cargo.trim() || null,
      telefone: editForm.telefone.replace(/\D/g, "") || null,
      lotacao: editForm.lotacao.trim() || null,
      equipe: editForm.equipe.trim() || null,
    };
    const table = editing.source === "profile" ? "profiles" : "team_members";
    const extra = editing.source === "operational"
      ? { email: editForm.email.trim() || null }
      : {};
    const { error } = await supabase
      .from(table as any)
      .update({ ...payload, ...extra } as any)
      .eq("id", editing.id);
    if (error) toast.error("Erro: " + error.message);
    else {
      toast.success("Membro atualizado");
      setEditing(null);
      loadAll();
    }
    setSaving(false);
  };

  const handleDeleteOperational = async (id: string) => {
    const { error } = await supabase.from("team_members").delete().eq("id", id);
    if (error) toast.error("Erro ao remover: " + error.message);
    else {
      toast.success("Membro removido");
      setMembers((prev) => prev.filter((m) => m.id !== id));
    }
  };

  const [deleteTarget, setDeleteTarget] = useState<UnifiedMember | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.source === "operational") {
        const { error } = await supabase.from("team_members").delete().eq("id", deleteTarget.id);
        if (error) throw error;
        setMembers((prev) => prev.filter((m) => m.id !== deleteTarget.id));
      } else {
        const { data, error } = await supabase.functions.invoke("admin-delete-user", {
          body: { user_id: deleteTarget.id },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setMembers((prev) => prev.filter((m) => m.id !== deleteTarget.id));
      }
      toast.success("Usuário excluído");
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error("Erro ao excluir: " + (err.message || "desconhecido"));
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (m: UnifiedMember) => {
    if (m.source !== "operational") return;
    const { error } = await supabase
      .from("team_members")
      .update({ is_active: !m.is_active } as any)
      .eq("id", m.id);
    if (error) toast.error("Erro: " + error.message);
    else setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, is_active: !m.is_active } : x)));
  };

  const handleCreate = async () => {
    if (!form.full_name.trim()) {
      toast.error("Nome completo é obrigatório");
      return;
    }
    setCreating(true);
    try {
      if (createWithLogin) {
        if (!form.email.trim() || !isValidInstitutionalEmail(form.email)) {
          toast.error(`E-mail institucional (${ALLOWED_EMAIL_DOMAIN}) obrigatório para login`);
          setCreating(false);
          return;
        }
        const { data, error } = await supabase.functions.invoke("admin-create-user", {
          body: {
            email: form.email.trim(),
            full_name: form.full_name.trim(),
            nickname: form.nickname.trim() || null,
            nf: form.nf.trim() || null,
            cargo: form.cargo.trim() || null,
            telefone: form.telefone.replace(/\D/g, "") || null,
            lotacao: form.lotacao.trim() || null,
            equipe: form.equipe.trim() || null,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast.success("Usuário criado. Deve usar 'Esqueci minha senha' para definir a senha.");
      } else {
        const { error } = await supabase.from("team_members").insert({
          full_name: form.full_name.trim(),
          nickname: form.nickname.trim() || null,
          nf: form.nf.trim() || null,
          cargo: form.cargo.trim() || null,
          email: form.email.trim() || null,
          telefone: form.telefone.replace(/\D/g, "") || null,
          lotacao: form.lotacao.trim() || null,
          equipe: form.equipe.trim() || null,
          created_by: user?.id,
        } as any);
        if (error) throw error;
        toast.success("Membro adicionado");
      }
      setShowCreate(false);
      setForm(emptyForm);
      setCreateWithLogin(false);
      loadAll();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "desconhecido"));
    } finally {
      setCreating(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/" replace />;

  const filtered = members
    .filter((m) => {
      const q = search.toLowerCase();
      return (
        m.full_name.toLowerCase().includes(q) ||
        (m.nickname || "").toLowerCase().includes(q) ||
        (m.nf || "").includes(search) ||
        (m.lotacao || "").toLowerCase().includes(q) ||
        (m.equipe || "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR", { sensitivity: "base" }));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          Administração de Membros
        </h2>
        <p className="text-sm text-muted-foreground">
          {members.length} membro(s) cadastrado(s) · todos podem compor plantões
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, apelido, NF, lotação ou equipe..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={() => { setShowCreate(true); setForm(emptyForm); setCreateWithLogin(false); }} size="sm" className="shrink-0 gap-1">
          <Plus className="w-4 h-4" /> Adicionar Membro
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome completo</TableHead>
                    <TableHead>Apelido</TableHead>
                    <TableHead>NF</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Lotação</TableHead>
                    <TableHead>Equipe</TableHead>
                    <TableHead>Permissão</TableHead>
                    <TableHead className="w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((m) => (
                    <TableRow key={`${m.source}-${m.id}`} className={!m.is_active ? "opacity-50" : ""}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                          <span className="truncate">{m.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell><span className="text-sm">{m.nickname || "—"}</span></TableCell>
                      <TableCell><span className="text-sm font-mono text-muted-foreground">{m.nf || "—"}</span></TableCell>
                      <TableCell><span className="text-sm text-muted-foreground">{m.cargo || "—"}</span></TableCell>
                      <TableCell><span className="text-sm text-muted-foreground">{m.lotacao || "—"}</span></TableCell>
                      <TableCell><span className="text-sm text-muted-foreground">{m.equipe || "—"}</span></TableCell>
                      <TableCell>
                        {m.source === "profile" ? (
                          <Select value={m.db_role || "analista"} onValueChange={(val) => handleRoleChange(m.id, val)}>
                            <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="analista">Analista</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge
                            variant={m.is_active ? "secondary" : "outline"}
                            className="cursor-pointer"
                            onClick={() => handleToggleActive(m)}
                            title="Clique para alternar"
                          >
                            {m.is_active ? "Operacional" : "Inativo"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(m)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          {m.source === "operational" && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteOperational(m.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Nenhum membro encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar Membro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
              <input
                type="checkbox"
                id="withLogin"
                checked={createWithLogin}
                onChange={(e) => setCreateWithLogin(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="withLogin" className="cursor-pointer text-sm">
                Criar com acesso ao sistema (login)
              </Label>
            </div>
            <FormFields value={form} onChange={setForm} includeEmail />
            <Button onClick={handleCreate} disabled={creating} className="w-full">
              {creating ? "Salvando..." : "Adicionar"}
            </Button>
            {createWithLogin && (
              <p className="text-xs text-muted-foreground text-center">
                O usuário deverá usar "Esqueci minha senha" para definir a senha.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Membro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <FormFields
              value={editForm}
              onChange={setEditForm}
              includeEmail={editing?.source === "operational"}
            />
            <Button onClick={handleSaveEdit} disabled={saving} className="w-full">
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsuarios;
