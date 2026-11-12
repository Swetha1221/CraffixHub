import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { CalendarDays, MapPin, Users, ArrowLeft } from 'lucide-react';
import api from '../../services/api';
import { setSession } from '../../app/authSlice';
import { pushToast } from '../../app/uiSlice';
import { CraffixLogo } from '../../components/common/CraffixLogo';
import { StatusBadge } from '../../components/common/UI';
import { Modal } from '../../components/common/Modal';
import { formatDate } from '../../utils/format';

export function PublicEventsPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    college: '',
    department: '',
    academicYear: '',
    teamName: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/public/events').then((res) => setEvents(res.data.data || []));
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post(`/public/events/${selectedEvent._id}/register`, form);
      dispatch(setSession(res.data.data));
      dispatch(
        pushToast({
          type: 'success',
          title: 'Registration Confirmed',
          message: `Welcome to ${selectedEvent.title}! Temporary guest dashboard unlocked.`,
        })
      );
      navigate('/dashboard');
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Registration Error', message: err.response?.data?.message || 'Failed' }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)' }}>
      <header className="erp-topbar">
        <CraffixLogo variant="light" size={28} showWordmark />
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/verify" className="btn btn-outline btn-sm">Verify Certificate</Link>
          <Link to="/login" className="btn btn-primary btn-sm">
            <ArrowLeft size={14} /> Sign In
          </Link>
        </div>
      </header>

      <div className="erp-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">CraffixWeb Public Events & Competitions</h1>
            <p className="page-subtitle">Register as a Guest participant to join hackathons, workshops, and coding challenges</p>
          </div>
        </div>

        <div className="grid-3">
          {events.map((ev) => (
            <div key={ev._id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-secondary)' }}>{ev.category}</span>
                  <StatusBadge status={ev.eventStatus} />
                </div>
                <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800 }}>{ev.title}</h3>
                <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-secondary)' }}>{ev.description}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, color: 'var(--text-muted)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CalendarDays size={14} /> {formatDate(ev.startDate)} – {formatDate(ev.endDate)}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MapPin size={14} /> {ev.venue} ({ev.mode})
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Users size={14} /> Max Team Size: {ev.maxTeamSize}
                  </span>
                </div>
              </div>
              <button type="button" className="btn btn-primary" onClick={() => setSelectedEvent(ev)}>
                Register as Guest Participant
              </button>
            </div>
          ))}
        </div>
      </div>

      <Modal
        open={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(null)}
        title={`Register for ${selectedEvent?.title || ''}`}
      >
        <form onSubmit={handleRegister} className="form-grid">
          <div className="form-field full">
            <label className="form-label">Full Name</label>
            <input className="form-input" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Email</label>
            <input type="email" className="form-input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Phone</label>
            <input className="form-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">College / Institution</label>
            <input className="form-input" required value={form.college} onChange={(e) => setForm({ ...form, college: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Department</label>
            <input className="form-input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Team Name (Optional)</label>
            <input className="form-input" value={form.teamName} onChange={(e) => setForm({ ...form, teamName: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Temporary Guest Password</label>
            <input type="password" minLength={8} required className="form-input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="form-field full" style={{ marginTop: 8 }}>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Registering...' : 'Complete Guest Registration'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
