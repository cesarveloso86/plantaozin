import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import DropZone from "@/components/DropZone";
import ProcessingStatus from "@/components/ProcessingStatus";
import AnalysisResultView from "@/components/AnalysisResult";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useShift } from "@/hooks/useShift";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, Send, Sparkles, AlertTriangle, Calendar, Building2, MapPin, Scale } from "lucide-react";
import { toast } from "sonner";
import { REGIONALS } from "@/types/shift";
import { matchRegionalByKeyword } from "@/lib/constants";
import { predictSubteamQueue, predictQueue } from "@/lib/availability";
import type { TriageResult, AnalysisResult } from "@/types/analysis";

const Index = () => {
  const {
    status, result, triageResult, error, fileName,
    analyzeTriage, persistTriageForShift,
    analyze, reanalyze, reset,
  } = useAnalysis();
  const shift = useShift();
  const navigate = useNavigate();
  const isProcessing = ["reading", "validating", "analyzing", "generating"].includes(status);

  const handleUpload = useCallback(async (file: File) => {
    await analyzeTriage(file);
  }, [analyzeTriage]);

  const resolveRegional = (t: TriageResult["triagem"] | AnalysisResult["triagem"]) => {
    let regional = t.regional_codigo || "";
    if (!regional || !REGIONALS.includes(regional as typeof REGIONALS[number])) {
      regional = matchRegionalByKeyword(t.unidade_registro || t.delegacia);
    }
    return regional;
  };

  /** Formata tipificações de forma curta (apenas artigo + lei) para o campo
   * `tipification` da ocorrência. A descrição completa permanece visível na
   * tela de análise. Ex.: "Art. 33 da Lei 11.343/06; Art. 35 da Lei 11.343/06". */
  const formatTipificacoesShort = (
    tips: Array<{ artigo?: string; lei?: string }> = [],
  ) =>
    tips
      .map((t) => {
        const artigo = (t.artigo || "").trim();
        const lei = (t.lei || "").trim();
        if (!artigo) return "";
        return lei ? `${artigo} da ${lei}` : artigo;
      })
      .filter(Boolean)
      .join("; ");

  const pickNextAssignees = () => {
     const active = shift.activeShift;
     if (!active) return { investigator: "", authority: "" };
     // Considera TODAS as ocorrências (em_atendimento, atendida, sem_oitiva) para
     // computar carga, igual à fila preditiva da OccurrencesTab. Filtrar só as
     // atendidas fazia o algoritmo repetir o mesmo OIP/Autoridade que já tinha
     // BU em andamento (carga zerada artificialmente).
     // Excluímos apenas "sem_oitiva", pois é uma fila paralela independente.
     const all = shift.occurrences.filter((o) => o.status !== "sem_oitiva");
     const now = new Date();
     const invSub = predictSubteamQueue(active.oip_subteams || [], all, [], "investigator", 1, now);
     const authSub = predictSubteamQueue(active.delegado_subteams || [], all, [], "authority", 1, now);
     const investigator = invSub[0]?.memberPick
       ?? predictQueue(active.investigators || [], all, [], "investigator", 1, now)[0]
       ?? "";
     const authority = authSub[0]?.memberPick
       ?? predictQueue(active.authorities || [], all, [], "authority", 1, now)[0]
       ?? "";
     return { investigator, authority };
  };

  const buildOccurrenceFromTriage = (t: TriageResult["triagem"]) => {
    const tipification = formatTipificacoesShort(t.tipificacoes_sugeridas);
    const { investigator, authority } = pickNextAssignees();
    return {
      status: "em_atendimento" as const,
      bu_number: (t.numero_bo || "").trim(),
      tipification,
      conducted_names: (t.interrogados_nomes || []).join(", "),
      victim_names: (t.vitimas_nomes || []).join(", "),
      regional: resolveRegional(t),
      investigator,
      authority,
    };
  };

  /** Mantém apenas chaves cujo valor atual da ocorrência está vazio/nulo. */
  const onlyEmptyFields = (
    existing: { [k: string]: unknown },
    incoming: Record<string, unknown>
  ): Record<string, unknown> => {
    const merged: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(incoming)) {
      const cur = existing[k];
      const isEmpty = cur === null || cur === undefined || cur === "" || (Array.isArray(cur) && cur.length === 0);
      if (isEmpty && v !== null && v !== undefined && v !== "") merged[k] = v;
    }
    return merged;
  };

  /** Envio rápido: persiste triagem + cria ocorrência vinculada à análise.
   *  Se BU já existir no plantão, mescla campos faltantes em vez de bloquear. */
  const handleSendTriageToShift = useCallback(async () => {
    if (!triageResult) return;
    if (!shift.activeShift) {
      toast.error("Nenhum plantão ativo. Crie um plantão antes de enviar.");
      navigate("/plantao");
      return;
    }

    const buNum = (triageResult.triagem.numero_bo || "").trim();
    const existing = buNum
      ? shift.occurrences.find((o) => (o.bu_number || "").trim() === buNum)
      : null;

    // ── Caso 1: BU já existe → mescla campos vazios. ──
    if (existing) {
      try {
        const incoming = buildOccurrenceFromTriage(triageResult.triagem);
        // Não sobrescreve atribuições nem horário já definidos.
        const { investigator: _i, authority: _a, tramitation_time: _t, status: _s, ...rest } =
          incoming as Record<string, unknown>;
        const mergeFields = onlyEmptyFields(existing as unknown as Record<string, unknown>, rest);

        // Linka análise se a ocorrência ainda não tinha uma.
        if (!existing.analysis_id) {
          const persisted = await persistTriageForShift(triageResult);
          if (persisted) mergeFields.analysis_id = persisted.analysisId;
        }

        if (Object.keys(mergeFields).length > 0) {
          await shift.updateOccurrence(existing.id, mergeFields as Partial<typeof existing>);
          toast.success(`Ocorrência ${buNum} atualizada com dados da análise.`);
        } else {
          toast.info(`BU ${buNum} já estava completo — nada a mesclar.`);
        }
        reset();
        navigate("/plantao");
      } catch {
        toast.error("Erro ao mesclar dados na ocorrência existente");
      }
      return;
    }

    // ── Caso 2: BU novo → fluxo padrão. ──
    const persisted = await persistTriageForShift(triageResult);
    if (!persisted) {
      toast.error("Erro ao salvar triagem");
      return;
    }

    const regional = resolveRegional(triageResult.triagem);
    if (!regional) {
      toast.warning("Não foi possível identificar a regional automaticamente — selecione manualmente.");
    }

    try {
      await shift.addOccurrence({
        ...buildOccurrenceFromTriage(triageResult.triagem),
        analysis_id: persisted.analysisId,
      });
      toast.success("Ocorrência distribuída — depoimentos podem ser gerados pelo OIP responsável.");
      reset();
      navigate("/plantao");
    } catch {
      toast.error("Erro ao enviar ao plantão");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triageResult, shift, navigate, persistTriageForShift, reset]);

  const handleSendFullToShift = useCallback(async () => {
    if (!result || !shift.activeShift) {
      if (!shift.activeShift) {
        toast.error("Nenhum plantão ativo. Crie um plantão antes de enviar.");
        navigate("/plantao");
      }
      return;
    }
    const regional = resolveRegional(result.triagem);
    const buNum = (result.triagem.numero_bo || "").trim();
    const existing = buNum
      ? shift.occurrences.find((o) => (o.bu_number || "").trim() === buNum)
      : null;

    const { investigator, authority } = pickNextAssignees();
    const incoming = {
      status: "em_atendimento" as const,
      bu_number: buNum,
      tipification: formatTipificacoesShort(result.despacho?.tipificacoes),
      conducted_names: result.depoimentos?.filter((d) => d.tipo === "interrogado").map((d) => d.nome).join(", ") || "",
      victim_names: result.depoimentos?.filter((d) => d.tipo === "vitima").map((d) => d.nome).join(", ") || "",
      regional,
      investigator,
      authority,
    };

    try {
      if (existing) {
        const { investigator: _i, authority: _a, tramitation_time: _t, status: _s, ...rest } =
          incoming as Record<string, unknown>;
        const mergeFields = onlyEmptyFields(existing as unknown as Record<string, unknown>, rest);
        if (Object.keys(mergeFields).length > 0) {
          await shift.updateOccurrence(existing.id, mergeFields as Partial<typeof existing>);
          toast.success(`Ocorrência ${buNum} atualizada com dados da análise.`);
        } else {
          toast.info(`BU ${buNum} já estava completo — nada a mesclar.`);
        }
      } else {
        await shift.addOccurrence(incoming);
        toast.success("Ocorrência enviada ao plantão.");
      }
    } catch {
      toast.error("Erro ao enviar ao plantão");
    }
  }, [result, shift, navigate]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      {status === "idle" && <DropZone onFileSelected={handleUpload} />}

      {isProcessing && <ProcessingStatus status={status} fileName={fileName} />}

      {status === "error" && (
        <div className="w-full max-w-lg mx-auto text-center space-y-4">
          <ProcessingStatus status={status} fileName={fileName} />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="lg" onClick={reset} className="min-h-[44px] gap-2">
            <RotateCcw className="w-4 h-4" />
            Tentar Novamente
          </Button>
        </div>
      )}

      {status === "triage_done" && triageResult && (
        <TriageQuickCard
          triage={triageResult}
          onSend={handleSendTriageToShift}
          onReset={reset}
        />
      )}

      {status === "done" && result && (
        <div className="w-full overflow-auto p-2">
          <AnalysisResultView
            data={result}
            onReset={reset}
            onReanalyze={reanalyze}
            reanalyzing={isProcessing}
            onSendToShift={handleSendFullToShift}
          />
        </div>
      )}
    </div>
  );
};

interface QuickProps {
  triage: TriageResult;
  onSend: () => void;
  onReset: () => void;
}

const TriageQuickCard = ({ triage, onSend, onReset }: QuickProps) => {
  const t = triage.triagem;
  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono text-xs">BO {t.numero_bo || "—"}</Badge>
                <Badge variant="outline" className="text-xs">{t.natureza || "—"}</Badge>
                <Badge variant="default" className="gap-1 text-xs">
                  <Sparkles className="w-3 h-3" /> Triagem rápida
                </Badge>
              </div>
              <CardTitle className="text-base">Pronto para distribuir ao plantão</CardTitle>
              <p className="text-xs text-muted-foreground">
                Depoimentos e despacho serão gerados sob demanda pelo OIP responsável.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Info icon={Calendar} label="Data do Fato" value={t.data_fato} />
            <Info icon={Building2} label="Delegacia" value={t.delegacia} />
            <Info icon={Scale} label="Natureza" value={t.natureza} />
            <Info icon={MapPin} label="Local" value={t.local_fato} />
            <Info icon={MapPin} label="Regional" value={t.regional_codigo || "(não identificada)"} />
            <Info icon={Building2} label="Unidade de Registro" value={t.unidade_registro || "—"} />
          </div>

          {t.resumo && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-1">Resumo</h4>
              <p className="text-sm leading-relaxed">{t.resumo}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <NameList label="Condutores" items={t.condutores_nomes} />
            <NameList label="Vítimas" items={t.vitimas_nomes} />
            <NameList label="Interrogados" items={t.interrogados_nomes} />
          </div>

          {t.tipificacoes_sugeridas && t.tipificacoes_sugeridas.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Tipificações sugeridas</h4>
              <div className="flex flex-wrap gap-2">
                {t.tipificacoes_sugeridas.map((tp, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {tp.artigo} — {tp.descricao}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {t.alertas?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {t.alertas.map((a, i) => (
                <Badge key={i} variant="destructive" className="gap-1 text-xs">
                  <AlertTriangle className="w-3 h-3" /> {a}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            <Button onClick={onSend} className="gap-2">
              <Send className="w-4 h-4" /> Enviar ao Plantão
            </Button>
            <Button variant="ghost" onClick={onReset} className="gap-2 ml-auto">
              <RotateCcw className="w-4 h-4" /> Nova Ocorrência
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const Info = ({ icon: Icon, label, value }: { icon: typeof Calendar; label: string; value?: string }) => (
  <div className="flex items-start gap-2.5 p-2.5 rounded-md bg-muted/30">
    <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground truncate">{value || "—"}</p>
    </div>
  </div>
);

const NameList = ({ label, items }: { label: string; items?: string[] }) => (
  <div className="p-2.5 rounded-md bg-muted/30">
    <p className="text-xs text-muted-foreground mb-1">{label}</p>
    {items && items.length > 0
      ? <ul className="space-y-0.5">{items.map((n, i) => <li key={i} className="text-sm truncate">{n}</li>)}</ul>
      : <p className="text-sm text-muted-foreground">—</p>}
  </div>
);

export default Index;
