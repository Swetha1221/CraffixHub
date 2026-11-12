import React, { useCallback, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users,
  GraduationCap,
  BookOpen,
  CalendarDays,
  UserPlus,
  PlusCircle,
  BarChart3,
  Layers,
  IndianRupee,
  CheckCircle2,
  Clock,
  Award,
  FileText,
  Upload,
  Trophy,
  MapPin,
  ArrowRight,
  AlertCircle,
  Lightbulb,
  CreditCard,
  ClipboardCheck,
  Crown,
  Check,
  MessageSquare,
  X,
  Plus,
  CalendarClock,
  Columns3,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import api from '../../services/api';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { pushToast } from '../../app/uiSlice';
import { StatCard, StatusBadge, DashboardSkeleton, EmptyState } from '../../components/common/UI';
import { Modal } from '../../components/common/Modal';
import { formatINR, formatDate, formatDateTime } from '../../utils/format';

const CEO_CATEGORIES = [
  { key: 'ALL', label: 'All Actions', cls: 'badge-neutral' },
  { key: 'ACADEMY_ENROLMENTS', label: 'Academy & Enrolments', cls: 'badge-success' },
  { key: 'LEAVE_UPDATES', label: 'Leave Updates', cls: 'badge-warning' },
  { key: 'FINANCE_APPROVALS', label: 'Finance & Approvals', cls: 'badge-info' },
  { key: 'SUBMISSIONS', label: 'Submissions & Pitches', cls: 'badge-primary' },
];

const KANBAN_STAGES = [
  { key: 'NEW_INQUIRY', label: 'New Inquiry', color: '#6366F1' },
  { key: 'FEE_UNLOCKED', label: 'Fee Unlocked', color: '#0EA5E9' },
  { key: 'COUNSELING_SESSION', label: 'Counseling Session', color: '#F59E0B' },
  { key: 'ADMIN_APPROVAL', label: 'Admin Approval', color: '#8B5CF6' },
  { key: 'ENROLLED', label: 'Enrolled', color: '#10B981' },
];

export function DashboardPage() {
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('THIS_MONTH');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [reviewPitch, setReviewPitch] = useState(null);
  const [pitchRemarks, setPitchRemarks] = useState('');
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    title: '',
    courseId: '',
    batchId: '',
    scheduledDate: new Date().toISOString().slice(0, 10),
    timeSlot: '10:00 AM - 11:30 AM',
    mode: 'ONLINE',
    notes: '',
  });
  const [draggedEnrollmentId, setDraggedEnrollmentId] = useState(null);

  const loadDashboard = useCallback(async () => {
    try {
      const res = await api.get('/reports/dashboard', { params: { period } });
      setData(res.data.data);
    } catch {
      // ignore transient errors
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useRealtimeSync(loadDashboard);

  const handlePitchReview = async (pitchId, decision, remarks = '') => {
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
    loadDashboard();
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    await api.post('/coordinator/enrollment-sessions', sessionForm);
    dispatch(
      pushToast({
        type: 'success',
        title: 'Enrollment Session Scheduled',
        message: `${sessionForm.title} has been added.`,
      })
    );
    setSessionModalOpen(false);
    setSessionForm({
      title: '',
      courseId: '',
      batchId: '',
      scheduledDate: new Date().toISOString().slice(0, 10),
      timeSlot: '10:00 AM - 11:30 AM',
      mode: 'ONLINE',
      notes: '',
    });
    loadDashboard();
  };

  const handleUpdateSessionStatus = async (sessionId, status) => {
    await api.patch(`/coordinator/enrollment-sessions/${sessionId}`, { status });
    dispatch(pushToast({ type: 'success', title: 'Session Updated', message: `Session marked ${status}.` }));
    loadDashboard();
  };

  const handleMoveKanbanStage = async (enrollmentId, kanbanStage) => {
    await api.patch(`/enrollments/${enrollmentId}/kanban-stage`, { kanbanStage });
    dispatch(pushToast({ type: 'success', title: 'Kanban Stage Updated', message: `Moved to ${kanbanStage.replace(/_/g, ' ')}.` }));
    loadDashboard();
  };

  if (loading || !data) {
    return <DashboardSkeleton />;
  }

  const role = data.role || user?.primaryRole;

  if (role === 'SUPER_ADMIN') {
    const {
      kpis,
      revenueOverview,
      recentActivities = [],
      upcomingEvents = [],
      categoryBreakdown = {},
      ideaPitches = [],
    } = data;
    const filteredActivities =
      categoryFilter === 'ALL'
        ? recentActivities
        : recentActivities.filter((a) => (a.category || 'SUBMISSIONS') === categoryFilter);
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Super Admin Dashboard</h1>
            <p className="page-subtitle">Organization-wide executive oversight and categorized activity</p>
          </div>
          <select
            className="form-select"
            style={{ width: 150 }}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            aria-label="Filter period"
          >
            <option value="THIS_MONTH">This Month</option>
            <option value="ALL_TIME">All Time</option>
          </select>
        </div>

        <div className="card" style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800 }}>Categorized Platform Activity Feed</div>
            <Link to="/notifications" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-secondary)' }}>
              Open Full CEO Notifications →
            </Link>
          </div>
          <div className="filter-tabs">
            {CEO_CATEGORIES.map((cat) => {
              const count = cat.key === 'ALL' ? recentActivities.length : categoryBreakdown[cat.key] || 0;
              return (
                <button
                  key={cat.key}
                  type="button"
                  className={`filter-tab ${categoryFilter === cat.key ? 'active' : ''}`}
                  onClick={() => setCategoryFilter(cat.key)}
                >
                  {cat.label}
                  <span className="badge badge-neutral" style={{ padding: '1px 7px', fontSize: 10.5 }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="kpi-grid">
          <StatCard
            label="Employees"
            value={kpis.employees.value}
            delta={kpis.employees.delta}
            icon={Users}
            iconBg="rgba(95, 78, 246, 0.12)"
            iconColor="#5F4EF6"
          />
          <StatCard
            label="Students"
            value={kpis.students.value}
            delta={kpis.students.delta}
            icon={GraduationCap}
            iconBg="rgba(45, 70, 185, 0.13)"
            iconColor="#2D46B9"
          />
          <StatCard
            label="Active Courses"
            value={kpis.activeCourses.value}
            delta={kpis.activeCourses.delta}
            icon={BookOpen}
            iconBg="rgba(65, 54, 182, 0.12)"
            iconColor="#4136B6"
          />
          <StatCard
            label="Upcoming Events"
            value={kpis.upcomingEvents.value}
            icon={CalendarDays}
            iconBg="rgba(105, 76, 246, 0.14)"
            iconColor="#694CF6"
          />
        </div>

        <div className="grid-3-1" style={{ marginBottom: 18 }}>
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Revenue Overview</h3>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
                  <span style={{ fontSize: 26, fontWeight: 800 }}>{formatINR(revenueOverview.totalRevenue)}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-accent)' }}>
                    {revenueOverview.growthPercent >= 0 ? '+' : ''}
                    {revenueOverview.growthPercent}% vs last month
                  </span>
                </div>
              </div>
              <span className="badge badge-primary">Verified Collections</span>
            </div>

            <div style={{ height: 210 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueOverview.series}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#6C63FF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} />
                  <Tooltip formatter={(val) => formatINR(val)} />
                  <Area type="monotone" dataKey="revenue" stroke="#6C63FF" strokeWidth={2.5} fill="url(#revGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Quick Actions</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Add User', to: '/users', icon: UserPlus, bg: 'rgba(95,78,246,0.12)', color: '#5F4EF6' },
                { label: 'Create Course', to: '/courses', icon: PlusCircle, bg: 'rgba(45,70,185,0.13)', color: '#2D46B9' },
                { label: 'Create Event', to: '/events', icon: CalendarDays, bg: 'rgba(65,54,182,0.12)', color: '#4136B6' },
                { label: 'Generate Report', to: '/reports', icon: BarChart3, bg: 'rgba(105,76,246,0.14)', color: '#694CF6' },
              ].map((act) => {
                const Icon = act.icon;
                return (
                  <button
                    key={act.label}
                    type="button"
                    className="btn btn-outline"
                    style={{ justifyContent: 'flex-start', height: 46, padding: '0 12px' }}
                    onClick={() => navigate(act.to)}
                  >
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: act.bg,
                        color: act.color,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon size={15} />
                    </span>
                    <span>{act.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid-2">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Recent Categorized Activities</h3>
              <Link to="/reports" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-secondary)' }}>
                View Audit Log
              </Link>
            </div>
            {filteredActivities.length === 0 ? (
              <EmptyState title="No activities in this category" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredActivities.map((act) => {
                  const catMeta = CEO_CATEGORIES.find((c) => c.key === act.category) || CEO_CATEGORIES[4];
                  return (
                    <div key={act._id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, paddingBottom: 10, borderBottom: '1px solid var(--border-color)' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                          <span className={`badge ${catMeta.cls}`} style={{ fontSize: 10.5 }}>{catMeta.label}</span>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{act.summary || act.action}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {act.actorName} • {act.module}
                        </div>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {formatDateTime(act.createdAt)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Upcoming Events</h3>
              <Link to="/events" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-secondary)' }}>
                View All
              </Link>
            </div>
            {upcomingEvents.length === 0 ? (
              <EmptyState title="No upcoming events" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {upcomingEvents.map((ev) => (
                  <div key={ev._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingBottom: 10, borderBottom: '1px solid var(--border-color)' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>{ev.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {ev.category} • {formatDate(ev.startDate)}
                      </div>
                    </div>
                    <StatusBadge status={ev.eventStatus} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ marginTop: 18 }}>
          <div className="card-header">
            <h3 className="card-title">Guest Idea Pitches — Review Queue</h3>
            <span className="badge badge-primary">{ideaPitches.length} Pitches</span>
          </div>
          {ideaPitches.length === 0 ? (
            <EmptyState icon={Lightbulb} title="No guest idea pitches yet" description="Guest submissions will trigger alerts here for immediate review." />
          ) : (
            <div className="table-wrap">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Pitch</th>
                    <th>Guest</th>
                    <th>Domain</th>
                    <th>Problem Statement</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ideaPitches.map((p) => (
                    <tr key={p._id}>
                      <td style={{ fontWeight: 700 }}>{p.pitchCode}</td>
                      <td>{p.guestUser?.fullName || 'Guest'}</td>
                      <td><span className="badge badge-primary">{p.category}</span></td>
                      <td style={{ maxWidth: 260 }}>{p.problemStatement}</td>
                      <td><StatusBadge status={p.status} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => {
                              setReviewPitch(p);
                              setPitchRemarks(p.reviewRemarks || '');
                            }}
                          >
                            <MessageSquare size={13} /> Review
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handlePitchReview(p._id, 'APPROVE', 'Approved from Super Admin Dashboard')}
                          >
                            <Check size={13} /> Approve
                          </button>
                          <button
                            type="button"
                            className="btn btn-success btn-sm"
                            onClick={() => handlePitchReview(p._id, 'SHORTLIST', 'Shortlisted from Super Admin Dashboard')}
                          >
                            <Check size={13} /> Shortlist
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Modal
          open={Boolean(reviewPitch)}
          onClose={() => setReviewPitch(null)}
          title={`Review Guest Idea Pitch — ${reviewPitch?.pitchCode || ''}`}
          maxWidth={580}
        >
          {reviewPitch && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{reviewPitch.guestUser?.fullName || 'Guest'}</strong>
                <StatusBadge status={reviewPitch.status} />
              </div>
              <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg-subtle)' }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>PROBLEM STATEMENT</div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{reviewPitch.problemStatement}</div>
              </div>
              <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg-subtle)' }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>ABSTRACT SOLUTION</div>
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>{reviewPitch.abstractSolution}</div>
              </div>
              <div className="form-field">
                <label className="form-label">Review Remarks</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={pitchRemarks}
                  onChange={(e) => setPitchRemarks(e.target.value)}
                  placeholder="Add review notes for the guest..."
                />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => handlePitchReview(reviewPitch._id, 'APPROVE', pitchRemarks || 'Approved')}>
                  <Check size={14} /> Approve
                </button>
                <button type="button" className="btn btn-success btn-sm" onClick={() => handlePitchReview(reviewPitch._id, 'SHORTLIST', pitchRemarks || 'Shortlisted')}>
                  <Check size={14} /> Shortlist
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => handlePitchReview(reviewPitch._id, 'REVIEWED', pitchRemarks || 'Reviewed')}>
                  <MessageSquare size={14} /> Mark Reviewed
                </button>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => handlePitchReview(reviewPitch._id, 'REJECT', pitchRemarks)}>
                  <X size={14} /> Reject
                </button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    );
  }

  if (role === 'ADMIN') {
    const { kpis, enrollmentsTrend, pendingApprovals, ideaPitches = [] } = data;
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Admin Dashboard</h1>
            <p className="page-subtitle">Manage daily operations</p>
          </div>
        </div>

        <div className="kpi-grid">
          <StatCard label="Employees" value={kpis.employees} icon={Users} iconBg="rgba(95,78,246,0.12)" iconColor="#5F4EF6" />
          <StatCard label="Students" value={kpis.students} icon={GraduationCap} iconBg="rgba(45,70,185,0.13)" iconColor="#2D46B9" />
          <StatCard label="Active Batches" value={kpis.activeBatches} icon={Layers} iconBg="rgba(65,54,182,0.12)" iconColor="#4136B6" />
          <StatCard label="This Month Revenue" value={formatINR(kpis.thisMonthRevenue)} icon={IndianRupee} iconBg="rgba(105,76,246,0.14)" iconColor="#694CF6" />
        </div>

        <div className="grid-3-1">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Enrolments Trend</h3>
            </div>
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={enrollmentsTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="enrollments" fill="#6C63FF" radius={[8, 8, 0, 0]} barSize={34} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Pending Approvals</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Link to="/leaves" className="stepper-item" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="kpi-icon-box" style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(95,78,246,0.12)', color: '#5F4EF6' }}>
                    <CheckCircle2 size={16} />
                  </span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>Leave Requests</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pendingApprovals.leaveRequests} Pending</div>
                  </div>
                </div>
                <span className="badge badge-warning">{pendingApprovals.leaveRequests}</span>
              </Link>

              <Link to="/finance" className="stepper-item" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="kpi-icon-box" style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(65,54,182,0.12)', color: '#4136B6' }}>
                    <CreditCard size={16} />
                  </span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>Payment Verification</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pendingApprovals.paymentVerification} Pending</div>
                  </div>
                </div>
                <span className="badge badge-warning">{pendingApprovals.paymentVerification}</span>
              </Link>

              <Link to="/enrollments" className="stepper-item" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="kpi-icon-box" style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(105,76,246,0.14)', color: '#694CF6' }}>
                    <ClipboardCheck size={16} />
                  </span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>Student Enrolments</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pendingApprovals.studentEnrollments} Pending</div>
                  </div>
                </div>
                <span className="badge badge-primary">{pendingApprovals.studentEnrollments}</span>
              </Link>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 18 }}>
          <div className="card-header">
            <h3 className="card-title">Guest Idea Pitches — Direct Review</h3>
            <span className="badge badge-primary">{ideaPitches.length} Pitches</span>
          </div>
          {ideaPitches.length === 0 ? (
            <EmptyState icon={Lightbulb} title="No guest idea pitches yet" description="Guest submissions appear here for direct Review, Approve, and Shortlist actions." />
          ) : (
            <div className="table-wrap">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Pitch</th>
                    <th>Guest</th>
                    <th>Domain</th>
                    <th>Problem Statement</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ideaPitches.map((p) => (
                    <tr key={p._id}>
                      <td style={{ fontWeight: 700 }}>{p.pitchCode}</td>
                      <td>{p.guestUser?.fullName || 'Guest'}</td>
                      <td><span className="badge badge-primary">{p.category}</span></td>
                      <td style={{ maxWidth: 260 }}>{p.problemStatement}</td>
                      <td><StatusBadge status={p.status} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => {
                              setReviewPitch(p);
                              setPitchRemarks(p.reviewRemarks || '');
                            }}
                          >
                            <MessageSquare size={13} /> Review
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handlePitchReview(p._id, 'APPROVE', 'Approved by Admin')}
                          >
                            <Check size={13} /> Approve
                          </button>
                          <button
                            type="button"
                            className="btn btn-success btn-sm"
                            onClick={() => handlePitchReview(p._id, 'SHORTLIST', 'Shortlisted by Admin')}
                          >
                            <Check size={13} /> Shortlist
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Modal
          open={Boolean(reviewPitch)}
          onClose={() => setReviewPitch(null)}
          title={`Review Guest Idea Pitch — ${reviewPitch?.pitchCode || ''}`}
          maxWidth={580}
        >
          {reviewPitch && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{reviewPitch.guestUser?.fullName || 'Guest'}</strong>
                <StatusBadge status={reviewPitch.status} />
              </div>
              <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg-subtle)' }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>PROBLEM STATEMENT</div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{reviewPitch.problemStatement}</div>
              </div>
              <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg-subtle)' }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>ABSTRACT SOLUTION</div>
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>{reviewPitch.abstractSolution}</div>
              </div>
              <div className="form-field">
                <label className="form-label">Review Remarks</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={pitchRemarks}
                  onChange={(e) => setPitchRemarks(e.target.value)}
                  placeholder="Add review notes for the guest..."
                />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => handlePitchReview(reviewPitch._id, 'APPROVE', pitchRemarks || 'Approved')}>
                  <Check size={14} /> Approve
                </button>
                <button type="button" className="btn btn-success btn-sm" onClick={() => handlePitchReview(reviewPitch._id, 'SHORTLIST', pitchRemarks || 'Shortlisted')}>
                  <Check size={14} /> Shortlist
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => handlePitchReview(reviewPitch._id, 'REVIEWED', pitchRemarks || 'Reviewed')}>
                  <MessageSquare size={14} /> Mark Reviewed
                </button>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => handlePitchReview(reviewPitch._id, 'REJECT', pitchRemarks)}>
                  <X size={14} /> Reject
                </button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    );
  }

  if (role === 'COORDINATOR') {
    const {
      kpis,
      myBatches,
      enrollmentSessions = [],
      kanbanEnrollments = [],
      courses = [],
      batches = [],
    } = data;
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Course Coordinator</h1>
            <p className="page-subtitle">Manage assigned courses, enrollment sessions, and candidate Kanban workflow</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setSessionModalOpen(true)}>
            <Plus size={15} /> Schedule Enrollment Session
          </button>
        </div>

        <div className="kpi-grid">
          <StatCard label="Assigned Courses" value={kpis.assignedCourses} icon={BookOpen} iconBg="rgba(95,78,246,0.12)" iconColor="#5F4EF6" />
          <StatCard label="Batches" value={kpis.batches} icon={Layers} iconBg="rgba(45,70,185,0.13)" iconColor="#2D46B9" />
          <StatCard label="Total Students" value={kpis.totalStudents} icon={GraduationCap} iconBg="rgba(65,54,182,0.12)" iconColor="#4136B6" />
          <StatCard label="Avg Attendance" value={`${kpis.avgAttendance}%`} icon={CheckCircle2} iconBg="rgba(105,76,246,0.14)" iconColor="#694CF6" />
        </div>

        {/* Enrollment Session Management Module */}
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-header">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarClock size={17} color="var(--color-secondary)" /> Enrollment Session Management
            </h3>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setSessionModalOpen(true)}>
              <Plus size={14} /> New Session
            </button>
          </div>
          {enrollmentSessions.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="No enrollment sessions scheduled"
              description="Schedule counseling or onboarding sessions for prospective students."
            />
          ) : (
            <div className="table-wrap">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Session</th>
                    <th>Course & Batch</th>
                    <th>Schedule</th>
                    <th>Mode</th>
                    <th>Status</th>
                    <th>Session Controls</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollmentSessions.map((ses) => (
                    <tr key={ses._id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{ses.title}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{ses.sessionCode}</div>
                      </td>
                      <td>
                        <div>{ses.courseTitle}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{ses.batchCode || 'All Batches'}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{formatDate(ses.scheduledDate)}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{ses.timeSlot}</div>
                      </td>
                      <td><span className="badge badge-info">{ses.mode}</span></td>
                      <td><StatusBadge status={ses.status} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {ses.status === 'SCHEDULED' && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => handleUpdateSessionStatus(ses._id, 'IN_PROGRESS')}
                            >
                              Start
                            </button>
                          )}
                          {ses.status !== 'COMPLETED' && ses.status !== 'CANCELLED' && (
                            <button
                              type="button"
                              className="btn btn-success btn-sm"
                              onClick={() => handleUpdateSessionStatus(ses._id, 'COMPLETED')}
                            >
                              Complete
                            </button>
                          )}
                          {ses.status === 'SCHEDULED' && (
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => handleUpdateSessionStatus(ses._id, 'CANCELLED')}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Organized Kanban Workflow Board */}
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-header">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Columns3 size={17} color="var(--color-secondary)" /> Enrollment Kanban Workflow Board
            </h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Drag cards across stages or use arrows to update candidate progression
            </span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, minmax(210px, 1fr))',
              gap: 12,
              overflowX: 'auto',
              paddingBottom: 6,
            }}
          >
            {KANBAN_STAGES.map((stage, stageIdx) => {
              const cards = kanbanEnrollments.filter((enr) => enr.kanbanStage === stage.key);
              return (
                <div
                  key={stage.key}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggedEnrollmentId) {
                      handleMoveKanbanStage(draggedEnrollmentId, stage.key);
                      setDraggedEnrollmentId(null);
                    }
                  }}
                  style={{
                    background: 'var(--bg-subtle)',
                    borderRadius: 12,
                    padding: 10,
                    border: '1px solid var(--border-color)',
                    minHeight: 240,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, borderBottom: `2px solid ${stage.color}` }}>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text-primary)' }}>{stage.label}</span>
                    <span className="badge badge-neutral">{cards.length}</span>
                  </div>
                  {cards.length === 0 ? (
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 6px' }}>
                      Drop candidate here
                    </div>
                  ) : (
                    cards.map((enr) => (
                      <div
                        key={enr._id}
                        draggable
                        onDragStart={() => setDraggedEnrollmentId(enr._id)}
                        style={{
                          background: 'var(--bg-surface)',
                          borderRadius: 10,
                          padding: 10,
                          border: '1px solid var(--border-color)',
                          cursor: 'grab',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{enr.studentName}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                          {enr.enrollmentCode} • {enr.courseTitle}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                          <StatusBadge status={enr.approvalStatus} />
                          <div style={{ display: 'flex', gap: 4 }}>
                            {stageIdx > 0 && (
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                style={{ padding: '2px 6px' }}
                                title={`Move back to ${KANBAN_STAGES[stageIdx - 1].label}`}
                                onClick={() => handleMoveKanbanStage(enr._id, KANBAN_STAGES[stageIdx - 1].key)}
                              >
                                <ChevronLeft size={12} />
                              </button>
                            )}
                            {stageIdx < KANBAN_STAGES.length - 1 && (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                style={{ padding: '2px 6px' }}
                                title={`Advance to ${KANBAN_STAGES[stageIdx + 1].label}`}
                                onClick={() => handleMoveKanbanStage(enr._id, KANBAN_STAGES[stageIdx + 1].key)}
                              >
                                <ChevronRight size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">My Batches</h3>
            <Link to="/batches" className="btn btn-outline btn-sm">Manage Batches</Link>
          </div>
          <div className="table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Course</th>
                  <th>Students</th>
                  <th>Progress</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {myBatches.map((b) => (
                  <tr key={b._id}>
                    <td style={{ fontWeight: 700 }}>{b.batchCode}</td>
                    <td>{b.courseTitle}</td>
                    <td>{b.students}</td>
                    <td style={{ minWidth: 160 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="progress-track">
                          <div className="progress-fill" style={{ width: `${b.progress}%` }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{b.progress}%</span>
                      </div>
                    </td>
                    <td>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/batches')}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Modal
          open={sessionModalOpen}
          onClose={() => setSessionModalOpen(false)}
          title="Schedule Enrollment Session"
          maxWidth={520}
        >
          <form onSubmit={handleCreateSession} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-field">
              <label className="form-label">Session Title *</label>
              <input
                className="form-input"
                required
                placeholder="e.g., Full Stack Cohort Counseling Session"
                value={sessionForm.title}
                onChange={(e) => setSessionForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="grid-2">
              <div className="form-field">
                <label className="form-label">Course *</label>
                <select
                  className="form-select"
                  required
                  value={sessionForm.courseId}
                  onChange={(e) => setSessionForm((f) => ({ ...f, courseId: e.target.value }))}
                >
                  <option value="">Select Course</option>
                  {courses.map((c) => (
                    <option key={c._id} value={c._id}>{c.title}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">Batch (Optional)</label>
                <select
                  className="form-select"
                  value={sessionForm.batchId}
                  onChange={(e) => setSessionForm((f) => ({ ...f, batchId: e.target.value }))}
                >
                  <option value="">All Batches</option>
                  {batches.map((b) => (
                    <option key={b._id} value={b._id}>{b.batchCode}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid-3">
              <div className="form-field">
                <label className="form-label">Date *</label>
                <input
                  type="date"
                  className="form-input"
                  required
                  value={sessionForm.scheduledDate}
                  onChange={(e) => setSessionForm((f) => ({ ...f, scheduledDate: e.target.value }))}
                />
              </div>
              <div className="form-field">
                <label className="form-label">Time Slot *</label>
                <input
                  className="form-input"
                  required
                  value={sessionForm.timeSlot}
                  onChange={(e) => setSessionForm((f) => ({ ...f, timeSlot: e.target.value }))}
                />
              </div>
              <div className="form-field">
                <label className="form-label">Mode</label>
                <select
                  className="form-select"
                  value={sessionForm.mode}
                  onChange={(e) => setSessionForm((f) => ({ ...f, mode: e.target.value }))}
                >
                  <option value="ONLINE">ONLINE</option>
                  <option value="OFFLINE">OFFLINE</option>
                  <option value="HYBRID">HYBRID</option>
                </select>
              </div>
            </div>
            <div className="form-field">
              <label className="form-label">Session Notes</label>
              <textarea
                className="form-textarea"
                rows={2}
                value={sessionForm.notes}
                onChange={(e) => setSessionForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn btn-outline" onClick={() => setSessionModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Create Session</button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  if (role === 'MENTOR') {
    const { kpis, todaysSchedule, pendingEvaluations } = data;
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Mentor Dashboard</h1>
            <p className="page-subtitle">Teach, evaluate and track student progress</p>
          </div>
        </div>

        <div className="kpi-grid">
          <StatCard label="Assigned Batches" value={kpis.assignedBatches} icon={Layers} iconBg="rgba(95,78,246,0.12)" iconColor="#5F4EF6" />
          <StatCard label="Students" value={kpis.students} icon={GraduationCap} iconBg="rgba(45,70,185,0.13)" iconColor="#2D46B9" />
          <StatCard label="Assignments" value={kpis.assignments} icon={FileText} iconBg="rgba(65,54,182,0.12)" iconColor="#4136B6" />
          <StatCard label="Submission Rate" value={`${kpis.submissionRate}%`} icon={CheckCircle2} iconBg="rgba(105,76,246,0.14)" iconColor="#694CF6" />
        </div>

        <div className="grid-2">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Today&apos;s Schedule</h3>
            </div>
            {todaysSchedule.length === 0 ? (
              <EmptyState icon={Clock} title="No sessions scheduled for today" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {todaysSchedule.map((s, idx) => (
                  <div key={s._id || idx} className="stepper-item" style={{ justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span className="badge badge-primary" style={{ fontWeight: 700 }}>
                        {s.startTime}
                      </span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{s.batchCode} — {s.topic}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.startTime} – {s.endTime}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Pending Evaluations</h3>
              <Link to="/assignments" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-secondary)' }}>
                Evaluate All
              </Link>
            </div>
            {pendingEvaluations.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="All submissions evaluated" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pendingEvaluations.map((p) => (
                  <div key={p._id} className="stepper-item" style={{ justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>{p.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {p.batchCode} • {p.pendingCount} Submissions
                      </div>
                    </div>
                    <Link to="/assignments" className="btn btn-primary btn-sm">
                      Grade ({p.pendingCount})
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (role === 'STUDENT') {
    const { kpis, myCourses, upcomingEvent } = data;

    const handleRegisterEvent = async () => {
      if (!upcomingEvent) return;
      try {
        await api.post(`/events/${upcomingEvent._id}/register`);
        dispatch(pushToast({ type: 'success', title: 'Registered', message: `Registered for ${upcomingEvent.title}` }));
        loadDashboard();
      } catch (err) {
        dispatch(pushToast({ type: 'info', title: 'Event Registration', message: err.response?.data?.message || 'Already registered' }));
      }
    };

    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">My Learning</h1>
            <p className="page-subtitle">Track your courses, progress and opportunities</p>
          </div>
        </div>

        <div className="kpi-grid">
          <StatCard label="Enrolled Courses" value={kpis.enrolledCourses} icon={BookOpen} iconBg="rgba(95,78,246,0.12)" iconColor="#5F4EF6" />
          <StatCard label="Avg Progress" value={`${kpis.avgProgress}%`} icon={BarChart3} iconBg="rgba(45,70,185,0.13)" iconColor="#2D46B9" />
          <StatCard label="Attendance" value={`${kpis.attendanceRate}%`} icon={CheckCircle2} iconBg="rgba(65,54,182,0.12)" iconColor="#4136B6" />
          <StatCard label="Certificates" value={kpis.certificates} icon={Award} iconBg="rgba(105,76,246,0.14)" iconColor="#694CF6" />
        </div>

        <div className="grid-3-1">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">My Courses</h3>
              <Link to="/courses" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-secondary)' }}>Browse Courses</Link>
            </div>
            {myCourses.length === 0 ? (
              <EmptyState icon={BookOpen} title="No enrolled courses yet" action={<Link to="/courses" className="btn btn-primary btn-sm">Explore Courses</Link>} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {myCourses.map((c) => (
                  <div key={c._id} className="stepper-item" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 200 }}>
                      <div className="kpi-icon-box" style={{ background: 'linear-gradient(135deg,#0B1F3B,#4F46E5)', color: '#fff', width: 42, height: 42 }}>
                        <BookOpen size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{c.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Batch: {c.batchCode}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 180, flex: 1, maxWidth: 260 }}>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${c.progressPercent}%` }} />
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 12.5 }}>{c.progressPercent}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="event-hero-banner" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            {upcomingEvent ? (
              <>
                <div>
                  <span className="badge badge-primary" style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', marginBottom: 12 }}>
                    Upcoming Event
                  </span>
                  <h3 style={{ margin: '0 0 6px', fontSize: 21, fontWeight: 800 }}>{upcomingEvent.title}</h3>
                  <p style={{ margin: '0 0 12px', fontSize: 12.5, opacity: 0.85 }}>{upcomingEvent.subtitle || upcomingEvent.category}</p>
                  <div style={{ fontSize: 12, opacity: 0.9 }}>
                    {formatDate(upcomingEvent.startDate)} • {upcomingEvent.venue}
                  </div>
                </div>
                <button type="button" className="btn" style={{ marginTop: 18, background: '#fff', color: '#0B1F3B' }} onClick={handleRegisterEvent}>
                  Register Now <ArrowRight size={15} />
                </button>
              </>
            ) : (
              <div>
                <h3 style={{ margin: 0 }}>Events & Hackathons</h3>
                <p style={{ fontSize: 13, opacity: 0.85 }}>Check the Events tab for upcoming CraffixWeb competitions.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // GUEST dashboard matching Image 2's exact Event Dashboard
  const { event, registration, steps } = data;
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Event Dashboard</h1>
          <p className="page-subtitle">Your registered event and participation</p>
        </div>
        {registration?.access?.expiresAt && (
          <span className="badge badge-warning">
            <Clock size={13} /> Access expires {formatDate(registration.access.expiresAt)}
          </span>
        )}
      </div>

      {!event ? (
        <EmptyState icon={AlertCircle} title="No active event assignment found" />
      ) : (
        <>
          <div className="event-hero-banner">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span className="badge badge-success">Event Active</span>
                  <span style={{ fontSize: 12, opacity: 0.85 }}>{event.category}</span>
                </div>
                <h2 style={{ margin: '0 0 6px', fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em' }}>
                  {event.title}
                </h2>
                <p style={{ margin: '0 0 14px', fontSize: 14, opacity: 0.9 }}>
                  {event.subtitle || event.description}
                </p>
                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 13, opacity: 0.92 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CalendarDays size={15} /> {formatDate(event.startDate)} – {formatDate(event.endDate)}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MapPin size={15} /> {event.venue}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(34,184,207,0.45), rgba(108,99,255,0.2))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(255,255,255,0.22)',
                  }}
                >
                  <Lightbulb size={32} color="#67E8F9" />
                </div>
                <Link to="/competitions" className="btn" style={{ background: '#ffffff', color: '#0B1F3B' }}>
                  <Upload size={15} /> Manage Submission
                </Link>
              </div>
            </div>
          </div>

          <div className="stepper-row">
            <div className="stepper-item">
              <CheckCircle2 size={20} color="#5F4EF6" />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Registration</div>
                <div style={{ fontSize: 11.5, color: '#4136B6', fontWeight: 600 }}>{steps.registration}</div>
              </div>
            </div>
            <div className="stepper-item">
              <Users size={20} color={steps.team === 'FORMED' ? '#5F4EF6' : '#8E9AC4'} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Team</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>{steps.team}</div>
              </div>
            </div>
            <div className="stepper-item">
              <Upload size={20} color={steps.submission === 'SUBMITTED' ? '#5F4EF6' : '#694CF6'} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Submission</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>{steps.submission}</div>
              </div>
            </div>
            <div className="stepper-item">
              <Clock size={20} color={steps.evaluation === 'COMPLETED' ? '#5F4EF6' : '#8E9AC4'} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Evaluation</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>{steps.evaluation}</div>
              </div>
            </div>
            <div className="stepper-item">
              <Trophy size={20} color={steps.results === 'PUBLISHED' ? '#5F4EF6' : '#8E9AC4'} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Results</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>{steps.results}</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
