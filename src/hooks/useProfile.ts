import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface SignatureStyle {
  tom?: "formal_juridico" | "tecnico_neutro" | "objetivo_simples";
  qualificacao_completa?: boolean;
  instrucoes_extras?: string;
}

export interface FullProfile {
  id: string;
  full_name: string;
  nickname: string | null;
  nf: string | null;
  cargo: string | null;
  telefone: string | null;
  lotacao: string | null;
  equipe: string | null;
  signature_style: SignatureStyle;
}

export const DEFAULT_SIGNATURE_STYLE: SignatureStyle = {
  tom: "formal_juridico",
  qualificacao_completa: true,
  instrucoes_extras: "",
};

export function useProfile() {
  const { user, profile: authProfile, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user || authLoading) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, nickname, nf, cargo, telefone, lotacao, equipe, signature_style")
      .eq("id", user.id)
      .maybeSingle();
    if (!error && data) {
      setProfile({
        ...data,
        signature_style: (data.signature_style as SignatureStyle) || {},
      } as FullProfile);
    }
    setLoading(false);
  }, [authLoading, user]);

  useEffect(() => {
    if (authProfile) {
      setProfile((current) => ({
        ...current,
        id: authProfile.id,
        full_name: authProfile.full_name,
        nickname: current?.nickname ?? null,
        nf: authProfile.nf,
        cargo: current?.cargo ?? null,
        telefone: current?.telefone ?? null,
        lotacao: current?.lotacao ?? null,
        equipe: current?.equipe ?? null,
        signature_style: current?.signature_style ?? DEFAULT_SIGNATURE_STYLE,
      }));
    }
    void load();
  }, [authProfile, load]);

  const save = useCallback(
    async (updates: Partial<Omit<FullProfile, "id">>) => {
      if (!user) return { error: "Sem usuário" };
      setSaving(true);
      const { error } = await supabase
        .from("profiles")
        .update(updates as any)
        .eq("id", user.id);
      setSaving(false);
      if (!error) await load();
      return { error: error?.message };
    },
    [user, load]
  );

  return { profile, loading: authLoading || loading, saving, save, reload: load };
}
