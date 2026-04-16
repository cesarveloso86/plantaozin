import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AnalysisResult, AnalysisStatus } from "@/types/analysis";

export function useAnalysis() {
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const lastBase64 = useRef<string>("");
  const lastFileName = useRef<string>("");

  const analyze = useCallback(async (file: File) => {
    setFileName(file.name);
    lastFileName.current = file.name;
    setError(null);
    setResult(null);

    try {
      setStatus("reading");
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );
      lastBase64.current = base64;

      setStatus("validating");
      await new Promise((r) => setTimeout(r, 600));

      // Fetch user signature_style preferences (best-effort).
      let signatureStyle: any = null;
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("signature_style")
          .eq("id", user.id)
          .maybeSingle();
        signatureStyle = (prof as any)?.signature_style || null;
      }

      setStatus("analyzing");
      const { data, error: fnError } = await supabase.functions.invoke("analyze-bo", {
        body: { pdf_base64: base64, file_name: file.name, signature_style: signatureStyle },
      });

      if (fnError) throw new Error(fnError.message || "Erro ao processar o documento");

      setStatus("generating");
      await new Promise((r) => setTimeout(r, 400));

      if (!data || !data.triagem || !data.depoimentos || !data.despacho) {
        throw new Error("Resposta inválida do servidor");
      }

      const analysisResult = data as AnalysisResult;

      // Save to history (reuse the same `user` fetched above)
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

  const reanalyze = useCallback(async (instructions: string, field?: string) => {
    if (!lastBase64.current) return;
    setError(null);

    try {
      setStatus("analyzing");
      const { data, error: fnError } = await supabase.functions.invoke("analyze-bo", {
        body: {
          pdf_base64: lastBase64.current,
          file_name: lastFileName.current,
          instructions,
          previous_result: result,
          field,
        },
      });

      if (fnError) throw new Error(fnError.message || "Erro ao reprocessar");

      if (!data || !data.triagem || !data.depoimentos || !data.despacho) {
        throw new Error("Resposta inválida do servidor");
      }

      setResult(data as AnalysisResult);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      setStatus("error");
    }
  }, [result]);

  const reset = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setError(null);
    setFileName("");
    lastBase64.current = "";
    lastFileName.current = "";
  }, []);

  return { status, result, error, fileName, analyze, reanalyze, reset };
}
