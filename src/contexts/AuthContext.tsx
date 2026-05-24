import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface Profile {
  id: string;
  full_name: string;
  role: string;
  avatar_url: string | null;
  nf: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  isAdmin: false,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return (data as Profile | null) ?? null;
  }, []);

  const fetchRole = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (error) {
      throw error;
    }

    const roles = (data || []).map((r: { role: string | null }) => r.role);
    return roles.includes("admin");
  }, []);

  useEffect(() => {
    let isActive = true;
    let authRequestId = 0;

    const syncUserContext = async (userId: string, requestId: number) => {
      try {
        const [nextProfile, nextIsAdmin] = await Promise.all([
          fetchProfile(userId),
          fetchRole(userId),
        ]);

        if (!isActive || requestId !== authRequestId) {
          return;
        }

        setProfile(nextProfile);
        setIsAdmin(nextIsAdmin);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching auth context:", error);

        if (!isActive || requestId !== authRequestId) {
          return;
        }

        setProfile(null);
        setIsAdmin(false);
        setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        authRequestId += 1;
        const requestId = authRequestId;

        if (!isActive) {
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);

        if (!session?.user) {
          setProfile(null);
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        setLoading(true);
        setProfile(null);
        setIsAdmin(false);
        void syncUserContext(session.user.id, requestId);
      }
    );

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, fetchRole]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, isAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
