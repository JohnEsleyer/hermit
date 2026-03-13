import { CheckCircle2, Info, AlertCircle } from 'lucide-react';
import { ToastMessage } from '../types';

export function ToastContainer({ toasts }: { toasts: ToastMessage[] }) {
  return (
    <div className="fixed bottom-10 right-10 z-[100] flex flex-col gap-4 pointer-events-none">
      {toasts.map(toast => {
        const isError = toast.type === 'error';
        const isInfo = toast.type === 'info';
        return (
          <div key={toast.id} className={`bg-white text-black px-8 py-5 rounded-full font-bold text-sm shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-5 fade-in duration-300 pointer-events-auto`}>
            {isError ? <AlertCircle className="w-5 h-5 text-red-500" /> : 
             isInfo ? <Info className="w-5 h-5 text-blue-500" /> : 
             <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
            <span className="lowercase">{toast.message}</span>
          </div>
        );
      })}
    </div>
  );
}
