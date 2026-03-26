import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Loader2, Shield, User, Search, Pencil, Plus, UserPlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { toast } from "sonner";

interface UserWithRole {
  id: string;
  full_name: string;
  nf: string | null;
  cargo: string | null;
  role: string;
  created_at: string;
  db_role: string | null;
}

interface TeamMember {
  id: string;
  full_name: string;
  nf: string | null;
  cargo: string | null;
  is_active: boolean;
  created_at: string;
}

const AdminUsuarios = () => {
  const { isAdmin, loading: authLoading, user } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editUser, setEditUser] = useState<UserWithRole | null>(null);
  const [editName, setEditName] = useState("");
  const [editNf, setEditNf] = useState("");
  const [editCargo, setEditCargo] = useState("");
  const [saving, setSaving] = useState(false);

  // Create user state
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newNf, setNewNf] = useState("");
  const [newCargo, setNewCargo] = useState("");
  const [creating, setCreating] = useState(false);

  // Operational members state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [showCreateOp, setShowCreateOp] = useState(false);
  const [opName, setOpName] = useState("");
  const [opNf, setOpNf] = useState("");
  const [opCargo, setOpCargo] = useState("");
  const [creatingOp, setCreatingOp] = useState(false);
  const [searchOp, setSearchOp] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    loadUsers();
    loadTeamMembers();
  }, [isAdmin]);

  const loadUsers = async () => {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: roles } = await supabase
      .from("user_roles")
      .select("*");

    const roleMap = new Map<string, string>();
    (roles || []).forEach((r: any) => roleMap.set(r.user_id, r.role));

    const merged: UserWithRole[] = (profiles || []).map((p: any) => ({
      id: p.id,
      full_name: p.full_name || "Sem nome",
      nf: p.nf || null,
      cargo: p.cargo || null,
      role: p.role,
      created_at: p.created_at,
      db_role: roleMap.get(p.id) || "analista",
    }));

    setUsers(merged);
    setLoading(false);
  };

  const loadTeamMembers = async () => {
    const { data } = await supabase
      .from("team_members")
      .select("*")
      .order("full_name");
    setTeamMembers((data as unknown as TeamMember[]) || []);
  };

  const handleCreateOperational = async () => {
    if (!opName.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (!opCargo) {
      toast.error("Cargo é obrigatório");
      return;
    }
    setCreatingOp(true);
    const { error } = await supabase.from("team_members").insert({
      full_name: opName.trim(),
      nf: opNf || null,
      cargo: opCargo || null,
      created_by: user?.id,
    } as any);
    if (error) {
      toast.error("Erro ao criar membro: " + error.message);
    } else {
      toast.success("Membro operacional adicionado!");
      setShowCreateOp(false);
      setOpName("");
      setOpNf("");
      setOpCargo("");
      loadTeamMembers();
    }
    setCreatingOp(false);
  };

  const handleDeleteOperational = async (id: string) => {
    const { error } = await supabase.from("team_members").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover: " + error.message);
    } else {
      toast.success("Membro removido");
      setTeamMembers((prev) => prev.filter((m) => m.id !== id));
    }
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from("team_members").update({ is_active: !active } as any).eq("id", id);
    if (error) {
      toast.error("Erro: " + error.message);
    } else {
      setTeamMembers((prev) => prev.map((m) => m.id === id ? { ...m, is_active: !active } : m));
    }
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

    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, db_role: newRole } : u))
    );
    toast.success("Permissão alterada com sucesso");
  };

  const openEdit = (user: UserWithRole) => {
    setEditUser(user);
    setEditName(user.full_name);
    setEditNf(user.nf || "");
    setEditCargo(user.cargo || "");
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: editName, nf: editNf || null, cargo: editCargo || null } as any)
      .eq("id", editUser.id);

    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editUser.id ? { ...u, full_name: editName, nf: editNf || null, cargo: editCargo || null } : u
        )
      );
      toast.success("Perfil atualizado");
      setEditUser(null);
    }
    setSaving(false);
  };

  const handleCreateUser = async () => {
    if (!newEmail.trim() || !newName.trim()) {
      toast.error("Email e nome são obrigatórios");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: { email: newEmail, full_name: newName, nf: newNf || null, cargo: newCargo || null },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Usuário criado! O usuário deve usar 'Esqueci minha senha' para definir a senha.");
      setShowCreate(false);
      setNewEmail("");
      setNewName("");
      setNewNf("");
      setNewCargo("");
      loadUsers();
    } catch (err: any) {
      toast.error("Erro ao criar usuário: " + (err.message || "Erro desconhecido"));
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

  const filtered = users.filter((u) =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (u.nf && u.nf.includes(search))
  );

  const filteredOp = teamMembers.filter((m) =>
    m.full_name.toLowerCase().includes(searchOp.toLowerCase()) ||
    (m.nf && m.nf.includes(searchOp))
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          Administração de Usuários
        </h2>
        <p className="text-sm text-muted-foreground">{users.length} usuário(s) · {teamMembers.filter(m => m.is_active).length} membro(s) operacional(is)</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Usuários do Sistema</TabsTrigger>
          <TabsTrigger value="operational">Membros Operacionais</TabsTrigger>
        </TabsList>

        {/* ===== TAB: USERS ===== */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome ou NF..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Button onClick={() => setShowCreate(true)} size="sm" className="shrink-0 gap-1">
              <Plus className="w-4 h-4" /> Criar Usuário
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
                        <TableHead>Nome</TableHead>
                        <TableHead>NF</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead>Permissão</TableHead>
                        <TableHead>Cadastro</TableHead>
                        <TableHead className="w-16">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                                <User className="w-3.5 h-3.5 text-muted-foreground" />
                              </div>
                              <span className="truncate">{user.full_name}</span>
                            </div>
                          </TableCell>
                          <TableCell><span className="text-sm font-mono text-muted-foreground">{user.nf || "—"}</span></TableCell>
                          <TableCell><span className="text-sm text-muted-foreground">{user.cargo || "—"}</span></TableCell>
                          <TableCell>
                            <Select value={user.db_role || "analista"} onValueChange={(val) => handleRoleChange(user.id, val)}>
                              <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="analista">Analista</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{new Date(user.created_at).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(user)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filtered.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </TabsContent>

        {/* ===== TAB: OPERATIONAL MEMBERS ===== */}
        <TabsContent value="operational" className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar membro operacional..." value={searchOp} onChange={(e) => setSearchOp(e.target.value)} className="pl-9" />
            </div>
            <Button onClick={() => setShowCreateOp(true)} size="sm" className="shrink-0 gap-1">
              <UserPlus className="w-4 h-4" /> Adicionar Membro
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Membros operacionais não possuem login no sistema. São utilizados apenas para compor a equipe do plantão e a fila de distribuição de ocorrências.
          </p>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>NF</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-24">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOp.map((m) => (
                      <TableRow key={m.id} className={!m.is_active ? "opacity-50" : ""}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center shrink-0">
                              <UserPlus className="w-3.5 h-3.5 text-accent-foreground" />
                            </div>
                            <span className="truncate">{m.full_name}</span>
                          </div>
                        </TableCell>
                        <TableCell><span className="text-sm font-mono text-muted-foreground">{m.nf || "—"}</span></TableCell>
                        <TableCell><span className="text-sm text-muted-foreground">{m.cargo || "—"}</span></TableCell>
                        <TableCell>
                          <Badge
                            variant={m.is_active ? "default" : "secondary"}
                            className="cursor-pointer"
                            onClick={() => handleToggleActive(m.id, m.is_active)}
                          >
                            {m.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteOperational(m.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredOp.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum membro operacional cadastrado.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Edit user dialog */}
      <Dialog open={!!editUser} onOpenChange={(v) => !v && setEditUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome completo</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <Label>Número Funcional (NF)</Label>
              <Input value={editNf} onChange={(e) => setEditNf(e.target.value)} placeholder="Ex: 4752619" />
            </div>
            <div>
              <Label>Cargo</Label>
              <Select value={editCargo || "__none"} onValueChange={(v) => setEditCargo(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Sem cargo</SelectItem>
                  <SelectItem value="Autoridade Policial">Autoridade Policial</SelectItem>
                  <SelectItem value="OIP">OIP — Oficial Investigador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSaveEdit} disabled={saving} className="w-full">
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create user dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Criar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="usuario@gov.br" />
            </div>
            <div>
              <Label>Nome completo</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome Sobrenome" />
            </div>
            <div>
              <Label>Número Funcional (NF)</Label>
              <Input value={newNf} onChange={(e) => setNewNf(e.target.value)} placeholder="Ex: 4752619" />
            </div>
            <div>
              <Label>Cargo</Label>
              <Select value={newCargo || "__none"} onValueChange={(v) => setNewCargo(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Sem cargo</SelectItem>
                  <SelectItem value="Autoridade Policial">Autoridade Policial</SelectItem>
                  <SelectItem value="OIP">OIP — Oficial Investigador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreateUser} disabled={creating} className="w-full">
              {creating ? "Criando..." : "Criar Usuário"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              O usuário receberá acesso e deverá usar "Esqueci minha senha" para definir sua senha.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create operational member dialog */}
      <Dialog open={showCreateOp} onOpenChange={setShowCreateOp}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar Membro Operacional</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Este membro não terá acesso ao sistema. Será utilizado apenas para compor escalas e a fila de distribuição do plantão.
            </p>
            <div>
              <Label>Nome completo</Label>
              <Input value={opName} onChange={(e) => setOpName(e.target.value)} placeholder="Nome Sobrenome" />
            </div>
            <div>
              <Label>Número Funcional (NF)</Label>
              <Input value={opNf} onChange={(e) => setOpNf(e.target.value)} placeholder="Ex: 4752619" />
            </div>
            <div>
              <Label>Cargo</Label>
              <Select value={opCargo || "__none"} onValueChange={(v) => setOpCargo(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Selecione...</SelectItem>
                  <SelectItem value="Autoridade Policial">Autoridade Policial</SelectItem>
                  <SelectItem value="OIP">OIP — Oficial Investigador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreateOperational} disabled={creatingOp} className="w-full">
              {creatingOp ? "Adicionando..." : "Adicionar Membro"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsuarios;
