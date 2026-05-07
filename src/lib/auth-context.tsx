import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  workspaceId: string | null;
  setWorkspaceId: (id: string | null) => void;
  refreshWorkspace: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [workspaceId, setWorkspaceIdState] = useState<string | null>(null);

  const loadWorkspace = async (uid: string) => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("current_workspace_id")
      .eq("id", uid)
      .maybeSingle();
    if (profile?.current_workspace_id) {
      setWorkspaceIdState(profile.current_workspace_id);
      return;
    }
    const { data: member } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", uid)
      .limit(1)
      .maybeSingle();
    setWorkspaceIdState(member?.workspace_id ?? null);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => loadWorkspace(s.user.id), 0);
      } else {
        setWorkspaceIdState(null);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) loadWorkspace(data.session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const setWorkspaceId = (id: string | null) => {
    setWorkspaceIdState(id);
    if (id && session?.user) {
      supabase.from("profiles").update({ current_workspace_id: id }).eq("id", session.user.id).then();
    }
  };

  const refreshWorkspace = async () => {
    if (session?.user) await loadWorkspace(session.user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Ctx.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        workspaceId,
        setWorkspaceId,
        refreshWorkspace,
        signOut,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
