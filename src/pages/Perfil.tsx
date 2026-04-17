import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, User as UserIcon, Sparkles, RotateCcw, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useProfile, DEFAULT_SIGNATURE_STYLE, type SignatureStyle } from "@/hooks/useProfile";
import { maskPhone, maskNF } from "@/lib/masks";
import { TEAM_NAMES } from "@/components/shift/shiftConstants";

const TOM_OPTIONS = [
  {
    value: "formal_juridico",
    label: "Formal jurídico",
    desc: "Linguagem técnica e citações legais (recomendado para autos formais).",
  },
  {
    value: "tecnico_neutro",
    label: "Técnico neutro",
    desc: "Equilíbrio entre clareza e formalidade — uso geral.",
  },
  {
    value: "objetivo_simples",
    label: "Objetivo e simples",
    desc: "Frases curtas e diretas, com menos jargão.",
  },
];

export default function Perfil() {
  const { profile, loading, saving, save } = useProfile();

  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [nf, setNf] = useState("");
  const [cargo, setCargo] = useState("");
  const [telefone, setTelefone] = useState("");
  const [lotacao, setLotacao] = useState("");
  const [equipe, setEquipe] = useState("");
  const [style, setStyle] = useState<SignatureStyle>(DEFAULT_SIGNATURE_STYLE);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name || "");
    setNickname(profile.nickname || "");
    setNf(profile.nf || "");
    setCargo(profile.cargo || "");
    setTelefone(profile.telefone ? maskPhone(profile.telefone) : "");
    setLotacao(profile.lotacao || "");
    setEquipe(profile.equipe || "");
    setStyle({ ...DEFAULT_SIGNATURE_STYLE, ...(profile.signature_style || {}) });
  }, [profile]);

  if (loading || !profile) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const handleSaveData = async () => {
    const { error } = await save({
      full_name: fullName.trim(),
      nickname: nickname.trim() || null,
      nf: nf.trim() || null,
      cargo: cargo.trim() || null,
      telefone: telefone.replace(/\D/g, "") || null,
      lotacao: lotacao.trim() || null,
      equipe: equipe.trim() || null,
    });
    if (error) toast.error("Erro ao salvar: " + error);
    else toast.success("Dados atualizados");
  };

  const handleSaveStyle = async () => {
    const { error } = await save({ signature_style: style });
    if (error) toast.error("Erro ao salvar: " + error);
    else toast.success("Preferências do agente atualizadas");
  };

  const handleResetStyle = () => {
    setStyle(DEFAULT_SIGNATURE_STYLE);
    toast.info("Restaurado para o padrão. Clique em salvar para confirmar.");
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <UserIcon className="w-5 h-5 text-primary" />
          Meu Perfil
        </h2>
        <p className="text-sm text-muted-foreground">
          Atualize seus dados funcionais e personalize o agente de análise de BU.
        </p>
      </div>

      {/* Meus Dados */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Meus Dados</CardTitle>
            <CardDescription>Informações pessoais e funcionais</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="fullName">Nome completo</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nome completo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nickname">Apelido</Label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Apelido"
              />
              <p className="text-xs text-muted-foreground">
                Exibido em filas de distribuição e estatísticas.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nf">Número Funcional (NF)</Label>
              <Input
                id="nf"
                value={nf}
                onChange={(e) => setNf(maskNF(e.target.value))}
                placeholder="123456"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cargo">Cargo</Label>
              <Select value={cargo || "__none"} onValueChange={(v) => setCargo(v === "__none" ? "" : v)}>
                <SelectTrigger id="cargo"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Sem cargo</SelectItem>
                  <SelectItem value="Autoridade Policial">Autoridade Policial</SelectItem>
                  <SelectItem value="OIP">OIP — Oficial Investigador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={telefone}
                onChange={(e) => setTelefone(maskPhone(e.target.value))}
                placeholder="(27) 99999-9999"
                inputMode="tel"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lotacao">Lotação</Label>
              <Input
                id="lotacao"
                value={lotacao}
                onChange={(e) => setLotacao(e.target.value)}
                placeholder="Unidade de lotação"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="equipe">Equipe</Label>
              <Select value={equipe || "__none"} onValueChange={(v) => setEquipe(v === "__none" ? "" : v)}>
                <SelectTrigger id="equipe"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Sem equipe</SelectItem>
                  {TEAM_NAMES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button onClick={handleSaveData} disabled={saving} className="gap-2">
                <Save className="w-4 h-4" />
                {saving ? "Salvando..." : "Salvar dados"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Agente de Análise */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Agente de Análise (BU)
            </CardTitle>
            <CardDescription>
              Personalize como a inteligência artificial redige a triagem, depoimentos e despacho.
              Estas preferências valem apenas para suas próprias análises.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Tom */}
            <div className="space-y-2">
              <Label>Tom da redação</Label>
              <Select
                value={style.tom || "formal_juridico"}
                onValueChange={(v) => setStyle((s) => ({ ...s, tom: v as SignatureStyle["tom"] }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TOM_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {TOM_OPTIONS.find((o) => o.value === (style.tom || "formal_juridico"))?.desc}
              </p>
            </div>

            {/* Qualificação completa */}
            <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="qualif" className="cursor-pointer">Qualificação completa nos depoimentos</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs text-muted-foreground underline decoration-dotted cursor-help">o que é?</span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      Quando ativado, a IA inclui nome, filiação, RG, profissão e endereço completos no início de cada depoimento.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-xs text-muted-foreground">
                  Recomendado para autos formais. Desative para resumos rápidos.
                </p>
              </div>
              <Switch
                id="qualif"
                checked={!!style.qualificacao_completa}
                onCheckedChange={(v) => setStyle((s) => ({ ...s, qualificacao_completa: v }))}
              />
            </div>

            {/* Instruções extras */}
            <div className="space-y-2">
              <Label htmlFor="extras">Instruções extras para a IA</Label>
              <Textarea
                id="extras"
                value={style.instrucoes_extras || ""}
                onChange={(e) => setStyle((s) => ({ ...s, instrucoes_extras: e.target.value }))}
                placeholder='Ex.: "Sempre citar o artigo do Código Penal aplicável" ou "Usar nomes em caixa alta no despacho"'
                rows={4}
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground">
                Escreva como se estivesse instruindo um colega novato. Máx. 1000 caracteres.
              </p>
            </div>

            <div className="flex justify-between gap-2">
              <Button variant="ghost" onClick={handleResetStyle} className="gap-2">
                <RotateCcw className="w-4 h-4" /> Restaurar padrão
              </Button>
              <Button onClick={handleSaveStyle} disabled={saving} className="gap-2">
                <Save className="w-4 h-4" />
                {saving ? "Salvando..." : "Salvar preferências"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
