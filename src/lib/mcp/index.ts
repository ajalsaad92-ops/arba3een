import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listOfficesTool from "./tools/list-offices";
import listDailyReportsTool from "./tools/list-daily-reports";
import getDailyReportTool from "./tools/get-daily-report";
import listEmergenciesTool from "./tools/list-emergencies";
import createEmergencyTool from "./tools/create-emergency";

// Build the OAuth issuer from the Supabase project ref (Vite inlines this at
// build time, so it stays import-safe with no runtime env read).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "arba3een-ops-mcp",
  title: "Arba3een Ops MCP",
  version: "0.1.0",
  instructions:
    "Tools for the Arba3een operations app. All actions run as the signed-in user (RLS + role permissions apply). Use `whoami` to check role, `list_offices` / `list_daily_reports` / `get_daily_report` for context, `list_emergencies` to monitor incidents, and `create_emergency` to open a new incident for the user's office.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    whoamiTool,
    listOfficesTool,
    listDailyReportsTool,
    getDailyReportTool,
    listEmergenciesTool,
    createEmergencyTool,
  ],
});
