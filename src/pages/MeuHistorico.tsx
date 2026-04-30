import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useAnalysis } from "@/hooks/useAnalysis";
import { Loader2, FileText, Sparkles, Eye, AlertCircle, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import AnalysisResultView from "@/components/AnalysisResult";
import type { AnalysisResult } from "@/types/analysis";
import { fmtDateTime, fmtTime } from "@/lib/utils";
import { toast } from "sonner";

interface Row {
  id: string;
  bu_number: string;
  tramitation_time: string | null;
  procedure_type: string | null;
  investigator: string | null;
  authority: string | null;
  regional: string | null;
  analysis_id: string | null;
  shift_id: string;
  // joined
  shift_date?: string;
  team_name?: string;
  pdf_storage_path?: string | null;
  has_full_result?: boolean;
  full_result?: AnalysisResult | null;
  analysis_created_at?: string | null;
}

const MeuHistorico = () => {
  const { user, isAdmin } = useAuth();
  const { profile } = useProfile();
  const analysis = useAnalysis();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterName, setFilterName] = useState<string>("");
  const [allNames, setAllNames] = useState<string[]>([]);

  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [resultData, setResultData] = useState<AnalysisResult | null>(null);

  // Quem é "eu" para filtragem por nome (investigator/authority).
  const myName = profile?.full_name || "";

  useEffect(() => {
    if (isAdmin) {
      // Carrega lista de nomes possíveis (membros ativos) para o filtro.
      supabase
        .from("team_members")
        .select("full_name")
        .eq("is_active", true)
        .order("full_name")
        .then(({ data }) => {
          const names = (data || []).map((d: { full_name: string }) => d.full_name);
          setAllNames(names);
        });
    }
  }, [isAdmin]);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);
      const targetName = isAdmin && filterName ? filterName : myName;
      if (!targetName) { setRows([]); setLoading(false); return; }

      const { data: occs, error } = await supabase
        .from("shift_occurrences")
        .select("id, bu_number, tramitation_time, procedure_type, investigator, authority, regional, analysis_id, shift_id, shifts(shift_date, team_name)")
        .or(`investigator.eq.${targetName},authority.eq.${targetName}`)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        console.error(error);
        setRows([]);
        setLoading(false);
        return;
      }

      const analysisIds = Array.from(new Set((occs || [])
        .map((o: { analysis_id: string | null }) => o.analysis_id)
        .filter((x): x is string => !!x)));

      let analysesById: Record<string, { pdf_storage_path: string | null; result: AnalysisResult | null; created_at: string | null }> = {};
      if (analysisIds.length > 0) {
        const { data: ans } = await supabase
          .from("analyses")
          .select("id, pdf_storage_path, result, created_at")
          .in("id", analysisIds);
        for (const a of (ans || []) as Array<{ id: string; pdf_storage_path: string | null; result: unknown; created_at: string | null }>) {
          analysesById[a.id] = {
            pdf_storage_path: a.pdf_storage_path,
            result: a.result as AnalysisResult | null,
            created_at: a.created_at,
          };
        }
      }

      const enriched: Row[] = (occs || []).map((o: {
        id: string; bu_number: string; tramitation_time: string | null;
        procedure_type: string | null; investigator: string | null; authority: string | null;
        regional: string | null; analysis_id: string | null; shift_id: string;
        shifts: { shift_date: string; team_name: string } | null;
      }) => {
        const a = o.analysis_id ? analysesById[o.analysis_id] : undefined;
        const result = a?.result || null;
        const hasFull = !!(result && (result as AnalysisResult).depoimentos && (result as AnalysisResult).depoimentos.length > 0);
        return {
          id: o.id,
          bu_number: o.bu_number,
          tramitation_time: o.tramitation_time,
          procedure_type: o.procedure_type,
          investigator: o.investigator,
          authority: o.authority,
          regional: o.regional,
          analysis_id: o.analysis_id,
          shift_id: o.shift_id,
          shift_date: o.shifts?.shift_date,
          team_name: o.shifts?.team_name,
          pdf_storage_path: a?.pdf_storage_path ?? null,
          has_full_result: hasFull,
          full_result: result,
          analysis_created_at: a?.created_at ?? null,
        };
      });

      setRows(enriched);
      setLoading(false);
    };
    load();
  }, [user, myName, isAdmin, filterName]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.bu_number.toLowerCase().includes(q) ||
      (r.procedure_type || "").toLowerCase().includes(q) ||
      (r.regional || "").toLowerCase().includes(q) ||
      (r.team_name || "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  // Group by shift_id
  const groups = useMemo(() => {
    const map = new Map<string, { shift_date?: string; team_name?: string; items: Row[] }>();
    for (const r of filtered) {
      const k = r.shift_id;
      if (!map.has(k)) map.set(k, { shift_date: r.shift_date, team_name: r.team_name, items: [] });
      map.get(k)!.items.push(r);
    }
    return Array.from(map.entries()).map(([shift_id, v]) => ({ shift_id, ...v }));
  }, [filtered]);

  const handleGenerate = async (row: Row) => {
    if (!row.analysis_id) {
      toast.error("Esta ocorrência não tem PDF vinculado.");
      return;
    }
    setGeneratingFor(row.id);
    const full = await analysis.generateFullFromAnalysis(row.analysis_id);
    setGeneratingFor(null);
    if (full) {
      setResultData(full);
      setResultOpen(true);
      toast.success("Depoimentos gerados.");
      // Atualiza a linha localmente: PDF foi descartado pela edge function.
      setRows((prev) => prev.map((r) => r.id === row.id
        ? { ...r, pdf_storage_path: null, has_full_result: true, full_result: full }
        : r));
    } else {
      toast.error("Não foi possível gerar os depoimentos.");
    }
  };

  const handleView = (row: Row) => {
    if (row.full_result) {
      setResultData(row.full_result);
      setResultOpen(true);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Meu Histórico</h2>
            <p className="text-sm text-muted-foreground">
              Ocorrências em que você atuou como OIP ou Autoridade. Gere depoimentos sob demanda enquanto o PDF estiver disponível (≤ 24h).
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            {isAdmin && (
              <Select value={filterName || "__me__"} onValueChange={(v) => setFilterName(v === "__me__" ? "" : v)}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Membro" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__me__">Meu histórico</SelectItem>
                  {allNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar BU, tipo, regional..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>

        {groups.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {myName
                  ? "Nenhuma ocorrência registrada em seu nome ainda."
                  : "Complete seu perfil (nome completo) para ver seu histórico."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <Card key={g.shift_id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <span>Plantão {g.shift_date ? fmtDateTime(g.shift_date) : "—"}</span>
                    {g.team_name && <Badge variant="outline">{g.team_name}</Badge>}
                    <Badge variant="secondary" className="ml-auto">{g.items.length} ocorr.</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {g.items.map((row) => {
                    const pdfAvailable = !!row.pdf_storage_path;
                    const hasFull = !!row.has_full_result;
                    const isGenerating = generatingFor === row.id;
                    return (
                      <div
                        key={row.id}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-background flex-wrap"
                      >
                        <span className="font-mono font-bold text-sm min-w-[90px]">
                          {row.bu_number}
                        </span>
                        {row.procedure_type && (
                          <Badge variant="secondary" className="text-xs">{row.procedure_type}</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {fmtTime(row.tramitation_time)}
                        </span>
                        {row.regional && (
                          <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                            {row.regional}
                          </span>
                        )}
                        <div className="ml-auto flex items-center gap-1.5">
                          {hasFull && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1"
                              onClick={() => handleView(row)}
                            >
                              <Eye className="w-3.5 h-3.5" /> Ver depoimentos
                            </Button>
                          )}
                          {pdfAvailable && (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-8 gap-1"
                              disabled={isGenerating}
                              onClick={() => handleGenerate(row)}
                            >
                              {isGenerating
                                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando…</>
                                : <><Sparkles className="w-3.5 h-3.5" /> {hasFull ? "Regerar" : "Gerar depoimentos"}</>}
                            </Button>
                          )}
                          {!pdfAvailable && !hasFull && row.analysis_id && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground cursor-help">
                                  <AlertCircle className="w-3.5 h-3.5" /> PDF expirado
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[260px]">
                                Por LGPD, o PDF original do BU é descartado em até 24h após a triagem. Não é mais possível gerar depoimentos para esta ocorrência.
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {!row.analysis_id && (
                            <span className="text-xs text-muted-foreground italic">
                              Sem PDF vinculado
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={resultOpen} onOpenChange={setResultOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Depoimentos e despacho</DialogTitle>
            </DialogHeader>
            {resultData && (
              <AnalysisResultView data={resultData} onReset={() => setResultOpen(false)} />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

export default MeuHistorico;
