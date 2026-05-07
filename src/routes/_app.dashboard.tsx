import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { STAGES, type StageId } from "@/lib/stages";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

interface Lead {
  id: string;
  stage: StageId;
}

function DashboardPage() {
  const { workspaceId } = useAuth();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [messagesCount, setMessagesCount] = useState(0);

  useEffect(() => {
    load();
  }, [workspaceId]);

  const load = async () => {
    if (!workspaceId) return;

    const [{ data: leadsData }, { count }] = await Promise.all([
      supabase
        .from("leads")
        .select("id,stage")
        .eq("workspace_id", workspaceId),

      supabase
        .from("lead_messages")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspaceId),
    ]);

    setLeads((leadsData ?? []) as Lead[]);
    setMessagesCount(count ?? 0);
  };

  const totalLeads = leads.length;

  const qualifiedCount = useMemo(
    () => leads.filter((l) => l.stage === "qualificado").length,
    [leads]
  );

  const meetingsCount = useMemo(
    () => leads.filter((l) => l.stage === "reuniao_agendada").length,
    [leads]
  );

  const stageCounts = useMemo(() => {
    const map: Record<string, number> = {};

    for (const stage of STAGES) {
      map[stage.id] = leads.filter((l) => l.stage === stage.id).length;
    }

    return map;
  }, [leads]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Dashboard
        </h1>

        <p className="text-sm text-muted-foreground">
          Workspace overview and pipeline metrics.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Leads"
          value={totalLeads}
        />

        <MetricCard
          title="Qualified Leads"
          value={qualifiedCount}
        />

        <MetricCard
          title="Meetings Scheduled"
          value={meetingsCount}
        />

        <MetricCard
          title="Messages Generated"
          value={messagesCount}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pipeline Stages</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {STAGES.map((stage) => (
            <div
              key={stage.id}
              className="flex items-center justify-between border rounded-md px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor: `var(--${stage.token})`,
                  }}
                />

                <span className="text-sm font-medium">
                  {stage.label}
                </span>
              </div>

              <span className="text-sm text-muted-foreground">
                {stageCounts[stage.id] ?? 0} leads
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground font-medium">
          {title}
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="text-3xl font-bold">
          {value}
        </div>
      </CardContent>
    </Card>
  );
}