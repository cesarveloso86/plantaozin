import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChevronLeft, Sparkles, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { Shift, ShiftMember, ShiftAbsence, ShiftSubteam } from "@/types/shift";
import { AbsenceSelector } from "./AbsenceSelector";
import { SubteamComposer, flattenSubteams } from "./SubteamComposer";
import { TEAM_NAMES } from "./shiftConstants";
import { useAllShiftMembers } from "@/hooks/useTeamMembers";
import { ShiftWizardSteps } from "./ShiftWizardSteps";
import { applyRotation, getTeamRule } from "./rotation";
import { HourSelect } from "./HourSelect";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (params: {
    team_name: string;
    shift_date: string;
    start_time: string;
    end_time?: string;
    iseo: ShiftMember[];
    absences?: ShiftAbsence[];
    oip_subteams: ShiftSubteam[];
    delegado_subteams: ShiftSubteam[];
    iseo_subteams: ShiftSubteam[];
  }) => Promise<unknown>;
  /** Busca o último plantão da equipe para aplicar rotação automática. */
  getLastShiftForTeam?: (teamName: string) => Promise<Shift | null>;
}

const OIP_CARGOS = ["OIP"];
const DELEGADO_CARGOS = ["Autoridade Policial", "Delegado", "Autoridade"];
const ISEO_CARGOS = ["OIP", "Autoridade Policial", "Delegado", "Autoridade"];

const todayISO = () => new Date().toISOString().split("T")[0];
const tomorrowISO = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
};

export function CreateShiftDialog({ open, onOpenChange, onCreate, getLastShiftForTeam }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [teamName, setTeamName] = useState("");
  const [shiftDate, setShiftDate] = useState(todayISO());
  const [startHour, setStartHour] = useState("10:00");
  const [saving, setSaving] = useState(false);

  const [oipSubteams, setOipSubteams] = useState<ShiftSubteam[]>([]);
  const [delSubteams, setDelSubteams] = useState<ShiftSubteam[]>([]);
  const [iseoSubteams, setIseoSubteams] = useState<ShiftSubteam[]>([]);
  const [absences, setAbsences] = useState<ShiftAbsence[]>([]);

  const [lastShift, setLastShift] = useState<Shift | null>(null);
  const [checkingLast, setCheckingLast] = useState(false);
  const [rotationApplied, setRotationApplied] = useState(false);
  const [activeTab, setActiveTab] = useState<"delegado" | "oip" | "iseo">("delegado");

  const { users } = useAllShiftMembers(open);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep(1);
      setTeamName("");
      setShiftDate(todayISO());
      setStartHour("10:00");
      setOipSubteams([]);
      setDelSubteams([]);
      setIseoSubteams([]);
      setAbsences([]);
      setLastShift(null);
      setRotationApplied(false);
    }
  }, [open]);

  // Quando muda equipe, busca último plantão para oferecer rotação
  useEffect(() => {
    if (!teamName || !getLastShiftForTeam) {
      setLastShift(null);
      return;
    }
    setCheckingLast(true);
    getLastShiftForTeam(teamName)
      .then((s) => setLastShift(s))
      .finally(() => setCheckingLast(false));
  }, [teamName, getLastShiftForTeam]);

  const flatOip = flattenSubteams(oipSubteams);
  const flatDel = flattenSubteams(delSubteams);
  const flatIseo = flattenSubteams(iseoSubteams);
  const allSelectedNames = [
    ...flatOip.map((m) => m.name),
    ...flatDel.map((m) => m.name),
    ...flatIseo.map((m) => m.name),
  ];

  const totalMembers = flatOip.length + flatDel.length + flatIseo.length;

  const handleApplyRotation = () => {
    if (!lastShift) return;
    const rule = getTeamRule(teamName);
    const rotated = applyRotation(lastShift, rule);
    setDelSubteams(rotated.delegado_subteams);
    setOipSubteams(rotated.oip_subteams);
    setIseoSubteams(rotated.iseo_subteams);
    setRotationApplied(true);
    setStep(3); // pula direto pra revisão
    toast.success("Rotação aplicada — revise antes de criar");
  };

  const handleStartFresh = () => {
    setDelSubteams([]);
    setOipSubteams([]);
    setIseoSubteams([]);
    setRotationApplied(false);
    setStep(2);
  };

  const handleUndoRotation = () => {
    setDelSubteams([]);
    setOipSubteams([]);
    setIseoSubteams([]);
    setRotationApplied(false);
    toast.info("Rotação desfeita");
  };

  const handleCreate = async () => {
    if (!teamName.trim()) {
      toast.error("Selecione a equipe");
      return;
    }
    setSaving(true);
    try {
      const startTime = new Date(`${shiftDate}T${startHour}:00`).toISOString();
      const endDate = new Date(`${shiftDate}T${startHour}:00`);
      endDate.setHours(endDate.getHours() + 24);
      const endTime = endDate.toISOString();
      await onCreate({
        team_name: teamName,
        shift_date: shiftDate,
        start_time: startTime,
        end_time: endTime,
        iseo: flatIseo,
        absences,
        oip_subteams: oipSubteams,
        delegado_subteams: delSubteams,
        iseo_subteams: iseoSubteams,
      });
      toast.success("Plantão criado com sucesso!");
      onOpenChange(false);
    } catch {
      toast.error("Erro ao criar plantão");
    } finally {
      setSaving(false);
    }
  };

  const canGoToStep2 = !!teamName;
  const canGoToStep3 = totalMembers > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2">
            {step > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 -ml-1"
                onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            )}
            Novo Plantão
          </DialogTitle>
          <ShiftWizardSteps current={step} />
        </DialogHeader>

        {/* PASSO 1 — Identificação */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label>Equipe</Label>
              <Select value={teamName} onValueChange={setTeamName}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar equipe..." />
                </SelectTrigger>
                <SelectContent>
                  {TEAM_NAMES.map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
              <div>
                <Label>Data</Label>
                <Input type="date" value={shiftDate} onChange={(e) => setShiftDate(e.target.value)} />
              </div>
              <Button
                type="button"
                variant={shiftDate === todayISO() ? "default" : "outline"}
                size="sm"
                onClick={() => setShiftDate(todayISO())}
              >
                Hoje
              </Button>
              <Button
                type="button"
                variant={shiftDate === tomorrowISO() ? "default" : "outline"}
                size="sm"
                onClick={() => setShiftDate(tomorrowISO())}
              >
                Amanhã
              </Button>
            </div>

            <div>
              <Label>Horário de Início</Label>
              <HourSelect value={startHour} onChange={setStartHour} />
              <p className="text-xs text-muted-foreground mt-1">Término padrão: +24h</p>
            </div>

            {/* Quick-Start: rotação */}
            {teamName && (
              <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                {checkingLast ? (
                  <p className="text-xs text-muted-foreground">Verificando último plantão…</p>
                ) : lastShift ? (
                  <>
                    <div className="flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Aplicar rotação automática?</p>
                        <p className="text-xs text-muted-foreground">
                          Última escala de {teamName}: {lastShift.delegado_subteams.length} Deleg. ·{" "}
                          {lastShift.oip_subteams.length} OIPs · {lastShift.iseo_subteams.length} ISEO.
                          Os turnos e a ordem interna serão deslocados conforme as regras da equipe.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleApplyRotation} className="flex-1">
                        Sim, aplicar rotação
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleStartFresh} className="flex-1">
                        Montar do zero
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Sem plantão anterior para esta equipe. Você vai montar do zero no próximo passo.
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button onClick={() => setStep(2)} disabled={!canGoToStep2}>
                Próximo
              </Button>
            </div>
          </div>
        )}

        {/* PASSO 2 — Composição */}
        {step === 2 && (
          <div className="space-y-3">
            {rotationApplied && (
              <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 p-2 px-3">
                <div className="flex items-center gap-2 text-xs">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>Rotação aplicada</span>
                </div>
                <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={handleUndoRotation}>
                  <RotateCcw className="w-3 h-3" /> Desfazer
                </Button>
              </div>
            )}

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
              <TabsList className="w-full grid grid-cols-3 h-9">
                <TabsTrigger value="delegado" className="text-xs">
                  Delegados <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{flatDel.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="oip" className="text-xs">
                  OIPs <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{flatOip.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="iseo" className="text-xs">
                  ISEO <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{flatIseo.length}</Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="delegado" className="mt-3">
                <SubteamComposer
                  category="Delegado"
                  title="Subequipes de Delegados"
                  subteams={delSubteams}
                  setSubteams={setDelSubteams}
                  users={users}
                  allSelectedNames={allSelectedNames}
                  allowedCargos={DELEGADO_CARGOS}
                />
              </TabsContent>

              <TabsContent value="oip" className="mt-3">
                <SubteamComposer
                  category="OIP"
                  title="Subequipes de OIPs"
                  subteams={oipSubteams}
                  setSubteams={setOipSubteams}
                  users={users}
                  allSelectedNames={allSelectedNames}
                  allowedCargos={OIP_CARGOS}
                />
              </TabsContent>

              <TabsContent value="iseo" className="mt-3">
                <SubteamComposer
                  category="ISEO"
                  title="Subequipes ISEO (8h)"
                  subteams={iseoSubteams}
                  setSubteams={setIseoSubteams}
                  users={users}
                  allSelectedNames={allSelectedNames}
                  allowedCargos={ISEO_CARGOS}
                />
              </TabsContent>
            </Tabs>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(1)}>Voltar</Button>
              <Button onClick={() => setStep(3)} disabled={!canGoToStep3}>Próximo</Button>
            </div>
          </div>
        )}

        {/* PASSO 3 — Revisão */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-md border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{teamName}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(shiftDate + "T00:00:00").toLocaleDateString("pt-BR")} · {startHour} (24h)
                </span>
              </div>

              {[
                { label: "Delegados", subs: delSubteams },
                { label: "OIPs", subs: oipSubteams },
                { label: "ISEO", subs: iseoSubteams },
              ].map(({ label, subs }) =>
                subs.length === 0 ? null : (
                  <div key={label} className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">{label}</p>
                    <div className="flex flex-wrap gap-1">
                      {subs.map((s) => (
                        <Badge key={s.id} variant="outline" className="text-xs gap-1">
                          {s.label}
                          <span className="text-muted-foreground">·</span>
                          {s.members.length} {s.members.length === 1 ? "membro" : "membros"}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )
              )}

              {totalMembers === 0 && (
                <p className="text-xs text-destructive">Nenhum membro adicionado. Volte e componha as subequipes.</p>
              )}
            </div>

            <AbsenceSelector
              absences={absences}
              setAbsences={setAbsences}
              availableNames={users.map((u) => u.full_name)}
            />

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(2)}>Voltar</Button>
              <Button onClick={handleCreate} disabled={saving || totalMembers === 0}>
                {saving ? "Criando…" : "Criar Plantão"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
