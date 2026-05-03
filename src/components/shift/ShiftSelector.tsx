import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import type { Shift } from "@/types/shift";
import { formatLocalDateBR } from "@/lib/utils";

interface Props {
  shifts: Shift[];
  onSelect: (shift: Shift) => void;
}

export function ShiftSelector({ shifts, onSelect }: Props) {
  const ativos = shifts.filter((s) => s.status === "active");
  const encerradosAll = shifts.filter((s) => s.status !== "active");
  const encerrados = encerradosAll.slice(0, 5);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          Plantões <ChevronDown className="w-3 h-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {ativos.length > 0 && (
          <>
            <DropdownMenuLabel>Ativo</DropdownMenuLabel>
            {ativos.map((s) => (
              <DropdownMenuItem key={s.id} onClick={() => onSelect(s)}>
                <span className="mr-2">🟢</span>
                {s.team_name} — {formatLocalDateBR(s.shift_date)}
              </DropdownMenuItem>
            ))}
          </>
        )}

        {ativos.length > 0 && encerrados.length > 0 && <DropdownMenuSeparator />}

        {encerrados.length > 0 && (
          <>
            <DropdownMenuLabel>Encerrados</DropdownMenuLabel>
            {encerrados.map((s) => (
              <DropdownMenuItem key={s.id} onClick={() => onSelect(s)}>
                <span className="mr-2">⚪</span>
                {s.team_name} — {formatLocalDateBR(s.shift_date)}
              </DropdownMenuItem>
            ))}
            {encerradosAll.length > 5 && (
              <DropdownMenuItem disabled>
                Ver todos em Histórico de Plantões
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
