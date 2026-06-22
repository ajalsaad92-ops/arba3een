import { useOnline } from '../hooks/useUtils';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-[900] bg-amber-600 text-black text-xs font-bold py-2 px-4 flex items-center justify-center gap-2" dir="rtl">
      <WifiOff className="w-4 h-4" />
      أنت غير متصل — سيتم حفظ التغييرات محلياً وإرسالها تلقائياً عند عودة الاتصال
    </div>
  );
}
