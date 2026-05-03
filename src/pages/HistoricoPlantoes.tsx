import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useShift } from "@/hooks/useShift";
import { Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatLocalDateBR } from "@/lib/utils";
import type { Shift } from "@/types/shift";

const PAGE_SIZE = 15;

type StatusFilter = "all" | "active" | "closed";

const HistoricoPlantoes = () => {
  const navigate = useNavigate();
  const { selectShift } = useShift();
  const [rows, setRows] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query = supabase
        .from("shifts")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);
      if (search.trim()) {
        query = query.ilike("team_name", `%${search.trim()}%`);
      }
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      const { data, count } = await query;
      setRows((data as unknown as Shift[]) || []);
      setTotal(count ?? 0);
      setLoading(false);
    };
    load();
  }, [page, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    setSearch(searchInput);
  };

  const handleSelect = async (shift: Shift) => {
    await selectShift(shift);
    navigate("/plantao");
  };

  return (
    <div className="flex-1 p-6 max-w-5xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">
          Histórico de Plantões
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Consulte plantões anteriores e ativos.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por equipe..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
        </form>
        <Select
          value={statusFilter}
          onValueChange={(v: StatusFilter) => {
            setStatusFilter(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="sm:w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="closed">Encerrado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhum plantão encontrado.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground truncate">
                      {s.team_name}
                    </span>
                    <Badge
                      variant="secondary"
                      className={
                        s.status === "active"
                          ? "bg-green-500/15 text-green-600 dark:text-green-400 hover:bg-green-500/20"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {s.status === "active" ? "Ativo" : "Encerrado"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatLocalDateBR(s.shift_date)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSelect(s)}
                >
                  Selecionar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && total > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-6">
          <span className="text-xs text-muted-foreground">
            Página {page + 1} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page + 1 >= totalPages}
            >
              Próxima <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoricoPlantoes;
