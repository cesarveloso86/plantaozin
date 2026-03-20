import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, FileText, Trash2, Eye, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import AnalysisResultView from "@/components/AnalysisResult";
import type { AnalysisResult } from "@/types/analysis";
import { motion } from "framer-motion";

interface AnalysisRow {
  id: string;
  file_name: string;
  numero_bo: string | null;
  natureza: string | null;
  delegacia: string | null;
  data_fato: string | null;
  result: AnalysisResult;
  created_at: string;
}

const Historico = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<AnalysisRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AnalysisRow | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("analyses")
        .select("*")
        .order("created_at", { ascending: false });
      setRows((data as unknown as AnalysisRow[]) || []);
      setLoading(false);
    };
    load();
  }, [user]);

  const handleDelete = async (id: string) => {
    await supabase.from("analyses").delete().eq("id", id);
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    return (
      (r.numero_bo?.toLowerCase() || "").includes(q) ||
      (r.natureza?.toLowerCase() || "").includes(q) ||
      (r.file_name?.toLowerCase() || "").includes(q) ||
      (r.delegacia?.toLowerCase() || "").includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Histórico de Análises</h2>
          <p className="text-sm text-muted-foreground">{rows.length} ocorrência(s) processada(s)</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por BO, natureza..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {rows.length === 0
                ? "Nenhuma análise realizada ainda."
                : "Nenhum resultado encontrado."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((row, i) => (
            <motion.div
              key={row.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
            >
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {row.numero_bo && (
                        <Badge variant="secondary" className="font-mono text-xs shrink-0">
                          BO {row.numero_bo}
                        </Badge>
                      )}
                      {row.natureza && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          {row.natureza}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 truncate">
                      {row.file_name} · {row.delegacia || "—"} ·{" "}
                      {new Date(row.created_at).toLocaleDateString("pt-BR", {
                        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setSelected(row)}
                      title="Visualizar"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(row.id)}
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Análise — {selected?.numero_bo || selected?.file_name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <AnalysisResultView data={selected.result} onReset={() => setSelected(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Historico;
