export function formatINR(amount = 0) {
  return `₹ ${Number(amount || 0).toLocaleString('en-IN')}`;
}

export function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const ROLE_DESIGNATIONS = {
  SUPER_ADMIN: { code: 'SUPER_ADMIN', label: 'Super Admin', rank: 1 },
  ADMIN: { code: 'ADMIN', label: 'Admin', rank: 2 },
  COORDINATOR: { code: 'COORDINATOR', label: 'Course Coordinator', rank: 3 },
  MENTOR: { code: 'MENTOR', label: 'Mentor', rank: 4 },
  STUDENT: { code: 'STUDENT', label: 'Student', rank: 5 },
  GUEST: { code: 'GUEST', label: 'Guest', rank: 6 },
};

export function formatRoleLabel(role = '') {
  const key = String(role || '').toUpperCase();
  if (ROLE_DESIGNATIONS[key]) return ROLE_DESIGNATIONS[key].label;
  return String(role || 'User').replace(/_/g, ' ');
}

export function getInitials(name = 'U') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

export function getStatusVariant(status = '') {
  const s = String(status).toUpperCase();
  if (
    [
      'ACTIVE',
      'VERIFIED',
      'APPROVED',
      'PAID',
      'COMPLETED',
      'PUBLISHED',
      'ONGOING',
      'PRESENT',
      'CONFIRMED',
      'EVALUATED',
      'SHORTLISTED',
      'RESOLVED',
      'ENROLLED',
      'APPROVED - FORWARDED TO COORDINATOR',
    ].includes(s)
  ) {
    return 'success';
  }
  if (
    [
      'PENDING',
      'PENDING_VERIFICATION',
      'PENDING_REVIEW',
      'PENDING REVIEW',
      'PENDING_MANAGER',
      'PENDING_HR',
      'PENDING MENTOR',
      'PENDING COORDINATOR',
      'PENDING ADMIN',
      'PENDING SUPER ADMIN',
      'UNDER REVIEW',
      'APPROVED - PENDING DISPATCH',
      'CLARIFICATION REQUESTED',
      'PARTIALLY_PAID',
      'UPCOMING',
      'REGISTRATION_OPEN',
      'IN_PROGRESS',
      'IN_REVIEW',
      'COUNSELING_SESSION',
      'ADMIN_APPROVAL',
      'PROBATION',
      'LATE',
      'OPEN',
    ].includes(s)
  ) {
    return 'warning';
  }
  if (
    [
      'REJECTED',
      'REJECTED - FORWARDED TO COORDINATOR',
      'CANCELLED',
      'REVOKED',
      'OVERDUE',
      'ABSENT',
      'TERMINATED',
      'SUSPENDED',
      'BLOCKED',
      'DROPPED',
    ].includes(s)
  ) {
    return 'danger';
  }
  if (
    [
      'RESULTS_PUBLISHED',
      'TODO',
      'FORMED',
      'SUBMITTED',
      'REVIEWED',
      'SCHEDULED',
      'NEW_INQUIRY',
      'FEE_UNLOCKED',
    ].includes(s)
  ) {
    return 'primary';
  }
  return 'neutral';
}

export function exportToCsv(filename, rows) {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map((r) =>
      headers
        .map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`)
        .join(',')
    ),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
