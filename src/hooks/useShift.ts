import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Shift, ShiftOccurrence, ShiftMember, ShiftAbsence } from "@/types/shift";
import type { Json } from "@/integrations/supabase/types";

export function useShift() {
  const { user } = useAuth();
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [occurrences, setOccurrences] = useState<ShiftOccurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState<Shift[]>([]);

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
      authorities: ShiftMember[];
      investigators: ShiftMember[];
      iseo: ShiftMember[];
      absences?: ShiftAbsence[];
    }) => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("shifts")
        .insert({
          created_by: user.id,
          team_name: params.team_name,
          shift_date: params.shift_date,
          start_time: params.start_time,
          end_time: params.end_time || null,
          authorities: params.authorities as unknown as Json,
          investigators: params.investigators as unknown as Json,
          iseo: params.iseo as unknown as Json,
          absences: (params.absences || []) as unknown as Json,
        })
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
      const { error } = await supabase.from("shift_occurrences").insert({
        shift_id: activeShift.id,
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
        observations: occ.observations || null,
        conducted_names: occ.conducted_names || null,
        victim_names: occ.victim_names || null,
        suspect_names: occ.suspect_names || null,
        tipification: occ.tipification || null,
        po_status: occ.po_status || null,
        analysis_id: occ.analysis_id || null,
        created_by: user.id,
      });
      if (error) throw error;
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
    const now = new Date().toISOString();
    await supabase
      .from("shifts")
      .update({ status: "closed", end_time: now })
      .eq("id", activeShift.id);
    setActiveShift((prev) => prev ? { ...prev, status: "closed", end_time: now } : null);
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
    async (updates: Partial<Pick<Shift, "team_name" | "shift_date" | "start_time" | "end_time" | "authorities" | "investigators" | "iseo" | "absences">>) => {
      if (!activeShift) return;

      const { error } = await supabase
        .from("shifts")
        .update(updates as Record<string, unknown>)
        .eq("id", activeShift.id);
      if (error) throw error;
      setActiveShift((prev) => prev ? { ...prev, ...updates } : null);
      setShifts((prev) => prev.map((s) => s.id === activeShift.id ? { ...s, ...updates } : s));
    },
    [activeShift]
  );

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
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseShift(data: any): Shift {
  return {
    ...data,
    authorities: Array.isArray(data.authorities) ? data.authorities : JSON.parse(data.authorities || "[]"),
    investigators: Array.isArray(data.investigators) ? data.investigators : JSON.parse(data.investigators || "[]"),
    iseo: Array.isArray(data.iseo) ? data.iseo : JSON.parse(data.iseo || "[]"),
    absences: Array.isArray(data.absences) ? data.absences : JSON.parse(data.absences || "[]"),
    observations: Array.isArray(data.observations) ? data.observations : [],
  } as Shift;
}
