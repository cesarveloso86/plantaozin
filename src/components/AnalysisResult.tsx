import { useState } from "react";
import { motion } from "framer-motion";
import { Copy, Check, RotateCcw, FileText, User, AlertTriangle, Shield } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import type { AnalysisResult as AnalysisResultType } from "@/types/analysis";

interface AnalysisResultProps {
  data: AnalysisResultType;
  onReset: () => void;
}

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="outline"
      size="lg"
      onClick={handleCopy}
      className="min-h-[44px] min-w-[160px] gap-2"
    >
      {copied ? (
        <>
          <Check className="w-4 h-4 text-success" />
          Copiado
        </>
      ) : (
        <>
          <Copy className="w-4 h-4" />
          Copiar Texto
        </>
      )}
    </Button>
  );
};

const TIPO_ICONS: Record<string, typeof User> = {
  condutor: Shield,
  testemunha: User,
  interrogado: AlertTriangle,
  vitima: User,
};

const TIPO_LABELS: Record<string, string> = {
  condutor: "Condutor",
  testemunha: "Testemunha",
  interrogado: "Interrogado",
  vitima: "Vítima",
};

const AnalysisResultView = ({ data, onReset }: AnalysisResultProps) => {
  const { triagem, depoimentos } = data;

  const triagemText = [
    `RELATÓRIO DE TRIAGEM`,
    ``,
    `Nº BO: ${triagem.numero_bo}`,
    `Delegacia: ${triagem.delegacia}`,
    `Data do Fato: ${triagem.data_fato}`,
    `Natureza: ${triagem.natureza}`,
    `Local: ${triagem.local_fato}`,
    ``,
    `RESUMO:`,
    triagem.resumo,
    ...(triagem.alertas.length > 0
      ? [``, `ALERTAS:`, ...triagem.alertas.map((a) => `⚠ ${a}`)]
      : []),
  ].join("\n");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-4xl mx-auto space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-foreground">
            BO {triagem.numero_bo}
          </h2>
          <p className="text-sm text-muted-foreground">
            {triagem.natureza} — {triagem.delegacia}
          </p>
        </div>
        <Button
          variant="outline"
          size="lg"
          onClick={onReset}
          className="min-h-[44px] gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Nova Ocorrência
        </Button>
      </div>

      {/* CEP Alert */}
      {!triagem.cep_valido && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">
            CEP informado não pôde ser validado. Verifique o endereço do local do fato.
          </p>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="triagem" className="w-full">
        <TabsList className="w-full flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger
            value="triagem"
            className="min-h-[40px] gap-2 data-[state=active]:bg-card"
          >
            <FileText className="w-4 h-4" />
            Triagem
          </TabsTrigger>
          {depoimentos.map((dep, i) => {
            const Icon = TIPO_ICONS[dep.tipo] || User;
            return (
              <TabsTrigger
                key={i}
                value={`dep-${i}`}
                className="min-h-[40px] gap-2 data-[state=active]:bg-card"
              >
                <Icon className="w-4 h-4" />
                {TIPO_LABELS[dep.tipo] || dep.tipo} — {dep.nome.split(" ")[0]}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Triagem Tab */}
        <TabsContent value="triagem" className="mt-4">
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <div className="flex justify-end">
              <CopyButton text={triagemText} />
            </div>
            <div className="font-mono text-sm leading-relaxed text-foreground whitespace-pre-wrap bg-muted/30 rounded-md p-5">
              {triagemText}
            </div>
          </div>
        </TabsContent>

        {/* Depoimento Tabs */}
        {depoimentos.map((dep, i) => {
          const fullText = [
            `DEPOIMENTO — ${(TIPO_LABELS[dep.tipo] || dep.tipo).toUpperCase()}`,
            ``,
            `Nome: ${dep.nome}`,
            `Qualificação: ${dep.qualificacao}`,
            ``,
            dep.texto,
          ].join("\n");

          return (
            <TabsContent key={i} value={`dep-${i}`} className="mt-4">
              <div className="bg-card border border-border rounded-lg p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">{dep.nome}</h3>
                    <p className="text-sm text-muted-foreground">{dep.qualificacao}</p>
                  </div>
                  <CopyButton text={fullText} />
                </div>
                <div className="font-mono text-sm leading-relaxed text-foreground whitespace-pre-wrap bg-muted/30 rounded-md p-5">
                  {dep.texto}
                </div>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </motion.div>
  );
};

export default AnalysisResultView;
