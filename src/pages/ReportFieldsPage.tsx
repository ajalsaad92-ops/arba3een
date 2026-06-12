import FieldDefinitionsManager from '../components/FieldDefinitionsManager';
import { Settings2 } from 'lucide-react';

export default function ReportFieldsPage() {
  return (
    <div className="h-full overflow-y-auto bg-[#0B0F19] p-3 md:p-5">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Settings2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-display font-black text-amber-400">إدارة حقول التقرير</div>
            <div className="text-xs text-slate-400 mt-0.5">أعد التسمية، أضف شروحاً، أخفِ، خصّص، أو أضف حقولاً جديدة</div>
          </div>
        </div>
        <FieldDefinitionsManager />
      </div>
    </div>
  );
}