import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import type { Shift } from "@/types/shift";

interface Props {
  shifts: Shift[];
  onSelect: (shift: Shift) => void;
}

export function ShiftSelector({ shifts, onSelect }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          Plantões <ChevronDown className="w-3 h-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {shifts.map((s) => (
          <DropdownMenuItem key={s.id} onClick={() => onSelect(s)}>
            <span className="mr-2">{s.status === "active" ? "🟢" : "⚪"}</span>
            {s.team_name} — {formatLocalDateBR(s.shift_date)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
