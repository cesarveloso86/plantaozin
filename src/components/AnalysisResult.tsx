import { useState } from "react";
import { motion } from "framer-motion";
import {
  Copy, Check, RotateCcw, FileText, User, AlertTriangle,
  Shield, Scale, ChevronRight, MapPin, Calendar, Building2, Gavel
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { AnalysisResult as AnalysisResultType } from "@/types/analysis";

interface AnalysisResultProps {
  data: AnalysisResultType;
  onReset: () => void;
}

const CopyButton = ({ text, label = "Copiar" }: { text: string; label?: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2 shrink-0">
      {copied ? <><Check className="w-3.5 h-3.5 text-emerald-500" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> {label}</>}
    </Button>
  );
};

const TIPO_CONFIG: Record<string, { icon: typeof User; label: string; color: string }> = {
  condutor: { icon: Shield, label: "Condutor", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20" },
  testemunha: { icon: User, label: "Testemunha", color: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20" },
  interrogado: { icon: AlertTriangle, label: "Interrogado", color: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20" },
  vitima: { icon: User, label: "Vítima", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
};

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
};

const AnalysisResultView = ({ data, onReset }: AnalysisResultProps) => {
  const { triagem, depoimentos, despacho } = data;

  const triagemText = [
    `RELATÓRIO DE TRIAGEM`, ``,
    `Nº BO: ${triagem.numero_bo}`,
    `Delegacia: ${triagem.delegacia}`,
    `Data do Fato: ${triagem.data_fato}`,
    `Natureza: ${triagem.natureza}`,
    `Local: ${triagem.local_fato}`,
    ...(triagem.cep_endereco ? [`Endereço (ViaCEP): ${triagem.cep_endereco}`] : []),
    ``, `RESUMO:`, triagem.resumo,
    ...(triagem.alertas.length > 0 ? [``, `ALERTAS:`, ...triagem.alertas.map((a) => `⚠ ${a}`)] : []),
  ].join("\n");

  const despachoText = [
    `DESPACHO`, ``,
    despacho?.texto || "",
    ``, `TIPIFICAÇÕES:`,
    ...(despacho?.tipificacoes || []).map(t => `• ${t.artigo}${t.lei ? ` (${t.lei})` : ""} — ${t.descricao}`),
    ``, `PROVIDÊNCIAS:`,
    ...(despacho?.providencias || []).map((p, i) => `${i + 1}. ${p}`),
  ].join("\n");

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-5xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <motion.div {...fadeUp} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono text-xs">
              BO {triagem.numero_bo}
            </Badge>
            <Badge variant="outline" className="text-xs">{triagem.natureza}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{triagem.delegacia}</p>
        </div>
        <Button variant="outline" onClick={onReset} className="gap-2">
          <RotateCcw className="w-4 h-4" />
          Nova Ocorrência
        </Button>
      </motion.div>

      {/* CEP Alert */}
      {!triagem.cep_valido && (
        <motion.div {...fadeUp} transition={{ delay: 0.1 }}>
          <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">CEP informado não pôde ser validado. Verifique o endereço do local do fato.</p>
          </div>
        </motion.div>
      )}

      {/* Triagem Card */}
      <motion.div {...fadeUp} transition={{ delay: 0.15 }}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Relatório de Triagem
              </CardTitle>
              <CopyButton text={triagemText} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoItem icon={Calendar} label="Data do Fato" value={triagem.data_fato} />
              <InfoItem icon={Building2} label="Delegacia" value={triagem.delegacia} />
              <InfoItem icon={Scale} label="Natureza" value={triagem.natureza} />
              <InfoItem icon={MapPin} label="Local" value={triagem.local_fato} />
              {triagem.cep_endereco && (
                <InfoItem icon={MapPin} label="Endereço (ViaCEP)" value={triagem.cep_endereco} />
              )}
            </div>

            <Separator />

            {/* Resumo */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Resumo dos Fatos</h4>
              <p className="text-sm leading-relaxed text-foreground">{triagem.resumo}</p>
            </div>

            {/* Alertas */}
            {triagem.alertas.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Alertas</h4>
                <div className="flex flex-wrap gap-2">
                  {triagem.alertas.map((a, i) => (
                    <Badge key={i} variant="destructive" className="gap-1 text-xs">
                      <AlertTriangle className="w-3 h-3" /> {a}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Despacho Card */}
      {despacho && (
        <motion.div {...fadeUp} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Gavel className="w-4 h-4 text-primary" />
                  Despacho
                </CardTitle>
                <CopyButton text={despachoText} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{despacho.texto}</p>

              {despacho.tipificacoes?.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-3">Tipificações Penais</h4>
                    <div className="space-y-2">
                      {despacho.tipificacoes.map((t, i) => (
                        <div key={i} className="flex items-start gap-2 p-3 rounded-md bg-muted/50">
                          <Scale className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                          <div>
                            <span className="text-sm font-medium text-foreground">{t.artigo}</span>
                            {t.lei && <span className="text-xs text-muted-foreground ml-1">({t.lei})</span>}
                            <p className="text-xs text-muted-foreground mt-0.5">{t.descricao}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {despacho.providencias?.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-3">Providências</h4>
                    <ol className="space-y-2">
                      {despacho.providencias.map((p, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                          <ChevronRight className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Depoimentos */}
      <motion.div {...fadeUp} transition={{ delay: 0.25 }}>
        <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-primary" />
          Depoimentos ({depoimentos.length})
        </h3>
        <div className="space-y-4">
          {depoimentos.map((dep, i) => {
            const config = TIPO_CONFIG[dep.tipo] || TIPO_CONFIG.testemunha;
            const Icon = config.icon;
            const fullText = [
              `DEPOIMENTO — ${config.label.toUpperCase()}`,
              ``, `Nome: ${dep.nome}`, `Qualificação: ${dep.qualificacao}`,
              ``, dep.texto,
            ].join("\n");

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
              >
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium shrink-0 ${config.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                          {config.label}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-foreground truncate">{dep.nome}</h4>
                          <p className="text-xs text-muted-foreground truncate">{dep.qualificacao}</p>
                        </div>
                      </div>
                      <CopyButton text={fullText} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap bg-muted/30 rounded-md p-4">
                      {dep.texto}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
};

const InfoItem = ({ icon: Icon, label, value }: { icon: typeof Calendar; label: string; value: string }) => (
  <div className="flex items-start gap-2.5 p-2.5 rounded-md bg-muted/30">
    <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground truncate">{value}</p>
    </div>
  </div>
);

export default AnalysisResultView;
