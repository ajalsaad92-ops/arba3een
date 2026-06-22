import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Role = "director" | "supervisor" | "manager" | "agent" | "viewer";

type CreatePayload = {
  action: "create";
  fullNameAr: string;
  username?: string;
  email?: string;
  password?: string;
  role: Role;
  officeId: string;
  permittedOfficeIds?: string[];
  specialPermissions?: Record<string, boolean>;
};

type ResetPayload = {
  action: "resetPassword";
  userId: string;
  password: string;
};

type UpdateEmailPayload = {
  action: "updateEmail";
  userId: string;
  username: string;
};

type ClearPayload = {
  action: "clearData";
};

type Payload = CreatePayload | ResetPayload | UpdateEmailPayload | ClearPayload;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // ── 1. Authenticate the caller from their JWT ──────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Invalid session" }, 401);
    const callerId = userData.user.id;

    // ── 2. Authorize: caller must be a director ────────────────────
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "director")
      .maybeSingle();
    if (!roleRow) return json({ error: "Forbidden — directors only" }, 403);

    const body = (await req.json()) as Payload;

    // ── 3. Handle actions ──────────────────────────────────────────
    if (body.action === "create") {
      const isDirector = body.role === "director";

      // Build a VALID, ASCII-only email. Arabic characters are not allowed in
      // the local part, so we sanitize the chosen username (or fall back to a
      // generated handle). This fixes "Unable to validate email address".
      const sanitizeLocal = (s: string) =>
        s
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9._-]+/g, "") // drop Arabic / spaces / symbols
          .replace(/^[._-]+|[._-]+$/g, ""); // trim leading/trailing separators

      let email: string;
      if (body.email && body.email.includes("@")) {
        email = body.email.toLowerCase().trim();
      } else {
        let local = body.username ? sanitizeLocal(body.username) : "";
        if (!local) local = `user${Date.now()}`;
        email = `${local}@ops.iq`;
      }
      const password = body.password && body.password.length >= 6 ? body.password : "123456";

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name_ar: body.fullNameAr },
      });
      if (createErr || !created.user) {
        return json({ error: createErr?.message ?? "Failed to create user" }, 400);
      }
      const userId = created.user.id;

      const permitted = body.permittedOfficeIds ?? (isDirector ? [] : [body.officeId]);
      const perms = body.specialPermissions ?? {
        canExport: isDirector,
        canAddCrossings: isDirector,
        canViewAllOffices: isDirector,
        canOpenWindow: isDirector || body.role === "supervisor",
        canEditReports: isDirector,
      };

      // handle_new_user() trigger already inserts a default profile + agent role,
      // so upsert/update to the requested values.
      await admin.from("profiles").upsert({
        id: userId,
        full_name_ar: body.fullNameAr,
        office_id: body.officeId,
        permitted_office_ids: permitted,
        special_permissions: perms,
        is_active: true,
      });
      await admin.from("user_roles").delete().eq("user_id", userId);
      await admin.from("user_roles").insert({ user_id: userId, role: body.role });

      return json({
        success: true,
        user: {
          id: userId,
          fullNameAr: body.fullNameAr,
          role: body.role,
          officeId: body.officeId,
          permittedOfficeIds: permitted,
          specialPermissions: perms,
          isActive: true,
          createdAt: new Date().toISOString(),
          email,
        },
      });
    }

    if (body.action === "resetPassword") {
      if (!body.userId || !body.password || body.password.length < 6) {
        return json({ error: "Invalid password (min 6 chars)" }, 400);
      }
      const { error } = await admin.auth.admin.updateUserById(body.userId, {
        password: body.password,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (body.action === "updateEmail") {
      const local = (body.username ?? "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9._-]+/g, "")
        .replace(/^[._-]+|[._-]+$/g, "");
      if (!body.userId || !local) {
        return json({ error: "Invalid username" }, 400);
      }
      const email = `${local}@ops.iq`;
      const { error } = await admin.auth.admin.updateUserById(body.userId, {
        email,
        email_confirm: true,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ success: true, email });
    }

    if (body.action === "clearData") {
      const tables = ["daily_reports", "emergencies", "extension_requests", "agent_locations", "visitor_flow_paths"];
      for (const t of tables) {
        await admin.from(t).delete().not("id", "is", null);
      }
      return json({ success: true });
    }

    if (body.action === "updateRole") {
      const { userId, role } = body as any;
      if (!userId || !role) return json({ error: "userId and role are required" }, 400);
      const validRoles = ["director", "supervisor", "manager", "agent", "viewer"];
      if (!validRoles.includes(role)) return json({ error: "Invalid role" }, 400);
      await admin.from("user_roles").delete().eq("user_id", userId);
      const { error: insertErr } = await admin.from("user_roles").insert({ user_id: userId, role });
      if (insertErr) return json({ error: insertErr.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
