import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { MainLayout } from '../layouts/MainLayout';
import { LoginPage } from '../modules/auth/LoginPage';
import { RegisterPage } from '../modules/auth/RegisterPage';
import { ForgotPasswordPage, ResetPasswordPage } from '../modules/auth/ForgotPasswordPage';
import { PublicEventsPage } from '../modules/events/PublicEventsPage';
import { PublicVerifyPage } from '../modules/certificates/PublicVerifyPage';
import { DashboardPage } from '../modules/dashboard/DashboardPage';
import { OrganizationPage } from '../modules/organization/OrganizationPage';
import { UsersPage } from '../modules/users/UsersPage';
import { EmployeesPage } from '../modules/employees/EmployeesPage';
import { HrmsPage } from '../modules/employees/HrmsPage';
import { StudentsPage } from '../modules/students/StudentsPage';
import { CoursesPage } from '../modules/courses/CoursesPage';
import { BatchesPage } from '../modules/batches/BatchesPage';
import { EnrollmentsPage } from '../modules/enrollments/EnrollmentsPage';
import { MentorsPage } from '../modules/mentors/MentorsPage';
import { AssignmentsPage } from '../modules/mentors/AssignmentsPage';
import { AttendancePage } from '../modules/attendance/AttendancePage';
import { FinancePage } from '../modules/finance/FinancePage';
import { EventsPage } from '../modules/events/EventsPage';
import { CompetitionsPage } from '../modules/competitions/CompetitionsPage';
import { ProjectsPage } from '../modules/projects/ProjectsPage';
import { TasksPage } from '../modules/tasks/TasksPage';
import { CertificatesPage } from '../modules/certificates/CertificatesPage';
import { ReportsPage } from '../modules/reports/ReportsPage';
import { SettingsPage } from '../modules/settings/SettingsPage';
import { ProfilePage } from '../modules/profile/ProfilePage';
import { NotificationsCenter } from '../modules/notifications/NotificationsCenter';
import { IdeaPitchingView } from '../modules/competitions/IdeaPitchingView';
import { AdminIdeaReview } from '../modules/competitions/AdminIdeaReview';
import { LeaveWorkflowPage } from '../modules/leaves/LeaveWorkflowPage';
import { HelpCenter } from '../modules/support/HelpCenter';
import { PrivacyPolicy } from '../modules/support/PrivacyPolicy';

export function AppRouter() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/public/events" element={<PublicEventsPage />} />
      <Route path="/verify" element={<PublicVerifyPage />} />
      <Route path="/verify/:token" element={<PublicVerifyPage />} />

      {/* Authenticated ERP routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/courses" element={<CoursesPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/competitions" element={<CompetitionsPage />} />
          <Route path="/certificates" element={<CertificatesPage />} />
          <Route path="/assignments" element={<AssignmentsPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/finance" element={<FinancePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/notifications" element={<NotificationsCenter />} />
          <Route path="/help" element={<HelpCenter />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />

          <Route element={<ProtectedRoute allowedRoles={['GUEST']} />}>
            <Route path="/idea-pitching" element={<IdeaPitchingView />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'COORDINATOR', 'MENTOR', 'STUDENT']} />}>
            <Route path="/leaves" element={<LeaveWorkflowPage />} />
            <Route path="/enrollments" element={<EnrollmentsPage />} />
            <Route path="/batches" element={<BatchesPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/tasks" element={<TasksPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'COORDINATOR', 'MENTOR']} />}>
            <Route path="/students" element={<StudentsPage />} />
            <Route path="/mentors" element={<MentorsPage />} />
            <Route path="/hrms" element={<HrmsPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'COORDINATOR']} />}>
            <Route path="/organization" element={<OrganizationPage />} />
            <Route path="/reports" element={<ReportsPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']} />}>
            <Route path="/users" element={<UsersPage />} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/idea-pitches" element={<AdminIdeaReview />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']} />}>
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
