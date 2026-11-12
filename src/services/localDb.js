import initialSeed from './initialBrowserSeed.json';
import { store } from '../app/store';
import { recordRealtimeChange, prependNotification } from '../app/realtimeSlice';
import { pushToast } from '../app/uiSlice';

export const STORAGE_KEY = 'craffixhub_browser_db_v4';

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('craffixhub_realtime') : null;

if (channel) {
  channel.onmessage = (event) => {
    if (event.data?.type === 'DATA_CHANGED') {
      store.dispatch(recordRealtimeChange({ module: event.data.module, action: event.data.action || 'updated' }));
    }
  };
}

export function genId() {
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 24; i += 1) {
    out += hex[Math.floor(Math.random() * 16)];
  }
  return out;
}

export function nowIso() {
  return new Date().toISOString();
}

export function nextSeqCode(list, field, prefix) {
  const year = new Date().getFullYear();
  const base = `${prefix}-${year}-`;
  let maxNum = 0;
  for (const item of list || []) {
    const val = String(item?.[field] || '');
    if (val.startsWith(base)) {
      const n = parseInt(val.slice(base.length), 10);
      if (!Number.isNaN(n) && n > maxNum) maxNum = n;
    }
  }
  return `${base}${String(maxNum + 1).padStart(4, '0')}`;
}

function buildDefaultDb() {
  const seed = JSON.parse(JSON.stringify(initialSeed || {}));
  const collections = [
    'users',
    'roles',
    'permissions',
    'userroles',
    'organizationsettings',
    'departments',
    'designations',
    'employees',
    'employeeattendances',
    'leaverequests',
    'students',
    'courses',
    'coursemodules',
    'coursematerials',
    'batches',
    'enrollments',
    'enrollmentsessions',
    'coursesessions',
    'studentattendances',
    'assignments',
    'submissions',
    'invoices',
    'payments',
    'expenses',
    'duerequests',
    'events',
    'eventregistrations',
    'eventteams',
    'eventsubmissions',
    'evaluations',
    'competitionresults',
    'certificates',
    'certificatetemplates',
    'projects',
    'tasks',
    'announcements',
    'notifications',
    'auditlogs',
    'loginhistories',
    'ideapitches',
  ];
  const db = {};
  for (const col of collections) {
    db[col] = Array.isArray(seed[col]) ? seed[col] : [];
  }
  if (db.organizationsettings.length === 0) {
    db.organizationsettings.push({
      _id: genId(),
      name: 'CraffixWeb Technologies',
      productName: 'CraffixHub',
      tagline: 'Powering People. Managing Progress. Building Innovation.',
      email: 'contact@craffixweb.com',
      phone: '+91 98765 43210',
      website: 'https://craffixweb.com',
      expenseApprovalLimit: 10000,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  }
  return db;
}

export function readDb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      parsed.ideapitches = parsed.ideapitches || [];
      parsed.notifications = parsed.notifications || [];
      parsed.leaverequests = parsed.leaverequests || [];
      parsed.duerequests = parsed.duerequests || [];
      parsed.enrollmentsessions = parsed.enrollmentsessions || [];
      return parsed;
    }
  } catch {
    // Corrupted localStorage falls back cleanly
  }
  const initial = buildDefaultDb();
  writeDb(initial, null);
  return initial;
}

export function writeDb(db, notifyModule = null, action = 'updated') {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  if (notifyModule) {
    const payload = { type: 'DATA_CHANGED', module: notifyModule, action };
    try {
      channel?.postMessage(payload);
    } catch {
      // ignore broadcast errors
    }
    store.dispatch(recordRealtimeChange({ module: notifyModule, action }));
  }
}

export function broadcastModule(module, action = 'updated') {
  try {
    channel?.postMessage({ type: 'DATA_CHANGED', module, action });
  } catch {
    // ignore
  }
  store.dispatch(recordRealtimeChange({ module, action }));
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export function getId(ref) {
  if (!ref) return '';
  if (typeof ref === 'object' && ref._id) return String(ref._id);
  return String(ref);
}

export function findById(list, id) {
  const sid = getId(id);
  return (list || []).find((item) => String(item._id) === sid) || null;
}

export function buildUserProfilePayload(db, user) {
  if (!user) return null;
  const uid = String(user._id);
  const roleAssignments = (db.userroles || []).filter((ur) => String(ur.userId) === uid && ur.isActive !== false);
  const roleSet = new Set([user.primaryRole]);
  const permSet = new Set();

  for (const ur of roleAssignments) {
    const roleDoc = findById(db.roles, ur.roleId);
    if (!roleDoc || roleDoc.isActive === false) continue;
    roleSet.add(roleDoc.code);
    for (const p of roleDoc.permissions || []) {
      if (p.code) permSet.add(p.code);
    }
  }

  let department = user.departmentId ? findById(db.departments, user.departmentId) : null;
  if (department) department = { _id: department._id, name: department.name, code: department.code };

  let studentProfile = null;
  if (user.accountType === 'STUDENT' || user.primaryRole === 'STUDENT') {
    studentProfile = (db.students || []).find((s) => String(s.userId) === uid) || null;
  }

  let employeeProfile = null;
  if (user.accountType === 'INTERNAL') {
    const emp = (db.employees || []).find((e) => String(e.userId) === uid) || null;
    if (emp) {
      const empDept = findById(db.departments, emp.departmentId);
      const empDesig = findById(db.designations, emp.designationId);
      employeeProfile = {
        ...emp,
        departmentId: empDept ? { _id: empDept._id, name: empDept.name, code: empDept.code } : emp.departmentId,
        designationId: empDesig ? { _id: empDesig._id, title: empDesig.title, code: empDesig.code } : emp.designationId,
      };
    }
  }

  let guestRegistrations = [];
  if (user.accountType === 'GUEST' || user.primaryRole === 'GUEST') {
    guestRegistrations = (db.eventregistrations || [])
      .filter((r) => String(r.userId) === uid)
      .map((r) => {
        const ev = findById(db.events, r.eventId);
        return {
          ...r,
          eventId: ev
            ? {
                _id: ev._id,
                title: ev.title,
                eventCode: ev.eventCode,
                startDate: ev.startDate,
                endDate: ev.endDate,
                venue: ev.venue,
                eventStatus: ev.eventStatus,
                category: ev.category,
              }
            : r.eventId,
        };
      });
  }

  return {
    id: user._id,
    _id: user._id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone || '',
    avatarUrl: user.avatarUrl || '',
    bio: user.bio || '',
    accountType: user.accountType,
    primaryRole: user.primaryRole,
    departmentId: user.departmentId || employeeProfile?.departmentId?._id || null,
    department: department || employeeProfile?.departmentId || null,
    roles: Array.from(roleSet),
    permissions: Array.from(permSet),
    status: user.status,
    emailVerified: Boolean(user.emailVerified),
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    studentProfile,
    employeeProfile,
    guestRegistrations,
  };
}

const MODULE_CATEGORY_MAP = {
  courses: 'ACADEMY_ENROLMENTS',
  batches: 'ACADEMY_ENROLMENTS',
  enrollments: 'ACADEMY_ENROLMENTS',
  certificates: 'ACADEMY_ENROLMENTS',
  students: 'ACADEMY_ENROLMENTS',
  assignments: 'ACADEMY_ENROLMENTS',
  attendance: 'ACADEMY_ENROLMENTS',
  leaves: 'LEAVE_UPDATES',
  finance: 'FINANCE_APPROVALS',
  competitions: 'SUBMISSIONS',
  events: 'SUBMISSIONS',
  users: 'SYSTEM_ALERTS',
  employees: 'SYSTEM_ALERTS',
  organization: 'SYSTEM_ALERTS',
  support: 'SYSTEM_ALERTS',
  auth: 'SYSTEM_ALERTS',
  profile: 'SYSTEM_ALERTS',
};

export function appendAudit(
  db,
  { actor, action, module, category = '', summary, resourceType = '', resourceId = null, notifyCeo = false, link = '/reports', notifyTitle = '' }
) {
  db.auditlogs = db.auditlogs || [];
  const resolvedCategory = category || MODULE_CATEGORY_MAP[module] || 'SYSTEM_ALERTS';
  db.auditlogs.unshift({
    _id: genId(),
    actorId: actor?._id || null,
    actorName: actor?.fullName || 'System',
    actorRole: actor?.primaryRole || 'SYSTEM',
    action,
    module,
    category: resolvedCategory,
    summary,
    resourceType,
    resourceId,
    createdAt: nowIso(),
  });
  if (db.auditlogs.length > 250) {
    db.auditlogs = db.auditlogs.slice(0, 250);
  }
  if (notifyCeo) {
    pushNotifications(
      db,
      [],
      {
        type: action,
        category: resolvedCategory,
        title: notifyTitle || action.replace(/_/g, ' '),
        message: summary,
        link,
        actionLabel: 'Review Log',
      },
      actor?._id || null
    );
  }
}

export function pushNotifications(
  db,
  userIds,
  { type = 'INFO', category = 'SYSTEM_ALERTS', title, message, link = '/dashboard', actionLabel = 'View Details', meta = null },
  currentUserId = null,
  { includeCeo = true } = {}
) {
  db.notifications = db.notifications || [];
  const ceoIds = includeCeo
    ? (db.users || []).filter((u) => u.primaryRole === 'SUPER_ADMIN' && u.status === 'ACTIVE').map((u) => String(u._id))
    : [];
  const uniqueIds = Array.from(new Set([...(userIds || []).map((id) => String(id)), ...ceoIds]));

  for (const uid of uniqueIds) {
    const notif = {
      _id: genId(),
      recipientId: uid,
      type,
      category,
      title,
      message,
      link,
      actionLabel,
      meta,
      readAt: null,
      createdAt: nowIso(),
    };
    db.notifications.unshift(notif);
    if (currentUserId && String(uid) === String(currentUserId)) {
      store.dispatch(prependNotification(notif));
      store.dispatch(pushToast({ type: 'info', title, message }));
    }
  }
}

export function makeToken(userId, kind = 'access') {
  const payload = btoa(unescape(encodeURIComponent(JSON.stringify({ sub: String(userId), kind, iat: Date.now() }))));
  return `cfx_local.${payload}.browser`;
}

export function parseToken(token) {
  if (!token) return null;
  if (token.startsWith('cfx_local.')) {
    try {
      const part = token.split('.')[1];
      return JSON.parse(decodeURIComponent(escape(atob(part))));
    } catch {
      return null;
    }
  }
  // Support existing JWT stored in localStorage seamlessly
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    }
  } catch {
    return null;
  }
  return null;
}

export function generateSimplePdfBlob({ certificateNumber, recipientName, programTitle, certificateType, issuedAt, verificationToken }) {
  const clean = (s) => String(s || '').replace(/[()\\]/g, '');
  const lines = [
    'CRAFFIXHUB OFFICIAL CERTIFICATE',
    `Certificate Number: ${clean(certificateNumber)}`,
    `Recipient: ${clean(recipientName)}`,
    `Type: ${clean(certificateType)}`,
    `Program / Event: ${clean(programTitle)}`,
    `Issued Date: ${clean(String(issuedAt || '').slice(0, 10))}`,
    `Verify At: /verify/${clean(verificationToken)}`,
  ];
  const textOps = lines
    .map((line, i) => `BT /F1 ${i === 0 ? 18 : 12} Tf 50 ${740 - i * 32} Td (${line}) Tj ET`)
    .join('\n');
  const stream = textOps;
  const pdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length ${stream.length} >>
stream
${stream}
endstream
endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000240 00000 n 
0000000500 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
570
%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}
