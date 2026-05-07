import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Megaphone, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/campaigns")({
  component: CampaignsPage,
});

interface Campaign {
  id: string;
  name: string;
  context: string | null;
  prompt: string | null;
  created_at: string;
}

function CampaignsPage() {
  const { workspaceId, user } = useAuth();
  const [items, setItems] = useState<Campaign[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);

  const load = async () => {
    if (!workspaceId) return;
    const { data } = await supabase
      .from("campaigns")
      .select("id,name,context,prompt,created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Campaign[]);
  };

  useEffect(() => { load(); }, [workspaceId]);

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Campaigns</h1>
          <p className="text-sm text-muted-foreground">Define context and prompts for AI outreach.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}>
              <Plus className="h-4 w-4 mr-1.5" /> New campaign
            </Button>
          </DialogTrigger>
          <CampaignDialog
            campaign={editing}
            onSaved={() => { setOpen(false); setEditing(null); load(); }}
            workspaceId={workspaceId}
            userId={user?.id}
          />
        </Dialog>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <Megaphone className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <h3 className="text-sm font-medium">No campaigns yet</h3>
          <p className="text-sm text-muted-foreground">Create one to start generating personalized outreach.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((c) => (
            <button
              key={c.id}
              className="text-left rounded-lg border bg-card p-4 hover:border-primary/40 transition-colors"
              onClick={() => { setEditing(c); setOpen(true); }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm">{c.name}</div>
                  {c.context && <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{c.context}</div>}
                </div>
                <Trash2
                  className="h-4 w-4 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!confirm("Delete this campaign?")) return;
                    await supabase.from("campaigns").delete().eq("id", c.id);
                    load();
                  }}
                />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CampaignDialog({
  campaign,
  onSaved,
  workspaceId,
  userId,
}: {
  campaign: Campaign | null;
  onSaved: () => void;
  workspaceId: string | null;
  userId: string | undefined;
}) {
  const [name, setName] = useState("");
  const [context, setContext] = useState("");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(campaign?.name ?? "");
    setContext(campaign?.context ?? "");
    setPrompt(campaign?.prompt ?? "");
  }, [campaign]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !userId) return;
    setBusy(true);
    try {
      if (campaign) {
        const { error } = await supabase.from("campaigns").update({ name, context, prompt }).eq("id", campaign.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("campaigns").insert({
          workspace_id: workspaceId,
          created_by: userId,
          name, context, prompt,
        });
        if (error) throw error;
      }
      toast.success("Saved");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogContent className="max-w-xl">
      <DialogHeader>
        <DialogTitle>{campaign ? "Edit campaign" : "New campaign"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Context</Label>
          <Textarea
            rows={3}
            placeholder="What you're selling, ideal customer profile, value props…"
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">AI prompt</Label>
          <Textarea
            rows={4}
            placeholder="Write a short, friendly first message that mentions a relevant pain point and asks for 15 minutes."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={busy || !name.trim()}>{busy ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
