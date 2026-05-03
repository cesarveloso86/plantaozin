import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Shift, ShiftOccurrence, ShiftMember, ShiftAbsence, ShiftSubteam } from "@/types/shift";
import type { Json } from "@/integrations/supabase/types";
import { flattenSubteams } from "@/components/shift/SubteamComposer";

export function useShift() {
  const { user } = useAuth();
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [occurrences, setOccurrences] = useState<ShiftOccurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [closingShift, setClosingShift] = useState(false);

  // Load active shift or recent shifts
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("shifts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      const parsed = (data || []).map(parseShift);
      setShifts(parsed);
      const active = parsed.find((s) => s.status === "active");
      if (active) {
        setActiveShift(active);
        await loadOccurrences(active.id);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  // Realtime subscription for occurrences
  useEffect(() => {
    if (!activeShift) return;
    const channel = supabase
      .channel(`shift-${activeShift.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shift_occurrences",
          filter: `shift_id=eq.${activeShift.id}`,
        },
        () => {
          loadOccurrences(activeShift.id);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeShift?.id]);

  const loadOccurrences = async (shiftId: string) => {
    const { data } = await supabase
      .from("shift_occurrences")
      .select("*")
      .eq("shift_id", shiftId)
      .order("created_at", { ascending: true });
    setOccurrences((data as unknown as ShiftOccurrence[]) || []);
  };

  const createShift = useCallback(
    async (params: {
      team_name: string;
      shift_date: string;
      start_time: string;
      end_time?: string;
      iseo: ShiftMember[];
      absences?: ShiftAbsence[];
      oip_subteams?: ShiftSubteam[];
      delegado_subteams?: ShiftSubteam[];
      iseo_subteams?: ShiftSubteam[];
      // legacy / overrides
      authorities?: ShiftMember[];
      investigators?: ShiftMember[];
    }) => {
      if (!user) return null;
      const oipSubteams = params.oip_subteams || [];
      const delSubteams = params.delegado_subteams || [];
      const iseoSubteams = params.iseo_subteams || [];
      const investigators = params.investigators ?? flattenSubteams(oipSubteams);
      const authorities = params.authorities ?? flattenSubteams(delSubteams);
      const iseoFlat = iseoSubteams.length > 0 ? flattenSubteams(iseoSubteams) : params.iseo;
      const { data, error } = await supabase
        .from("shifts")
        .insert({
          created_by: user.id,
          team_name: params.team_name,
          shift_date: params.shift_date,
          start_time: params.start_time,
          end_time: params.end_time || null,
          authorities: authorities as unknown as Json,
          investigators: investigators as unknown as Json,
          iseo: iseoFlat as unknown as Json,
          absences: (params.absences || []) as unknown as Json,
          oip_subteams: oipSubteams as unknown as Json,
          delegado_subteams: delSubteams as unknown as Json,
          iseo_subteams: iseoSubteams as unknown as Json,
        } as never)
        .select()
        .single();
      if (error) throw error;
      const shift = parseShift(data);
      setActiveShift(shift);
      setShifts((prev) => [shift, ...prev]);
      return shift;
    },
    [user]
  );

  const addOccurrence = useCallback(
    async (occ: Partial<ShiftOccurrence>) => {
      if (!user || !activeShift) return;
      const { data, error } = await supabase
        .from("shift_occurrences")
        .insert({
          shift_id: activeShift.id,
          status: occ.status || "em_atendimento",
          bu_number: occ.bu_number || "",
          tramitation_time: occ.tramitation_time || null,
          procedure_type: occ.procedure_type || null,
          procedure_type_2: occ.procedure_type_2 || null,
          procedure_type_3: occ.procedure_type_3 || null,
          investigator: occ.investigator || null,
          authority: occ.authority || null,
          regional: occ.regional || null,
          has_report: occ.has_report || false,
          num_hearings: occ.num_hearings || 0,
          final_time: occ.final_time || null,
          first_hearing_time: occ.first_hearing_time || null,
          observations: occ.observations || null,
          conducted_names: occ.conducted_names || null,
          victim_names: occ.victim_names || null,
          suspect_names: occ.suspect_names || null,
          tipification: occ.tipification || null,
          po_status: occ.po_status || null,
          has_fianca: occ.has_fianca ?? false,
          fianca_paga: occ.fianca_paga ?? false,
          analysis_id: occ.analysis_id || null,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      // Atualização otimista: insere localmente sem aguardar realtime.
      if (data) {
        setOccurrences((prev) =>
          prev.some((o) => o.id === (data as ShiftOccurrence).id)
            ? prev
            : [...prev, data as unknown as ShiftOccurrence]
        );
      }
    },
    [user, activeShift]
  );

  const updateOccurrence = useCallback(
    async (id: string, updates: Partial<ShiftOccurrence>) => {
      const { error } = await supabase
        .from("shift_occurrences")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
      setOccurrences((prev) =>
        prev.map((o) => (o.id === id ? { ...o, ...updates } : o))
      );
    },
    []
  );

  const deleteOccurrence = useCallback(async (id: string) => {
    await supabase.from("shift_occurrences").delete().eq("id", id);
    setOccurrences((prev) => prev.filter((o) => o.id !== id));
  }, []);

  const closeShift = useCallback(async () => {
    if (!activeShift) return;
    setClosingShift(true);
    try {
      const now = new Date().toISOString();
      await supabase
        .from("shifts")
        .update({ status: "closed", end_time: now })
        .eq("id", activeShift.id);
      setActiveShift((prev) => prev ? { ...prev, status: "closed", end_time: now } : null);
    } finally {
      setClosingShift(false);
    }
  }, [activeShift]);

  const addObservation = useCallback(
    async (text: string) => {
      if (!activeShift) return;
      const newObs = [...activeShift.observations, text];
      await supabase
        .from("shifts")
        .update({ observations: newObs })
        .eq("id", activeShift.id);
      setActiveShift((prev) => prev ? { ...prev, observations: newObs } : null);
    },
    [activeShift]
  );

  const updateObservation = useCallback(
    async (idx: number, text: string) => {
      if (!activeShift) return;
      const newObs = activeShift.observations.map((o, i) => (i === idx ? text : o));
      await supabase
        .from("shifts")
        .update({ observations: newObs })
        .eq("id", activeShift.id);
      setActiveShift((prev) => prev ? { ...prev, observations: newObs } : null);
    },
    [activeShift]
  );

  const deleteObservation = useCallback(
    async (idx: number) => {
      if (!activeShift) return;
      const newObs = activeShift.observations.filter((_, i) => i !== idx);
      await supabase
        .from("shifts")
        .update({ observations: newObs })
        .eq("id", activeShift.id);
      setActiveShift((prev) => prev ? { ...prev, observations: newObs } : null);
    },
    [activeShift]
  );

  const selectShift = useCallback(async (shift: Shift) => {
    setActiveShift(shift);
    await loadOccurrences(shift.id);
  }, []);

  const updateShift = useCallback(
    async (updates: Partial<Pick<Shift, "team_name" | "shift_date" | "start_time" | "end_time" | "authorities" | "investigators" | "iseo" | "absences" | "oip_subteams" | "delegado_subteams" | "iseo_subteams">>) => {
      if (!activeShift) return;

      // If subteams are being updated, derive flat arrays for compat.
      const finalUpdates: Record<string, unknown> = { ...updates };
      if (updates.oip_subteams) {
        finalUpdates.investigators = flattenSubteams(updates.oip_subteams);
      }
      if (updates.delegado_subteams) {
        finalUpdates.authorities = flattenSubteams(updates.delegado_subteams);
      }
      if (updates.iseo_subteams) {
        finalUpdates.iseo = flattenSubteams(updates.iseo_subteams);
      }

      const { error } = await supabase
        .from("shifts")
        .update(finalUpdates)
        .eq("id", activeShift.id);
      if (error) throw error;
      setActiveShift((prev) => prev ? { ...prev, ...finalUpdates } as Shift : null);
      setShifts((prev) => prev.map((s) => s.id === activeShift.id ? { ...s, ...finalUpdates } as Shift : s));
    },
    [activeShift]
  );

  const getLastShiftForTeam = useCallback(async (teamName: string): Promise<Shift | null> => {
    const { data } = await supabase
      .from("shifts")
      .select("*")
      .eq("team_name", teamName)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ? parseShift(data as RawShiftRow) : null;
  }, []);

  const deleteShift = useCallback(async (shiftId: string) => {
    await supabase.from("shift_occurrences").delete().eq("shift_id", shiftId);
    await supabase.from("shifts").delete().eq("id", shiftId);
    setShifts((prev) => prev.filter((s) => s.id !== shiftId));
    if (activeShift?.id === shiftId) {
      setActiveShift(null);
      setOccurrences([]);
    }
  }, [activeShift]);

  return {
    activeShift,
    occurrences,
    shifts,
    loading,
    closingShift,
    createShift,
    addOccurrence,
    updateOccurrence,
    deleteOccurrence,
    closeShift,
    addObservation,
    updateObservation,
    deleteObservation,
    selectShift,
    updateShift,
    deleteShift,
    getLastShiftForTeam,
  };
}

type RawShiftRow = Record<string, unknown>;

function parseShift(data: RawShiftRow): Shift {
  const parseJson = <T,>(v: unknown, fallback: T): T => {
    if (Array.isArray(v)) return v as unknown as T;
    if (typeof v === "string") {
      try { return JSON.parse(v) as T; } catch { return fallback; }
    }
    return (v as T) ?? fallback;
  };
  const investigators = parseJson<ShiftMember[]>(data.investigators, []);
  const authorities = parseJson<ShiftMember[]>(data.authorities, []);
  let oip_subteams = parseJson<ShiftSubteam[]>(data.oip_subteams, []);
  let delegado_subteams = parseJson<ShiftSubteam[]>(data.delegado_subteams, []);
  const iseoFlat = parseJson<ShiftMember[]>(data.iseo, []);
  let iseo_subteams = parseJson<ShiftSubteam[]>(data.iseo_subteams, []);

  // Fallback legado: se nenhum subteam mas há membros planos, cria 1 subequipe "Legada".
  if (oip_subteams.length === 0 && investigators.length > 0) {
    oip_subteams = [{
      id: "legacy_oip",
      label: "OIP 1",
      category: "OIP",
      preset: "CUSTOM",
      windows: investigators[0]?.schedule?.windows?.length
        ? investigators[0].schedule.windows
        : [{ start: "00:00", end: "23:59" }],
      members: investigators,
    }];
  }
  if (delegado_subteams.length === 0 && authorities.length > 0) {
    delegado_subteams = [{
      id: "legacy_del",
      label: "Delegado 1",
      category: "Delegado",
      preset: "CUSTOM",
      windows: authorities[0]?.schedule?.windows?.length
        ? authorities[0].schedule.windows
        : [{ start: "00:00", end: "23:59" }],
      members: authorities,
    }];
  }
  if (iseo_subteams.length === 0 && iseoFlat.length > 0) {
    iseo_subteams = [{
      id: "legacy_iseo",
      label: "ISEO 1",
      category: "ISEO",
      preset: "CUSTOM",
      windows: iseoFlat[0]?.schedule?.windows?.length
        ? iseoFlat[0].schedule.windows
        : [{ start: "00:00", end: "23:59" }],
      members: iseoFlat,
    }];
  }

  return {
    ...data,
    authorities,
    investigators,
    iseo: iseoFlat,
    absences: parseJson<ShiftAbsence[]>(data.absences, []),
    observations: Array.isArray(data.observations) ? data.observations : [],
    oip_subteams,
    delegado_subteams,
    iseo_subteams,
  } as Shift;
}
