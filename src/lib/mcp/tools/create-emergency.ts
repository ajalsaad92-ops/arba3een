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
  name: "create_emergency",
  title: "إنشاء حالة طارئة",
  description:
    "Create a new emergency for the signed-in user's office. Location fields are optional.",
  inputSchema: {
    emergencyType: z.string().min(1).max(120).describe("Short label, e.g. 'حريق'."),
    description: z.string().min(1).max(2000).describe("Details of the emergency."),
    locationMgrs: z.string().max(64).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = db(ctx);
    const userId = ctx.getUserId();
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("office_id, full_name_ar")
      .eq("id", userId)
      .maybeSingle();
    if (pErr || !profile) {
      return { content: [{ type: "text", text: pErr?.message ?? "Profile not found" }], isError: true };
    }
    const { data, error } = await supabase
      .from("emergencies")
      .insert({
        reported_by: userId,
        reported_by_name: profile.full_name_ar ?? "",
        office_id: profile.office_id,
        emergency_type: input.emergencyType,
        description: input.description,
        location_mgrs: input.locationMgrs ?? null,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        status: "active",
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Emergency created: ${data.id}` }],
      structuredContent: { emergency: data },
    };
  },
});
