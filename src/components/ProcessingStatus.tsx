import { motion } from "framer-motion";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import type { AnalysisStatus } from "@/types/analysis";
import { STATUS_MESSAGES } from "@/types/analysis";

interface ProcessingStatusProps {
  status: AnalysisStatus;
  fileName?: string;
}

const STEPS: AnalysisStatus[] = ["reading", "analyzing"];

const ProcessingStatus = ({ status, fileName }: ProcessingStatusProps) => {
  const currentIdx = STEPS.indexOf(status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-lg mx-auto"
    >
      <div className="bg-card border border-border rounded-lg p-8 space-y-6">
        {fileName && (
          <p className="text-sm text-muted-foreground text-center font-mono truncate">
            {fileName}
          </p>
        )}

        <div className="space-y-4">
          {STEPS.map((step, i) => {
            const isActive = step === status;
            const isDone = currentIdx > i || status === "done";
            const isError = status === "error" && isActive;

            return (
              <div key={step} className="flex items-center gap-3">
                <div className="w-6 h-6 flex items-center justify-center">
                  {isError ? (
                    <AlertCircle className="w-5 h-5 text-destructive" />
                  ) : isDone ? (
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  ) : isActive ? (
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  ) : (
                    <div className="w-3 h-3 rounded-full bg-muted" />
                  )}
                </div>
                <span
                  className={`text-sm transition-colors ${
                    isActive
                      ? "text-foreground font-medium"
                      : isDone
                      ? "text-muted-foreground"
                      : "text-muted-foreground/50"
                  }`}
                >
                  {STATUS_MESSAGES[step]}
                </span>
              </div>
            );
          })}
        </div>

        {status === "done" && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-sm font-medium text-success"
          >
            ✓ Análise concluída com sucesso
          </motion.p>
        )}
      </div>
    </motion.div>
  );
};

export default ProcessingStatus;
