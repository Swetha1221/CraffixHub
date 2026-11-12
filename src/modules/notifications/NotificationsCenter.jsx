import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Bell, ArrowRight, Check, MessageSquare, X } from 'lucide-react';
import api from '../../services/api';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { setNotificationsState } from '../../app/realtimeSlice';
import { pushToast } from '../../app/uiSlice';
import { EmptyState, StatusBadge } from '../../components/common/UI';
import { Modal } from '../../components/common/Modal';
import { formatDateTime } from '../../utils/format';

const FILTER_TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'UNREAD', label: 'Unread' },
  { key: 'ACADEMY_ENROLMENTS', label: 'Academy & Enrolments' },
  { key: 'LEAVE_UPDATES', label: 'Leave Updates' },
  { key: 'FINANCE_APPROVALS', label: 'Finance & Approvals' },
  { key: 'SUBMISSIONS', label: 'Submissions' },
];

const CATEGORY_LABELS = {
  ACADEMY_ENROLMENTS: { label: 'Academy & Enrolments', cls: 'badge-success' },
  LEAVE_UPDATES: { label: 'Leave Updates', cls: 'badge-warning' },
  FINANCE_APPROVALS: { label: 'Finance & Approvals', cls: 'badge-info' },
  SUBMISSIONS: { label: 'Submissions & Pitches', cls: 'badge-primary' },
};

function resolveCategory(notif) {
  if (notif.category && CATEGORY_LABELS[notif.category]) return notif.category;
  const type = String(notif.type || '').toUpperCase();
  if (type.includes('LEAVE')) return 'LEAVE_UPDATES';
  if (type.includes('ENROL') || type.includes('COURSE') || type.includes('BATCH') || type.includes('ATTEND')) {
    return 'ACADEMY_ENROLMENTS';
  }
  if (type.includes('FINANCE') || type.includes('PAYMENT') || type.includes('INVOICE') || type.includes('EXPENSE')) {
    return 'FINANCE_APPROVALS';
  }
  if (type.includes('PITCH') || type.includes('SUBMISSION') || type.includes('TASK') || type.includes('PROJECT')) {
    return 'SUBMISSIONS';
  }
  return 'SYSTEM_ALERTS';
}

export function NotificationsCenter() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);
  const canReviewPitches = ['ADMIN', 'SUPER_ADMIN'].includes(user?.primaryRole);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState('ALL');
  const [reviewPitch, setReviewPitch] = useState(null);
  const [pitchRemarks, setPitchRemarks] = useState('');

  const loadNotifications = useCallback(async () => {
    const res = await api.get('/notifications');
    const data = res.data.data || {};
    setItems(data.items || []);
    setUnreadCount(data.unreadCount || 0);
    dispatch(setNotificationsState(data));
  }, [dispatch]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Automatically mark notifications as read after viewing without a manual button
  useEffect(() => {
    if (unreadCount <= 0) return undefined;
    const timer = setTimeout(async () => {
      try {
        await api.post('/notifications/read-all');
        const res = await api.get('/notifications');
        const data = res.data.data || {};
        setUnreadCount(data.unreadCount || 0);
        dispatch(setNotificationsState(data));
      } catch {
        // Ignore silent auto-read errors
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [unreadCount, dispatch]);

  useRealtimeSync(loadNotifications, ['notifications', 'leaves', 'ideas', 'enrollments']);

  const markSingleRead = async (notif) => {
    if (notif.readAt) return;
    try {
      await api.post(`/notifications/${notif._id}/read`);
      setItems((prev) =>
        prev.map((item) => (item._id === notif._id ? { ...item, readAt: new Date().toISOString() } : item))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Ignore silent read error
    }
  };

  const handleQuickAction = async (notif, e) => {
    if (e) e.stopPropagation();
    await markSingleRead(notif);
    navigate(notif.link || '/dashboard');
  };

  const handlePitchDecision = async (pitchId, decision, remarks = '') => {
    await api.post(`/idea-pitches/${pitchId}/review`, { decision, remarks });
    dispatch(
      pushToast({
        type: 'success',
        title: `Pitch ${decision === 'APPROVE' ? 'Approved' : decision === 'SHORTLIST' ? 'Shortlisted' : decision}`,
        message: 'Guest participant has been notified of your decision.',
      })
    );
    setReviewPitch(null);
    setPitchRemarks('');
    loadNotifications();
  };

  const categoryCounts = items.reduce((acc, n) => {
    const c = resolveCategory(n);
    acc[c] = (acc[c] || 0) + 1;
    return acc;
  }, {});

  const filtered = items.filter((n) => {
    const cat = resolveCategory(n);
    if (activeTab === 'UNREAD') return !n.readAt;
    if (activeTab === 'ALL') return true;
    return cat === activeTab;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications Center</h1>
          <p className="page-subtitle">
            Stay updated on leave approvals, course enrolments, guest idea pitches, and submissions. Notifications are marked read automatically upon view or click.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="filter-tabs">
          {FILTER_TABS.map((t) => {
            const count =
              t.key === 'ALL'
                ? items.length
                : t.key === 'UNREAD'
                ? unreadCount
                : categoryCounts[t.key] || 0;
            return (
              <button
                key={t.key}
                type="button"
                className={`filter-tab ${activeTab === t.key ? 'active' : ''}`}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
                {count > 0 && (
                  <span
                    className={`badge ${t.key === 'UNREAD' ? 'badge-danger' : 'badge-neutral'}`}
                    style={{ padding: '1px 7px', fontSize: 10.5 }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Bell}
            title="No notifications in this category"
            description="When leave approvals, enrolments, finance updates, or submissions arrive, they will appear here."
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((n) => {
            const catKey = resolveCategory(n);
            const badge = CATEGORY_LABELS[catKey] || { label: 'Update', cls: 'badge-neutral' };
            const isPitchAlert = canReviewPitches && n.type === 'NEW_PITCH' && n.pitch;
            return (
              <div
                key={n._id}
                className={`notif-card ${n.readAt ? '' : 'unread'}`}
                style={{ cursor: 'pointer' }}
                onClick={() => markSingleRead(n)}
              >
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flex: 1 }}>
                  {!n.readAt ? (
                    <span className="notif-unread-dot" title="Unread" />
                  ) : (
                    <span style={{ width: 9, flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span className={`badge ${badge.cls}`}>{badge.label}</span>
                      <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{formatDateTime(n.createdAt)}</span>
                      {n.pitch && <StatusBadge status={n.pitch.status} />}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text-primary)' }}>{n.title}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>{n.message}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                  {isPitchAlert && (
                    <>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          markSingleRead(n);
                          setReviewPitch(n.pitch);
                          setPitchRemarks(n.pitch.reviewRemarks || '');
                        }}
                      >
                        <MessageSquare size={13} /> Review
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          markSingleRead(n);
                          handlePitchDecision(n.pitch._id, 'APPROVE', 'Approved from Notifications Center');
                        }}
                      >
                        <Check size={13} /> Approve
                      </button>
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          markSingleRead(n);
                          handlePitchDecision(n.pitch._id, 'SHORTLIST', 'Shortlisted from Notifications Center');
                        }}
                      >
                        <Check size={13} /> Shortlist
                      </button>
                    </>
                  )}
                  {n.link && !isPitchAlert && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={(e) => handleQuickAction(n, e)}
                    >
                      {n.actionLabel || 'Open'} <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={Boolean(reviewPitch)}
        onClose={() => setReviewPitch(null)}
        title={`Review Guest Idea Pitch — ${reviewPitch?.pitchCode || ''}`}
        maxWidth={580}
      >
        {reviewPitch && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span className="badge badge-primary">{reviewPitch.category}</span>
              <StatusBadge status={reviewPitch.status} />
            </div>
            <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg-subtle)' }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>PROBLEM STATEMENT</div>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{reviewPitch.problemStatement}</div>
            </div>
            <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg-subtle)' }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>ABSTRACT SOLUTION</div>
              <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{reviewPitch.abstractSolution}</div>
            </div>
            <div className="form-field">
              <label className="form-label">Review Remarks</label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="Write feedback for the guest participant..."
                value={pitchRemarks}
                onChange={(e) => setPitchRemarks(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => handlePitchDecision(reviewPitch._id, 'APPROVE', pitchRemarks || 'Approved for innovation showcase')}
              >
                <Check size={14} /> Approve
              </button>
              <button
                type="button"
                className="btn btn-success btn-sm"
                onClick={() => handlePitchDecision(reviewPitch._id, 'SHORTLIST', pitchRemarks || 'Shortlisted for next round')}
              >
                <Check size={14} /> Shortlist
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => handlePitchDecision(reviewPitch._id, 'REVIEWED', pitchRemarks || 'Reviewed by Administration')}
              >
                <MessageSquare size={14} /> Mark Reviewed
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => handlePitchDecision(reviewPitch._id, 'REJECT', pitchRemarks)}
              >
                <X size={14} /> Reject
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
