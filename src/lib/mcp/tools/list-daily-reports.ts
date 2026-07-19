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
  name: "list_daily_reports",
  title: "التقارير اليومية",
  description:
    "List recent daily reports visible to the signed-in user. Optional filters: officeId, fromDate/toDate (YYYY-MM-DD), and limit (1–100, default 20).",
  inputSchema: {
    officeId: z.string().optional().describe("Filter by office id."),
    fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Inclusive start date."),
    toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Inclusive end date."),
    limit: z.number().int().min(1).max(100).default(20),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ officeId, fromDate, toDate, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    let q = db(ctx)
      .from("daily_reports")
      .select(
        "id, office_id, submitted_by, report_date, submitted_at, deployment_count, incidents_count, violations_count, deaths_count, events_count, visits_count, visitors_in, visitors_out, vehicles_count, processions_count",
      )
      .order("report_date", { ascending: false })
      .limit(limit);
    if (officeId) q = q.eq("office_id", officeId);
    if (fromDate) q = q.gte("report_date", fromDate);
    if (toDate) q = q.lte("report_date", toDate);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { reports: data ?? [] },
    };
  },
});
