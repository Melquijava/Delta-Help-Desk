import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

type ModalProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  size?: 'default' | 'wide';
  onClose: () => void;
};

export function Modal({ open, title, children, size = 'default', onClose }: ModalProps) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/50 p-0 sm:items-center sm:justify-center sm:p-6" role="presentation" onMouseDown={onClose}>
      <section
        className={size === 'wide' ? 'max-h-[90vh] w-full overflow-auto rounded-t bg-white shadow-xl sm:max-w-5xl sm:rounded' : 'max-h-[90vh] w-full overflow-auto rounded-t bg-white shadow-xl sm:max-w-lg sm:rounded'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id="modal-title" className="text-base font-semibold text-slate-950">
            {title}
          </h2>
          <Button className="h-10 w-10 px-0" variant="ghost" title="Fechar" onClick={onClose} icon={<X size={18} aria-hidden="true" />} />
        </header>
        <div className="px-5 py-4">{children}</div>
      </section>
    </div>
  );
}
