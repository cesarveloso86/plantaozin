import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AnalysisResult, AnalysisStatus, TriageResult } from "@/types/analysis";

function fileToBase64(file: File): Promise<string> {
  return file.arrayBuffer().then((buffer) =>
    btoa(new Uint8Array(buffer).reduce((acc, b) => acc + String.fromCharCode(b), ""))
  );
}

async function fetchSignatureStyle(userId: string) {
  const { data: prof } = await supabase
    .from("profiles")
    .select("signature_style")
    .eq("id", userId)
    .maybeSingle();
  return (prof as { signature_style?: unknown } | null)?.signature_style ?? null;
}

export function useAnalysis() {
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const lastBase64 = useRef<string>("");
  const lastFileName = useRef<string>("");
  const pendingStoragePath = useRef<string>("");

  /** Triagem rápida: extrai apenas dados estruturados para distribuição. */
  const analyzeTriage = useCallback(async (file: File): Promise<TriageResult | null> => {
    setFileName(file.name);
    lastFileName.current = file.name;
    setError(null);
    setResult(null);
    setTriageResult(null);

    try {
      setStatus("reading");
      const base64 = await fileToBase64(file);
      lastBase64.current = base64;

      setStatus("analyzing");
      const { data, error: fnError } = await supabase.functions.invoke("analyze-bo", {
        body: { pdf_base64: base64, file_name: file.name, mode: "triage" },
      });
      if (fnError) throw new Error(fnError.message || "Erro na triagem");
      if (!data || !data.triagem) throw new Error("Resposta inválida do servidor");

      const triage: TriageResult = { triagem: data.triagem };
      setTriageResult(triage);
      setStatus("triage_done");
      return triage;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      setStatus("error");
      return null;
    }
  }, []);

  /**
   * Persiste o PDF da triagem no Storage privado e cria o registro `analyses`
   * (apenas com a triagem). Retorna { analysisId, storagePath } para vincular à ocorrência.
   */
  const persistTriageForShift = useCallback(
    async (triage: TriageResult): Promise<{ analysisId: string; storagePath: string } | null> => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");
        if (!lastBase64.current) throw new Error("PDF não disponível");

        const insertPayload = {
          user_id: user.id,
          file_name: lastFileName.current || "bu.pdf",
          numero_bo: triage.triagem.numero_bo || null,
          natureza: triage.triagem.natureza || null,
          delegacia: triage.triagem.delegacia || null,
          data_fato: triage.triagem.data_fato || null,
          result: triage as unknown as Record<string, unknown>,
        };

        const { data: inserted, error: insErr } = await supabase
          .from("analyses")
          .insert(insertPayload as never)
          .select("id")
          .single();
        if (insErr || !inserted) throw insErr || new Error("Falha ao salvar análise");

        const analysisId = inserted.id as string;
        const storagePath = `${user.id}/${analysisId}.pdf`;

        const bin = atob(lastBase64.current);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const blob = new Blob([bytes], { type: "application/pdf" });

        const { error: upErr } = await supabase.storage
          .from("bo-pdfs")
          .upload(storagePath, blob, { contentType: "application/pdf", upsert: true });
        if (upErr) throw upErr;

        const { error: updErr } = await supabase
          .from("analyses")
          .update({ pdf_storage_path: storagePath } as never)
          .eq("id", analysisId);
        if (updErr) throw updErr;

        pendingStoragePath.current = storagePath;
        return { analysisId, storagePath };
      } catch (err) {
        console.error("persistTriageForShift error:", err);
        setError(err instanceof Error ? err.message : "Erro ao salvar triagem");
        return null;
      }
    },
    [],
  );

  /**
   * Geração completa (depoimentos + despacho) sob demanda, a partir de um
   * registro `analyses` previamente salvo (com PDF no storage).
   */
  const generateFullFromAnalysis = useCallback(
    async (analysisId: string): Promise<AnalysisResult | null> => {
      setError(null);
      try {
        setStatus("analyzing");
        const { data: row, error: rowErr } = await supabase
          .from("analyses")
          .select("file_name, pdf_storage_path, result")
          .eq("id", analysisId)
          .maybeSingle();
        if (rowErr || !row) throw rowErr || new Error("Análise não encontrada");
        const storagePath = (row as { pdf_storage_path?: string | null }).pdf_storage_path;
        if (!storagePath) throw new Error("PDF original não está mais disponível");

        const { data: { user } } = await supabase.auth.getUser();
        const signatureStyle = user ? await fetchSignatureStyle(user.id) : null;

        const { data, error: fnError } = await supabase.functions.invoke("analyze-bo", {
          body: {
            pdf_storage_path: storagePath,
            file_name: row.file_name,
            mode: "full",
            signature_style: signatureStyle,
          },
        });
        if (fnError) throw new Error(fnError.message || "Erro ao gerar depoimentos");
        if (!data || !data.triagem || !data.depoimentos || !data.despacho) {
          throw new Error("Resposta inválida do servidor");
        }

        const full = data as AnalysisResult;

        await supabase
          .from("analyses")
          .update({
            result: full as unknown as Record<string, unknown>,
            numero_bo: full.triagem.numero_bo || null,
            natureza: full.triagem.natureza || null,
            delegacia: full.triagem.delegacia || null,
            data_fato: full.triagem.data_fato || null,
          } as never)
          .eq("id", analysisId);

        // LGPD: descarta PDF imediatamente após gerar depoimentos.
        await supabase.storage.from("bo-pdfs").remove([storagePath]);
        await supabase
          .from("analyses")
          .update({ pdf_storage_path: null } as never)
          .eq("id", analysisId);

        setResult(full);
        setStatus("done");
        return full;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro desconhecido");
        setStatus("error");
        return null;
      }
    },
    [],
  );

  /** Fluxo completo legado (compatibilidade com botão "Gerar tudo agora"). */
  const analyze = useCallback(async (file: File) => {
    setFileName(file.name);
    lastFileName.current = file.name;
    setError(null);
    setResult(null);
    setTriageResult(null);

    try {
      setStatus("reading");
      const base64 = await fileToBase64(file);
      lastBase64.current = base64;

      setStatus("validating");
      await new Promise((r) => setTimeout(r, 300));

      const { data: { user } } = await supabase.auth.getUser();
      const signatureStyle = user ? await fetchSignatureStyle(user.id) : null;

      setStatus("analyzing");
      const { data, error: fnError } = await supabase.functions.invoke("analyze-bo", {
        body: { pdf_base64: base64, file_name: file.name, signature_style: signatureStyle, mode: "full" },
      });
      if (fnError) throw new Error(fnError.message || "Erro ao processar o documento");

      setStatus("generating");
      await new Promise((r) => setTimeout(r, 200));

      if (!data || !data.triagem || !data.depoimentos || !data.despacho) {
        throw new Error("Resposta inválida do servidor");
      }
      const analysisResult = data as AnalysisResult;

      if (user) {
        await supabase.from("analyses").insert({
          user_id: user.id,
          file_name: file.name,
          numero_bo: analysisResult.triagem.numero_bo || null,
          natureza: analysisResult.triagem.natureza || null,
          delegacia: analysisResult.triagem.delegacia || null,
          data_fato: analysisResult.triagem.data_fato || null,
          result: analysisResult as unknown as Record<string, unknown>,
        } as never);
      }

      setResult(analysisResult);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      setStatus("error");
    }
  }, []);

  const reanalyze = useCallback(
    async (instructions: string, field?: string, depoimentoIndex?: number) => {
      if (!lastBase64.current) return;
      setError(null);
      try {
        setStatus("analyzing");
        const { data, error: fnError } = await supabase.functions.invoke("analyze-bo", {
          body: {
            pdf_base64: lastBase64.current,
            file_name: lastFileName.current,
            mode: "full",
            instructions,
            previous_result: result,
            field,
            depoimento_index: typeof depoimentoIndex === "number" ? depoimentoIndex : undefined,
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
    },
    [result],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setTriageResult(null);
    setError(null);
    setFileName("");
    lastBase64.current = "";
    lastFileName.current = "";
    pendingStoragePath.current = "";
  }, []);

  return {
    status, result, triageResult, error, fileName,
    analyze, analyzeTriage, persistTriageForShift, generateFullFromAnalysis,
    reanalyze, reset,
  };
}
