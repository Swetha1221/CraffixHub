import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { CraffixLogo } from '../../components/common/CraffixLogo';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setSent(true);
      if (res.data?.data?.devResetToken) {
        setDevToken(res.data.data.devResetToken);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="card" style={{ maxWidth: 440, width: '100%', padding: 32 }}>
        <div style={{ marginBottom: 18 }}>
          <CraffixLogo variant="light" size={30} showWordmark />
        </div>
        <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800 }}>Forgot Password</h2>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--text-muted)' }}>
          Enter your registered email to receive password reset instructions.
        </p>
        {sent ? (
          <div style={{ padding: 14, borderRadius: 10, background: 'var(--color-accent-soft)', fontSize: 13 }}>
            If that account exists, a reset link has been generated.
            {devToken && (
              <div style={{ marginTop: 8 }}>
                <Link to={`/reset-password?token=${devToken}`} style={{ color: 'var(--color-secondary)', fontWeight: 700 }}>
                  Proceed to Reset Password →
                </Link>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-field">
              <label className="form-label">Email Address</label>
              <input type="email" required className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}
        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 13 }}>
          <Link to="/login" style={{ color: 'var(--color-secondary)', fontWeight: 600 }}>
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

export function ResetPasswordPage() {
  const params = new URLSearchParams(window.location.search);
  const [token, setToken] = useState(params.get('token') || '');
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to reset password');
    }
  };

  return (
    <div className="auth-page">
      <div className="card" style={{ maxWidth: 440, width: '100%', padding: 32 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 800 }}>Reset Password</h2>
        {error && <div style={{ color: 'var(--color-danger)', fontSize: 13, marginBottom: 10 }}>{error}</div>}
        {done ? (
          <div>
            <p style={{ color: '#059669', fontWeight: 600 }}>Password updated successfully!</p>
            <Link to="/login" className="btn btn-primary" style={{ width: '100%' }}>
              Sign In Now
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-field">
              <label className="form-label">Reset Token</label>
              <input className="form-input" required value={token} onChange={(e) => setToken(e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">New Password</label>
              <input type="password" minLength={8} required className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary">
              Update Password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
