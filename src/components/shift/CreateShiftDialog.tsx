import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { ShiftMember } from "@/types/shift";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (params: {
    team_name: string;
    shift_date: string;
    start_time: string;
    authorities: ShiftMember[];
    investigators: ShiftMember[];
    iseo: ShiftMember[];
  }) => Promise<any>;
}

export function CreateShiftDialog({ open, onOpenChange, onCreate }: Props) {
  const [teamName, setTeamName] = useState("");
  const [shiftDate, setShiftDate] = useState(new Date().toISOString().split("T")[0]);
  const [startHour, setStartHour] = useState("10:00");
  const [authoritiesText, setAuthoritiesText] = useState("");
  const [investigatorsText, setInvestigatorsText] = useState("");
  const [iseoText, setIseoText] = useState("");
  const [saving, setSaving] = useState(false);

  const parseMembers = (text: string): ShiftMember[] =>
    text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const nfMatch = line.match(/NF\s*(\d+)/i);
        const name = line.replace(/[-–]\s*NF\s*\d+/i, "").trim();
        return { name, nf: nfMatch?.[1] || undefined };
      });

  const handleCreate = async () => {
    if (!teamName.trim()) {
      toast.error("Informe o nome da equipe");
      return;
    }
    setSaving(true);
    try {
      const startTime = new Date(`${shiftDate}T${startHour}:00`).toISOString();
      await onCreate({
        team_name: teamName,
        shift_date: shiftDate,
        start_time: startTime,
        authorities: parseMembers(authoritiesText),
        investigators: parseMembers(investigatorsText),
        iseo: parseMembers(iseoText),
      });
      toast.success("Plantão criado com sucesso!");
      onOpenChange(false);
      setTeamName("");
      setAuthoritiesText("");
      setInvestigatorsText("");
      setIseoText("");
    } catch (err) {
      toast.error("Erro ao criar plantão");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Plantão</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Equipe</Label>
              <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Equipe A" />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={shiftDate} onChange={(e) => setShiftDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Horário de Início</Label>
            <Input type="time" value={startHour} onChange={(e) => setStartHour(e.target.value)} />
          </div>
          <div>
            <Label>Autoridades Policiais (uma por linha)</Label>
            <Textarea
              rows={4}
              value={authoritiesText}
              onChange={(e) => setAuthoritiesText(e.target.value)}
              placeholder="DR ALDARI DOS SANTOS PIMENTEL&#10;DRª IVINA QUEIROZ DE OLIVEIRA"
            />
          </div>
          <div>
            <Label>OIPs - Oficiais Investigadores (uma por linha)</Label>
            <Textarea
              rows={4}
              value={investigatorsText}
              onChange={(e) => setInvestigatorsText(e.target.value)}
              placeholder="CESAR CURY VELOSO - NF 4752619&#10;CHRISTIANY FRASSON - NF 2557100"
            />
          </div>
          <div>
            <Label>ISEO (uma por linha, opcional)</Label>
            <Textarea
              rows={2}
              value={iseoText}
              onChange={(e) => setIseoText(e.target.value)}
              placeholder="18H00 ÀS 02H00 - VANESSA LUBE - NF 3087573"
            />
          </div>
          <Button onClick={handleCreate} disabled={saving} className="w-full">
            {saving ? "Criando..." : "Criar Plantão"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
