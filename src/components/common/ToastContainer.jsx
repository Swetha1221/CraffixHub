import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { X } from 'lucide-react';
import { removeToast } from '../../app/uiSlice';

export function ToastContainer() {
  const dispatch = useDispatch();
  const toasts = useSelector((state) => state.ui.toasts);

  useEffect(() => {
    if (toasts.length === 0) return undefined;
    const timer = setTimeout(() => {
      dispatch(removeToast(toasts[0].id));
    }, 4500);
    return () => clearTimeout(timer);
  }, [toasts, dispatch]);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        maxWidth: 340,
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="card"
          style={{
            padding: '12px 14px',
            boxShadow: 'var(--shadow-lg)',
            borderLeft: `4px solid ${
              t.type === 'error'
                ? 'var(--color-danger)'
                : t.type === 'success'
                  ? 'var(--color-accent)'
                  : 'var(--color-secondary)'
            }`,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            {t.title && <div style={{ fontWeight: 700, fontSize: 13 }}>{t.title}</div>}
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>{t.message}</div>
          </div>
          <button
            type="button"
            onClick={() => dispatch(removeToast(t.id))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
