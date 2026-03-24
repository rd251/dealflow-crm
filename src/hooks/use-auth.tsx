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

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    role: null,
    loading: true,
    isAdmin: false,
  });

  const fetchRole = async (userId: string): Promise<AppRole> => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) {
        console.error("Failed to fetch role:", error.message);
        return "user";
      }
      return (data?.role as AppRole) || "user";
    } catch (err) {
      console.error("fetchRole exception:", err);
      return "user";
    }
  };

  useEffect(() => {
    let mounted = true;

    // Safety timeout: if loading hasn't resolved in 5s, check session manually
    const safetyTimeout = setTimeout(async () => {
      if (!mounted) return;
      // If still loading, force resolve
      setState((prev) => {
        if (!prev.loading) return prev;
        console.warn("Auth safety timeout: forcing loading=false");
        return { ...prev, loading: false };
      });
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      console.info("[Auth] onAuthStateChange:", event);

      if (event === "SIGNED_OUT" || !session) {
        console.info("[Auth] Session ikke funnet, setter bruker til utlogget");
        setState({ user: null, session: null, role: null, loading: false, isAdmin: false });
        return;
      }

      if (session?.user) {
        console.info("[Auth] Session funnet for bruker", session.user.email);
        // Fetch role with 3s timeout
        const role = await withTimeout(fetchRole(session.user.id), 3000, "user" as AppRole);
        if (mounted) {
          setState({
            user: session.user,
            session,
            role,
            loading: false,
            isAdmin: role === "admin",
          });
        }
      }
    });

    supabase.auth.getSession().then(async ({ data, error }) => {
      if (!mounted) return;

      if (error) {
        console.error("[Auth] Feil ved lesing av session:", error.message);
        setState({ user: null, session: null, role: null, loading: false, isAdmin: false });
        return;
      }

      if (!data.session?.user) {
        console.info("[Auth] Ingen eksisterende session ved init");
        setState({ user: null, session: null, role: null, loading: false, isAdmin: false });
        return;
      }

      console.info("[Auth] Eksisterende session funnet ved init for", data.session.user.email);
      const role = await withTimeout(fetchRole(data.session.user.id), 3000, "user" as AppRole);
      if (!mounted) return;

      setState({
        user: data.session.user,
        session: data.session,
        role,
        loading: false,
        isAdmin: role === "admin",
      });
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    console.info("[Auth] Starter e-post innlogging");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? new Error(error.message) : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const inviteUser = async (email: string, password: string, displayName: string) => {
    try {
      const res = await supabase.functions.invoke("invite-user", {
        body: { email, password, displayName },
      });
      if (res.error) return { error: new Error(res.error.message || "Failed to invite user") };
      if (res.data?.error) return { error: new Error(res.data.error) };
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
