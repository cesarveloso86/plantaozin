import { Shield } from "lucide-react";
import DropZone from "@/components/DropZone";
import ProcessingStatus from "@/components/ProcessingStatus";
import AnalysisResultView from "@/components/AnalysisResult";
import { useAnalysis } from "@/hooks/useAnalysis";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

const Index = () => {
  const { status, result, error, fileName, analyze, reset } = useAnalysis();

  const isProcessing = ["reading", "validating", "analyzing", "generating"].includes(status);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground leading-tight">
                Flagrante Digital
              </h1>
              <p className="text-xs text-muted-foreground">
                Processamento de Boletins de Ocorrência
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 container max-w-5xl mx-auto px-4 py-8 flex flex-col items-center justify-center">
        {status === "idle" && (
          <DropZone onFileSelected={analyze} />
        )}

        {isProcessing && (
          <ProcessingStatus status={status} fileName={fileName} />
        )}

        {status === "error" && (
          <div className="w-full max-w-lg mx-auto text-center space-y-4">
            <ProcessingStatus status={status} fileName={fileName} />
            <p className="text-sm text-destructive">{error}</p>
            <Button
              variant="outline"
              size="lg"
              onClick={reset}
              className="min-h-[44px] gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Tentar Novamente
            </Button>
          </div>
        )}

        {status === "done" && result && (
          <AnalysisResultView data={result} onReset={reset} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-3">
        <p className="text-center text-xs text-muted-foreground">
          Sistema de uso restrito — Dados protegidos conforme LGPD
        </p>
      </footer>
    </div>
  );
};

export default Index;
