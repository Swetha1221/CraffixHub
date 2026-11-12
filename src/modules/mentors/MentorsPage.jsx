import React, { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { StatusBadge } from '../../components/common/UI';

export function MentorsPage() {
  const [mentors, setMentors] = useState([]);

  const loadData = useCallback(async () => {
    const res = await api.get('/mentors');
    setMentors(res.data.data || []);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mentor Management</h1>
          <p className="page-subtitle">Faculty profiles and allocated training batches</p>
        </div>
      </div>

      <div className="grid-3">
        {mentors.map((m) => (
          <div key={m._id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{m.fullName}</div>
              <StatusBadge status={m.status} />
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 12 }}>{m.email}</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Assigned Batches ({m.assignedBatches?.length || 0})</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {m.assignedBatches?.map((b) => (
                <span key={b._id} className="badge badge-primary">{b.batchCode}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
