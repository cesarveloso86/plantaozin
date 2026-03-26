import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UserProfile {
  id: string;
  full_name: string;
  nf: string | null;
  cargo: string | null;
  role: string;
  is_operational?: boolean;
}

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
      supabase.from("profiles").select("id, full_name, nf, cargo, role").order("full_name"),
      supabase.from("team_members").select("*").eq("is_active", true).order("full_name"),
    ]);

    const profiles: UserProfile[] = ((profilesRes.data as any[]) || []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      nf: p.nf,
      cargo: p.cargo,
      role: p.role,
      is_operational: false,
    }));

    const operationals: UserProfile[] = ((teamRes.data as any[]) || []).map((t) => ({
      id: t.id,
      full_name: t.full_name,
      nf: t.nf,
      cargo: t.cargo,
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
