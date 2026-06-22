import React from 'react';

type Props = { children: React.ReactNode; fallback?: React.ReactNode };
type State = { hasError: boolean; error?: any };

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: any): State {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, info: any) {
    console.error('[ErrorBoundary]', error, info);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center p-6" dir="rtl">
          <div className="max-w-md w-full bg-[#111827] border border-red-500/30 rounded-2xl p-6 text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <div className="text-lg font-black text-red-300 mb-2">حدث خطأ غير متوقع</div>
            <div className="text-xs text-slate-400 mb-4">تم تسجيل الخطأ تلقائياً. جرّب تحديث الصفحة.</div>
            <div className="flex gap-2 justify-center">
              <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm">
                تحديث الصفحة
              </button>
              <button onClick={() => this.setState({ hasError: false })} className="px-4 py-2 rounded-lg bg-[#1E293B] hover:bg-[#263244] text-slate-200 text-sm">
                محاولة مجدداً
              </button>
            </div>
            {import.meta.env.DEV && (
              <pre className="mt-4 text-[10px] text-left text-red-300 bg-black/30 p-2 rounded overflow-auto max-h-40" dir="ltr">
                {String(this.state.error?.stack || this.state.error)}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
