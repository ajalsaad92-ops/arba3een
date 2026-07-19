import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function db(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_emergencies",
  title: "الحالات الطارئة",
  description:
    "List emergencies visible to the signed-in user. Filter by status (active/acknowledged/resolved) or officeId.",
  inputSchema: {
    status: z.enum(["active", "acknowledged", "resolved"]).optional(),
    officeId: z.string().optional(),
    limit: z.number().int().min(1).max(100).default(20),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, officeId, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    let q = db(ctx).from("emergencies").select("*").order("created_at", { ascending: false }).limit(limit);
    if (status) q = q.eq("status", status);
    if (officeId) q = q.eq("office_id", officeId);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { emergencies: data ?? [] },
    };
  },
});
