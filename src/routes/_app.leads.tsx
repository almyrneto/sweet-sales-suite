import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  useDroppable,
  useDraggable,
  DragOverlay,
} from "@dnd-kit/core";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { STAGES, type StageId } from "@/lib/stages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Mail,
  Building2,
  Linkedin,
  Sparkles,
  Loader2,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/leads")({
  component: LeadsPage,
});

interface Lead {
  id: string;
  name: string;
  company: string | null;
  title: string | null;
  email: string | null;
  linkedin_url: string | null;
  phone: string | null;
  notes: string | null;
  lead_source: string | null;
  stage: StageId;
  position: number;
  campaign_id: string | null;
}

interface Campaign {
  id: string;
  name: string;
}

function LeadsPage() {
  const { workspaceId, user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const load = async () => {
    if (!workspaceId) return;

    setLoading(true);

    const [{ data: ld }, { data: cp }] = await Promise.all([
      supabase
        .from("leads")
        .select(
          "id,name,company,title,email,linkedin_url,phone,notes,lead_source,stage,position,campaign_id"
        )
        .eq("workspace_id", workspaceId)
        .order("position"),
      supabase
        .from("campaigns")
        .select("id,name")
        .eq("workspace_id", workspaceId),
    ]);

    setLeads((ld ?? []) as Lead[]);
    setCampaigns((cp ?? []) as Campaign[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [workspaceId]);

  const grouped = useMemo(() => {
    const g = Object.fromEntries(
      STAGES.map((s) => [s.id, [] as Lead[]])
    ) as Record<StageId, Lead[]>;

    for (const l of leads) {
      g[l.stage]?.push(l);
    }

    return g;
  }, [leads]);

  const onDragEnd = async (e: DragEndEvent) => {
    setDraggingId(null);

    const overId = e.over?.id as string | undefined;
    const leadId = e.active.id as string;

    if (!overId) return;

    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;

    const newStage = overId as StageId;

    if (lead.stage === newStage) return;

    const requiredByStage: Partial<Record<StageId, (keyof Lead)[]>> = {
      base_lead_mapeado: ["name", "company", "phone", "title"],
      qualificado: ["name", "company", "email", "title"],
      reuniao_agendada: ["name", "company", "email", "phone"],
    };

    const required = requiredByStage[newStage] ?? [];

    const missing = required.filter((field) => {
      const value = lead[field];

      if (typeof value === "string") {
        return value.trim() === "";
      }

      return value === null || value === undefined;
    });

    if (missing.length > 0) {
      const labels: Partial<Record<keyof Lead, string>> = {
        name: "Name",
        company: "Company",
        phone: "Phone",
        title: "Title",
        email: "Email",
        lead_source: "Lead source",
      };

      toast.error(
        `Fill required fields before moving: ${missing
          .map((field) => labels[field] ?? String(field))
          .join(", ")}`
      );

      return;
    }

    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, stage: newStage } : l))
    );

    const { error } = await supabase
      .from("leads")
      .update({ stage: newStage })
      .eq("id", leadId);

    if (error) {
      toast.error("Could not move lead");
      load();
    }
  };

  const createLead = async (data: Partial<Lead>) => {
    if (!workspaceId || !user) return;

    const { error } = await supabase.from("leads").insert({
      workspace_id: workspaceId,
      created_by: user.id,
      name: data.name!,
      company: data.company || null,
      title: data.title || null,
      email: data.email || null,
      linkedin_url: data.linkedin_url || null,
      phone: data.phone || null,
      notes: data.notes || null,
      campaign_id: data.campaign_id || null,
      stage: "base_lead_mapeado",
      lead_source: data.lead_source || null,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Lead added");
      setOpenNew(false);
      load();
    }
  };

  const draggingLead = leads.find((l) => l.id === draggingId);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Drag cards across stages to update.
          </p>
        </div>

        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-1.5" /> New lead
            </Button>
          </DialogTrigger>

          <NewLeadDialog campaigns={campaigns} onSubmit={createLead} />
        </Dialog>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={(e) => setDraggingId(e.active.id as string)}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDraggingId(null)}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STAGES.map((stage) => (
              <Column
                key={stage.id}
                stage={stage}
                leads={grouped[stage.id]}
                onOpen={setActiveLead}
              />
            ))}
          </div>

          <DragOverlay>
            {draggingLead ? <LeadCard lead={draggingLead} dragging /> : null}
          </DragOverlay>
        </DndContext>
      )}

      <LeadDialog
        lead={activeLead}
        campaigns={campaigns}
        onClose={() => setActiveLead(null)}
        onChanged={load}
      />
    </div>
  );
}

function Column({
  stage,
  leads,
  onOpen,
}: {
  stage: (typeof STAGES)[number];
  leads: Lead[];
  onOpen: (l: Lead) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div className="w-72 shrink-0">
      <div className="flex items-center gap-2 px-2 mb-2">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: `var(--${stage.token})` }}
        />
        <h3 className="text-sm font-medium">{stage.label}</h3>
        <span className="text-xs text-muted-foreground">{leads.length}</span>
      </div>

      <div
        ref={setNodeRef}
        className={`rounded-lg border border-dashed p-2 min-h-[60vh] space-y-2 transition-colors ${
          isOver
            ? "bg-accent/60 border-primary/40"
            : "bg-muted/30 border-border"
        }`}
      >
        {leads.map((lead) => (
          <DraggableCard key={lead.id} lead={lead} onOpen={onOpen} />
        ))}

        {leads.length === 0 && (
          <div className="text-xs text-muted-foreground py-4 text-center">
            No leads
          </div>
        )}
      </div>
    </div>
  );
}

function DraggableCard({
  lead,
  onOpen,
}: {
  lead: Lead;
  onOpen: (l: Lead) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(lead)}
      className={`cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-30" : ""
      }`}
    >
      <LeadCard lead={lead} />
    </div>
  );
}

function LeadCard({ lead, dragging }: { lead: Lead; dragging?: boolean }) {
  return (
    <div
      className={`rounded-md border bg-card p-3 shadow-sm ${
        dragging ? "ring-2 ring-primary shadow-md" : "hover:border-primary/40"
      }`}
    >
      <div className="text-sm font-medium leading-tight">{lead.name}</div>

      {lead.title && (
        <div className="text-xs text-muted-foreground mt-0.5">
          {lead.title}
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {lead.company && (
          <span className="inline-flex items-center gap-1">
            <Building2 className="h-3 w-3" />
            {lead.company}
          </span>
        )}

        {lead.email && (
          <span className="inline-flex items-center gap-1">
            <Mail className="h-3 w-3" />
            {lead.email}
          </span>
        )}

        {lead.linkedin_url && (
          <span className="inline-flex items-center gap-1">
            <Linkedin className="h-3 w-3" />
            LinkedIn
          </span>
        )}
      </div>
    </div>
  );
}

function NewLeadDialog({
  campaigns,
  onSubmit,
}: {
  campaigns: Campaign[];
  onSubmit: (l: Partial<Lead>) => void;
}) {
  const [data, setData] = useState<Partial<Lead>>({});

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>New lead</DialogTitle>
      </DialogHeader>

      <div className="space-y-3">
        <Field label="Name *">
          <Input
            value={data.name ?? ""}
            onChange={(e) => setData({ ...data, name: e.target.value })}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Company">
            <Input
              value={data.company ?? ""}
              onChange={(e) =>
                setData({ ...data, company: e.target.value })
              }
            />
          </Field>

          <Field label="Title">
            <Input
              value={data.title ?? ""}
              onChange={(e) => setData({ ...data, title: e.target.value })}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">
            <Input
              value={data.email ?? ""}
              onChange={(e) => setData({ ...data, email: e.target.value })}
            />
          </Field>

          <Field label="Phone">
            <Input
              value={data.phone ?? ""}
              onChange={(e) => setData({ ...data, phone: e.target.value })}
              placeholder="+55 11 99999-9999"
            />
          </Field>
        </div>

        <Field label="LinkedIn URL">
          <Input
            value={data.linkedin_url ?? ""}
            onChange={(e) =>
              setData({ ...data, linkedin_url: e.target.value })
            }
          />
        </Field>

        <Field label="Campaign">
          <Select
            value={data.campaign_id ?? "none"}
            onValueChange={(v) =>
              setData({
                ...data,
                campaign_id: v === "none" ? null : v,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="none">None</SelectItem>

              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Notes">
          <Textarea
            rows={3}
            value={data.notes ?? ""}
            onChange={(e) => setData({ ...data, notes: e.target.value })}
          />
        </Field>

        <Field label="Lead source">
          <Input
            value={data.lead_source ?? ""}
            onChange={(e) =>
              setData({ ...data, lead_source: e.target.value })
            }
          />
        </Field>
      </div>

      <DialogFooter>
        <Button onClick={() => onSubmit(data)} disabled={!data.name?.trim()}>
          Create
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function LeadDialog({
  lead,
  campaigns,
  onClose,
  onChanged,
}: {
  lead: Lead | null;
  campaigns: Campaign[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { workspaceId, user } = useAuth();
  const [edit, setEdit] = useState<Lead | null>(null);
  const [messages, setMessages] = useState<
    { id: string; content: string; variant: number }[]
  >([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setEdit(lead);

    if (lead) {
      supabase
        .from("lead_messages")
        .select("id,content,variant")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false })
        .then(({ data }) => setMessages(data ?? []));
    }
  }, [lead]);

  if (!lead || !edit) return null;

  const save = async () => {
    const { error } = await supabase
      .from("leads")
      .update({
        name: edit.name,
        company: edit.company,
        title: edit.title,
        email: edit.email,
        linkedin_url: edit.linkedin_url,
        phone: edit.phone,
        notes: edit.notes,
        stage: edit.stage,
        campaign_id: edit.campaign_id,
        lead_source: edit.lead_source,
      })
      .eq("id", lead.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Saved");
      onChanged();
      onClose();
    }
  };

  const remove = async () => {
    const { error } = await supabase.from("leads").delete().eq("id", lead.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Deleted");
      onChanged();
      onClose();
    }
  };

  const generate = async () => {
    if (!edit.campaign_id) {
      toast.error("Pick a campaign first");
      return;
    }

    if (!workspaceId || !user) return;

    setGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "generate-messages",
        {
          body: {
            lead_id: lead.id,
            campaign_id: edit.campaign_id,
            workspace_id: workspaceId,
          },
        }
      );

      if (error) throw error;

      const variations = (data as { variations: string[] }).variations;

      const rows = variations.map((content, i) => ({
        workspace_id: workspaceId,
        lead_id: lead.id,
        campaign_id: edit.campaign_id,
        content,
        variant: i + 1,
        created_by: user.id,
      }));

      const { data: inserted, error: insErr } = await supabase
        .from("lead_messages")
        .insert(rows)
        .select("id,content,variant");

      if (insErr) throw insErr;

      setMessages([...(inserted ?? []), ...messages]);
      toast.success("Messages generated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const sendMessage = async (_content: string) => {
    try {
      const { error } = await supabase
        .from("leads")
        .update({ stage: "tentando_contato" })
        .eq("id", lead.id);

      if (error) throw error;

      setEdit((prev) =>
        prev ? { ...prev, stage: "tentando_contato" as StageId } : prev
      );

      toast.success("Message sent");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send message");
    }
  };

  return (
    <Dialog open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lead details</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Name">
            <Input
              value={edit.name}
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
            />
          </Field>

          <Field label="Stage">
            <Select
              value={edit.stage}
              onValueChange={(v) => setEdit({ ...edit, stage: v as StageId })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                {STAGES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Company">
            <Input
              value={edit.company ?? ""}
              onChange={(e) => setEdit({ ...edit, company: e.target.value })}
            />
          </Field>

          <Field label="Title">
            <Input
              value={edit.title ?? ""}
              onChange={(e) => setEdit({ ...edit, title: e.target.value })}
            />
          </Field>

          <Field label="Email">
            <Input
              value={edit.email ?? ""}
              onChange={(e) => setEdit({ ...edit, email: e.target.value })}
            />
          </Field>

          <Field label="Phone">
            <Input
              value={edit.phone ?? ""}
              onChange={(e) => setEdit({ ...edit, phone: e.target.value })}
              placeholder="+55 11 99999-9999"
            />
          </Field>

          <Field label="LinkedIn">
            <Input
              value={edit.linkedin_url ?? ""}
              onChange={(e) =>
                setEdit({ ...edit, linkedin_url: e.target.value })
              }
            />
          </Field>

          <Field label="Lead source">
            <Input
              value={edit.lead_source ?? ""}
              onChange={(e) =>
                setEdit({ ...edit, lead_source: e.target.value })
              }
            />
          </Field>

          <div className="col-span-2">
            <Field label="Campaign">
              <Select
                value={edit.campaign_id ?? "none"}
                onValueChange={(v) =>
                  setEdit({
                    ...edit,
                    campaign_id: v === "none" ? null : v,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="none">None</SelectItem>

                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="col-span-2">
            <Field label="Notes">
              <Textarea
                rows={3}
                value={edit.notes ?? ""}
                onChange={(e) =>
                  setEdit({ ...edit, notes: e.target.value })
                }
              />
            </Field>
          </div>
        </div>

        <div className="border-t pt-4 mt-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-medium flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" /> AI outreach
                messages
              </h3>

              <p className="text-xs text-muted-foreground">
                Personalized variations based on the campaign.
              </p>
            </div>

            <Button size="sm" onClick={generate} disabled={generating}>
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1.5" />
              )}
              Generate
            </Button>
          </div>

          <div className="space-y-2">
            {messages.length === 0 && (
              <div className="text-xs text-muted-foreground">
                No messages yet.
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap"
              >
                <div className="flex items-center justify-between mb-1.5 text-xs text-muted-foreground">
                  <span>Variation {m.variant}</span>

                  <div className="flex items-center gap-3">
                    <button
                      className="inline-flex items-center gap-1 hover:text-foreground"
                      onClick={() => {
                        navigator.clipboard.writeText(m.content);
                        toast.success("Copied");
                      }}
                    >
                      <Copy className="h-3 w-3" /> Copy
                    </button>

                    <button
                      className="inline-flex items-center gap-1 hover:text-foreground"
                      onClick={() => sendMessage(m.content)}
                    >
                      <Mail className="h-3 w-3" /> Send
                    </button>
                  </div>
                </div>

                {m.content}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={remove}
            className="text-destructive hover:text-destructive"
          >
            Delete
          </Button>

          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}