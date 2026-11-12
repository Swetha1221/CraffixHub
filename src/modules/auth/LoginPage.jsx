import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  ArrowRight,
  Shield,
  Settings,
  Layers,
  BookOpen,
  GraduationCap,
  Ticket,
  UserPlus,
  LogIn,
  KeyRound,
} from 'lucide-react';
import api from '../../services/api';
import { setSession } from '../../app/authSlice';
import { pushToast } from '../../app/uiSlice';
import { CraffixLogo } from '../../components/common/CraffixLogo';

const DEMO_GROUPS = [
  {
    group: 'Management & Faculty',
    roles: [
      { code: 'SUPER_ADMIN', label: 'Super Admin', desc: 'Executive governance', icon: Shield },
      { code: 'ADMIN', label: 'Admin', desc: 'Daily operations', icon: Settings },
      { code: 'COORDINATOR', label: 'Course Coordinator', desc: 'Courses & batches', icon: Layers },
      { code: 'MENTOR', label: 'Mentor', desc: 'Teaching & grading', icon: BookOpen },
    ],
  },
  {
    group: 'Learners & Event Access',
    roles: [
      { code: 'STUDENT', label: 'Student', desc: 'Courses & certificates', icon: GraduationCap },
      { code: 'GUEST', label: 'Guest', desc: 'Event participation', icon: Ticket },
    ],
  },
];

export function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [mode, setMode] = useState('signin'); // 'signin' | 'demo' | 'setup'
  const [needsSetup, setNeedsSetup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoLoadingRole, setDemoLoadingRole] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/auth/setup-status')
      .then((res) => setNeedsSetup(Boolean(res.data?.data?.needsSetup)))
      .catch(() => setNeedsSetup(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password, rememberMe });
      dispatch(setSession(res.data.data));
      dispatch(
        pushToast({
          type: 'success',
          title: 'Welcome back',
          message: `Signed in as ${res.data.data.user.fullName}`,
        })
      );
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to sign in. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoDemoLogin = async (roleCode, roleLabel) => {
    setError('');
    setDemoLoadingRole(roleCode);
    try {
      const res = await api.post('/auth/demo-login', { role: roleCode });
      dispatch(setSession(res.data.data));
      dispatch(
        pushToast({
          type: 'success',
          title: 'Auto Demo Login',
          message: `Signed in as ${res.data.data.user.fullName} (${roleLabel})`,
        })
      );
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Auto demo login failed');
    } finally {
      setDemoLoadingRole('');
    }
  };

  const handleInitialSetup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/setup-super-admin', {
        fullName,
        email,
        password,
        organizationName,
      });
      dispatch(setSession(res.data.data));
      dispatch(
        pushToast({
          type: 'success',
          title: 'System Initialized',
          message: `Super Admin ${res.data.data.user.fullName} created`,
        })
      );
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleClick = () => {
    dispatch(
      pushToast({
        type: 'info',
        title: 'Google SSO',
        message: 'Google OAuth sign-in is disabled in Local Browser Mode. Use Sign In or Auto Demo.',
      })
    );
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Left Purple-Blue Wave Hero matching uploaded template */}
        <div className="auth-hero">
          <svg
            viewBox="0 0 420 540"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="waveGradA" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#162576" stopOpacity="0.82" />
                <stop offset="100%" stopColor="#4136B6" stopOpacity="0.65" />
              </linearGradient>
              <linearGradient id="waveGradB" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" stopColor="#4136B6" stopOpacity="0.58" />
                <stop offset="100%" stopColor="#5F4EF6" stopOpacity="0.52" />
              </linearGradient>
            </defs>
            <path d="M0,30 C90,90 190,10 270,-10 L0,-10 Z" fill="#162576" opacity="0.6" />
            <path d="M0,360 C110,270 250,435 420,310 L420,540 L0,540 Z" fill="url(#waveGradA)" />
            <path d="M0,425 C150,335 280,485 420,375 L420,540 L0,540 Z" fill="url(#waveGradB)" />
            <path d="M90,540 C190,440 310,490 420,425 L420,540 Z" fill="#694CF6" opacity="0.34" />
          </svg>

          <div className="auth-hero-inner">
            <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'center' }}>
              <CraffixLogo variant="dark" size={28} showWordmark wordmarkText="Craffixweb" />
            </div>
            <h1 style={{ margin: '0 0 10px', fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em' }}>
              <span style={{ color: '#FFFFFF' }}>Craffix</span>
              <span
                style={{
                  background: 'linear-gradient(90deg, #694CF6 0%, #8B5CF6 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Hub
              </span>
            </h1>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'rgba(226, 232, 248, 0.85)',
                marginBottom: 24,
              }}
            >
              Internal Business Operating System
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 13.5,
                fontWeight: 500,
                lineHeight: 1.6,
                color: 'rgba(255, 255, 255, 0.9)',
                maxWidth: 300,
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            >
              Powering People, Managing Progress &amp; Building Innovation.
            </p>
          </div>
        </div>

        {/* Right Clean White Auth Panel — Self-contained Sign In / Auto Demo Login */}
        <div className="auth-form-panel">
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800, color: '#0A1438' }}>
              {mode === 'setup' ? 'Initial System Setup' : 'Welcome Back'}
            </h2>
            <p style={{ margin: 0, fontSize: 12.5, color: '#6A759B' }}>
              {mode === 'setup'
                ? 'Create your custom Super Admin account'
                : 'Sign in to access CraffixHub'}
            </p>
          </div>

          {/* Segmented Mode Switcher inside Login Card */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: needsSetup ? '1fr 1fr 1fr' : '1fr 1fr',
              gap: 4,
              padding: 4,
              borderRadius: 11,
              background: '#F2F4FC',
              border: '1px solid #DFE4F6',
              marginBottom: 18,
              position: 'relative',
              zIndex: 1,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError('');
              }}
              style={{
                height: 32,
                borderRadius: 8,
                border: 'none',
                background: mode === 'signin' ? '#FFFFFF' : 'transparent',
                color: mode === 'signin' ? '#5F4EF6' : '#6A759B',
                fontWeight: 700,
                fontSize: 12,
                boxShadow: mode === 'signin' ? '0 2px 6px rgba(9,26,70,0.08)' : 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}
            >
              <LogIn size={13} /> Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('demo');
                setError('');
              }}
              style={{
                height: 32,
                borderRadius: 8,
                border: 'none',
                background: mode === 'demo' ? '#FFFFFF' : 'transparent',
                color: mode === 'demo' ? '#5F4EF6' : '#6A759B',
                fontWeight: 700,
                fontSize: 12,
                boxShadow: mode === 'demo' ? '0 2px 6px rgba(9,26,70,0.08)' : 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}
            >
              <KeyRound size={13} /> Auto Demo
            </button>
            {needsSetup && (
              <button
                type="button"
                onClick={() => {
                  setMode('setup');
                  setError('');
                }}
                style={{
                  height: 32,
                  borderRadius: 8,
                  border: 'none',
                  background: mode === 'setup' ? '#FFFFFF' : 'transparent',
                  color: mode === 'setup' ? '#5F4EF6' : '#6A759B',
                  fontWeight: 700,
                  fontSize: 12,
                  boxShadow: mode === 'setup' ? '0 2px 6px rgba(9,26,70,0.08)' : 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                }}
              >
                <UserPlus size={13} /> Setup
              </button>
            )}
          </div>

          {error && (
            <div
              style={{
                padding: '9px 12px',
                borderRadius: 10,
                background: 'var(--color-danger-soft)',
                color: 'var(--color-danger)',
                fontSize: 12.5,
                fontWeight: 600,
                marginBottom: 14,
              }}
            >
              {error}
            </div>
          )}

          {mode === 'signin' && (
            <div style={{ position: 'relative', zIndex: 1 }}>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-field">
                  <label className="form-label" htmlFor="login-email" style={{ color: '#0A1438' }}>
                    Email address
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    required
                    className="form-input"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="login-password" style={{ color: '#0A1438' }}>
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      className="form-input"
                      style={{ paddingRight: 40 }}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: '#6A759B',
                        cursor: 'pointer',
                      }}
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', color: '#434E73', fontWeight: 500 }}>
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    Remember me
                  </label>
                  <Link to="/forgot-password" style={{ color: '#5F4EF6', fontWeight: 600 }}>
                    Forgot password?
                  </Link>
                </div>

                <button
                  type="submit"
                  className="btn"
                  style={{
                    width: '100%',
                    height: 42,
                    fontSize: 14,
                    background: 'linear-gradient(90deg, #5F4EF6 0%, #694CF6 100%)',
                    color: '#FFFFFF',
                    boxShadow: '0 6px 18px rgba(95, 78, 246, 0.3)',
                  }}
                  disabled={loading}
                >
                  {loading ? 'Signing In...' : 'Sign In'}
                </button>
              </form>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  margin: '14px 0',
                  color: '#8E9AC4',
                  fontSize: 12,
                }}
              >
                <div style={{ flex: 1, height: 1, background: '#DFE4F6' }} />
                <span>or</span>
                <div style={{ flex: 1, height: 1, background: '#DFE4F6' }} />
              </div>

              <button
                type="button"
                className="btn btn-outline"
                style={{ width: '100%', height: 40, borderColor: '#DFE4F6', color: '#0A1438', background: '#FFFFFF' }}
                onClick={handleGoogleClick}
              >
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.9-5.4 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.8 9.1-9.2 0-.6-.1-1.1-.2-1.6H12z" />
                </svg>
                Continue with Google
              </button>

              <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12.5, color: '#434E73' }}>
                New here?{' '}
                <Link to="/register" style={{ color: '#5F4EF6', fontWeight: 700 }}>
                  Register as Student
                </Link>
              </div>
            </div>
          )}

          {mode === 'demo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'relative', zIndex: 1 }}>
              {DEMO_GROUPS.map((grp) => (
                <div key={grp.group}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#6A759B',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: 8,
                    }}
                  >
                    {grp.group}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {grp.roles.map((r) => {
                      const Icon = r.icon;
                      const isBusy = demoLoadingRole === r.code;
                      return (
                        <button
                          key={r.code}
                          type="button"
                          disabled={Boolean(demoLoadingRole)}
                          onClick={() => handleAutoDemoLogin(r.code, r.label)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '10px 11px',
                            borderRadius: 11,
                            border: `1px solid ${isBusy ? '#5F4EF6' : '#DFE4F6'}`,
                            background: isBusy ? 'rgba(95,78,246,0.08)' : '#F6F7FE',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 8,
                              background: 'rgba(95,78,246,0.12)',
                              color: '#5F4EF6',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Icon size={15} />
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 12.5, color: '#0A1438' }}>
                              {isBusy ? 'Signing in...' : r.label}
                            </div>
                            <div style={{ fontSize: 11, color: '#6A759B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {r.desc}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: 10,
                  borderTop: '1px solid #DFE4F6',
                  fontSize: 12,
                  color: '#434E73',
                }}
              >
                <Link to="/public/events" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                  Public Events <ArrowRight size={12} />
                </Link>
                <Link to="/verify" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                  Verify Certificate <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          )}

          {mode === 'setup' && needsSetup && (
            <form onSubmit={handleInitialSetup} style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', zIndex: 1 }}>
              <div className="form-field">
                <label className="form-label" style={{ color: '#0A1438' }}>Organization Name</label>
                <input
                  className="form-input"
                  required
                  placeholder="Enter organization name"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label className="form-label" style={{ color: '#0A1438' }}>Super Admin Full Name</label>
                <input
                  className="form-input"
                  required
                  placeholder="Enter full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label className="form-label" style={{ color: '#0A1438' }}>Email address</label>
                <input
                  type="email"
                  className="form-input"
                  required
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label className="form-label" style={{ color: '#0A1438' }}>Password</label>
                <input
                  type="password"
                  minLength={8}
                  className="form-input"
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="btn"
                style={{
                  width: '100%',
                  height: 42,
                  fontSize: 14,
                  background: 'linear-gradient(90deg, #5F4EF6 0%, #694CF6 100%)',
                  color: '#FFFFFF',
                  marginTop: 4,
                }}
                disabled={loading}
              >
                {loading ? 'Creating Super Admin...' : 'Initialize CraffixHub'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
