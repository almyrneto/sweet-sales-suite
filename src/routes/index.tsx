import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, loading, workspaceId } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/login" />;
  if (!workspaceId) return <Navigate to="/onboarding" />;
  return <Navigate to="/leads" />;
}
