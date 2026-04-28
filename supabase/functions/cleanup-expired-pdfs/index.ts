import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RETENTION_HOURS = 24;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const cutoffIso = new Date(Date.now() - RETENTION_HOURS * 3600 * 1000).toISOString();

    // Busca registros com PDF ainda anexado e mais antigos que o limite.
    const { data: rows, error: qErr } = await service
      .from("analyses")
      .select("id, pdf_storage_path, created_at")
      .not("pdf_storage_path", "is", null)
      .lt("created_at", cutoffIso);

    if (qErr) throw qErr;

    const paths = (rows || [])
      .map((r: { pdf_storage_path: string | null }) => r.pdf_storage_path)
      .filter((p): p is string => !!p);

    let removed = 0;
    if (paths.length > 0) {
      // Storage remove aceita batch.
      const { error: rmErr } = await service.storage.from("bo-pdfs").remove(paths);
      if (rmErr) console.error("Storage remove error:", rmErr);
      removed = paths.length;

      const ids = (rows || []).map((r: { id: string }) => r.id);
      const { error: upErr } = await service
        .from("analyses")
        .update({ pdf_storage_path: null })
        .in("id", ids);
      if (upErr) console.error("Update error:", upErr);
    }

    const result = { ok: true, removed, cutoff: cutoffIso };
    console.log("cleanup-expired-pdfs", result);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro desconhecido";
    console.error("cleanup-expired-pdfs error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
