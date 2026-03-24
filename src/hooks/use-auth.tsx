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

function readOAuthResponseFromUrl() {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const searchParams = new URLSearchParams(window.location.search);

  const accessToken = hashParams.get("access_token") ?? searchParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token") ?? searchParams.get("refresh_token");
  const error = hashParams.get("error_description")
    ?? searchParams.get("error_description")
    ?? hashParams.get("error")
    ?? searchParams.get("error");

  return { accessToken, refreshToken, error };
}

function clearOAuthResponseFromUrl() {
  const cleanUrl = `${window.location.origin}${window.location.pathname}`;
  window.history.replaceState({}, document.title, cleanUrl);
}

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

    const applySession = async (session: Session | null, source: string) => {
      if (!mounted) return;

      if (!session?.user) {
        console.info(`[Auth] Session ikke funnet (${source})`);
        setState({ user: null, session: null, role: null, loading: false, isAdmin: false });
        return;
      }

      console.info(`[Auth] Session funnet (${source}) for`, session.user.email);
      const role = await withTimeout(fetchRole(session.user.id), 3000, "user" as AppRole);

      if (!mounted) return;

      setState({
        user: session.user,
        session,
        role,
        loading: false,
        isAdmin: role === "admin",
      });
    };

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

      if (event === "SIGNED_OUT") {
        await applySession(null, "signed_out");
        return;
      }

      await applySession(session, `event:${event}`);
    });

    const bootstrapAuth = async () => {
      const { accessToken, refreshToken, error: oauthError } = readOAuthResponseFromUrl();

      if (oauthError) {
        console.error("[Auth] OAuth callback returnerte feil:", oauthError);
        clearOAuthResponseFromUrl();
      }

      if (accessToken && refreshToken) {
        console.info("[Auth] OAuth tokens funnet i URL, oppretter session");
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          console.error("[Auth] Kunne ikke opprette session fra callback:", error.message);
        } else {
          console.info("[Auth] Session opprettet fra OAuth callback");
        }

        clearOAuthResponseFromUrl();
      }

      const { data, error } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        console.error("[Auth] Feil ved lesing av session:", error.message);
        await applySession(null, "init_error");
        return;
      }

      await applySession(data.session, "init");
    };

    bootstrapAuth();

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
