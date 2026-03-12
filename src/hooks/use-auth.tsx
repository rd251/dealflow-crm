import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "admin" | "user";

interface AuthState {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  isAdmin: boolean;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  inviteUser: (email: string, password: string, displayName: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    role: null,
    loading: true,
    isAdmin: false,
  });

  const fetchRole = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    return (data?.role as AppRole) || "user";
  };

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT') {
        setState({ user: null, session: null, role: null, loading: false, isAdmin: false });
        return;
      }
      if (session?.user) {
        const role = await fetchRole(session.user.id);
        if (mounted) setState({ user: session.user, session, role, loading: false, isAdmin: role === "admin" });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? new Error(error.message) : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const inviteUser = async (email: string, password: string, displayName: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("invite-user", {
        body: { email, password, displayName },
      });
      if (res.error) {
        return { error: new Error(res.error.message || "Failed to invite user") };
      }
      if (res.data?.error) {
        return { error: new Error(res.data.error) };
      }
      return { error: null };
    } catch (err: any) {
      return { error: new Error(err.message || "Failed to invite user") };
    }
  };

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut, inviteUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
