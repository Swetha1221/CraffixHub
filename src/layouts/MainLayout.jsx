import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { Topbar } from '../components/layout/Topbar';
import { SuperAdminSlideDrawer } from '../components/layout/SuperAdminSlideDrawer';
import { connectSocket, disconnectSocket } from '../services/socket';
import { setMobileMenuOpen } from '../app/uiSlice';

export function MainLayout() {
  const dispatch = useDispatch();
  const accessToken = useSelector((state) => state.auth.accessToken);
  const { sidebarCollapsed, mobileMenuOpen } = useSelector((state) => state.ui);

  useEffect(() => {
    if (accessToken) {
      connectSocket(accessToken);
    }
    return () => {
      disconnectSocket();
    };
  }, [accessToken]);

  return (
    <div className="erp-shell">
      {mobileMenuOpen && (
        <div
          onClick={() => dispatch(setMobileMenuOpen(false))}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 35,
          }}
        />
      )}
      <Sidebar />
      <div className={`erp-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Topbar />
        <main className="erp-content">
          <Outlet />
        </main>
      </div>
      <SuperAdminSlideDrawer />
    </div>
  );
}
