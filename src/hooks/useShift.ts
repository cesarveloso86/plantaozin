import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Shift, ShiftOccurrence, ShiftMember } from "@/types/shift";

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
          authorities: params.authorities as any,
          investigators: params.investigators as any,
          iseo: params.iseo as any,
        } as any)
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
      } as any);
      if (error) throw error;
    },
    [user, activeShift]
  );

  const updateOccurrence = useCallback(
    async (id: string, updates: Partial<ShiftOccurrence>) => {
      const { error } = await supabase
        .from("shift_occurrences")
        .update(updates as any)
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
      .update({ status: "closed", end_time: now } as any)
      .eq("id", activeShift.id);
    setActiveShift((prev) => prev ? { ...prev, status: "closed", end_time: now } : null);
  }, [activeShift]);

  const addObservation = useCallback(
    async (text: string) => {
      if (!activeShift) return;
      const newObs = [...activeShift.observations, text];
      await supabase
        .from("shifts")
        .update({ observations: newObs } as any)
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
    async (updates: Partial<Pick<Shift, "team_name" | "shift_date" | "start_time" | "end_time" | "authorities" | "investigators" | "iseo">>) => {
      if (!activeShift) return;
      const payload: any = {};
      if (updates.team_name !== undefined) payload.team_name = updates.team_name;
      if (updates.shift_date !== undefined) payload.shift_date = updates.shift_date;
      if (updates.start_time !== undefined) payload.start_time = updates.start_time;
      if (updates.end_time !== undefined) payload.end_time = updates.end_time;
      if (updates.authorities !== undefined) payload.authorities = updates.authorities;
      if (updates.investigators !== undefined) payload.investigators = updates.investigators;
      if (updates.iseo !== undefined) payload.iseo = updates.iseo;
      const { error } = await supabase
        .from("shifts")
        .update(payload)
        .eq("id", activeShift.id);
      if (error) throw error;
      setActiveShift((prev) => prev ? { ...prev, ...updates } : null);
      setShifts((prev) => prev.map((s) => s.id === activeShift.id ? { ...s, ...updates } : s));
    },
    [activeShift]
  );

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
    selectShift,
  };
}

function parseShift(data: any): Shift {
  return {
    ...data,
    authorities: Array.isArray(data.authorities) ? data.authorities : JSON.parse(data.authorities || "[]"),
    investigators: Array.isArray(data.investigators) ? data.investigators : JSON.parse(data.investigators || "[]"),
    iseo: Array.isArray(data.iseo) ? data.iseo : JSON.parse(data.iseo || "[]"),
    observations: Array.isArray(data.observations) ? data.observations : [],
  } as Shift;
}
