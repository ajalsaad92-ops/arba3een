import { AlertCircle, ExternalLink, Copy } from 'lucide-react';
import { useState } from 'react';

const REQUIRED_VARS = [
  { key: 'VITE_SUPABASE_URL',            hint: 'Project Settings → API → Project URL' },
  { key: 'VITE_SUPABASE_PUBLISHABLE_KEY', hint: 'Project Settings → API → Publishable key' },
];

export default function EnvErrorPage() {
  const [copied, setCopied] = useState(false);
  const exampleEnv = `VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxx`;

  const copyExample = async () => {
    try {
      await navigator.clipboard.writeText(exampleEnv);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center p-4 bg-[#0B0F19] grid-pattern">
      <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-red-500/10 blur-3xl pointer-events-none" />
      <div className="relative z-10 w-full max-w-2xl bg-gradient-to-br from-[#111827] to-[#0B0F19] border border-red-500/30 rounded-2xl p-8 shadow-2xl shadow-black/60">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-12 h-12 rounded-xl bg-red-500/15 border border-red-500/40 flex items-center justify-center shrink-0">
            <AlertCircle className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-red-300 mb-1">لم يتم تهيئة Supabase</h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              التطبيق يحتاج إلى متغيري بيئة (env vars) للاتصال بقاعدة البيانات. أضفهما في إعدادات المشروع ثم أعد النشر.
            </p>
          </div>
        </div>

        <div className="mb-5">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-bold">المتغيرات المطلوبة</div>
          <ul className="space-y-2">
            {REQUIRED_VARS.map(v => (
              <li key={v.key} className="flex items-start gap-2 p-2.5 rounded-lg bg-[#0B0F19] border border-[#1E293B]">
                <code className="text-xs text-amber-400 font-mono font-bold shrink-0">{v.key}</code>
                <span className="text-[11px] text-slate-500 leading-relaxed pt-0.5">— {v.hint}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mb-5">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-bold">مثال على ملف .env</div>
          <div className="relative">
            <pre dir="ltr" className="text-[11px] font-mono text-emerald-300 bg-[#0B0F19] border border-[#1E293B] rounded-lg p-3 overflow-x-auto whitespace-pre">
{exampleEnv}
            </pre>
            <button
              onClick={copyExample}
              className="absolute top-2 left-2 p-1.5 rounded-md bg-[#1E293B] hover:bg-[#263244] text-slate-400 hover:text-white transition-colors"
              title="نسخ المثال"
            >
              {copied ? <span className="text-[10px] text-emerald-400">✓</span> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-[11px]">
          <ExternalLink className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">
            في Lovable: <span className="font-mono">Project → Settings → Env</span> ، أضف المتغيرين ثم اضغط <span className="font-bold">Publish</span> لإعادة النشر.
          </div>
        </div>
      </div>
    </div>
  );
}
