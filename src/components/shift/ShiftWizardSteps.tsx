import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  current: 1 | 2 | 3;
  labels?: [string, string, string];
}

export function ShiftWizardSteps({ current, labels = ["Equipe", "Composição", "Revisar"] }: Props) {
  return (
    <div className="flex items-center justify-between gap-1 px-1 mb-2">
      {labels.map((label, i) => {
        const step = (i + 1) as 1 | 2 | 3;
        const done = step < current;
        const active = step === current;
        return (
          <div key={label} className="flex items-center gap-1.5 flex-1">
            <div
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 border",
                done && "bg-primary text-primary-foreground border-primary",
                active && "bg-primary/15 text-primary border-primary",
                !done && !active && "bg-muted text-muted-foreground border-border",
              )}
            >
              {done ? <Check className="w-3.5 h-3.5" /> : step}
            </div>
            <span
              className={cn(
                "text-xs truncate",
                active ? "text-foreground font-medium" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
            {i < 2 && <div className={cn("h-px flex-1 mx-1", done ? "bg-primary" : "bg-border")} />}
          </div>
        );
      })}
    </div>
  );
}
