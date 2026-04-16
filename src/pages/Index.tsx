import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import DropZone from "@/components/DropZone";
import ProcessingStatus from "@/components/ProcessingStatus";
import AnalysisResultView from "@/components/AnalysisResult";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useShift } from "@/hooks/useShift";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { REGIONALS } from "@/types/shift";

// Tenta mapear texto livre da delegacia/unidade para uma das REGIONALS oficiais.
function matchRegionalByKeyword(input: string | undefined): string {
  if (!input) return "";
  const norm = input.toUpperCase();
  for (const r of REGIONALS) {
    const key = r.split(" - ")[1] || r;
    if (norm.includes(key.toUpperCase())) return r;
  }
  if (norm.includes("DEACLE")) return "DEACLE";
  return "";
}

const Index = () => {
  const { status, result, error, fileName, analyze, reanalyze, reset } = useAnalysis();
  const shift = useShift();
  const navigate = useNavigate();
  const isProcessing = ["reading", "validating", "analyzing", "generating"].includes(status);

  const handleSendToShift = useCallback(async () => {
    if (!result || !shift.activeShift) {
      if (!shift.activeShift) {
        toast.error("Nenhum plantão ativo. Crie um plantão antes de enviar.");
        navigate("/plantao");
        return;
      }
      return;
    }

    // Resolve regional: 1) IA; 2) fallback por palavra-chave; 3) vazio + alerta.
    let regional = result.triagem.regional_codigo || "";
    if (!regional || !REGIONALS.includes(regional as typeof REGIONALS[number])) {
      regional = matchRegionalByKeyword(result.triagem.unidade_registro || result.triagem.delegacia);
    }
    if (!regional) {
      toast.warning("Não foi possível identificar a regional automaticamente — selecione manualmente.");
    }

    // Bloquear duplicado
    const buNum = (result.triagem.numero_bo || "").trim();
    if (buNum) {
      const dup = shift.occurrences.find((o) => (o.bu_number || "").trim() === buNum);
      if (dup) {
        const where = dup.status === "em_atendimento" ? "em distribuição" : "já atendida";
        toast.error(`BU ${buNum} já está ${where} neste plantão.`);
        return;
      }
    }

    try {
      await shift.addOccurrence({
        status: "em_atendimento",
        bu_number: buNum,
        tipification: result.despacho?.tipificacoes?.map(t => `${t.artigo} - ${t.descricao}`).join("; ") || "",
        conducted_names: result.depoimentos
          ?.filter(d => d.tipo === "interrogado")
          .map(d => d.nome)
          .join(", ") || "",
        victim_names: result.depoimentos
          ?.filter(d => d.tipo === "vitima")
          .map(d => d.nome)
          .join(", ") || "",
        regional,
        // observations: começa vazio — usuário preenche manualmente
        // first_hearing_time: vazio — preenchido ao iniciar a oitiva
        tramitation_time: new Date().toISOString(),
      });
      toast.success("Ocorrência enviada ao plantão — aguardando atendimento.");
    } catch {
      toast.error("Erro ao enviar ao plantão");
    }
  }, [result, shift, navigate]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      {status === "idle" && <DropZone onFileSelected={analyze} />}

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

      {status === "done" && result && (
        <div className="w-full overflow-auto p-2">
          <AnalysisResultView
            data={result}
            onReset={reset}
            onReanalyze={reanalyze}
            reanalyzing={isProcessing}
            onSendToShift={handleSendToShift}
          />
        </div>
      )}
    </div>
  );
};

export default Index;
