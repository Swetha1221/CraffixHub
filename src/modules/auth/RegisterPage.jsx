import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { setSession } from '../../app/authSlice';
import { pushToast } from '../../app/uiSlice';
import { CraffixLogo } from '../../components/common/CraffixLogo';

export function RegisterPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    college: '',
    department: '',
    academicYear: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/register', form);
      dispatch(setSession(res.data.data));
      dispatch(pushToast({ type: 'success', title: 'Account Created', message: 'Welcome to CraffixHub Academy!' }));
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 920 }}>
        <div className="auth-hero">
          <div className="auth-hero-inner">
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'center' }}>
              <CraffixLogo variant="dark" size={32} showWordmark wordmarkText="Craffixweb" />
            </div>
            <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 800 }}>Join CraffixHub</h1>
            <p style={{ margin: 0, fontSize: 13.5, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>
              Create your unified Student account to enrol in courses, submit assignments, track attendance, and earn verified certificates.
            </p>
          </div>
        </div>

        <div className="auth-form-panel">
          <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800 }}>Student Registration</h2>
          <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--text-muted)' }}>
            Register for your CraffixWeb Academy portal
          </p>

          {error && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                background: 'var(--color-danger-soft)',
                color: 'var(--color-danger)',
                fontSize: 13,
                marginBottom: 14,
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="form-grid">
            <div className="form-field full">
              <label className="form-label">Full Name</label>
              <input
                className="form-input"
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label className="form-label">Phone Number</label>
              <input
                className="form-input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label className="form-label">College / Institution</label>
              <input
                className="form-input"
                value={form.college}
                onChange={(e) => setForm({ ...form, college: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label className="form-label">Department</label>
              <input
                className="form-input"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label className="form-label">Academic Year</label>
              <input
                className="form-input"
                placeholder="e.g. 3rd Year"
                value={form.academicYear}
                onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label className="form-label">Password (min 8 chars)</label>
              <input
                type="password"
                minLength={8}
                required
                className="form-input"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div className="form-field full" style={{ marginTop: 4 }}>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'Creating Account...' : 'Create Student Account'}
              </button>
            </div>
          </form>

          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13 }}>
            Already registered?{' '}
            <Link to="/login" style={{ color: 'var(--color-secondary)', fontWeight: 700 }}>
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
