import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type DemoUser = {
  email: string;
  password: string;
  fullNameAr: string;
  role: "director" | "supervisor" | "manager" | "agent";
  officeId: string;
};

const DEMO_USERS: DemoUser[] = [
  { email: "u-director@ops.iq",   password: "123456", fullNameAr: "أبو علي المهداوي",   role: "director",   officeId: "HQ"  },
  { email: "u-supervisor@ops.iq", password: "123456", fullNameAr: "الحاج كاظم العبيدي", role: "supervisor", officeId: "HQ"  },
  { email: "u-manager@ops.iq",    password: "123456", fullNameAr: "أحمد محمد الجبوري",  role: "manager",    officeId: "KRB" },
  { email: "u-agent@ops.iq",      password: "123456", fullNameAr: "محمد علي الحسناوي",  role: "agent",      officeId: "KRB" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const results: Array<{ email: string; status: string }> = [];

    // list existing users to avoid duplicates
    const { data: existing } = await admin.auth.admin.listUsers();
    const existingByEmail = new Map(
      (existing?.users ?? []).map((u) => [u.email?.toLowerCase(), u.id]),
    );

    for (const u of DEMO_USERS) {
      let userId = existingByEmail.get(u.email.toLowerCase());

      if (!userId) {
        const { data: created, error: createErr } =
          await admin.auth.admin.createUser({
            email: u.email,
            password: u.password,
            email_confirm: true,
            user_metadata: { full_name_ar: u.fullNameAr },
          });
        if (createErr || !created.user) {
          results.push({ email: u.email, status: `error: ${createErr?.message}` });
          continue;
        }
        userId = created.user.id;
      } else {
        // make sure password is reset to the demo password
        await admin.auth.admin.updateUserById(userId, {
          password: u.password,
          email_confirm: true,
        });
      }

      const isDirector = u.role === "director";
      const permitted = isDirector ? [] : [u.officeId];

      await admin.from("profiles").upsert({
        id: userId,
        full_name_ar: u.fullNameAr,
        office_id: u.officeId,
        permitted_office_ids: permitted,
        special_permissions: {
          canExport: isDirector,
          canAddCrossings: isDirector,
          canViewAllOffices: isDirector,
          canOpenWindow: isDirector || u.role === "supervisor",
          canEditReports: isDirector,
        },
        is_active: true,
      });

      await admin.from("user_roles").upsert(
        { user_id: userId, role: u.role },
        { onConflict: "user_id,role" },
      );

      results.push({ email: u.email, status: "ok" });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
