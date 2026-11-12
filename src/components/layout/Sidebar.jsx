import React from 'react';
import { useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  LayoutDashboard,
  ShieldCheck,
  HelpCircle,
  Settings,
  Menu,
} from 'lucide-react';
import { CraffixLogo } from '../common/CraffixLogo';
import { toggleSidebar, setMobileMenuOpen, openSuperAdminDrawer } from '../../app/uiSlice';
import { NAV_BY_ROLE, SUPER_ADMIN_SUPPORT_GROUP, SUPER_ADMIN_SETTINGS_GROUP } from './superAdminNav';

export function Sidebar() {
  const dispatch = useDispatch();
  const location = useLocation();
  const user = useSelector((state) => state.auth.user);
  const { sidebarCollapsed, mobileMenuOpen, superAdminDrawer } = useSelector((state) => state.ui);
  const { unreadNotifications, pendingPitchesCount } = useSelector((state) => state.realtime);

  const role = user?.primaryRole || 'STUDENT';
  const groups = NAV_BY_ROLE[role] || NAV_BY_ROLE.STUDENT;
  const counts = { unreadNotifications, pendingPitchesCount };

  const handleOpenPillar = (grp) => {
    dispatch(openSuperAdminDrawer({ group: grp.group, itemPath: grp.items[0].to }));
    dispatch(setMobileMenuOpen(false));
  };

  const handleOpenSupport = (itemPath) => {
    dispatch(openSuperAdminDrawer({ group: SUPER_ADMIN_SUPPORT_GROUP.group, itemPath }));
    dispatch(setMobileMenuOpen(false));
  };

  const handleOpenSettings = () => {
    dispatch(openSuperAdminDrawer({ group: SUPER_ADMIN_SETTINGS_GROUP.group, itemPath: '/profile' }));
    dispatch(setMobileMenuOpen(false));
  };

  return (
    <aside
      className={`erp-sidebar ${sidebarCollapsed ? 'collapsed erp-sidebar-icon-only' : ''} ${
        mobileMenuOpen ? 'mobile-open' : ''
      }`}
    >
      <div className={`erp-sidebar-brand ${sidebarCollapsed ? 'erp-sidebar-brand-compact' : ''}`} title="CraffixHub">
        <CraffixLogo
          variant="dark"
          size={28}
          showWordmark={!sidebarCollapsed}
          wordmarkText="CraffixHub"
        />
        <button
          type="button"
          onClick={() => dispatch(toggleSidebar())}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: 'none',
            borderRadius: 8,
            color: '#CBD5E1',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Menu size={18} />
        </button>
      </div>

      <nav className={`erp-sidebar-nav ${sidebarCollapsed ? 'erp-sidebar-nav-icons' : ''}`}>
        <div className={`sa-nav-list ${sidebarCollapsed ? 'sa-nav-list-icons' : ''}`}>
          {groups.map((grp) => {
            const CatIcon = grp.icon || LayoutDashboard;
            const isDrawerForGroup = Boolean(superAdminDrawer?.open && superAdminDrawer?.group === grp.group);
            const isRouteInGroup =
              !superAdminDrawer?.open &&
              grp.items.some(
                (item) =>
                  location.pathname === item.to || location.pathname.startsWith(`${item.to.split('?')[0]}/`)
              );
            const isActive = isDrawerForGroup || isRouteInGroup;
            const groupBadge = grp.items.reduce(
              (sum, item) => sum + (item.badgeKey ? counts[item.badgeKey] || 0 : 0),
              0
            );

            return (
              <button
                key={grp.group}
                type="button"
                className={`sa-cat-btn ${sidebarCollapsed ? 'sa-cat-btn-icon' : ''} ${
                  isActive ? 'active-route open' : ''
                }`}
                onClick={() => handleOpenPillar(grp)}
                title={grp.group}
                data-tooltip={sidebarCollapsed ? grp.group : undefined}
                aria-label={grp.group}
                aria-expanded={isDrawerForGroup}
              >
                <span className="sa-cat-icon">
                  <CatIcon size={19} />
                </span>
                {sidebarCollapsed ? (
                  groupBadge > 0 && (
                    <span className="sa-icon-badge" aria-label={`${groupBadge} pending`}>
                      {groupBadge > 99 ? '99+' : groupBadge}
                    </span>
                  )
                ) : (
                  <>
                    <span className="sa-cat-meta">
                      <div className="sa-cat-title">{grp.group}</div>
                    </span>
                    {groupBadge > 0 && (
                      <span className="sidebar-badge sidebar-badge-emerald" style={{ marginLeft: 0 }}>
                        {groupBadge}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      <div className={`erp-sidebar-footer ${sidebarCollapsed ? 'erp-sidebar-footer-icons' : ''}`}>
        <button
          type="button"
          onClick={() => handleOpenSupport('/help')}
          title="Help & Support"
          data-tooltip={sidebarCollapsed ? 'Help & Support' : undefined}
          aria-label="Help & Support"
          className={`${sidebarCollapsed ? 'sa-footer-icon-btn' : 'erp-nav-item'} ${
            superAdminDrawer?.open && superAdminDrawer?.itemPath === '/help' ? 'active' : ''
          }`}
        >
          <HelpCircle size={18} style={{ flexShrink: 0 }} />
          {!sidebarCollapsed && <span>Help & Support</span>}
        </button>
        <button
          type="button"
          onClick={() => handleOpenSupport('/privacy-policy')}
          title="Privacy Policy"
          data-tooltip={sidebarCollapsed ? 'Privacy Policy' : undefined}
          aria-label="Privacy Policy"
          className={`${sidebarCollapsed ? 'sa-footer-icon-btn' : 'erp-nav-item'} ${
            superAdminDrawer?.open && superAdminDrawer?.itemPath === '/privacy-policy' ? 'active' : ''
          }`}
        >
          <ShieldCheck size={18} style={{ flexShrink: 0 }} />
          {!sidebarCollapsed && <span>Privacy Policy</span>}
        </button>
        <button
          type="button"
          onClick={handleOpenSettings}
          title="Settings (Profile & Theme)"
          data-tooltip={sidebarCollapsed ? 'Settings' : undefined}
          aria-label="Settings"
          className={`${sidebarCollapsed ? 'sa-footer-icon-btn' : 'erp-nav-item'} ${
            superAdminDrawer?.open && superAdminDrawer?.group === SUPER_ADMIN_SETTINGS_GROUP.group ? 'active' : ''
          }`}
        >
          <Settings size={18} style={{ flexShrink: 0 }} />
          {!sidebarCollapsed && <span>Settings</span>}
        </button>
      </div>
    </aside>
  );
}
