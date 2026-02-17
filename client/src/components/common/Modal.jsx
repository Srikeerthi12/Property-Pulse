import { useEffect } from 'react';

export default function Modal({ open, title, onClose, children, footer }) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose?.();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 h-full w-full bg-foreground/20"
        aria-label="Close"
        onClick={() => onClose?.()}
      />
      <div className="relative mx-auto mt-24 w-[92vw] max-w-lg rounded-lg border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-serif text-base font-semibold">{title}</div>
          </div>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="rounded-md border bg-background px-2 py-1 text-sm"
          >
            Close
          </button>
        </div>
        <div className="grid gap-3">{children}</div>
        {footer ? <div className="mt-4 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}
