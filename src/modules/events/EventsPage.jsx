import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { CalendarDays, MapPin, Users, Plus, Globe } from 'lucide-react';
import api from '../../services/api';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { pushToast } from '../../app/uiSlice';
import { Modal } from '../../components/common/Modal';
import { StatusBadge } from '../../components/common/UI';
import { formatDate } from '../../utils/format';

export function EventsPage() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const canManage = ['ADMIN', 'COORDINATOR'].includes(user?.primaryRole);

  const [events, setEvents] = useState([]);
  const [filterTab, setFilterTab] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [regsModal, setRegsModal] = useState({ event: null, items: [] });

  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    description: '',
    categorySelect: 'OTHER',
    customCategory: '',
    startDate: '',
    endDate: '',
    registrationDeadline: '',
    venue: '',
    mode: 'HYBRID',
    maxParticipants: '',
    maxTeamSize: '',
    eventStatus: 'REGISTRATION_OPEN',
  });
  const existingEventCategories = Array.from(new Set(events.map((ev) => ev.category).filter(Boolean)));

  const loadData = useCallback(async () => {
    const res = await api.get('/events');
    setEvents(res.data.data || []);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRealtimeSync(loadData, ['events']);

  const filteredEvents = events.filter((ev) => {
    if (filterTab === 'UPCOMING') return ['PUBLISHED', 'REGISTRATION_OPEN', 'DRAFT'].includes(ev.eventStatus);
    if (filterTab === 'ONGOING') return ['ONGOING', 'EVALUATION'].includes(ev.eventStatus);
    if (filterTab === 'COMPLETED') return ['COMPLETED', 'RESULTS_PUBLISHED'].includes(ev.eventStatus);
    return true;
  });

  const handleCreate = async (e) => {
    e.preventDefault();
    const resolvedCategory =
      form.categorySelect === 'OTHER' ? form.customCategory.trim() : form.categorySelect;
    if (!resolvedCategory) {
      dispatch(pushToast({ type: 'error', title: 'Validation', message: 'Please type a custom event category' }));
      return;
    }
    try {
      await api.post('/events', {
        title: form.title,
        subtitle: form.subtitle,
        description: form.description,
        category: resolvedCategory,
        startDate: form.startDate,
        endDate: form.endDate,
        registrationDeadline: form.registrationDeadline,
        venue: form.venue,
        mode: form.mode,
        maxParticipants: Number(form.maxParticipants),
        maxTeamSize: Number(form.maxTeamSize),
        eventStatus: form.eventStatus,
      });
      dispatch(pushToast({ type: 'success', title: 'Event Created', message: form.title }));
      setModalOpen(false);
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed' }));
    }
  };

  const handleRegister = async (eventId) => {
    try {
      await api.post(`/events/${eventId}/register`);
      dispatch(pushToast({ type: 'success', title: 'Registered', message: 'Event registration confirmed' }));
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'info', title: 'Event', message: err.response?.data?.message || 'Already registered' }));
    }
  };

  const handlePublish = async (eventId) => {
    await api.post(`/events/${eventId}/publish`, { status: 'REGISTRATION_OPEN' });
    dispatch(pushToast({ type: 'success', title: 'Published', message: 'Event is now open for registration' }));
    loadData();
  };

  const viewRegistrations = async (ev) => {
    const res = await api.get(`/events/${ev._id}/registrations`);
    setRegsModal({ event: ev, items: res.data.data || [] });
  };

  const revokeGuest = async (regId) => {
    await api.post(`/admin/event-registrations/${regId}/revoke-access`);
    dispatch(pushToast({ type: 'info', title: 'Access Revoked', message: 'Guest access revoked cleanly' }));
    if (regsModal.event) viewRegistrations(regsModal.event);
  };

  return (
    <div>
      {/* Exact header + tabs matching Image 1's Events & Competitions panel */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Events & Competitions</h1>
          <p className="page-subtitle">Hackathons, monthly tech competitions, workshops & guest access</p>
        </div>
        {canManage && (
          <button type="button" className="btn btn-primary" onClick={() => setModalOpen(true)}>
            <Plus size={15} /> Create Event
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {[
          ['ALL', 'All Events'],
          ['UPCOMING', 'Upcoming'],
          ['ONGOING', 'Ongoing'],
          ['COMPLETED', 'Completed'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`btn btn-sm ${filterTab === key ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilterTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid-3">
        {filteredEvents.map((ev) => (
          <div key={ev._id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14 }}>
            <div>
              <div
                style={{
                  height: 84,
                  borderRadius: 12,
                  background: 'linear-gradient(125deg, #061D46 0%, #162576 55%, #5F4EF6 100%)',
                  padding: 14,
                  color: '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  marginBottom: 14,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.9 }}>{ev.eventCode}</span>
                  <StatusBadge status={ev.eventStatus} />
                </div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{ev.title}</div>
              </div>

              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-secondary)', marginBottom: 6 }}>
                {ev.category}
              </div>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
                {ev.subtitle || ev.description}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, color: 'var(--text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CalendarDays size={14} /> {formatDate(ev.startDate)} – {formatDate(ev.endDate)}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MapPin size={14} /> {ev.venue} ({ev.mode})
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Users size={14} /> {ev.participantCount || 0} / {ev.maxParticipants} Participants
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
              {canManage ? (
                <>
                  {ev.eventStatus === 'DRAFT' && (
                    <button type="button" className="btn btn-success btn-sm" onClick={() => handlePublish(ev._id)}>
                      <Globe size={14} /> Publish
                    </button>
                  )}
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => viewRegistrations(ev)}>
                    Registrations ({ev.participantCount || 0})
                  </button>
                </>
              ) : ev.myRegistration ? (
                <span className="badge badge-success">Registered ({ev.myRegistration.registrationNumber})</span>
              ) : (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => handleRegister(ev._id)}>
                  Register Now
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Event">
        <form onSubmit={handleCreate} className="form-grid">
          <div className="form-field full">
            <label className="form-label">Event Title</label>
            <input className="form-input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Category</label>
            <select className="form-select" value={form.categorySelect} onChange={(e) => setForm({ ...form, categorySelect: e.target.value })}>
              {existingEventCategories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              <option value="OTHER">Other (Type Custom Category)</option>
            </select>
          </div>
          {form.categorySelect === 'OTHER' && (
            <div className="form-field">
              <label className="form-label">Custom Event Category</label>
              <input
                className="form-input"
                required
                placeholder="Type custom event category..."
                value={form.customCategory}
                onChange={(e) => setForm({ ...form, customCategory: e.target.value })}
              />
            </div>
          )}
          <div className="form-field">
            <label className="form-label">Mode</label>
            <select className="form-select" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
              <option value="HYBRID">Hybrid</option>
              <option value="ONLINE">Online</option>
              <option value="OFFLINE">Offline</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Start Date</label>
            <input type="date" className="form-input" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">End Date</label>
            <input type="date" className="form-input" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Registration Deadline</label>
            <input type="date" className="form-input" required value={form.registrationDeadline} onChange={(e) => setForm({ ...form, registrationDeadline: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Venue</label>
            <input className="form-input" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
          </div>
          <div className="form-field full">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="form-field full">
            <button type="submit" className="btn btn-primary">Create Event</button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(regsModal.event)}
        onClose={() => setRegsModal({ event: null, items: [] })}
        title={`Registrations — ${regsModal.event?.title || ''}`}
        maxWidth={720}
      >
        <div className="table-wrap">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Reg #</th>
                <th>Participant</th>
                <th>Type</th>
                <th>College</th>
                <th>Access Expires</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {regsModal.items.map((r) => (
                <tr key={r._id}>
                  <td style={{ fontWeight: 700 }}>{r.registrationNumber}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.userId?.fullName}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{r.userId?.email}</div>
                  </td>
                  <td><StatusBadge status={r.participantType} /></td>
                  <td>{r.college || '—'}</td>
                  <td>{r.access?.revokedAt ? <span className="badge badge-danger">Revoked</span> : formatDate(r.access?.expiresAt)}</td>
                  <td>
                    {r.participantType === 'GUEST' && !r.access?.revokedAt && (
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => revokeGuest(r._id)}>
                        Revoke Access
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
}
