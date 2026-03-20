import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AnalysisResult, AnalysisStatus } from "@/types/analysis";

export function useAnalysis() {
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");

  const analyze = useCallback(async (file: File) => {
    setFileName(file.name);
    setError(null);
    setResult(null);

    try {
      // Step 1: Read PDF
      setStatus("reading");
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );

      // Step 2: Validate
      setStatus("validating");
      await new Promise((r) => setTimeout(r, 600));

      // Step 3: Analyze
      setStatus("analyzing");

      const { data, error: fnError } = await supabase.functions.invoke("analyze-bo", {
        body: { pdf_base64: base64, file_name: file.name },
      });

      if (fnError) throw new Error(fnError.message || "Erro ao processar o documento");

      // Step 4: Generate
      setStatus("generating");
      await new Promise((r) => setTimeout(r, 400));

      if (!data || !data.triagem || !data.depoimentos) {
        throw new Error("Resposta inválida do servidor");
      }

      setResult(data as AnalysisResult);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      setStatus("error");
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setError(null);
    setFileName("");
  }, []);

  return { status, result, error, fileName, analyze, reset };
}
