import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UserProfile {
  id: string;
  full_name: string;
  nickname: string | null;
  nf: string | null;
  cargo: string | null;
  telefone?: string | null;
  lotacao?: string | null;
  equipe?: string | null;
  role: string;
  is_operational?: boolean;
}

/** Display label preferring nickname, falling back to full_name. */
export const displayName = (m: { nickname?: string | null; full_name: string }): string =>
  (m.nickname && m.nickname.trim()) || m.full_name;

/**
 * Fetches both real profiles and operational team_members,
 * merging them into a single list for shift selectors.
 * Subscribes to realtime updates so newly added members appear immediately.
 */
export function useAllShiftMembers(enabled: boolean) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [profilesRes, teamRes] = await Promise.all([
      supabase.rpc("list_safe_profiles"),
      supabase.rpc("list_safe_team_members"),
    ]);

    const profiles: UserProfile[] = ((profilesRes.data as any[]) || []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      nickname: p.nickname ?? null,
      nf: null,
      cargo: null,
      telefone: null,
      lotacao: p.lotacao ?? null,
      equipe: p.equipe ?? null,
      role: p.role,
      is_operational: false,
    }));

    const operationals: UserProfile[] = ((teamRes.data as any[]) || [])
      .filter((t) => t.is_active !== false)
      .map((t) => ({
        id: t.id,
        full_name: t.full_name,
        nickname: t.nickname ?? null,
        nf: null,
        cargo: t.cargo ?? null,
        telefone: null,
        lotacao: t.lotacao ?? null,
        equipe: t.equipe ?? null,
        role: "operacional",
        is_operational: true,
      }));

    setUsers([...profiles, ...operationals]);
    setLoading(false);
  }, []);


  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  // Realtime: revalida quando profiles ou team_members mudam.
  useEffect(() => {
    if (!enabled) return;
    const debouncedReload = () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(() => { load(); }, 300);
    };
    const channel = supabase
      .channel("shift-members-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, debouncedReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "team_members" }, debouncedReload)
      .subscribe();
    return () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      supabase.removeChannel(channel);
    };
  }, [enabled, load]);

  return { users, loading, reload: load };
}
