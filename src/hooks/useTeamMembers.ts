import { useState, useEffect, useCallback } from "react";
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
 */
export function useAllShiftMembers(enabled: boolean) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [profilesRes, teamRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, nickname, nf, cargo, telefone, lotacao, equipe, role")
        .order("full_name"),
      supabase
        .from("team_members")
        .select("*")
        .eq("is_active", true)
        .order("full_name"),
    ]);

    const profiles: UserProfile[] = ((profilesRes.data as any[]) || []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      nickname: p.nickname ?? null,
      nf: p.nf,
      cargo: p.cargo,
      telefone: p.telefone ?? null,
      lotacao: p.lotacao ?? null,
      equipe: p.equipe ?? null,
      role: p.role,
      is_operational: false,
    }));

    const operationals: UserProfile[] = ((teamRes.data as any[]) || []).map((t) => ({
      id: t.id,
      full_name: t.full_name,
      nickname: t.nickname ?? null,
      nf: t.nf,
      cargo: t.cargo,
      telefone: t.telefone ?? null,
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

  return { users, loading, reload: load };
}
