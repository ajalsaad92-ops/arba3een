import React from 'react';

type Props = {
  label: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  id?: string;
  counter?: { current: number; max?: number };
};

export function FormField({ label, error, hint, required, children, id, counter }: Props) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  
  const child = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<any>, {
        id,
        'aria-invalid': !!error,
        'aria-describedby': describedBy,
        className: [
          (children.props as any).className || '',
          error ? ' !border-red-500/70 focus:!border-red-500 focus:!ring-red-500/20' : ''
        ].join(' ')
      })
    : children;

  return (
    <div>
      <label htmlFor={id} className="text-xs text-slate-300 mb-1.5 flex items-center justify-between font-semibold">
        <span>{label}{required && <span className="text-red-400 mr-1">*</span>}</span>
        {counter && (
          <span className={`text-[10px] ${counter.max && counter.current > counter.max ? 'text-red-400' : 'text-slate-500'}`}>
            {counter.current}{counter.max ? `/${counter.max}` : ''}
          </span>
        )}
      </label>
      {child}
      {error ? (
        <div id={`${id}-error`} className="text-[11px] text-red-400 mt-1" role="alert">{error}</div>
      ) : hint ? (
        <div id={`${id}-hint`} className="text-[10px] text-slate-500 mt-1">{hint}</div>
      ) : null}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-[#1E293B] ${className}`} />;
}

export function EmptyState({ icon: Icon, title, description, action }: {
  icon?: any;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="py-12 text-center">
      {Icon && <Icon className="w-10 h-10 mx-auto text-slate-600 mb-3" />}
      <div className="text-sm font-bold text-slate-300">{title}</div>
      {description && <div className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="py-10 text-center">
      <div className="text-sm font-bold text-red-300 mb-1">حدث خطأ</div>
      <div className="text-xs text-slate-400">{message || 'تعذّر تحميل البيانات'}</div>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 px-4 py-1.5 rounded-md bg-[#1E293B] hover:bg-[#263244] text-slate-200 text-xs font-bold">
          إعادة المحاولة
        </button>
      )}
    </div>
  );
}
