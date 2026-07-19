import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";
import { ShieldCheck, ExternalLink } from "lucide-react";

// Local typed wrapper for the beta supabase.auth.oauth namespace.
type OAuthClient = { name?: string; client_name?: string; client_uri?: string; logo_uri?: string } | null;
type OAuthDetails = {
  client?: OAuthClient;
  redirect_uri?: string;
  scope?: string;
  scopes?: string[];
  redirect_url?: string;
  redirect_to?: string;
} | null;
type OAuthResult = { data: { redirect_url?: string; redirect_to?: string } | null; error: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: OAuthDetails; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};
const oauthApi = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export default function OAuthConsentPage() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<OAuthDetails>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("طلب صلاحية غير صالح — لا يوجد authorization_id");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      setEmail(sess.session.user.email ?? "");
      const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => { active = false; };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const api = oauthApi();
    const res = approve
      ? await api.approveAuthorization(authorizationId)
      : await api.denyAuthorization(authorizationId);
    if (res.error) { setBusy(false); return setError(res.error.message); }
    const target = res.data?.redirect_url ?? res.data?.redirect_to;
    if (!target) { setBusy(false); return setError("لم يُرجع خادم الصلاحيات عنوان توجيه."); }
    window.location.href = target;
  }

  const clientName = details?.client?.client_name ?? details?.client?.name ?? "تطبيق خارجي";
  const scopeList: string[] = details?.scopes ?? (details?.scope ? details.scope.split(/\s+/).filter(Boolean) : []);

  if (error) {
    return (
      <main className="min-h-screen bg-[#0d0d0d] flex items-center justify-center p-4" dir="rtl">
        <div className="w-full max-w-md bg-[#151515] border border-red-500/30 rounded-2xl p-6 text-center">
          <div className="text-red-400 font-bold mb-2">تعذّر تحميل طلب الصلاحية</div>
          <div className="text-slate-400 text-sm">{error}</div>
        </div>
      </main>
    );
  }
  if (!details) {
    return (
      <main className="min-h-screen bg-[#0d0d0d] flex items-center justify-center" dir="rtl">
        <div className="w-10 h-10 border-3 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0d0d0d] flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md bg-[#151515] border border-[#232323] rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="text-slate-200 font-bold">ربط {clientName} بحسابك</div>
            <div className="text-[11px] text-slate-500">صلاحية وصول عبر MCP</div>
          </div>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed mb-3">
          سيتمكّن <span className="text-amber-300 font-semibold">{clientName}</span> من استدعاء أدوات
          هذا التطبيق نيابةً عنك أثناء تسجيل دخولك. لن يتم تجاوز صلاحياتك أو سياسات الحماية.
        </p>

        <div className="text-[12px] text-slate-400 bg-[#1a1a1a] border border-[#232323] rounded-lg p-3 mb-4 space-y-1">
          <div>الحساب: <span className="text-slate-200">{email || "—"}</span></div>
          {details.redirect_uri && (
            <div className="flex items-center gap-1 truncate">
              <ExternalLink className="w-3 h-3" />
              <span className="truncate">{details.redirect_uri}</span>
            </div>
          )}
          {scopeList.length > 0 && (
            <div>الصلاحيات: <span className="text-slate-200">{scopeList.join("، ")}</span></div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            disabled={busy}
            onClick={() => decide(true)}
            className="flex-1 py-2.5 rounded-lg bg-amber-500 text-black font-bold text-sm disabled:opacity-50"
          >
            موافقة
          </button>
          <button
            disabled={busy}
            onClick={() => decide(false)}
            className="flex-1 py-2.5 rounded-lg bg-[#1a1a1a] border border-[#232323] text-slate-300 text-sm disabled:opacity-50"
          >
            رفض
          </button>
        </div>
      </div>
    </main>
  );
}
