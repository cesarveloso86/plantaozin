import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Shift, ShiftOccurrence } from "@/types/shift";

interface Props {
  occurrences: ShiftOccurrence[];
  shift: Shift;
}

export function StatisticsTab({ occurrences, shift }: Props) {
  // Build name → nickname map from the shift roster.
  const nicknameMap = useMemo(() => {
    const m = new Map<string, string>();
    [...shift.investigators, ...shift.authorities, ...shift.iseo].forEach((p) => {
      if (p.nickname && p.nickname.trim()) m.set(p.name, p.nickname);
    });
    return m;
  }, [shift]);
  const displayLabel = (name: string) => nicknameMap.get(name) || name;

  const stats = useMemo(() => {
    // Apenas ocorrências atendidas contam nas estatísticas oficiais.
    const finalOccs = occurrences.filter((o) => o.status !== "em_atendimento");
    const byType: Record<string, number> = {};
    const byRegional: Record<string, number> = {};
    const byInvestigator: Record<string, number> = {};
    const byAuthority: Record<string, number> = {};
    let totalHearings = 0;

    finalOccs.forEach((occ) => {
      [occ.procedure_type, occ.procedure_type_2, occ.procedure_type_3].forEach((pt) => {
        if (pt) byType[pt] = (byType[pt] || 0) + 1;
      });
      if (occ.regional) byRegional[occ.regional] = (byRegional[occ.regional] || 0) + 1;
      if (occ.investigator) {
        const k = displayLabel(occ.investigator);
        byInvestigator[k] = (byInvestigator[k] || 0) + 1;
      }
      if (occ.authority) {
        const k = displayLabel(occ.authority);
        byAuthority[k] = (byAuthority[k] || 0) + 1;
      }
      totalHearings += occ.num_hearings || 0;
    });

    return { byType, byRegional, byInvestigator, byAuthority, totalHearings, total: finalOccs.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [occurrences, nicknameMap]);

  const StatCard = ({ title, data }: { title: string; data: Record<string, number> }) => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {Object.entries(data)
          .sort((a, b) => b[1] - a[1])
          .map(([key, val]) => (
            <div key={key} className="flex items-center justify-between text-sm">
              <span className="truncate mr-2">{key}</span>
              <Badge variant="secondary" className="font-mono shrink-0">{val}</Badge>
            </div>
          ))}
        {Object.keys(data).length === 0 && (
          <p className="text-sm text-muted-foreground">Sem dados</p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Total Procedimentos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{stats.totalHearings}</p>
            <p className="text-sm text-muted-foreground">Total de Oitivas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{stats.byType["APFD"] || 0}</p>
            <p className="text-sm text-muted-foreground">APFDs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{Object.keys(stats.byRegional).length}</p>
            <p className="text-sm text-muted-foreground">Regionais Atendidas</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard title="Por Tipo de Procedimento" data={stats.byType} />
        <StatCard title="Por Regional" data={stats.byRegional} />
        <StatCard title="Por OIP" data={stats.byInvestigator} />
        <StatCard title="Por Autoridade" data={stats.byAuthority} />
      </div>
    </div>
  );
}
