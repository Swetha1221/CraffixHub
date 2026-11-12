import React from 'react';
import { getStatusVariant } from '../../utils/format';

export function Badge({ children, variant = 'neutral' }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}

export function StatusBadge({ status }) {
  const variant = getStatusVariant(status);
  const label = String(status || 'UNKNOWN').replace(/_/g, ' ');
  return <Badge variant={variant}>{label}</Badge>;
}

export function StatCard({ label, value, delta, icon: Icon, iconBg = 'var(--color-secondary-soft)', iconColor = 'var(--color-secondary)' }) {
  return (
    <div className="kpi-card">
      {Icon && (
        <div className="kpi-icon-box" style={{ background: iconBg, color: iconColor }}>
          <Icon size={22} />
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span className="kpi-value">{value}</span>
          {delta && <span className="kpi-delta" style={{ marginTop: 0 }}>{delta}</span>}
        </div>
        <div className="kpi-label">{label}</div>
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title = 'No records found', description = '', action = null }) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '44px 20px',
        color: 'var(--text-muted)',
      }}
    >
      {Icon && (
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: 'var(--bg-hover)',
            color: 'var(--text-muted)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 12,
          }}
        >
          <Icon size={24} />
        </div>
      )}
      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{title}</div>
      {description && <div style={{ fontSize: 13, marginTop: 4 }}>{description}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div>
      <div className="kpi-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card">
            <div className="skeleton" style={{ height: 28, width: '50%', marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 14, width: '75%' }} />
          </div>
        ))}
      </div>
      <div className="grid-3-1">
        <div className="card">
          <div className="skeleton" style={{ height: 240, width: '100%' }} />
        </div>
        <div className="card">
          <div className="skeleton" style={{ height: 240, width: '100%' }} />
        </div>
      </div>
    </div>
  );
}
