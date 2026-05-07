import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_PUBLISHABLE_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { lead_id, campaign_id } = await req.json();
    if (!lead_id || !campaign_id) return json({ error: "Missing lead_id or campaign_id" }, 400);

    const [{ data: lead, error: lErr }, { data: campaign, error: cErr }] = await Promise.all([
      supabase.from("leads").select("name,company,title,email,linkedin_url,notes").eq("id", lead_id).maybeSingle(),
      supabase.from("campaigns").select("name,context,prompt").eq("id", campaign_id).maybeSingle(),
    ]);
    if (lErr || !lead) return json({ error: "Lead not found" }, 404);
    if (cErr || !campaign) return json({ error: "Campaign not found" }, 404);

    const system = `You are an expert SDR who writes short, natural, personalized outreach messages.
Messages must:
- be reusable across email, LinkedIn, or WhatsApp (no channel-specific markers, no "Subject:")
- be 2-4 sentences max, friendly but professional
- reference something concrete about the lead
- end with a soft, low-friction CTA
- NEVER use emojis, hashtags, or salesy language
Return STRICTLY a JSON object with a "variations" array of 3 distinct strings. No prose, no markdown.`;

    const user = `Campaign: ${campaign.name}
Campaign context: ${campaign.context ?? "(none)"}
Campaign prompt: ${campaign.prompt ?? "(none)"}

Lead:
- Name: ${lead.name}
- Title: ${lead.title ?? "?"}
- Company: ${lead.company ?? "?"}
- Notes: ${lead.notes ?? "(none)"}

Write 3 personalized message variations.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_variations",
            description: "Return 3 outreach message variations",
            parameters: {
              type: "object",
              properties: {
                variations: {
                  type: "array",
                  minItems: 3,
                  maxItems: 3,
                  items: { type: "string" },
                },
              },
              required: ["variations"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_variations" } },
      }),
    });

    if (aiResp.status === 429) return json({ error: "Rate limited, try again shortly." }, 429);
    if (aiResp.status === 402) return json({ error: "AI credits exhausted. Add credits in workspace settings." }, 402);
    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("AI error", aiResp.status, txt);
      return json({ error: "AI gateway error" }, 500);
    }

    const data = await aiResp.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return json({ error: "No output from AI" }, 500);
    const parsed = JSON.parse(args);
    return json({ variations: parsed.variations });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
