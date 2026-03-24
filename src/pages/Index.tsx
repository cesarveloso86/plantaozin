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

    try {
      await shift.addOccurrence({
        bu_number: result.triagem.numero_bo || "",
        tipification: result.despacho?.tipificacoes?.map(t => `${t.artigo} - ${t.descricao}`).join("; ") || "",
        conducted_names: result.depoimentos
          ?.filter(d => d.tipo === "interrogado")
          .map(d => d.nome)
          .join(", ") || "",
        victim_names: result.depoimentos
          ?.filter(d => d.tipo === "vitima")
          .map(d => d.nome)
          .join(", ") || "",
        regional: result.triagem.delegacia || "",
        observations: result.triagem.resumo?.substring(0, 200) || "",
        tramitation_time: new Date().toISOString(),
      });
      toast.success("Ocorrência enviada ao plantão com sucesso!");
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
