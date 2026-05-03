import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface HourSelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);

const formatHourLabel = (value: string) => `${value.slice(0, 2)}h`;

export function normalizeToHour(value: string | null | undefined) {
  if (!value) return "";
  const [rawHour] = value.split(":");
  const hour = Number(rawHour);
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return "";
  return `${String(hour).padStart(2, "0")}:00`;
}

export function HourSelect({ value, onChange, disabled, placeholder = "Selecione", className }: HourSelectProps) {
  const normalized = normalizeToHour(value);

  return (
    <Select value={normalized} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {HOURS.map((hour) => (
          <SelectItem key={hour} value={hour}>
            {formatHourLabel(hour)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
