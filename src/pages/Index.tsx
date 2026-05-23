import { useCallback, useState } from "react";
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
import { PROCEDURE_TYPES, REGIONALS } from "@/types/shift";
import { matchRegionalByKeyword } from "@/lib/constants";
import { predictSubteamQueue, predictQueue } from "@/lib/availability";
import { classificarOcorrencia, type TipoOitiva } from "@/lib/classificacao";
import type { TriageResult, AnalysisResult } from "@/types/analysis";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

const Index = () => {
  const {
    status, result, triageResult, error, fileName, analysisId,
    analyzeTriage, persistTriageForShift,
    analyze, reanalyze, reset,
  } = useAnalysis();
  const shift = useShift();
  const navigate = useNavigate();
  const isProcessing = ["reading", "validating", "analyzing", "generating"].includes(status);

  const [showRegister, setShowRegister] = useState(false);
  const [regForm, setRegForm] = useState<{
    procedure_type: string;
    po_status: string;
    investigator: string;
    authority: string;
    has_report: boolean;
    has_fianca: boolean;
    fianca_paga: boolean;
    final_time: string;
    first_hearing_time: string;
  }>({
    procedure_type: "",
    po_status: "",
    investigator: "",
    authority: "",
    has_report: false,
    has_fianca: false,
    fianca_paga: false,
    final_time: "",
    first_hearing_time: "",
  });
  const [registering, setRegistering] = useState(false);

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
     // Considera TODAS as ocorrências (incluindo sem_oitiva) para computar carga,
     // de forma que a sugestão preditiva distribua igualmente entre as duas filas.
     const all = shift.occurrences;
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

  const classifyTriagem = (t: TriageResult["triagem"]): TipoOitiva => {
    const procType = (t as { procedure_type?: string }).procedure_type;
    const naturezaTxt = t.natureza || (t.tipificacoes_sugeridas || []).map((x) => x.descricao).join(", ");
    return classificarOcorrencia({
      procedure_type: procType,
      tipificacoes: (t.tipificacoes_sugeridas || []).map((x) => `${x.artigo} ${x.descricao}`),
      tem_conduzido: Array.isArray(t.interrogados_nomes) && t.interrogados_nomes.length > 0,
      tem_menor:
        procType === "BOC" ||
        procType === "AAAI" ||
        naturezaTxt.toLowerCase().includes("menor"),
      natureza_texto: naturezaTxt,
    });
  };

  const buildOccurrenceFromTriage = (t: TriageResult["triagem"]) => {
    const tipification = formatTipificacoesShort(t.tipificacoes_sugeridas);
    const { investigator, authority } = pickNextAssignees();
    const tipoOitiva = classifyTriagem(t);
    const statusInicial = tipoOitiva === "sem_oitiva" ? "sem_oitiva" : "em_atendimento";
    return {
      status: statusInicial as "em_atendimento" | "sem_oitiva",
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

  const toShiftIso = useCallback((timeStr: string) => {
    if (!shift.activeShift || !timeStr) return null;
    const hms = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
    return new Date(`${shift.activeShift.shift_date}T${hms}`).toISOString();
  }, [shift.activeShift]);

  const handleOpenRegister = useCallback(() => {
    if (!shift.activeShift) {
      toast.error("Nenhum plantão ativo. Crie um plantão antes.");
      navigate("/plantao");
      return;
    }
    const firstInv = shift.activeShift.investigators[0]?.name ?? "";
    const firstAuth = shift.activeShift.authorities[0]?.name ?? "";
    setRegForm({
      procedure_type: "",
      po_status: "",
      investigator: firstInv,
      authority: firstAuth,
      has_report: false,
      has_fianca: false,
      fianca_paga: false,
      final_time: result?.triagem.fim_lavratura_recebimento || "",
      first_hearing_time: "",
    });
    setShowRegister(true);
  }, [shift.activeShift, navigate, result]);

  const handleConfirmRegister = useCallback(async () => {
    if (!result || !shift.activeShift) return;
    if (!regForm.procedure_type) {
      toast.error("Selecione o tipo de procedimento.");
      return;
    }
    const buNum = (result.triagem.numero_bo || "").trim();
    const dup = shift.occurrences.find(
      (o) => (o.bu_number || "").trim() === buNum
    );
    if (dup) {
      const where = dup.status === "em_atendimento" ? "em distribuição" : "já atendida";
      toast.error(`BU ${buNum} já está ${where} neste plantão.`);
      return;
    }
    let regional = result.triagem.regional_codigo || "";
    if (!regional || !REGIONALS.includes(regional as typeof REGIONALS[number])) {
      regional = matchRegionalByKeyword(
        result.triagem.unidade_registro || result.triagem.delegacia
      );
    }
    setRegistering(true);
    try {
      await shift.addOccurrence({
        status: "em_atendimento",
        bu_number: buNum,
        procedure_type: regForm.procedure_type,
        po_status: regForm.po_status || null,
        investigator: regForm.investigator || null,
        authority: regForm.authority || null,
        has_report: regForm.has_report,
        has_fianca: regForm.has_fianca,
        fianca_paga: regForm.fianca_paga,
        tipification:
          result.despacho?.tipificacoes
            ?.map((t) => `${t.artigo} - ${t.descricao}`)
            .join("; ") || "",
        conducted_names:
          result.depoimentos
            ?.filter((d) => d.tipo === "interrogado")
            .map((d) => d.nome)
            .join(", ") || "",
        victim_names:
          result.depoimentos
            ?.filter((d) => d.tipo === "vitima")
            .map((d) => d.nome)
            .join(", ") || "",
        regional,
        tramitation_time: new Date().toISOString(),
        final_time: toShiftIso(regForm.final_time),
        first_hearing_time: toShiftIso(regForm.first_hearing_time),
        analysis_id: analysisId ?? null,
      } as unknown as Parameters<typeof shift.addOccurrence>[0]);
      toast.success("Ocorrência enviada para fila de atendimento.");
      setShowRegister(false);
    } catch {
      toast.error("Erro ao registrar ocorrência.");
    } finally {
      setRegistering(false);
    }
  }, [result, shift, regForm, analysisId, navigate, toShiftIso]);

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
          tipoOitiva={classifyTriagem(triageResult.triagem)}
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
            onRegister={handleOpenRegister}
          />
        </div>
      )}

      <Dialog open={showRegister} onOpenChange={setShowRegister}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Ocorrência</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md bg-muted/40 p-3 space-y-1 text-sm">
              <p><span className="text-muted-foreground">BU:</span> {result?.triagem.numero_bo || "—"}</p>
              <p><span className="text-muted-foreground">Regional:</span> {result?.triagem.regional_codigo || "—"}</p>
              {result?.triagem.fim_lavratura_recebimento && (
                <p><span className="text-muted-foreground">Fim da lavratura/Recebimento:</span> {result.triagem.fim_lavratura_recebimento}</p>
              )}
              {result?.triagem.natureza && (
                <p><span className="text-muted-foreground">Natureza:</span> {result.triagem.natureza}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Tipo de Procedimento *</Label>
              {result?.triagem.natureza && (
                <p className="text-xs text-muted-foreground">
                  Natureza extraída pelo IA: {result.triagem.natureza}
                </p>
              )}
              <Select
                value={regForm.procedure_type}
                onValueChange={(v) => setRegForm((p) => ({ ...p, procedure_type: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {PROCEDURE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">OIP</Label>
              <Select
                value={regForm.investigator}
                onValueChange={(v) => setRegForm((p) => ({ ...p, investigator: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(shift.activeShift?.investigators ?? []).map((m) => (
                    <SelectItem key={m.name} value={m.name}>
                      {m.nickname || m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Autoridade</Label>
              <Select
                value={regForm.authority}
                onValueChange={(v) => setRegForm((p) => ({ ...p, authority: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(shift.activeShift?.authorities ?? []).map((m) => (
                    <SelectItem key={m.name} value={m.name}>
                      {m.nickname || m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Status PO</Label>
              <Select
                value={regForm.po_status}
                onValueChange={(v) => setRegForm((p) => ({ ...p, po_status: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Aguardando">Aguardando</SelectItem>
                  <SelectItem value="Comunicado">Comunicado</SelectItem>
                  <SelectItem value="Tramitado">Tramitado</SelectItem>
                  <SelectItem value="Tramitado e comunicado">Tramitado e comunicado</SelectItem>
                  <SelectItem value="Enviado">Enviado</SelectItem>
                  <SelectItem value="Arquivado">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Hora Finalização</Label>
                <Input
                  type="time"
                  value={regForm.final_time}
                  onChange={(e) => setRegForm((p) => ({ ...p, final_time: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Hora 1ª Oitiva</Label>
                <Input
                  type="time"
                  value={regForm.first_hearing_time}
                  onChange={(e) => setRegForm((p) => ({ ...p, first_hearing_time: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Relatório</Label>
                <Switch
                  checked={regForm.has_report}
                  onCheckedChange={(v) => setRegForm((p) => ({ ...p, has_report: v }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Fiança aplicada</Label>
                <Switch
                  checked={regForm.has_fianca}
                  onCheckedChange={(v) =>
                    setRegForm((p) => ({ ...p, has_fianca: v, fianca_paga: v ? p.fianca_paga : false }))
                  }
                />
              </div>
              {regForm.has_fianca && (
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Fiança paga</Label>
                  <Switch
                    checked={regForm.fianca_paga}
                    onCheckedChange={(v) => setRegForm((p) => ({ ...p, fianca_paga: v }))}
                  />
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              A ocorrência será enviada para a fila de atendimento. Conclua o registro na aba Plantão.
            </p>

            <Button onClick={handleConfirmRegister} disabled={registering} className="w-full">
              {registering ? "Enviando..." : "Enviar para Fila"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface QuickProps {
  triage: TriageResult;
  tipoOitiva: TipoOitiva;
  onSend: () => void;
  onReset: () => void;
}

const TriageQuickCard = ({ triage, tipoOitiva, onSend, onReset }: QuickProps) => {
  const t = triage.triagem;
  const procType = (t as { procedure_type?: string }).procedure_type;
  const isTC = procType === "TC";
  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="font-mono text-xs">BO {t.numero_bo || "—"}</Badge>
                <Badge variant="outline" className="text-xs">{t.natureza || "—"}</Badge>
                <Badge variant="default" className="gap-1 text-xs">
                  <Sparkles className="w-3 h-3" /> Triagem rápida
                </Badge>
                {tipoOitiva === "com_oitiva" ? (
                  <Badge className="text-xs bg-green-600 hover:bg-green-600 text-white border-transparent">
                    🟢 COM OITIVA
                  </Badge>
                ) : (
                  <Badge className="text-xs bg-yellow-500 hover:bg-yellow-500 text-black border-transparent">
                    🟡 SEM OITIVA
                  </Badge>
                )}
              </div>
              <CardTitle className="text-base">Pronto para distribuir ao plantão</CardTitle>
              <p className="text-xs text-muted-foreground">
                Depoimentos e despacho serão gerados sob demanda pelo OIP responsável.
              </p>
              {isTC && (
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  ⚠️ Sugestão: devolver à PM (crime de menor potencial ofensivo). Se apresentado pela Guarda Municipal, não é possível devolver.
                </p>
              )}
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
