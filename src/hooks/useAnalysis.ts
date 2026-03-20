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
      setStatus("reading");
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );

      setStatus("validating");
      await new Promise((r) => setTimeout(r, 600));

      setStatus("analyzing");
      const { data, error: fnError } = await supabase.functions.invoke("analyze-bo", {
        body: { pdf_base64: base64, file_name: file.name },
      });

      if (fnError) throw new Error(fnError.message || "Erro ao processar o documento");

      setStatus("generating");
      await new Promise((r) => setTimeout(r, 400));

      if (!data || !data.triagem || !data.depoimentos || !data.despacho) {
        throw new Error("Resposta inválida do servidor");
      }

      const analysisResult = data as AnalysisResult;

      // Save to history
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("analyses").insert({
          user_id: user.id,
          file_name: file.name,
          numero_bo: analysisResult.triagem.numero_bo || null,
          natureza: analysisResult.triagem.natureza || null,
          delegacia: analysisResult.triagem.delegacia || null,
          data_fato: analysisResult.triagem.data_fato || null,
          result: analysisResult as any,
        } as any);
      }

      setResult(analysisResult);
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
