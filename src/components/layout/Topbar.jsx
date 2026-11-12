import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, LogOut, Menu, Settings, User as UserIcon, ChevronRight } from 'lucide-react';
import api from '../../services/api';
import { clearSession } from '../../app/authSlice';
import { setMobileMenuOpen } from '../../app/uiSlice';
import { setNotificationsState } from '../../app/realtimeSlice';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { disconnectSocket } from '../../services/socket';
import { getInitials } from '../../utils/format';

const ROUTE_TITLES = {
  '/dashboard': 'Dashboard',
  '/organization': 'Organization',
  '/users': 'Users & Roles',
  '/employees': 'Employees',
  '/hrms': 'HRMS & Attendance',
  '/leaves': 'Leave Management',
  '/students': 'Students',
  '/courses': 'Courses',
  '/batches': 'Batches',
  '/enrollments': 'Enrolments',
  '/mentors': 'Mentors',
  '/assignments': 'Assignments',
  '/attendance': 'Attendance',
  '/finance': 'Finance',
  '/events': 'Events',
  '/competitions': 'Competitions',
  '/idea-pitching': 'Idea Pitching',
  '/idea-pitches': 'Idea Pitches Review',
  '/projects': 'Projects',
  '/tasks': 'Tasks',
  '/certificates': 'Certificates',
  '/reports': 'Reports',
  '/notifications': 'Notifications',
  '/profile': 'My Profile',
  '/settings': 'System Settings',
  '/help': 'Help & Support',
  '/privacy-policy': 'Privacy Policy',
};

export function Topbar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, refreshToken } = useSelector((state) => state.auth);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('/notifications');
      dispatch(setNotificationsState(res.data.data));
    } catch {
      // Ignore silent poll errors
    }
  }, [dispatch]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useRealtimeSync(fetchNotifications, ['notifications', 'leaves', 'ideas', 'enrollments', 'support']);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return undefined;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/reports/search?q=${encodeURIComponent(searchQuery.trim())}`);
        setSearchResults(res.data.data);
      } catch {
        setSearchResults(null);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout', { refreshToken });
    } catch {
      // ignore
    }
    disconnectSocket();
    dispatch(clearSession());
    navigate('/login');
  };

  const currentTitle = ROUTE_TITLES[location.pathname] || 'Workspace';

  return (
    <header className="erp-topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
        <button
          type="button"
          className="icon-btn"
          onClick={() => dispatch(setMobileMenuOpen(true))}
          aria-label="Open menu"
          style={{ display: window.innerWidth <= 820 ? 'inline-flex' : 'none' }}
        >
          <Menu size={18} />
        </button>

        <nav className="topbar-breadcrumb" aria-label="Breadcrumb">
          <span>CraffixHub</span>
          <ChevronRight size={14} />
          <span className="topbar-breadcrumb-current">{currentTitle}</span>
        </nav>

        <div className="topbar-search-wrap">
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            className="topbar-search-input"
            placeholder="Search courses, students, events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onBlur={() => setTimeout(() => setSearchResults(null), 200)}
          />
          {searchResults && (
            <div className="popover-menu" style={{ left: 0, right: 'auto', width: '100%', padding: 10 }}>
              {['courses', 'events', 'students'].every((k) => !searchResults[k]?.length) ? (
                <div style={{ padding: 10, color: 'var(--text-muted)', fontSize: 12.5 }}>No matching records</div>
              ) : (
                <>
                  {searchResults.courses?.map((c) => (
                    <div
                      key={c._id}
                      onMouseDown={() => navigate('/courses')}
                      style={{ padding: '7px 10px', cursor: 'pointer', borderRadius: 8 }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{c.title}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Course • {c.courseCode}</div>
                    </div>
                  ))}
                  {searchResults.events?.map((ev) => (
                    <div
                      key={ev._id}
                      onMouseDown={() => navigate('/events')}
                      style={{ padding: '7px 10px', cursor: 'pointer', borderRadius: 8 }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{ev.title}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Event • {ev.category}</div>
                    </div>
                  ))}
                  {searchResults.students?.map((st) => (
                    <div
                      key={st._id}
                      onMouseDown={() => navigate('/students')}
                      style={{ padding: '7px 10px', cursor: 'pointer', borderRadius: 8 }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{st.userId?.fullName}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Student • {st.studentId}</div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="topbar-actions">
        <div style={{ position: 'relative' }}>
          <div
            className="profile-chip"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
          >
            <div className="avatar-circle" style={{ overflow: 'hidden' }}>
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user?.fullName || 'Avatar'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                getInitials(user?.fullName)
              )}
            </div>
            <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
              <div style={{ fontWeight: 700, fontSize: 12.5 }}>{user?.fullName}</div>
            </div>
          </div>

          {showProfileMenu && (
            <div className="popover-menu" style={{ width: 220, padding: 8 }}>
              <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-color)', marginBottom: 6 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{user?.fullName}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{user?.email}</div>
              </div>
              <button
                type="button"
                className="erp-nav-item"
                style={{ color: 'var(--text-primary)' }}
                onClick={() => {
                  navigate('/profile');
                  setShowProfileMenu(false);
                }}
              >
                <UserIcon size={15} /> My Profile
              </button>
              {user?.primaryRole === 'SUPER_ADMIN' && (
                <button
                  type="button"
                  className="erp-nav-item"
                  style={{ color: 'var(--text-primary)' }}
                  onClick={() => {
                    navigate('/settings');
                    setShowProfileMenu(false);
                  }}
                >
                  <Settings size={15} /> System Settings
                </button>
              )}
              <button
                type="button"
                className="erp-nav-item"
                style={{ color: 'var(--text-primary)' }}
                onClick={() => {
                  navigate('/dashboard');
                  setShowProfileMenu(false);
                }}
              >
                <UserIcon size={15} /> My Dashboard
              </button>
              <button
                type="button"
                className="erp-nav-item"
                style={{ color: 'var(--color-danger)' }}
                onClick={handleLogout}
              >
                <LogOut size={15} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
