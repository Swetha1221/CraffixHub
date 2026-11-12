import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { X, Sun, Moon } from 'lucide-react';
import {
  closeSuperAdminDrawer,
  setSuperAdminDrawerItem,
  toggleTheme,
} from '../../app/uiSlice';
import {
  NAV_BY_ROLE,
  SUPER_ADMIN_SUPPORT_GROUP,
  SUPER_ADMIN_SETTINGS_GROUP,
} from './superAdminNav';
import { DashboardPage } from '../../modules/dashboard/DashboardPage';
import { NotificationsCenter } from '../../modules/notifications/NotificationsCenter';
import { ReportsPage } from '../../modules/reports/ReportsPage';
import { FinancePage } from '../../modules/finance/FinancePage';
import { LeaveWorkflowPage } from '../../modules/leaves/LeaveWorkflowPage';
import { AdminIdeaReview } from '../../modules/competitions/AdminIdeaReview';
import { IdeaPitchingView } from '../../modules/competitions/IdeaPitchingView';
import { OrganizationPage } from '../../modules/organization/OrganizationPage';
import { UsersPage } from '../../modules/users/UsersPage';
import { EmployeesPage } from '../../modules/employees/EmployeesPage';
import { HrmsPage } from '../../modules/employees/HrmsPage';
import { StudentsPage } from '../../modules/students/StudentsPage';
import { CoursesPage } from '../../modules/courses/CoursesPage';
import { BatchesPage } from '../../modules/batches/BatchesPage';
import { EnrollmentsPage } from '../../modules/enrollments/EnrollmentsPage';
import { AssignmentsPage } from '../../modules/mentors/AssignmentsPage';
import { AttendancePage } from '../../modules/attendance/AttendancePage';
import { EventsPage } from '../../modules/events/EventsPage';
import { CompetitionsPage } from '../../modules/competitions/CompetitionsPage';
import { ProjectsPage } from '../../modules/projects/ProjectsPage';
import { TasksPage } from '../../modules/tasks/TasksPage';
import { CertificatesPage } from '../../modules/certificates/CertificatesPage';
import { SettingsPage } from '../../modules/settings/SettingsPage';
import { ProfilePage } from '../../modules/profile/ProfilePage';
import { HelpCenter } from '../../modules/support/HelpCenter';
import { PrivacyPolicy } from '../../modules/support/PrivacyPolicy';

const ROUTE_COMPONENTS = {
  '/dashboard': DashboardPage,
  '/notifications': NotificationsCenter,
  '/reports': ReportsPage,
  '/finance': FinancePage,
  '/leaves': LeaveWorkflowPage,
  '/idea-pitches': AdminIdeaReview,
  '/idea-pitching': IdeaPitchingView,
  '/organization': OrganizationPage,
  '/users': UsersPage,
  '/employees': EmployeesPage,
  '/hrms': HrmsPage,
  '/students': StudentsPage,
  '/courses': CoursesPage,
  '/batches': BatchesPage,
  '/enrollments': EnrollmentsPage,
  '/assignments': AssignmentsPage,
  '/attendance': AttendancePage,
  '/events': EventsPage,
  '/competitions': CompetitionsPage,
  '/competitions?tab=results': CompetitionsPage,
  '/projects': ProjectsPage,
  '/tasks': TasksPage,
  '/certificates': CertificatesPage,
  '/settings': SettingsPage,
  '/profile': ProfilePage,
  '/help': HelpCenter,
  '/privacy-policy': PrivacyPolicy,
};

export function SuperAdminSlideDrawer() {
  const dispatch = useDispatch();
  const location = useLocation();
  const user = useSelector((state) => state.auth.user);
  const { superAdminDrawer, sidebarCollapsed, theme } = useSelector((state) => state.ui);
  const { unreadNotifications, pendingPitchesCount } = useSelector((state) => state.realtime);
  const prevPathRef = useRef(location.pathname);

  const role = user?.primaryRole || 'STUDENT';
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isOpen = Boolean(user && superAdminDrawer?.open);

  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      prevPathRef.current = location.pathname;
      if (isOpen) {
        dispatch(closeSuperAdminDrawer());
      }
    }
  }, [location.pathname, isOpen, dispatch]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        dispatch(closeSuperAdminDrawer());
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, dispatch]);

  if (!user) return null;

  const roleGroups = NAV_BY_ROLE[role] || NAV_BY_ROLE.STUDENT;
  const settingsGroupForRole = {
    ...SUPER_ADMIN_SETTINGS_GROUP,
    items: isSuperAdmin
      ? SUPER_ADMIN_SETTINGS_GROUP.items
      : SUPER_ADMIN_SETTINGS_GROUP.items.filter((it) => it.to === '/profile'),
  };

  const allGroups = [...roleGroups, SUPER_ADMIN_SUPPORT_GROUP, settingsGroupForRole];
  const activeGroup =
    allGroups.find((g) => g.group === superAdminDrawer.group) || roleGroups[0];
  const activeItem =
    activeGroup.items.find((it) => it.to === superAdminDrawer.itemPath) || activeGroup.items[0];

  const ActiveComponent = ROUTE_COMPONENTS[activeItem.to] || DashboardPage;
  const GroupIcon = activeGroup.icon;
  const counts = { unreadNotifications, pendingPitchesCount };

  return (
    <aside
      className={`sa-drawer-panel ${isOpen ? 'open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
      role="region"
      aria-label={`${activeGroup.group} workspace`}
      aria-hidden={!isOpen}
    >
      <div className="sa-drawer-accent" />

      <header className="sa-drawer-header">
        <div className="sa-drawer-title-wrap">
          <div className="sa-drawer-icon-badge">
            <GroupIcon size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h2 className="sa-drawer-title">{activeGroup.group}</h2>
            <p className="sa-drawer-subtitle">{activeGroup.description}</p>
          </div>
        </div>

        <div className="sa-drawer-actions">
          <button
            type="button"
            className="sa-drawer-icon-btn close"
            onClick={() => dispatch(closeSuperAdminDrawer())}
            title="Close panel (Esc)"
            aria-label="Close panel"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      <nav className="sa-drawer-tabs" aria-label={`${activeGroup.group} sections`}>
        {activeGroup.items.map((item) => {
          const isTabActive = item.to === activeItem.to;
          const badgeCount = item.badgeKey ? counts[item.badgeKey] || 0 : 0;
          return (
            <button
              key={item.to}
              type="button"
              className={`sa-drawer-tab ${isTabActive ? 'active' : ''}`}
              onClick={() => dispatch(setSuperAdminDrawerItem(item.to))}
            >
              <span>{item.label}</span>
              {badgeCount > 0 && (
                <span className={`sa-drawer-tab-badge ${item.badgeKey === 'unreadNotifications' ? 'emerald' : ''}`}>
                  {badgeCount}
                </span>
              )}
            </button>
          );
        })}

        {activeGroup.group === 'Settings' && (
          <button
            type="button"
            className="sa-drawer-tab"
            style={{ marginLeft: 'auto' }}
            onClick={() => dispatch(toggleTheme())}
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
            <span>Theme: {theme === 'light' ? 'Light' : 'Dark'}</span>
          </button>
        )}
      </nav>

      <div className="sa-drawer-body">
        {isOpen && (
          <div key={activeItem.to} className="sa-drawer-content-anim sa-drawer-inner">
            <ActiveComponent />
          </div>
        )}
      </div>
    </aside>
  );
}
