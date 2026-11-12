import {
  readDb,
  writeDb,
  genId,
  nowIso,
  nextSeqCode,
  readFileAsDataUrl,
  getId,
  findById,
  buildUserProfilePayload,
  appendAudit,
  pushNotifications,
  makeToken,
  parseToken,
  generateSimplePdfBlob,
} from './localDb';

class HttpError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

function ok(data, message = 'Success', status = 200, meta = undefined) {
  return {
    status,
    data: {
      success: true,
      message,
      data,
      ...(meta ? { meta } : {}),
    },
  };
}

function requireAuth(db, headers) {
  const authHeader = headers?.Authorization || headers?.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim() || localStorage.getItem('cfx_access_token') || '';
  const decoded = parseToken(token);
  if (!decoded?.sub) {
    throw new HttpError('Authentication token is required', 401);
  }
  const user = findById(db.users, decoded.sub);
  if (!user || user.status !== 'ACTIVE') {
    throw new HttpError('Account is inactive or not found', 403);
  }
  const roleAssignments = (db.userroles || []).filter((ur) => String(ur.userId) === String(user._id) && ur.isActive !== false);
  const roles = new Set([user.primaryRole]);
  for (const ur of roleAssignments) {
    const r = findById(db.roles, ur.roleId);
    if (r?.code) roles.add(r.code);
  }
  return { user, roles: Array.from(roles) };
}

function requireRole(roles, ...allowed) {
  if (!roles.some((r) => allowed.includes(r))) {
    throw new HttpError('Forbidden: insufficient role permissions', 403);
  }
}

function assertNotCeoReadOnly(user) {
  if (user?.primaryRole === 'SUPER_ADMIN') {
    throw new HttpError(
      'CEO Read-Only Mode: Super Admin has executive oversight only. Operational actions are handled by Admin, Coordinator, or Mentor.',
      403
    );
  }
}

function populateUserBrief(db, userId) {
  const u = findById(db.users, userId);
  if (!u) return null;
  return {
    _id: u._id,
    fullName: u.fullName,
    email: u.email,
    phone: u.phone || '',
    avatarUrl: u.avatarUrl || '',
    primaryRole: u.primaryRole,
    status: u.status,
  };
}

function populateStudent(db, studentId) {
  const s = findById(db.students, studentId);
  if (!s) return null;
  return { ...s, userId: populateUserBrief(db, s.userId) };
}

function populateBatch(db, batch) {
  if (!batch) return null;
  const course = findById(db.courses, batch.courseId);
  const mentors = (batch.mentors || []).map((mId) => populateUserBrief(db, mId)).filter(Boolean);
  const coord = batch.coordinatorId ? populateUserBrief(db, batch.coordinatorId) : null;
  const enrollCount = (db.enrollments || []).filter(
    (e) => String(e.batchId) === String(batch._id) && ['APPROVED', 'ACTIVE', 'COMPLETED'].includes(e.status)
  ).length;
  const studentCount = Math.max(enrollCount, (batch.students || []).length);
  return {
    ...batch,
    courseId: course ? { _id: course._id, courseCode: course.courseCode, title: course.title, category: course.category } : batch.courseId,
    mentors,
    coordinatorId: coord,
    studentCount,
  };
}

function populateEnrollment(db, enr, viewerRole = 'ADMIN') {
  if (!enr) return null;
  const stu = populateStudent(db, enr.studentId);
  const course = findById(db.courses, enr.courseId);
  const batch = findById(db.batches, enr.batchId);
  const isUnlocked = Boolean(enr.priceUnlocked || course?.priceUnlocked || ['ACTIVE', 'COMPLETED'].includes(enr.status));
  const rawFee = enr.feeDetails || {};
  const visibleFeeDetails =
    viewerRole === 'STUDENT' && !isUnlocked
      ? { originalFee: null, discountPercent: 0, discount: 0, scholarship: 0, finalFee: null, currency: 'INR', locked: true }
      : { ...rawFee, locked: !isUnlocked };
  return {
    ...enr,
    priceUnlocked: isUnlocked,
    feeDetails: visibleFeeDetails,
    studentId: stu,
    courseId: course
      ? {
          _id: course._id,
          courseCode: course.courseCode,
          title: course.title,
          category: course.category,
          priceUnlocked: Boolean(course.priceUnlocked),
          fee: viewerRole === 'STUDENT' && !isUnlocked ? { amount: null, locked: true, currency: 'INR' } : course.fee,
        }
      : enr.courseId,
    batchId: batch ? { _id: batch._id, batchCode: batch.batchCode, name: batch.name, progressPercent: batch.progressPercent, mentors: batch.mentors } : null,
  };
}

function parseUrlAndParams(url, configParams) {
  const cleanUrl = String(url || '').replace(/^\/api\/v1/, '');
  const [pathOnly, qs] = cleanUrl.split('?');
  const path = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
  const query = {};
  if (qs) {
    const sp = new URLSearchParams(qs);
    sp.forEach((v, k) => {
      query[k] = v;
    });
  }
  if (configParams && typeof configParams === 'object') {
    for (const [k, v] of Object.entries(configParams)) {
      if (v !== undefined && v !== null && v !== '') query[k] = String(v);
    }
  }
  return { path, query };
}

function validateBatchCap(db, batchId, courseId, excludeEnrollmentId = null) {
  const batch = findById(db.batches, batchId);
  if (!batch) throw new HttpError('Selected batch not found', 404);
  if (String(batch.courseId) !== String(courseId)) {
    throw new HttpError('Selected batch does not belong to the chosen course', 400);
  }
  const activeCount = (db.enrollments || []).filter(
    (e) =>
      String(e.batchId) === String(batch._id) &&
      (!excludeEnrollmentId || String(e._id) !== String(excludeEnrollmentId)) &&
      ['APPROVED', 'ACTIVE'].includes(e.status)
  ).length;
  if (activeCount >= Number(batch.capacity || 40)) {
    throw new HttpError(`Batch ${batch.batchCode} has reached maximum capacity (${batch.capacity})`, 400);
  }
  return batch;
}

export async function dispatchLocalRequest(config) {
  const method = (config.method || 'get').toUpperCase();
  const { path, query } = parseUrlAndParams(config.url, config.params);
  let body = config.data;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  const db = readDb();

  // ================= AUTHENTICATION =================
  if (method === 'GET' && path === '/auth/setup-status') {
    return ok({ needsSetup: (db.users || []).length === 0 });
  }

  if (method === 'POST' && path === '/auth/setup-super-admin') {
    if ((db.users || []).length > 0) {
      throw new HttpError('Initial Super Admin setup has already been completed', 403);
    }
    const userId = genId();
    const user = {
      _id: userId,
      fullName: body.fullName,
      email: String(body.email || '').toLowerCase().trim(),
      phone: body.phone || '',
      localPassword: body.password,
      avatarUrl: '',
      bio: '',
      accountType: 'INTERNAL',
      primaryRole: 'SUPER_ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
      lastLoginAt: nowIso(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.users.push(user);
    if (db.organizationsettings[0] && body.organizationName) {
      db.organizationsettings[0].name = body.organizationName;
    }
    const saRole = db.roles.find((r) => r.code === 'SUPER_ADMIN');
    if (saRole) {
      db.userroles.push({ _id: genId(), userId, roleId: saRole._id, isPrimary: true, isActive: true });
    }
    writeDb(db, 'users', 'created');
    return ok(
      {
        user: buildUserProfilePayload(db, user),
        accessToken: makeToken(user._id, 'access'),
        refreshToken: makeToken(user._id, 'refresh'),
      },
      'Super Admin initialized',
      201
    );
  }

  if (method === 'POST' && path === '/auth/register') {
    const email = String(body.email || '').toLowerCase().trim();
    if (db.users.some((u) => u.email === email)) {
      throw new HttpError('Email address is already registered', 409);
    }
    const userId = genId();
    const user = {
      _id: userId,
      fullName: body.fullName,
      email,
      phone: body.phone || '',
      localPassword: body.password,
      avatarUrl: '',
      bio: '',
      accountType: 'STUDENT',
      primaryRole: 'STUDENT',
      status: 'ACTIVE',
      emailVerified: true,
      lastLoginAt: nowIso(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.users.push(user);
    const stuRole = db.roles.find((r) => r.code === 'STUDENT');
    if (stuRole) {
      db.userroles.push({ _id: genId(), userId, roleId: stuRole._id, isPrimary: true, isActive: true });
    }
    const studentId = nextSeqCode(db.students, 'studentId', 'CFX-STU');
    db.students.push({
      _id: genId(),
      userId,
      studentId,
      college: body.college || '',
      department: body.department || '',
      academicYear: body.academicYear || '',
      address: { line1: '', city: '', state: '', postalCode: '' },
      guardian: { name: '', relationship: '', phone: '' },
      internshipDetails: { company: '', role: '', status: 'NOT_STARTED' },
      placementDetails: { company: '', role: '', packageLpa: 0, status: 'SEEKING' },
      studentStatus: 'REGISTERED',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    appendAudit(db, { actor: user, action: 'REGISTER_STUDENT', module: 'auth', summary: `${user.fullName} registered (${studentId})` });
    writeDb(db, 'students', 'created');
    return ok(
      {
        user: buildUserProfilePayload(db, user),
        accessToken: makeToken(user._id, 'access'),
        refreshToken: makeToken(user._id, 'refresh'),
      },
      'Student registered successfully',
      201
    );
  }

  if (method === 'POST' && path === '/auth/login') {
    const email = String(body.email || '').toLowerCase().trim();
    const user = db.users.find((u) => u.email === email);
    const validPwd = user && (user.localPassword ? user.localPassword === body.password : body.password === 'Craffix@2026');
    if (!user || !validPwd) {
      db.loginhistories.unshift({ _id: genId(), email, success: false, createdAt: nowIso() });
      writeDb(db);
      throw new HttpError('Invalid email or password', 401);
    }
    if (user.status !== 'ACTIVE') {
      throw new HttpError(`Account is ${user.status}. Contact an administrator.`, 403);
    }
    user.lastLoginAt = nowIso();
    db.loginhistories.unshift({ _id: genId(), userId: user._id, email: user.email, success: true, createdAt: nowIso() });
    writeDb(db);
    return ok(
      {
        user: buildUserProfilePayload(db, user),
        accessToken: makeToken(user._id, 'access'),
        refreshToken: makeToken(user._id, 'refresh'),
      },
      'Login successful'
    );
  }

  if (method === 'POST' && path === '/auth/demo-login') {
    const roleCode = body.role;
    let user = db.users.find((u) => u.primaryRole === roleCode && u.status === 'ACTIVE');
    if (!user) {
      user = db.users.find((u) => u.primaryRole === roleCode);
    }
    if (!user) {
      throw new HttpError(`No demo user found for role ${roleCode}`, 404);
    }
    if (user.status !== 'ACTIVE') user.status = 'ACTIVE';
    user.lastLoginAt = nowIso();
    db.loginhistories.unshift({ _id: genId(), userId: user._id, email: user.email, success: true, createdAt: nowIso() });
    writeDb(db);
    return ok(
      {
        user: buildUserProfilePayload(db, user),
        accessToken: makeToken(user._id, 'access'),
        refreshToken: makeToken(user._id, 'refresh'),
      },
      'Demo login successful'
    );
  }

  if (method === 'POST' && path === '/auth/refresh') {
    const decoded = parseToken(body?.refreshToken);
    if (!decoded?.sub) throw new HttpError('Invalid refresh token', 401);
    return ok({
      accessToken: makeToken(decoded.sub, 'access'),
      refreshToken: makeToken(decoded.sub, 'refresh'),
    });
  }

  if (method === 'POST' && path === '/auth/logout') {
    return ok({ loggedOut: true }, 'Logged out successfully');
  }

  if (method === 'POST' && path === '/auth/forgot-password') {
    const token = `reset-${genId()}`;
    const u = db.users.find((x) => x.email === String(body.email || '').toLowerCase().trim());
    if (u) {
      u.resetToken = token;
      writeDb(db);
    }
    return ok({ sent: true, devResetToken: token }, 'Reset instructions prepared');
  }

  if (method === 'POST' && path === '/auth/reset-password') {
    const u = db.users.find((x) => x.resetToken === body.token);
    if (!u) throw new HttpError('Invalid or expired password reset token', 400);
    u.localPassword = body.password;
    delete u.resetToken;
    writeDb(db);
    return ok({ reset: true }, 'Password reset successful');
  }

  // Public routes (no auth required)
  if (method === 'GET' && path === '/public/events') {
    const events = (db.events || []).filter((e) =>
      ['PUBLISHED', 'REGISTRATION_OPEN', 'ONGOING', 'RESULTS_PUBLISHED', 'COMPLETED'].includes(e.eventStatus)
    );
    return ok(events);
  }

  if (method === 'POST' && /^\/public\/events\/[^/]+\/register$/.test(path)) {
    const eventId = path.split('/')[3];
    const event = findById(db.events, eventId);
    if (!event) throw new HttpError('Event not found', 404);
    const email = String(body.email || '').toLowerCase().trim();
    let user = db.users.find((u) => u.email === email);
    if (!user) {
      user = {
        _id: genId(),
        fullName: body.fullName,
        email,
        phone: body.phone || '',
        localPassword: body.password || 'Guest@2026',
        avatarUrl: '',
        bio: '',
        accountType: 'GUEST',
        primaryRole: 'GUEST',
        status: 'ACTIVE',
        emailVerified: true,
        lastLoginAt: nowIso(),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      db.users.push(user);
      const gr = db.roles.find((r) => r.code === 'GUEST');
      if (gr) db.userroles.push({ _id: genId(), userId: user._id, roleId: gr._id, isPrimary: true, isActive: true });
    }
    const existingReg = db.eventregistrations.find(
      (r) => String(r.eventId) === String(event._id) && String(r.userId) === String(user._id)
    );
    if (existingReg) throw new HttpError('Already registered for this event', 409);

    const registrationNumber = nextSeqCode(db.eventregistrations, 'registrationNumber', 'REG');
    const reg = {
      _id: genId(),
      registrationNumber,
      eventId: event._id,
      userId: user._id,
      participantType: user.primaryRole === 'STUDENT' ? 'STUDENT' : 'GUEST',
      college: body.college || '',
      department: body.department || '',
      academicYear: body.academicYear || '',
      registrationStatus: 'CONFIRMED',
      access: {
        startsAt: nowIso(),
        expiresAt: event.guestAccess?.expiresAt || new Date(Date.now() + 7 * 86400000).toISOString(),
        revokedAt: null,
      },
      createdAt: nowIso(),
    };
    db.eventregistrations.push(reg);
    writeDb(db, 'events', 'updated');
    return ok(
      {
        registration: reg,
        user: buildUserProfilePayload(db, user),
        accessToken: makeToken(user._id, 'access'),
        refreshToken: makeToken(user._id, 'refresh'),
      },
      'Guest registration successful',
      201
    );
  }

  if (method === 'GET' && /^\/public\/certificates\/verify\/[^/]+$/.test(path)) {
    const token = decodeURIComponent(path.split('/').pop());
    const cert = db.certificates.find((c) => c.verificationToken === token || c.certificateNumber === token);
    if (!cert) throw new HttpError('Certificate not found', 404);
    const recipient = findById(db.users, cert.userId);
    const course = cert.courseId ? findById(db.courses, cert.courseId) : null;
    const event = cert.eventId ? findById(db.events, cert.eventId) : null;
    return ok({
      valid: cert.status === 'ACTIVE' && cert.approvalStatus === 'APPROVED',
      certificateNumber: cert.certificateNumber,
      certificateType: cert.certificateType,
      programTitle: cert.programTitle || course?.title || event?.title || 'CraffixWeb Program',
      recipientName: recipient?.fullName || cert.recipientName || 'Participant',
      issuedAt: cert.issuedAt,
      status: cert.status,
      approvalStatus: cert.approvalStatus,
    });
  }

  // ========= AUTHENTICATED ROUTES =========
  const { user, roles } = requireAuth(db, config.headers);
  const uid = String(user._id);

  // Enforce CEO Read-Only Mode for Super Admin across operational mutations (except approvals & pitch reviews)
  const ceoSelfAllowed =
    path.startsWith('/auth/') ||
    path.startsWith('/notifications/') ||
    path === '/organization/settings' ||
    /^\/leaves\/[^/]+\/transition$/.test(path) ||
    /^\/finance\/due-requests\/[^/]+\/transition$/.test(path) ||
    /^\/idea-pitches\/[^/]+\/review$/.test(path) ||
    path === '/enrollments' ||
    /^\/enrollments\/[^/]+(\/(approve|reject))?$/.test(path) ||
    /^\/students(\/[^/]+)?$/.test(path) ||
    /^\/finance\/payments(\/[^/]+\/verify)?$/.test(path) ||
    path === '/finance/issue-amount';
  if (user.primaryRole === 'SUPER_ADMIN' && method !== 'GET' && !ceoSelfAllowed) {
    assertNotCeoReadOnly(user);
  }

  // /auth/me
  if (method === 'GET' && path === '/auth/me') {
    return ok(buildUserProfilePayload(db, user));
  }

  if (method === 'PATCH' && path === '/auth/me') {
    if (body.fullName !== undefined) user.fullName = String(body.fullName).trim();
    if (body.phone !== undefined) user.phone = String(body.phone || '').trim();
    if (body.bio !== undefined) user.bio = String(body.bio || '').trim();
    if (body.departmentId !== undefined && (roles.includes('SUPER_ADMIN') || roles.includes('ADMIN') || !user.departmentId)) {
      user.departmentId = body.departmentId || null;
    }
    user.updatedAt = nowIso();

    if ((user.accountType === 'STUDENT' || user.primaryRole === 'STUDENT') && body.studentProfile) {
      let stu = db.students.find((s) => String(s.userId) === uid);
      if (!stu) {
        stu = {
          _id: genId(),
          userId: user._id,
          studentId: nextSeqCode(db.students, 'studentId', 'CFX-STU'),
          studentStatus: 'REGISTERED',
          address: {},
          guardian: {},
          internshipDetails: {},
          placementDetails: {},
          createdAt: nowIso(),
        };
        db.students.push(stu);
      }
      Object.assign(stu, {
        ...body.studentProfile,
        address: { ...(stu.address || {}), ...(body.studentProfile.address || {}) },
        guardian: { ...(stu.guardian || {}), ...(body.studentProfile.guardian || {}) },
        internshipDetails: { ...(stu.internshipDetails || {}), ...(body.studentProfile.internshipDetails || {}) },
        placementDetails: { ...(stu.placementDetails || {}), ...(body.studentProfile.placementDetails || {}) },
        updatedAt: nowIso(),
      });
    }

    appendAudit(db, { actor: user, action: 'UPDATE_SELF_PROFILE', module: 'profile', summary: `${user.fullName} updated their profile` });
    writeDb(db, 'users', 'updated');
    return ok(buildUserProfilePayload(db, user), 'Profile updated successfully');
  }

  if (method === 'POST' && path === '/auth/me/avatar') {
    const file = body instanceof FormData ? body.get('avatar') : null;
    if (!file) throw new HttpError('Avatar file is required', 400);
    user.avatarUrl = await readFileAsDataUrl(file);
    user.updatedAt = nowIso();
    writeDb(db, 'users', 'updated');
    return ok(buildUserProfilePayload(db, user), 'Profile photo updated');
  }

  if (method === 'POST' && path === '/auth/change-password') {
    const currentValid = user.localPassword ? user.localPassword === body.currentPassword : body.currentPassword === 'Craffix@2026';
    if (!currentValid) throw new HttpError('Current password is incorrect', 400);
    if (body.currentPassword === body.newPassword) throw new HttpError('New password must be different', 400);
    user.localPassword = body.newPassword;
    user.updatedAt = nowIso();
    appendAudit(db, { actor: user, action: 'CHANGE_PASSWORD', module: 'profile', summary: `${user.fullName} changed password` });
    writeDb(db);
    return ok({ changed: true }, 'Password changed successfully');
  }

  if (method === 'GET' && path === '/auth/login-history') {
    const isAdmin = roles.includes('SUPER_ADMIN') || roles.includes('ADMIN');
    const items = isAdmin ? db.loginhistories : db.loginhistories.filter((h) => String(h.userId) === uid || h.email === user.email);
    return ok(items.slice(0, 50));
  }

  // ========= USERS & ROLES =========
  if (method === 'GET' && path === '/users') {
    requireRole(roles, 'SUPER_ADMIN', 'ADMIN', 'COORDINATOR', 'MENTOR');
    let list = [...db.users];
    if (query.role) list = list.filter((u) => u.primaryRole === query.role);
    if (query.status) list = list.filter((u) => u.status === query.status);
    if (query.search) {
      const q = query.search.toLowerCase();
      list = list.filter(
        (u) =>
          u.fullName?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.phone?.toLowerCase().includes(q)
      );
    }
    const hydrated = list.map((u) => {
      const dept = u.departmentId ? findById(db.departments, u.departmentId) : null;
      return { ...u, departmentId: dept ? { _id: dept._id, name: dept.name, code: dept.code } : null };
    });
    return ok(hydrated);
  }

  if (method === 'POST' && path === '/users') {
    requireRole(roles, 'SUPER_ADMIN', 'ADMIN');
    if (body.primaryRole === 'SUPER_ADMIN' && !roles.includes('SUPER_ADMIN')) {
      throw new HttpError('Only Super Admin can create another Super Admin', 403);
    }
    const email = String(body.email || '').toLowerCase().trim();
    if (db.users.some((u) => u.email === email)) throw new HttpError('Email already registered', 409);

    const accountType = body.primaryRole === 'STUDENT' ? 'STUDENT' : body.primaryRole === 'GUEST' ? 'GUEST' : 'INTERNAL';
    const resolvedDept = body.departmentId || (accountType === 'INTERNAL' ? db.departments[0]?._id : null);
    const newUser = {
      _id: genId(),
      fullName: body.fullName,
      email,
      phone: body.phone || '',
      localPassword: body.password,
      avatarUrl: '',
      bio: '',
      accountType,
      primaryRole: body.primaryRole,
      departmentId: resolvedDept || null,
      status: 'ACTIVE',
      emailVerified: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.users.unshift(newUser);
    const roleDoc = db.roles.find((r) => r.code === body.primaryRole);
    if (roleDoc) db.userroles.push({ _id: genId(), userId: newUser._id, roleId: roleDoc._id, isPrimary: true, isActive: true });

    if (accountType === 'STUDENT') {
      db.students.unshift({
        _id: genId(),
        userId: newUser._id,
        studentId: nextSeqCode(db.students, 'studentId', 'CFX-STU'),
        college: body.college || '',
        studentStatus: 'REGISTERED',
        address: {},
        guardian: {},
        createdAt: nowIso(),
      });
    } else if (accountType === 'INTERNAL' && resolvedDept) {
      db.employees.unshift({
        _id: genId(),
        userId: newUser._id,
        employeeId: nextSeqCode(db.employees, 'employeeId', 'CFX-EMP'),
        departmentId: resolvedDept,
        designationId: body.designationId || db.designations[0]?._id || null,
        employmentType: 'FULL_TIME',
        employmentStatus: 'ACTIVE',
        joiningDate: nowIso(),
        createdAt: nowIso(),
      });
    }
    appendAudit(db, {
      actor: user,
      action: 'CREATE_USER',
      module: 'users',
      summary: `Created ${body.primaryRole} for ${newUser.fullName}`,
      notifyCeo: true,
      link: '/users',
      notifyTitle: `New User Account (${body.primaryRole})`,
    });
    writeDb(db, 'users', 'created');
    return ok(buildUserProfilePayload(db, newUser), 'User created', 201);
  }

  if (method === 'GET' && /^\/users\/[^/]+$/.test(path)) {
    const targetId = path.split('/')[2];
    if (!roles.includes('SUPER_ADMIN') && !roles.includes('ADMIN') && targetId !== uid) {
      throw new HttpError('Access denied', 403);
    }
    const target = findById(db.users, targetId);
    if (!target) throw new HttpError('User not found', 404);
    return ok(buildUserProfilePayload(db, target));
  }

  if (method === 'PATCH' && /^\/users\/[^/]+$/.test(path)) {
    requireRole(roles, 'SUPER_ADMIN', 'ADMIN');
    const targetId = path.split('/')[2];
    const target = findById(db.users, targetId);
    if (!target) throw new HttpError('User not found', 404);
    if (target.primaryRole === 'SUPER_ADMIN' && !roles.includes('SUPER_ADMIN')) {
      throw new HttpError('Only Super Admin can modify a Super Admin account', 403);
    }
    if (body.primaryRole === 'SUPER_ADMIN' && !roles.includes('SUPER_ADMIN')) {
      throw new HttpError('Only Super Admin can assign Super Admin role', 403);
    }
    if (body.email !== undefined) {
      const nextEmail = String(body.email).toLowerCase().trim();
      if (db.users.some((u) => u.email === nextEmail && String(u._id) !== String(target._id))) {
        throw new HttpError('Email already in use', 409);
      }
      target.email = nextEmail;
    }
    if (body.fullName !== undefined) target.fullName = body.fullName.trim();
    if (body.phone !== undefined) target.phone = body.phone;
    if (body.bio !== undefined) target.bio = body.bio;
    if (body.status !== undefined) target.status = body.status;
    if (body.departmentId !== undefined) target.departmentId = body.departmentId || null;
    if (body.newPassword && body.newPassword.length >= 8) target.localPassword = body.newPassword;

    if (body.primaryRole && body.primaryRole !== target.primaryRole) {
      target.primaryRole = body.primaryRole;
      target.accountType = body.primaryRole === 'STUDENT' ? 'STUDENT' : body.primaryRole === 'GUEST' ? 'GUEST' : 'INTERNAL';
      const roleDoc = db.roles.find((r) => r.code === body.primaryRole);
      if (roleDoc) {
        db.userroles = db.userroles.filter((ur) => String(ur.userId) !== String(target._id));
        db.userroles.push({ _id: genId(), userId: target._id, roleId: roleDoc._id, isPrimary: true, isActive: true });
      }
    }
    target.updatedAt = nowIso();

    if (target.accountType === 'STUDENT') {
      let stu = db.students.find((s) => String(s.userId) === String(target._id));
      if (!stu) {
        stu = {
          _id: genId(),
          userId: target._id,
          studentId: nextSeqCode(db.students, 'studentId', 'CFX-STU'),
          studentStatus: 'REGISTERED',
          address: {},
          guardian: {},
          createdAt: nowIso(),
        };
        db.students.unshift(stu);
      }
      if (body.studentProfile) {
        Object.assign(stu, {
          ...body.studentProfile,
          guardian: { ...(stu.guardian || {}), ...(body.studentProfile.guardian || {}) },
          updatedAt: nowIso(),
        });
      }
    } else if (target.accountType === 'INTERNAL') {
      let emp = db.employees.find((e) => String(e.userId) === String(target._id));
      const deptId = body.departmentId || target.departmentId || emp?.departmentId || db.departments[0]?._id;
      const desigId = body.designationId || emp?.designationId || db.designations[0]?._id;
      if (!emp && deptId) {
        emp = {
          _id: genId(),
          userId: target._id,
          employeeId: nextSeqCode(db.employees, 'employeeId', 'CFX-EMP'),
          departmentId: deptId,
          designationId: desigId,
          employmentType: 'FULL_TIME',
          employmentStatus: 'ACTIVE',
          joiningDate: nowIso(),
          createdAt: nowIso(),
        };
        db.employees.unshift(emp);
      }
      if (emp) {
        if (body.departmentId) emp.departmentId = body.departmentId;
        if (body.designationId) emp.designationId = body.designationId;
        if (body.employeeProfile) Object.assign(emp, body.employeeProfile);
        emp.updatedAt = nowIso();
      }
    }
    appendAudit(db, { actor: user, action: 'RECTIFY_USER_PROFILE', module: 'users', summary: `Rectified profile for ${target.fullName}` });
    writeDb(db, 'users', 'updated');
    return ok(buildUserProfilePayload(db, target), 'User profile rectified & updated');
  }

  if (method === 'PATCH' && /^\/users\/[^/]+\/status$/.test(path)) {
    requireRole(roles, 'SUPER_ADMIN', 'ADMIN');
    const targetId = path.split('/')[2];
    if (targetId === uid && body.status !== 'ACTIVE') throw new HttpError('Cannot deactivate own session', 400);
    const target = findById(db.users, targetId);
    if (!target) throw new HttpError('User not found', 404);
    target.status = body.status;
    target.updatedAt = nowIso();
    appendAudit(db, { actor: user, action: 'UPDATE_USER_STATUS', module: 'users', summary: `Set ${target.fullName} to ${body.status}` });
    writeDb(db, 'users', 'updated');
    return ok(target, 'User status updated');
  }

  if (method === 'GET' && path === '/roles') {
    const labelMap = {
      SUPER_ADMIN: 'Super Admin',
      ADMIN: 'Admin',
      COORDINATOR: 'Course Coordinator',
      MENTOR: 'Mentor',
      STUDENT: 'Student',
      GUEST: 'Guest',
    };
    const normalized = (db.roles || []).map((r) => ({
      ...r,
      name: labelMap[r.code] || r.name,
    }));
    return ok(normalized);
  }

  // ========= ORGANIZATION =========
  if (method === 'GET' && path === '/organization/settings') {
    return ok(db.organizationsettings[0] || {});
  }
  if (method === 'PATCH' && path === '/organization/settings') {
    requireRole(roles, 'SUPER_ADMIN');
    Object.assign(db.organizationsettings[0], body, { updatedAt: nowIso() });
    writeDb(db, 'organization', 'updated');
    return ok(db.organizationsettings[0], 'Settings updated');
  }
  if (method === 'GET' && path === '/organization/departments') {
    return ok(db.departments || []);
  }
  if (method === 'POST' && path === '/organization/departments') {
    requireRole(roles, 'SUPER_ADMIN', 'ADMIN');
    const dept = { _id: genId(), ...body, code: String(body.code || '').toUpperCase(), createdAt: nowIso() };
    db.departments.unshift(dept);
    writeDb(db, 'organization', 'created');
    return ok(dept, 'Department created', 201);
  }
  if (method === 'GET' && path === '/organization/designations') {
    return ok(db.designations || []);
  }
  if (method === 'GET' && path === '/organization/announcements') {
    return ok(db.announcements || []);
  }
  if (method === 'POST' && path === '/organization/announcements') {
    requireRole(roles, 'SUPER_ADMIN', 'ADMIN', 'COORDINATOR');
    const ann = { _id: genId(), ...body, createdBy: user._id, createdAt: nowIso() };
    db.announcements.unshift(ann);
    writeDb(db, 'organization', 'created');
    return ok(ann, 'Announcement posted', 201);
  }

  // ========= EMPLOYEES & HRMS =========
  if (method === 'GET' && path === '/employees') {
    let list = (db.employees || []).map((e) => ({
      ...e,
      userId: populateUserBrief(db, e.userId),
      departmentId: findById(db.departments, e.departmentId),
      designationId: findById(db.designations, e.designationId),
    }));
    if (query.search) {
      const q = query.search.toLowerCase();
      list = list.filter(
        (e) =>
          e.employeeId?.toLowerCase().includes(q) ||
          e.userId?.fullName?.toLowerCase().includes(q) ||
          e.userId?.email?.toLowerCase().includes(q)
      );
    }
    return ok(list);
  }

  if (method === 'POST' && path === '/employees') {
    requireRole(roles, 'SUPER_ADMIN', 'ADMIN');
    const email = String(body.email || '').toLowerCase().trim();
    if (db.users.some((u) => u.email === email)) throw new HttpError('Email already exists', 409);
    const newUser = {
      _id: genId(),
      fullName: body.fullName,
      email,
      phone: body.phone || '',
      localPassword: body.password,
      avatarUrl: '',
      bio: '',
      accountType: 'INTERNAL',
      primaryRole: body.primaryRole || 'MENTOR',
      departmentId: body.departmentId,
      status: 'ACTIVE',
      emailVerified: true,
      createdAt: nowIso(),
    };
    db.users.unshift(newUser);
    const rDoc = db.roles.find((r) => r.code === newUser.primaryRole);
    if (rDoc) db.userroles.push({ _id: genId(), userId: newUser._id, roleId: rDoc._id, isPrimary: true, isActive: true });
    const emp = {
      _id: genId(),
      userId: newUser._id,
      employeeId: nextSeqCode(db.employees, 'employeeId', 'CFX-EMP'),
      departmentId: body.departmentId,
      designationId: body.designationId,
      employmentType: body.employmentType || 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      joiningDate: body.joiningDate || nowIso(),
      salaryStructure: { basic: Number(body.basicSalary || 0), allowances: Number(body.allowances || 0) },
      createdAt: nowIso(),
    };
    db.employees.unshift(emp);
    appendAudit(db, { actor: user, action: 'CREATE_EMPLOYEE', module: 'employees', summary: `Onboarded ${newUser.fullName} (${emp.employeeId})` });
    writeDb(db, 'employees', 'created');
    return ok(emp, 'Employee registered', 201);
  }

  if (method === 'GET' && path === '/employees/leaves') {
    const isAdminOnly = user.primaryRole === 'ADMIN';
    let list = [...(db.leaverequests || [])];
    if (user.primaryRole === 'SUPER_ADMIN') {
      list = [];
    } else if (!isAdminOnly) {
      const myEmp = db.employees.find((e) => String(e.userId) === uid);
      list = myEmp ? list.filter((l) => String(l.employeeId) === String(myEmp._id) || String(l.applicantUserId) === uid) : list.filter((l) => String(l.applicantUserId) === uid);
    }
    return ok(
      list.map((l) => {
        const emp = findById(db.employees, l.employeeId);
        return { ...l, employeeId: emp ? { ...emp, userId: populateUserBrief(db, emp.userId) } : null };
      })
    );
  }

  if (method === 'POST' && path === '/employees/leaves') {
    if (['SUPER_ADMIN', 'ADMIN'].includes(user.primaryRole)) {
      throw new HttpError('Super Admin and Admin roles do not submit leave applications', 403);
    }
    const emp = db.employees.find((e) => String(e.userId) === uid);
    if (!emp) throw new HttpError('Employee profile not found for current user', 404);
    const leave = {
      _id: genId(),
      leaveCode: nextSeqCode(db.leaverequests, 'leaveCode', 'LVE'),
      employeeId: emp._id,
      applicantUserId: user._id,
      applicantRole: user.primaryRole,
      applicantName: user.fullName,
      leaveType: body.leaveType || 'CASUAL',
      startDate: body.startDate,
      endDate: body.endDate,
      days: Number(body.days || 1),
      reason: body.reason,
      status: 'Pending Admin',
      finalStatus: 'Pending Admin',
      history: [
        {
          step: 'Submitted',
          actorId: user._id,
          actorName: user.fullName,
          actorRole: user.primaryRole,
          action: 'SUBMITTED',
          remarks: `Submitted by ${user.primaryRole} directly to Admin`,
          timestamp: nowIso(),
        },
      ],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.leaverequests.unshift(leave);
    const adminIds = db.users.filter((u) => u.primaryRole === 'ADMIN' && u.status === 'ACTIVE').map((u) => u._id);
    pushNotifications(
      db,
      adminIds,
      {
        type: 'STAFF_LEAVE_SUBMITTED',
        category: 'LEAVE_UPDATES',
        title: `Staff Leave Request (${user.primaryRole})`,
        message: `${user.fullName} requested ${leave.days} day(s) (${leave.leaveType}): "${String(leave.reason || '').slice(0, 60)}"`,
        link: '/leaves',
        actionLabel: 'Review Request',
      },
      uid,
      { includeCeo: false }
    );
    writeDb(db, 'leaves', 'created');
    return ok(leave, 'Leave request submitted', 201);
  }

  if (method === 'POST' && /^\/employees\/leaves\/[^/]+\/review$/.test(path)) {
    if (user.primaryRole !== 'ADMIN') {
      throw new HttpError('Only Admin can approve or reject staff leave requests', 403);
    }
    const leaveId = path.split('/')[3];
    const leave = findById(db.leaverequests, leaveId);
    if (!leave) throw new HttpError('Leave request not found', 404);
    const isApproved = ['APPROVE', 'APPROVED'].includes(String(body.decision || '').toUpperCase());
    leave.finalStatus = isApproved ? 'APPROVED' : 'REJECTED';
    leave.status = isApproved ? 'Completed' : 'Rejected';
    leave.reviewedBy = user._id;
    leave.reviewedAt = nowIso();
    if (leave.applicantUserId) {
      pushNotifications(
        db,
        [leave.applicantUserId],
        {
          type: isApproved ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
          category: 'LEAVE_UPDATES',
          title: `Staff Leave ${isApproved ? 'Approved' : 'Rejected'}`,
          message: `Your leave request was ${isApproved ? 'approved' : 'rejected'} by Admin ${user.fullName}.`,
          link: '/leaves',
          actionLabel: 'View Details',
        },
        uid,
        { includeCeo: false }
      );
    }
    writeDb(db, 'leaves', 'updated');
    return ok(leave, 'Leave reviewed');
  }

  if (method === 'GET' && path === '/employees/attendance/all') {
    return ok(
      (db.employeeattendances || []).map((a) => {
        const emp = findById(db.employees, a.employeeId);
        return { ...a, employeeId: emp ? { ...emp, userId: populateUserBrief(db, emp.userId) } : null };
      })
    );
  }

  if (method === 'POST' && path === '/employees/attendance') {
    requireRole(roles, 'SUPER_ADMIN', 'ADMIN');
    const dateStr = String(body.date).slice(0, 10);
    let rec = db.employeeattendances.find((a) => String(a.employeeId) === String(body.employeeId) && String(a.date).slice(0, 10) === dateStr);
    if (!rec) {
      rec = { _id: genId(), employeeId: body.employeeId, date: dateStr, status: body.status, remarks: body.remarks || '' };
      db.employeeattendances.unshift(rec);
    } else {
      rec.status = body.status;
      rec.remarks = body.remarks || '';
    }
    writeDb(db, 'attendance', 'updated');
    return ok(rec, 'Employee attendance marked');
  }

  // ========= STUDENTS =========
  if (method === 'GET' && path === '/students') {
    let list = (db.students || []).map((s) => ({ ...s, userId: populateUserBrief(db, s.userId) }));
    if (query.search) {
      const q = query.search.toLowerCase();
      list = list.filter(
        (s) =>
          s.studentId?.toLowerCase().includes(q) ||
          s.userId?.fullName?.toLowerCase().includes(q) ||
          s.userId?.email?.toLowerCase().includes(q) ||
          s.college?.toLowerCase().includes(q)
      );
    }
    return ok(list);
  }

  if (method === 'POST' && path === '/students') {
    requireRole(roles, 'SUPER_ADMIN', 'ADMIN', 'COORDINATOR');
    const email = String(body.email || '').toLowerCase().trim();
    if (db.users.some((u) => u.email === email)) throw new HttpError('Student email already registered', 409);
    const newUser = {
      _id: genId(),
      fullName: body.fullName,
      email,
      phone: body.phone || '',
      localPassword: body.password,
      avatarUrl: '',
      bio: '',
      accountType: 'STUDENT',
      primaryRole: 'STUDENT',
      status: 'ACTIVE',
      emailVerified: true,
      createdAt: nowIso(),
    };
    db.users.unshift(newUser);
    const stuRole = db.roles.find((r) => r.code === 'STUDENT');
    if (stuRole) db.userroles.push({ _id: genId(), userId: newUser._id, roleId: stuRole._id, isPrimary: true, isActive: true });
    const stu = {
      _id: genId(),
      userId: newUser._id,
      studentId: nextSeqCode(db.students, 'studentId', 'CFX-STU'),
      college: body.college || '',
      department: body.department || '',
      academicYear: body.academicYear || '',
      guardian: { name: body.guardianName || '', phone: body.guardianPhone || '' },
      address: {},
      studentStatus: 'REGISTERED',
      createdAt: nowIso(),
    };
    db.students.unshift(stu);
    appendAudit(db, { actor: user, action: 'CREATE_STUDENT', module: 'students', summary: `Registered ${newUser.fullName} (${stu.studentId})` });
    writeDb(db, 'students', 'created');
    return ok({ ...stu, userId: populateUserBrief(db, newUser._id) }, 'Student account created', 201);
  }

  if (method === 'PATCH' && /^\/students\/[^/]+$/.test(path)) {
    requireRole(roles, 'SUPER_ADMIN', 'ADMIN', 'COORDINATOR');
    const stu = findById(db.students, path.split('/')[2]);
    if (!stu) throw new HttpError('Student not found', 404);
    const linkedUser = findById(db.users, stu.userId);
    if (linkedUser) {
      if (body.fullName !== undefined) linkedUser.fullName = String(body.fullName).trim();
      if (body.email !== undefined) {
        const nextEmail = String(body.email).toLowerCase().trim();
        if (nextEmail !== linkedUser.email && db.users.some((u) => u.email === nextEmail)) {
          throw new HttpError('Email already in use', 409);
        }
        linkedUser.email = nextEmail;
      }
      if (body.phone !== undefined) linkedUser.phone = String(body.phone).trim();
    }
    if (body.college !== undefined) stu.college = body.college;
    if (body.department !== undefined) stu.department = body.department;
    if (body.academicYear !== undefined) stu.academicYear = body.academicYear;
    if (body.studentStatus !== undefined) stu.studentStatus = body.studentStatus;
    if (body.guardianName !== undefined || body.guardianPhone !== undefined) {
      stu.guardian = {
        name: body.guardianName ?? stu.guardian?.name ?? '',
        phone: body.guardianPhone ?? stu.guardian?.phone ?? '',
      };
    }
    stu.updatedAt = nowIso();
    appendAudit(db, { actor: user, action: 'UPDATE_STUDENT', module: 'students', summary: `Updated student ${stu.studentId}` });
    writeDb(db, 'students', 'updated');
    return ok({ ...stu, userId: populateUserBrief(db, stu.userId) }, 'Student updated');
  }

  if (method === 'DELETE' && /^\/students\/[^/]+$/.test(path)) {
    requireRole(roles, 'SUPER_ADMIN', 'ADMIN', 'COORDINATOR');
    const stuId = path.split('/')[2];
    const stu = findById(db.students, stuId);
    if (!stu) throw new HttpError('Student not found', 404);
    db.students = db.students.filter((s) => String(s._id) !== String(stuId));
    db.users = db.users.filter((u) => String(u._id) !== String(stu.userId));
    db.userroles = db.userroles.filter((ur) => String(ur.userId) !== String(stu.userId));
    appendAudit(db, { actor: user, action: 'DELETE_STUDENT', module: 'students', summary: `Deleted student ${stu.studentId}` });
    writeDb(db, 'students', 'deleted');
    return ok({ _id: stuId }, 'Student deleted');
  }

  // ========= MENTORS, ASSIGNMENTS & SUBMISSIONS =========
  if (method === 'GET' && path === '/mentors') {
    const mentors = db.users
      .filter((u) => u.primaryRole === 'MENTOR')
      .map((m) => ({
        ...m,
        assignedBatches: db.batches.filter((b) => (b.mentors || []).some((id) => String(id) === String(m._id))),
      }));
    return ok(mentors);
  }

  if (method === 'GET' && path === '/mentors/assignments') {
    let list = [...(db.assignments || [])];
    if (user.primaryRole === 'STUDENT') {
      const myStu = db.students.find((s) => String(s.userId) === uid);
      const myBatches = new Set(db.enrollments.filter((e) => String(e.studentId) === String(myStu?._id)).map((e) => String(e.batchId)));
      list = list.filter((a) => myBatches.has(String(a.batchId)));
    }
    return ok(
      list.map((a) => {
        const b = findById(db.batches, a.batchId);
        const c = findById(db.courses, b?.courseId);
        return { ...a, batchId: b ? { _id: b._id, batchCode: b.batchCode, courseId: c } : null };
      })
    );
  }

  if (method === 'POST' && path === '/mentors/assignments') {
    requireRole(roles, 'SUPER_ADMIN', 'ADMIN', 'COORDINATOR', 'MENTOR');
    const a = {
      _id: genId(),
      ...body,
      mentorId: user._id,
      createdAt: nowIso(),
    };
    db.assignments.unshift(a);
    writeDb(db, 'assignments', 'created');
    return ok(a, 'Assignment created', 201);
  }

  if (method === 'POST' && /^\/mentors\/assignments\/[^/]+\/submit$/.test(path)) {
    const assignmentId = path.split('/')[3];
    const myStu = db.students.find((s) => String(s.userId) === uid);
    if (!myStu) throw new HttpError('Student profile not found', 404);
    const sub = {
      _id: genId(),
      assignmentId,
      studentId: myStu._id,
      submissionUrl: body.submissionUrl || '',
      notes: body.notes || '',
      status: 'SUBMITTED',
      submittedAt: nowIso(),
    };
    db.submissions.unshift(sub);
    writeDb(db, 'assignments', 'updated');
    return ok(sub, 'Assignment submitted', 201);
  }

  if (method === 'GET' && path === '/mentors/submissions') {
    let list = [...(db.submissions || [])];
    if (user.primaryRole === 'STUDENT') {
      const myStu = db.students.find((s) => String(s.userId) === uid);
      list = list.filter((s) => String(s.studentId) === String(myStu?._id));
    }
    return ok(
      list.map((s) => ({
        ...s,
        assignmentId: findById(db.assignments, s.assignmentId),
        studentId: populateStudent(db, s.studentId),
      }))
    );
  }

  if (method === 'POST' && /^\/mentors\/submissions\/[^/]+\/evaluate$/.test(path)) {
    requireRole(roles, 'SUPER_ADMIN', 'ADMIN', 'COORDINATOR', 'MENTOR');
    const subId = path.split('/')[3];
    const sub = findById(db.submissions, subId);
    if (!sub) throw new HttpError('Submission not found', 404);
    sub.marks = Number(body.marks || 0);
    sub.feedback = body.feedback || '';
    sub.status = 'EVALUATED';
    sub.evaluatedBy = user._id;
    sub.evaluatedAt = nowIso();
    writeDb(db, 'assignments', 'updated');
    return ok(sub, 'Submission evaluated');
  }

  // ========= COURSES & MATERIALS =========
  if (method === 'GET' && path === '/courses') {
    const myStu = user.primaryRole === 'STUDENT' ? db.students.find((s) => String(s.userId) === uid) : null;
    const list = (db.courses || []).map((c) => {
      const myEnroll = myStu
        ? (db.enrollments || []).find((e) => String(e.studentId) === String(myStu._id) && String(e.courseId) === String(c._id))
        : null;
      const unlockedForViewer =
        user.primaryRole !== 'STUDENT' ||
        Boolean(c.priceUnlocked) ||
        Boolean(myEnroll?.priceUnlocked) ||
        ['ACTIVE', 'COMPLETED'].includes(myEnroll?.status);
      const batchCount = (db.batches || []).filter((b) => String(b.courseId) === String(c._id)).length;
      return {
        ...c,
        objective:
          c.objective ||
          `Build strong foundations, architectural fluency, and hands-on implementation mastery in ${c.title}.`,
        outcome:
          c.outcome ||
          `Deliver production-ready projects, complete weekly mentor evaluations, and earn a QR-verifiable ${c.title} certificate.`,
        priceUnlocked: Boolean(c.priceUnlocked),
        unlockedForViewer,
        myEnrollmentStatus: myEnroll?.status || null,
        batchCount,
        fee: unlockedForViewer
          ? { ...(c.fee || { amount: 0, currency: 'INR' }), locked: !c.priceUnlocked }
          : { amount: null, currency: 'INR', locked: true },
      };
    });
    return ok(list);
  }

  if (method === 'POST' && path === '/courses') {
    assertNotCeoReadOnly(user);
    requireRole(roles, 'ADMIN', 'COORDINATOR');
    const c = {
      _id: genId(),
      courseCode: (body.courseCode || nextSeqCode(db.courses, 'courseCode', 'CRS')).toUpperCase(),
      title: body.title,
      description: body.description || '',
      objective: body.objective || `Master core concepts and practical workflows in ${body.title}.`,
      outcome: body.outcome || `Graduate with industry-ready portfolio deliverables in ${body.title}.`,
      category: body.category || 'Development',
      duration: { value: Number(body.durationValue || 12), unit: body.durationUnit || 'WEEKS' },
      fee: { amount: Number(body.feeAmount || 0), currency: 'INR' },
      priceUnlocked: Boolean(body.priceUnlocked ?? false),
      eligibility: body.eligibility || 'Open to eligible students',
      courseStatus: body.courseStatus || 'ACTIVE',
      createdAt: nowIso(),
    };
    db.courses.unshift(c);
    const coordIds = db.users.filter((u) => ['ADMIN', 'COORDINATOR'].includes(u.primaryRole)).map((u) => u._id);
    pushNotifications(
      db,
      coordIds,
      {
        type: 'COURSE_CREATED',
        category: 'ACADEMY_ENROLMENTS',
        title: `New Course Added (${c.courseCode})`,
        message: `${user.fullName} published "${c.title}" (Fee locked by default).`,
        link: '/courses',
        actionLabel: 'Open Catalog',
      },
      uid
    );
    appendAudit(db, { actor: user, action: 'CREATE_COURSE', module: 'courses', summary: `Created course ${c.title}` });
    writeDb(db, 'courses', 'created');
    return ok(c, 'Course created', 201);
  }

  if (method === 'POST' && /^\/courses\/[^/]+\/toggle-price-lock$/.test(path)) {
    assertNotCeoReadOnly(user);
    requireRole(roles, 'COORDINATOR', 'ADMIN');
    const courseId = path.split('/')[2];
    const course = findById(db.courses, courseId);
    if (!course) throw new HttpError('Course not found', 404);
    course.priceUnlocked = body.unlocked !== undefined ? Boolean(body.unlocked) : !Boolean(course.priceUnlocked);
    course.updatedAt = nowIso();
    if (course.priceUnlocked) {
      for (const enr of db.enrollments || []) {
        if (String(enr.courseId) === String(course._id)) {
          enr.priceUnlocked = true;
        }
      }
    }
    const adminIds = db.users.filter((u) => u.primaryRole === 'ADMIN').map((u) => u._id);
    pushNotifications(
      db,
      adminIds,
      {
        type: 'COURSE_PRICE_LOCK',
        category: 'ACADEMY_ENROLMENTS',
        title: `Course Price ${course.priceUnlocked ? 'Unlocked' : 'Locked'}`,
        message: `${user.fullName} ${course.priceUnlocked ? 'unlocked' : 'locked'} catalog pricing for ${course.title}.`,
        link: '/courses',
        actionLabel: 'View Course',
      },
      uid
    );
    appendAudit(db, {
      actor: user,
      action: course.priceUnlocked ? 'UNLOCK_COURSE_PRICE' : 'LOCK_COURSE_PRICE',
      module: 'courses',
      summary: `${course.priceUnlocked ? 'Unlocked' : 'Locked'} catalog fee for ${course.title}`,
    });
    writeDb(db, 'courses', 'updated');
    return ok(course, `Course price ${course.priceUnlocked ? 'unlocked' : 'locked'}`);
  }

  if (method === 'GET' && path === '/courses/materials/all') {
    let list = [...(db.coursematerials || [])];
    if (query.cadence) list = list.filter((m) => m.cadence === query.cadence);
    return ok(
      list.map((m) => ({
        ...m,
        courseId: findById(db.courses, m.courseId),
        uploadedBy: populateUserBrief(db, m.uploadedBy),
      }))
    );
  }

  if (method === 'POST' && /^\/courses\/[^/]+\/materials$/.test(path)) {
    requireRole(roles, 'SUPER_ADMIN', 'ADMIN', 'COORDINATOR', 'MENTOR');
    const courseId = path.split('/')[2];
    const isFd = body instanceof FormData;
    const file = isFd ? body.get('file') : null;
    const fileUrl = file ? await readFileAsDataUrl(file) : '';
    const mat = {
      _id: genId(),
      courseId,
      title: isFd ? body.get('title') : body.title,
      materialType: isFd ? body.get('materialType') : body.materialType || 'DOCUMENT',
      cadence: isFd ? body.get('cadence') : body.cadence || 'WEEKLY',
      periodLabel: isFd ? body.get('periodLabel') : body.periodLabel || 'Week 1',
      content: isFd ? body.get('content') : body.content || '',
      fileName: file?.name || '',
      fileUrl,
      uploadedBy: user._id,
      createdAt: nowIso(),
    };
    db.coursematerials.unshift(mat);
    writeDb(db, 'courses', 'updated');
    return ok(mat, 'Course material uploaded', 201);
  }

  // ========= BATCHES =========
  if (method === 'GET' && path === '/batches') {
    let list = [...(db.batches || [])];
    if (query.courseId) list = list.filter((b) => String(b.courseId) === query.courseId);
    if (user.primaryRole === 'COORDINATOR') {
      const adminIds = new Set(db.users.filter((u) => ['SUPER_ADMIN', 'ADMIN'].includes(u.primaryRole)).map((u) => String(u._id)));
      list = list.filter(
        (b) => !b.coordinatorId || String(b.coordinatorId) === uid || adminIds.has(String(b.coordinatorId))
      );
    } else if (user.primaryRole === 'MENTOR') {
      list = list.filter((b) => (b.mentors || []).some((m) => String(m) === uid));
    }
    return ok(list.map((b) => populateBatch(db, b)));
  }

  if (method === 'POST' && path === '/batches') {
    requireRole(roles, 'SUPER_ADMIN', 'ADMIN', 'COORDINATOR');
    if (new Date(body.endDate) < new Date(body.startDate)) {
      throw new HttpError('Batch end date cannot be earlier than start date', 400);
    }
    const batch = {
      _id: genId(),
      ...body,
      batchCode: String(body.batchCode).toUpperCase(),
      coordinatorId: body.coordinatorId || (user.primaryRole === 'COORDINATOR' ? user._id : null),
      students: [],
      batchStatus: 'ACTIVE',
      progressPercent: Number(body.progressPercent || 0),
      createdAt: nowIso(),
    };
    db.batches.unshift(batch);
    appendAudit(db, {
      actor: user,
      action: 'CREATE_BATCH',
      module: 'batches',
      summary: `Created batch ${batch.batchCode}`,
      notifyCeo: true,
      link: '/batches',
      notifyTitle: `Batch Created (${batch.batchCode})`,
    });
    writeDb(db, 'batches', 'created');
    return ok(populateBatch(db, batch), 'Batch created', 201);
  }

  if (method === 'PATCH' && /^\/batches\/[^/]+$/.test(path)) {
    const batchId = path.split('/')[2];
    const batch = findById(db.batches, batchId);
    if (!batch) throw new HttpError('Batch not found', 404);
    Object.assign(batch, body, { updatedAt: nowIso() });
    writeDb(db, 'batches', 'updated');
    return ok(populateBatch(db, batch), 'Batch updated');
  }

  if (method === 'GET' && /^\/batches\/[^/]+\/enrollments$/.test(path)) {
    const batchId = path.split('/')[2];
    const list = db.enrollments.filter((e) => String(e.batchId) === batchId).map((e) => populateEnrollment(db, e));
    return ok(list);
  }

  // ========= ENROLLMENTS (WITH PERCENTAGE DISCOUNT, COORDINATOR UNLOCK & ADMIN APPROVAL) =========
  if (method === 'GET' && path === '/enrollments') {
    let list = [...(db.enrollments || [])];
    if (query.batchId) list = list.filter((e) => String(e.batchId) === query.batchId);
    if (user.primaryRole === 'STUDENT') {
      const stu = db.students.find((s) => String(s.userId) === uid);
      list = stu ? list.filter((e) => String(e.studentId) === String(stu._id)) : [];
    }
    return ok(list.map((e) => populateEnrollment(db, e, user.primaryRole)));
  }

  if (method === 'POST' && path === '/enrollments') {
    requireRole(roles, 'SUPER_ADMIN', 'ADMIN', 'COORDINATOR', 'STUDENT');
    const isStaff = roles.some((r) => ['SUPER_ADMIN', 'ADMIN', 'COORDINATOR'].includes(r));
    const targetStu = user.primaryRole === 'STUDENT' ? db.students.find((s) => String(s.userId) === uid) : findById(db.students, body.studentId);
    if (!targetStu) throw new HttpError('Courses can only be taken by registered Student accounts', 400);
    const course = findById(db.courses, body.courseId);
    if (!course) throw new HttpError('Course not found', 404);
    if (body.batchId) validateBatchCap(db, body.batchId, course._id);

    const dup = db.enrollments.find(
      (e) => String(e.studentId) === String(targetStu._id) && String(e.courseId) === String(course._id) && !['CANCELLED', 'DROPPED'].includes(e.status)
    );
    if (dup) throw new HttpError('Student is already enrolled or pending in this course', 409);

    const originalFee = Number(course.fee?.amount || 0);
    const discountPercent = isStaff ? Math.min(100, Math.max(0, Number(body.discountPercent ?? body.discount ?? 0))) : 0;
    const discount = Number(((originalFee * discountPercent) / 100).toFixed(2));
    const scholarship = isStaff ? Math.max(0, Number(body.scholarship || 0)) : 0;
    const finalFee = Math.max(0, Number((originalFee - discount - scholarship).toFixed(2)));

    const enrollmentNumber = nextSeqCode(db.enrollments, 'enrollmentNumber', 'ENR');
    const enr = {
      _id: genId(),
      enrollmentNumber,
      studentId: targetStu._id,
      courseId: course._id,
      batchId: body.batchId || null,
      priceUnlocked: isStaff ? true : Boolean(course.priceUnlocked),
      feeDetails: { originalFee, discountPercent, discount, scholarship, finalFee, currency: 'INR' },
      paymentStatus: finalFee === 0 && isStaff ? 'PAID' : 'PENDING',
      progressPercent: 0,
      enrolledAt: nowIso(),
      status: isStaff ? 'APPROVED' : 'PENDING_REVIEW',
      approvedBy: isStaff ? user._id : null,
      approvedAt: isStaff ? nowIso() : null,
      createdAt: nowIso(),
    };
    db.enrollments.unshift(enr);

    if (isStaff) {
      targetStu.studentStatus = 'ENROLLED';
      if (enr.batchId) {
        const b = findById(db.batches, enr.batchId);
        if (b) {
          b.students = b.students || [];
          if (!b.students.some((id) => String(id) === String(targetStu._id))) b.students.push(targetStu._id);
        }
      }
      db.invoices.unshift({
        _id: genId(),
        invoiceNumber: nextSeqCode(db.invoices, 'invoiceNumber', 'INV'),
        studentId: targetStu._id,
        enrollmentId: enr._id,
        totalAmount: finalFee,
        paidAmount: 0,
        dueAmount: finalFee,
        dueDate: new Date(Date.now() + 14 * 86400000).toISOString(),
        status: finalFee === 0 ? 'PAID' : 'PENDING',
        createdAt: nowIso(),
      });
    } else {
      const adminIds = db.users
        .filter((u) => ['ADMIN', 'SUPER_ADMIN'].includes(u.primaryRole))
        .map((u) => u._id);
      const coordIds = db.users.filter((u) => u.primaryRole === 'COORDINATOR').map((u) => u._id);
      pushNotifications(
        db,
        adminIds,
        {
          type: 'NEW_ENROLLMENT',
          category: 'ACADEMY_ENROLMENTS',
          title: 'Student Course Enrolment — Admin / Super Admin Approval Needed',
          message: `${user.fullName} requested enrolment in ${course.title} (${enrollmentNumber}).`,
          link: '/enrollments',
          actionLabel: 'Review & Approve',
        },
        uid,
        { includeCeo: false }
      );
      pushNotifications(
        db,
        coordIds,
        {
          type: 'COORDINATOR_MONITOR_ENROLLMENT',
          category: 'ACADEMY_ENROLMENTS',
          title: 'Monitor Student Course Request & Unlock Fee',
          message: `${user.fullName} requested ${course.title}. Monitor progress and unlock course price when ready.`,
          link: '/enrollments',
          actionLabel: 'Monitor Request',
        },
        uid,
        { includeCeo: false }
      );
    }

    appendAudit(db, { actor: user, action: 'CREATE_ENROLLMENT', module: 'enrollments', summary: `Created ${enrollmentNumber} for ${course.title}` });
    writeDb(db, 'enrollments', 'created');
    return ok(populateEnrollment(db, enr, user.primaryRole), 'Enrolment submitted', 201);
  }

  if (method === 'PATCH' && /^\/enrollments\/[^/]+$/.test(path)) {
    assertNotCeoReadOnly(user);
    requireRole(roles, 'ADMIN', 'COORDINATOR');
    const enr = findById(db.enrollments, path.split('/')[2]);
    if (!enr) throw new HttpError('Enrolment not found', 404);
    if (body.batchId !== undefined) {
      if (body.batchId) {
        const b = validateBatchCap(db, body.batchId, enr.courseId, enr._id);
        b.students = b.students || [];
        if (!b.students.some((id) => String(id) === String(enr.studentId))) b.students.push(enr.studentId);
      }
      if (enr.batchId && String(enr.batchId) !== String(body.batchId || '')) {
        const prevB = findById(db.batches, enr.batchId);
        if (prevB) prevB.students = (prevB.students || []).filter((id) => String(id) !== String(enr.studentId));
      }
      enr.batchId = body.batchId || null;
    }
    if (body.discountPercent !== undefined || body.scholarship !== undefined) {
      const orig = Number(enr.feeDetails?.originalFee || 0);
      const pct = body.discountPercent !== undefined ? Math.min(100, Math.max(0, Number(body.discountPercent))) : Number(enr.feeDetails?.discountPercent || 0);
      const schol = body.scholarship !== undefined ? Math.max(0, Number(body.scholarship)) : Number(enr.feeDetails?.scholarship || 0);
      const disc = Number(((orig * pct) / 100).toFixed(2));
      const fin = Math.max(0, Number((orig - disc - schol).toFixed(2)));
      enr.feeDetails = { originalFee: orig, discountPercent: pct, discount: disc, scholarship: schol, finalFee: fin, currency: 'INR' };
      const inv = db.invoices.find((i) => String(i.enrollmentId) === String(enr._id));
      if (inv) {
        inv.totalAmount = fin;
        inv.dueAmount = Math.max(0, Number((fin - Number(inv.paidAmount || 0)).toFixed(2)));
        inv.status = inv.dueAmount === 0 ? 'PAID' : inv.paidAmount > 0 ? 'PARTIALLY_PAID' : 'PENDING';
      }
    }
    if (body.status) enr.status = body.status;
    if (body.progressPercent !== undefined) enr.progressPercent = Number(body.progressPercent);
    writeDb(db, 'enrollments', 'updated');
    return ok(populateEnrollment(db, enr, user.primaryRole), 'Enrolment updated');
  }

  if (method === 'PATCH' && /^\/enrollments\/[^/]+\/kanban-stage$/.test(path)) {
    assertNotCeoReadOnly(user);
    requireRole(roles, 'COORDINATOR', 'ADMIN');
    const enr = findById(db.enrollments, path.split('/')[2]);
    if (!enr) throw new HttpError('Enrolment not found', 404);
    const allowedStages = ['NEW_INQUIRY', 'FEE_UNLOCKED', 'COUNSELING_SESSION', 'ADMIN_APPROVAL', 'ENROLLED'];
    if (!allowedStages.includes(body.kanbanStage)) {
      throw new HttpError('Invalid Kanban workflow stage', 400);
    }
    enr.kanbanStage = body.kanbanStage;
    if (body.sessionId !== undefined) enr.enrollmentSessionId = body.sessionId || null;
    if (['FEE_UNLOCKED', 'COUNSELING_SESSION', 'ADMIN_APPROVAL', 'ENROLLED'].includes(body.kanbanStage)) {
      enr.priceUnlocked = true;
    }
    enr.updatedAt = nowIso();
    appendAudit(db, {
      actor: user,
      action: 'UPDATE_ENROLLMENT_KANBAN',
      module: 'enrollments',
      summary: `Moved ${enr.enrollmentNumber} to ${body.kanbanStage}`,
    });
    writeDb(db, 'enrollments', 'updated');
    return ok(populateEnrollment(db, enr, user.primaryRole), `Candidate moved to ${body.kanbanStage.replace(/_/g, ' ')}`);
  }

  if (method === 'GET' && path === '/coordinator/enrollment-sessions') {
    requireRole(roles, 'SUPER_ADMIN', 'ADMIN', 'COORDINATOR');
    const list = (db.enrollmentsessions || []).map((s) => ({
      ...s,
      courseId: s.courseId ? findById(db.courses, s.courseId) : null,
      batchId: s.batchId ? findById(db.batches, s.batchId) : null,
      coordinator: s.coordinatorId ? populateUserBrief(db, s.coordinatorId) : null,
    }));
    return ok(list);
  }

  if (method === 'POST' && path === '/coordinator/enrollment-sessions') {
    assertNotCeoReadOnly(user);
    requireRole(roles, 'COORDINATOR', 'ADMIN');
    db.enrollmentsessions = db.enrollmentsessions || [];
    const session = {
      _id: genId(),
      sessionCode: nextSeqCode(db.enrollmentsessions, 'sessionCode', 'ESN'),
      title: String(body.title || '').trim(),
      courseId: body.courseId || null,
      batchId: body.batchId || null,
      scheduledDate: body.scheduledDate || nowIso().slice(0, 10),
      timeSlot: body.timeSlot || '10:00 AM - 11:00 AM',
      mode: body.mode || 'ONLINE',
      status: 'SCHEDULED',
      notes: String(body.notes || '').trim(),
      coordinatorId: user._id,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    if (!session.title) throw new HttpError('Session title is required', 400);
    db.enrollmentsessions.unshift(session);
    appendAudit(db, {
      actor: user,
      action: 'CREATE_ENROLLMENT_SESSION',
      module: 'enrollments',
      summary: `Scheduled enrollment session ${session.sessionCode}: ${session.title}`,
    });
    writeDb(db, 'enrollments', 'created');
    return ok(session, 'Enrollment session created', 201);
  }

  if (method === 'PATCH' && /^\/coordinator\/enrollment-sessions\/[^/]+$/.test(path)) {
    assertNotCeoReadOnly(user);
    requireRole(roles, 'COORDINATOR', 'ADMIN');
    const session = findById(db.enrollmentsessions, path.split('/')[3]);
    if (!session) throw new HttpError('Enrollment session not found', 404);
    if (body.status) session.status = body.status;
    if (body.title !== undefined) session.title = String(body.title).trim();
    if (body.scheduledDate !== undefined) session.scheduledDate = body.scheduledDate;
    if (body.timeSlot !== undefined) session.timeSlot = body.timeSlot;
    if (body.mode !== undefined) session.mode = body.mode;
    if (body.notes !== undefined) session.notes = String(body.notes).trim();
    session.updatedAt = nowIso();
    writeDb(db, 'enrollments', 'updated');
    return ok(session, 'Enrollment session updated');
  }

  if (method === 'POST' && /^\/enrollments\/[^/]+\/unlock-price$/.test(path)) {
    assertNotCeoReadOnly(user);
    requireRole(roles, 'COORDINATOR', 'ADMIN');
    const enr = findById(db.enrollments, path.split('/')[2]);
    if (!enr) throw new HttpError('Enrolment not found', 404);
    enr.priceUnlocked = true;
    enr.priceUnlockedBy = user._id;
    enr.priceUnlockedAt = nowIso();
    if (body?.discountPercent !== undefined || body?.scholarship !== undefined) {
      const orig = Number(enr.feeDetails?.originalFee || 0);
      const pct = body.discountPercent !== undefined ? Math.min(100, Math.max(0, Number(body.discountPercent))) : Number(enr.feeDetails?.discountPercent || 0);
      const schol = body.scholarship !== undefined ? Math.max(0, Number(body.scholarship)) : Number(enr.feeDetails?.scholarship || 0);
      const disc = Number(((orig * pct) / 100).toFixed(2));
      const fin = Math.max(0, Number((orig - disc - schol).toFixed(2)));
      enr.feeDetails = { originalFee: orig, discountPercent: pct, discount: disc, scholarship: schol, finalFee: fin, currency: 'INR' };
    }
    const course = findById(db.courses, enr.courseId);
    const stu = findById(db.students, enr.studentId);
    const stuUser = stu ? findById(db.users, stu.userId) : null;
    const adminIds = db.users.filter((u) => u.primaryRole === 'ADMIN').map((u) => u._id);
    pushNotifications(
      db,
      [...(stuUser ? [stuUser._id] : []), ...adminIds],
      {
        type: 'ENROLLMENT_PRICE_UNLOCKED',
        category: 'ACADEMY_ENROLMENTS',
        title: `Course Price Unlocked (${enr.enrollmentNumber})`,
        message: `Course Coordinator ${user.fullName} unlocked fee visibility for ${course?.title || 'course'} (${stuUser?.fullName || 'Student'}).`,
        link: '/enrollments',
        actionLabel: 'View Enrolment',
      },
      uid
    );
    appendAudit(db, { actor: user, action: 'UNLOCK_ENROLLMENT_PRICE', module: 'enrollments', summary: `Unlocked course fee for ${enr.enrollmentNumber}` });
    writeDb(db, 'enrollments', 'updated');
    return ok(populateEnrollment(db, enr, user.primaryRole), 'Course price unlocked for student request');
  }

  if (method === 'POST' && /^\/enrollments\/[^/]+\/approve$/.test(path)) {
    requireRole(roles, 'ADMIN', 'SUPER_ADMIN');
    const enr = findById(db.enrollments, path.split('/')[2]);
    if (!enr) throw new HttpError('Enrolment not found', 404);
    const chosenBatchId = body?.batchId || enr.batchId;
    if (chosenBatchId) {
      const b = validateBatchCap(db, chosenBatchId, enr.courseId, enr._id);
      enr.batchId = b._id;
      b.students = b.students || [];
      if (!b.students.some((id) => String(id) === String(enr.studentId))) b.students.push(enr.studentId);
    }
    enr.status = 'ACTIVE';
    enr.priceUnlocked = true;
    enr.approvedBy = user._id;
    enr.approvedAt = nowIso();
    const stu = findById(db.students, enr.studentId);
    if (stu) stu.studentStatus = 'ACTIVE';
    if (!db.invoices.some((i) => String(i.enrollmentId) === String(enr._id))) {
      db.invoices.unshift({
        _id: genId(),
        invoiceNumber: nextSeqCode(db.invoices, 'invoiceNumber', 'INV'),
        studentId: enr.studentId,
        enrollmentId: enr._id,
        totalAmount: enr.feeDetails.finalFee,
        paidAmount: 0,
        dueAmount: enr.feeDetails.finalFee,
        dueDate: new Date(Date.now() + 14 * 86400000).toISOString(),
        status: enr.feeDetails.finalFee === 0 ? 'PAID' : 'PENDING',
        createdAt: nowIso(),
      });
    }
    const course = findById(db.courses, enr.courseId);
    const stuUser = stu ? findById(db.users, stu.userId) : null;
    const coordIds = db.users.filter((u) => u.primaryRole === 'COORDINATOR').map((u) => u._id);
    pushNotifications(
      db,
      [...(stuUser ? [stuUser._id] : []), ...coordIds],
      {
        type: 'ENROLLMENT_APPROVED',
        category: 'ACADEMY_ENROLMENTS',
        title: `Enrolment Approved (${enr.enrollmentNumber})`,
        message: `Admin ${user.fullName} approved ${stuUser?.fullName || 'Student'} for ${course?.title || 'course'}.`,
        link: '/enrollments',
        actionLabel: 'View Enrolment',
      },
      uid
    );
    appendAudit(db, { actor: user, action: 'APPROVE_ENROLLMENT', module: 'enrollments', summary: `Approved ${enr.enrollmentNumber}` });
    writeDb(db, 'enrollments', 'updated');
    return ok(populateEnrollment(db, enr, user.primaryRole), 'Enrolment approved by Admin');
  }

  if (method === 'POST' && /^\/enrollments\/[^/]+\/reject$/.test(path)) {
    requireRole(roles, 'ADMIN', 'SUPER_ADMIN');
    const enr = findById(db.enrollments, path.split('/')[2]);
    if (!enr) throw new HttpError('Enrolment not found', 404);
    enr.status = 'CANCELLED';
    enr.rejectedBy = user._id;
    enr.rejectedAt = nowIso();
    const stu = findById(db.students, enr.studentId);
    const stuUser = stu ? findById(db.users, stu.userId) : null;
    const coordIds = db.users.filter((u) => u.primaryRole === 'COORDINATOR').map((u) => u._id);
    pushNotifications(
      db,
      [...(stuUser ? [stuUser._id] : []), ...coordIds],
      {
        type: 'ENROLLMENT_REJECTED',
        category: 'ACADEMY_ENROLMENTS',
        title: `Enrolment Declined (${enr.enrollmentNumber})`,
        message: `Admin ${user.fullName} declined ${stuUser?.fullName || 'Student'}'s enrolment request.`,
        link: '/enrollments',
        actionLabel: 'View Status',
      },
      uid
    );
    appendAudit(db, { actor: user, action: 'REJECT_ENROLLMENT', module: 'enrollments', summary: `Declined ${enr.enrollmentNumber}` });
    writeDb(db, 'enrollments', 'updated');
    return ok(populateEnrollment(db, enr, user.primaryRole), 'Enrolment declined');
  }

  // ========= ATTENDANCE =========
  if (method === 'GET' && path === '/attendance/students') {
    let list = [...(db.studentattendances || [])];
    if (query.batchId) list = list.filter((a) => String(a.batchId) === query.batchId);
    if (user.primaryRole === 'STUDENT') {
      const stu = db.students.find((s) => String(s.userId) === uid);
      list = stu ? list.filter((a) => String(a.studentId) === String(stu._id)) : [];
    }
    return ok(
      list.map((a) => ({
        ...a,
        studentId: populateStudent(db, a.studentId),
        batchId: findById(db.batches, a.batchId),
      }))
    );
  }

  if (method === 'POST' && path === '/attendance/students/mark') {
    requireRole(roles, 'SUPER_ADMIN', 'ADMIN', 'COORDINATOR', 'MENTOR');
    const sessionDate = String(body.sessionDate || nowIso()).slice(0, 10);
    for (const r of body.records || []) {
      const existing = db.studentattendances.find(
        (a) =>
          String(a.batchId) === String(body.batchId) &&
          String(a.studentId) === String(r.studentId) &&
          String(a.sessionDate).slice(0, 10) === sessionDate
      );
      if (existing) {
        existing.status = r.status;
        existing.markedBy = user._id;
      } else {
        db.studentattendances.unshift({
          _id: genId(),
          batchId: body.batchId,
          studentId: r.studentId,
          sessionDate,
          status: r.status,
          markedBy: user._id,
          createdAt: nowIso(),
        });
      }
    }
    writeDb(db, 'attendance', 'updated');
    return ok({ marked: (body.records || []).length }, 'Attendance marked');
  }

  // ========= FINANCE =========
  if (method === 'GET' && path === '/finance/invoices') {
    let list = [...(db.invoices || [])];
    if (user.primaryRole === 'STUDENT') {
      const stu = db.students.find((s) => String(s.userId) === uid);
      list = stu ? list.filter((i) => String(i.studentId) === String(stu._id)) : [];
    }
    return ok(
      list.map((inv) => {
        const enr = findById(db.enrollments, inv.enrollmentId);
        return {
          ...inv,
          studentId: populateStudent(db, inv.studentId),
          enrollmentId: enr ? { ...enr, courseId: findById(db.courses, enr.courseId) } : null,
        };
      })
    );
  }

  if (method === 'GET' && path === '/finance/payments') {
    let list = [...(db.payments || [])];
    if (user.primaryRole === 'STUDENT') {
      const stu = db.students.find((s) => String(s.userId) === uid);
      list = stu ? list.filter((p) => String(p.studentId) === String(stu._id)) : [];
    }
    return ok(
      list.map((p) => ({
        ...p,
        studentId: populateStudent(db, p.studentId),
        invoiceId: findById(db.invoices, p.invoiceId),
      }))
    );
  }

  if (method === 'POST' && path === '/finance/payments') {
    const inv = body.invoiceId
      ? findById(db.invoices, body.invoiceId)
      : db.invoices.find((i) => String(i.enrollmentId) === String(body.enrollmentId));
    if (!inv) throw new HttpError('Invoice not found', 404);
    const isDirectStaffPay = ['SUPER_ADMIN', 'ADMIN', 'COORDINATOR'].includes(user.primaryRole);
    const amount = Number(body.amount || inv.dueAmount || 0);
    const p = {
      _id: genId(),
      paymentNumber: nextSeqCode(db.payments, 'paymentNumber', 'PAY'),
      studentId: inv.studentId,
      enrollmentId: inv.enrollmentId,
      invoiceId: inv._id,
      amount,
      paymentMethod: body.paymentMethod || 'UPI',
      transactionReference: body.transactionReference || `TXN-${Date.now()}`,
      notes: body.notes || '',
      paymentStatus: isDirectStaffPay ? 'VERIFIED' : 'PENDING_VERIFICATION',
      verifiedBy: isDirectStaffPay ? user._id : null,
      verifiedAt: isDirectStaffPay ? nowIso() : null,
      paidAt: nowIso(),
      createdAt: nowIso(),
    };
    db.payments.unshift(p);

    if (isDirectStaffPay) {
      inv.paidAmount = Number((Number(inv.paidAmount || 0) + amount).toFixed(2));
      inv.dueAmount = Math.max(0, Number((Number(inv.totalAmount) - inv.paidAmount).toFixed(2)));
      inv.status = inv.dueAmount === 0 ? 'PAID' : 'PARTIALLY_PAID';
      const enr = findById(db.enrollments, inv.enrollmentId);
      if (enr) {
        enr.paymentStatus = inv.dueAmount === 0 ? 'PAID' : 'PARTIALLY_PAID';
        if (enr.status === 'PENDING_REVIEW') enr.status = 'ACTIVE';
      }
      const stu = findById(db.students, inv.studentId);
      if (stu?.userId) {
        pushNotifications(
          db,
          [stu.userId],
          {
            type: 'PAYMENT_VERIFIED',
            category: 'FINANCE_APPROVALS',
            title: `Payment Updated (${p.paymentNumber})`,
            message: `Your payment of INR ${amount} has been recorded and verified. Status: ${inv.status}.`,
            link: '/finance',
            actionLabel: 'View Invoice',
          },
          uid,
          { includeCeo: false }
        );
      }
    } else {
      const reviewers = db.users
        .filter((u) => ['SUPER_ADMIN', 'ADMIN', 'COORDINATOR'].includes(u.primaryRole))
        .map((u) => u._id);
      pushNotifications(
        db,
        reviewers,
        {
          type: 'PAYMENT_SUBMITTED',
          category: 'FINANCE_APPROVALS',
          title: `Payment Verification Needed (${p.paymentNumber})`,
          message: `${user.fullName} submitted INR ${amount} (${p.paymentMethod}) for ${inv.invoiceNumber}.`,
          link: '/finance',
          actionLabel: 'Verify Payment',
        },
        uid,
        { includeCeo: false }
      );
    }
    writeDb(db, 'finance', 'created');
    writeDb(db, 'enrollments', 'updated');
    return ok(p, isDirectStaffPay ? 'Payment recorded and updated' : 'Payment recorded', 201);
  }

  if (method === 'POST' && path === '/finance/issue-amount') {
    requireRole(roles, 'COORDINATOR', 'ADMIN', 'SUPER_ADMIN');
    const stu = findById(db.students, body.studentId);
    if (!stu) throw new HttpError('Selected registered student not found', 404);
    const amount = Number(body.amount || 0);
    if (amount <= 0) throw new HttpError('Amount must be greater than zero', 400);
    const issueMode = body.issueMode || 'RECORD_PAID';
    const paymentMethod = body.paymentMethod || 'UPI';
    const stuUser = findById(db.users, stu.userId);

    let inv = body.invoiceId ? findById(db.invoices, body.invoiceId) : null;
    if (!inv) {
      inv = {
        _id: genId(),
        invoiceNumber: nextSeqCode(db.invoices, 'invoiceNumber', 'INV'),
        studentId: stu._id,
        enrollmentId: body.enrollmentId || null,
        totalAmount: amount,
        paidAmount: issueMode === 'RECORD_PAID' ? amount : 0,
        dueAmount: issueMode === 'RECORD_PAID' ? 0 : amount,
        dueDate: body.dueDate || new Date(Date.now() + 14 * 86400000).toISOString(),
        status: issueMode === 'RECORD_PAID' ? 'PAID' : 'PENDING',
        notes: body.notes || '',
        createdAt: nowIso(),
      };
      db.invoices.unshift(inv);
    } else if (issueMode === 'RECORD_PAID') {
      inv.paidAmount = Number((Number(inv.paidAmount || 0) + amount).toFixed(2));
      inv.dueAmount = Math.max(0, Number((Number(inv.totalAmount) - inv.paidAmount).toFixed(2)));
      inv.status = inv.dueAmount === 0 ? 'PAID' : 'PARTIALLY_PAID';
    }

    let payment = null;
    if (issueMode === 'RECORD_PAID') {
      payment = {
        _id: genId(),
        paymentNumber: nextSeqCode(db.payments, 'paymentNumber', 'PAY'),
        studentId: stu._id,
        enrollmentId: inv.enrollmentId || null,
        invoiceId: inv._id,
        amount,
        paymentMethod,
        transactionReference: body.transactionReference || `TXN-${Date.now().toString().slice(-6)}`,
        notes: body.notes || '',
        paymentStatus: 'VERIFIED',
        verifiedBy: user._id,
        verifiedAt: nowIso(),
        paidAt: nowIso(),
        createdAt: nowIso(),
      };
      db.payments.unshift(payment);
      if (inv.enrollmentId) {
        const enr = findById(db.enrollments, inv.enrollmentId);
        if (enr) {
          enr.paymentStatus = inv.dueAmount === 0 ? 'PAID' : 'PARTIALLY_PAID';
          if (enr.status === 'PENDING_REVIEW') enr.status = 'ACTIVE';
        }
      }
    }

    if (stuUser?._id) {
      pushNotifications(
        db,
        [stuUser._id],
        {
          type: issueMode === 'RECORD_PAID' ? 'PAYMENT_VERIFIED' : 'INVOICE_ISSUED',
          category: 'FINANCE_APPROVALS',
          title:
            issueMode === 'RECORD_PAID'
              ? `Transaction Recorded (${payment.paymentNumber})`
              : `Fee Invoice Issued (${inv.invoiceNumber})`,
          message:
            issueMode === 'RECORD_PAID'
              ? `${user.fullName} recorded INR ${amount} via ${paymentMethod} for ${inv.invoiceNumber}.`
              : `${user.fullName} issued a fee invoice of INR ${amount} (${inv.invoiceNumber}).`,
          link: '/finance',
          actionLabel: 'View Finance',
        },
        uid,
        { includeCeo: false }
      );
    }
    appendAudit(db, {
      actor: user,
      action: issueMode === 'RECORD_PAID' ? 'ISSUE_PAYMENT' : 'ISSUE_INVOICE',
      module: 'finance',
      summary: `${user.fullName} issued ${issueMode === 'RECORD_PAID' ? `${paymentMethod} payment` : 'invoice'} of INR ${amount} for ${stuUser?.fullName || stu.studentId}`,
    });
    writeDb(db, 'finance', 'created');
    writeDb(db, 'enrollments', 'updated');
    return ok({ invoice: inv, payment }, 'Transaction issued successfully', 201);
  }

  if (method === 'POST' && /^\/finance\/payments\/[^/]+\/verify$/.test(path)) {
    requireRole(roles, 'SUPER_ADMIN', 'ADMIN', 'COORDINATOR');
    const pay = findById(db.payments, path.split('/')[3]);
    if (!pay) throw new HttpError('Payment not found', 404);
    const isVerified = ['VERIFY', 'VERIFIED'].includes(String(body.decision || '').toUpperCase());
    pay.paymentStatus = isVerified ? 'VERIFIED' : 'FAILED';
    pay.verifiedBy = user._id;
    pay.verifiedAt = nowIso();
    if (isVerified) {
      const inv = findById(db.invoices, pay.invoiceId);
      if (inv) {
        inv.paidAmount = Number((Number(inv.paidAmount || 0) + Number(pay.amount || 0)).toFixed(2));
        inv.dueAmount = Math.max(0, Number((Number(inv.totalAmount) - inv.paidAmount).toFixed(2)));
        inv.status = inv.dueAmount === 0 ? 'PAID' : 'PARTIALLY_PAID';
      }
      const enr = findById(db.enrollments, pay.enrollmentId);
      if (enr && inv) {
        enr.paymentStatus = inv.dueAmount === 0 ? 'PAID' : 'PARTIALLY_PAID';
        if (enr.status === 'PENDING_REVIEW') enr.status = 'ACTIVE';
      }
      const stu = findById(db.students, pay.studentId);
      if (stu?.userId) {
        pushNotifications(
          db,
          [stu.userId],
          {
            type: 'PAYMENT_VERIFIED',
            category: 'FINANCE_APPROVALS',
            title: `Payment Verified (${pay.paymentNumber})`,
            message: `Your payment of INR ${pay.amount} was verified. Invoice status: ${inv?.status || 'PAID'}.`,
            link: '/finance',
            actionLabel: 'View Invoice',
          },
          uid,
          { includeCeo: false }
        );
      }
    }
    appendAudit(db, {
      actor: user,
      action: 'VERIFY_PAYMENT',
      module: 'finance',
      summary: `${pay.paymentNumber} marked ${pay.paymentStatus}`,
      notifyCeo: true,
      link: '/finance',
      notifyTitle: `Payment ${pay.paymentStatus} (${pay.paymentNumber})`,
    });
    writeDb(db, 'finance', 'updated');
    writeDb(db, 'enrollments', 'updated');
    return ok(pay, 'Payment verification saved');
  }

  if (method === 'GET' && path === '/finance/expenses') {
    return ok((db.expenses || []).map((e) => ({ ...e, requestedBy: populateUserBrief(db, e.requestedBy) })));
  }

  if (method === 'POST' && path === '/finance/expenses') {
    requireRole(roles, 'SUPER_ADMIN', 'ADMIN', 'COORDINATOR');
    const exp = {
      _id: genId(),
      expenseNumber: nextSeqCode(db.expenses, 'expenseNumber', 'EXP'),
      ...body,
      amount: Number(body.amount),
      approvalStatus: 'PENDING',
      requestedBy: user._id,
      expenseDate: nowIso(),
      createdAt: nowIso(),
    };
    db.expenses.unshift(exp);
    writeDb(db, 'finance', 'created');
    return ok(exp, 'Expense submitted', 201);
  }

  if (method === 'POST' && /^\/finance\/expenses\/[^/]+\/approve$/.test(path)) {
    requireRole(roles, 'SUPER_ADMIN', 'ADMIN');
    const exp = findById(db.expenses, path.split('/')[3]);
    if (!exp) throw new HttpError('Expense not found', 404);
    exp.approvalStatus = ['APPROVE', 'APPROVED'].includes(String(body.decision || '').toUpperCase()) ? 'APPROVED' : 'REJECTED';
    exp.approvedBy = user._id;
    writeDb(db, 'finance', 'updated');
    return ok(exp, 'Expense updated');
  }

  // ---- DUE AMOUNT REQUEST HIERARCHY (Mentor -> Coordinator -> Admin / Super Admin -> Coordinator -> Student) ----
  if (method === 'GET' && path === '/finance/due-requests') {
    const role = user.primaryRole;
    let list = [...(db.duerequests || [])];
    if (role === 'STUDENT') {
      list = list.filter((r) => String(r.applicantUserId) === uid);
    } else if (role === 'MENTOR') {
      list = list.filter((r) => !r.assignedMentorId || String(r.assignedMentorId) === uid);
    }
    const hydrated = list.map((r) => {
      const inv = findById(db.invoices, r.invoiceId);
      const mentor = r.assignedMentorId ? findById(db.users, r.assignedMentorId) : null;
      return {
        ...r,
        invoiceNumber: r.invoiceNumber || inv?.invoiceNumber || '',
        currentDueAmount: inv ? Number(inv.dueAmount || 0) : Number(r.currentDueAmount || 0),
        assignedMentorName: mentor?.fullName || (r.assignedMentorId ? 'Assigned Mentor' : 'Any Mentor'),
      };
    });
    return ok(hydrated);
  }

  if (method === 'POST' && path === '/finance/due-requests') {
    requireRole(roles, 'STUDENT', 'ADMIN', 'COORDINATOR');
    const inv = findById(db.invoices, body.invoiceId);
    if (!inv) throw new HttpError('Invoice not found', 404);
    if (Number(inv.dueAmount || 0) <= 0) {
      throw new HttpError('This invoice has no remaining due amount', 400);
    }
    if (user.primaryRole === 'STUDENT') {
      const stu = db.students.find((s) => String(s.userId) === uid);
      if (!stu || String(inv.studentId) !== String(stu._id)) {
        throw new HttpError('You can only raise due amount requests for your own invoices', 403);
      }
    }
    const enr = findById(db.enrollments, inv.enrollmentId);
    const course = enr ? findById(db.courses, enr.courseId) : null;
    const stu = findById(db.students, inv.studentId);
    const applicantUser = stu ? findById(db.users, stu.userId) : user;

    const dueReq = {
      _id: genId(),
      requestCode: nextSeqCode(db.duerequests, 'requestCode', 'DUE'),
      invoiceId: inv._id,
      invoiceNumber: inv.invoiceNumber,
      enrollmentId: inv.enrollmentId,
      studentId: inv.studentId,
      applicantUserId: applicantUser?._id || user._id,
      applicantName: applicantUser?.fullName || user.fullName,
      courseTitle: course?.title || 'Course Fee',
      totalInvoiceAmount: Number(inv.totalAmount || 0),
      currentDueAmount: Number(inv.dueAmount || 0),
      requestedAmount: Number(body.requestedAmount || inv.dueAmount || 0),
      requestType: body.requestType || 'DUE_EXTENSION',
      proposedDate: body.proposedDate || '',
      reason: String(body.reason || '').trim(),
      assignedMentorId: body.assignedMentorId || null,
      status: 'Pending Mentor',
      finalStatus: 'PENDING',
      decisionOutcome: null,
      decisionByRole: null,
      decisionByName: null,
      history: [
        {
          step: 'Submitted',
          actorId: user._id,
          actorName: user.fullName,
          actorRole: user.primaryRole,
          action: 'SUBMITTED',
          remarks: 'Submitted by Student to Mentor',
          timestamp: nowIso(),
        },
      ],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    if (!dueReq.reason) {
      throw new HttpError('Please provide a reason for the due amount request', 400);
    }
    db.duerequests = db.duerequests || [];
    db.duerequests.unshift(dueReq);

    const mentorTargets = dueReq.assignedMentorId
      ? [dueReq.assignedMentorId]
      : db.users.filter((u) => u.primaryRole === 'MENTOR' && u.status === 'ACTIVE').map((u) => u._id);
    pushNotifications(
      db,
      mentorTargets,
      {
        type: 'DUE_REQUEST_SUBMITTED',
        category: 'FINANCE_APPROVALS',
        title: `New Due Amount Request (${dueReq.requestCode})`,
        message: `${dueReq.applicantName} submitted a due request for ${dueReq.invoiceNumber} (₹${dueReq.requestedAmount}).`,
        link: '/finance',
        actionLabel: 'Review Due Request',
      },
      uid,
      { includeCeo: false }
    );
    appendAudit(db, {
      actor: user,
      action: 'SUBMIT_DUE_REQUEST',
      module: 'finance',
      summary: `${dueReq.applicantName} submitted due request ${dueReq.requestCode} (${dueReq.invoiceNumber}) -> Pending Mentor`,
    });
    writeDb(db, 'finance', 'created');
    return ok(dueReq, 'Due amount request submitted to Mentor', 201);
  }

  if (method === 'POST' && /^\/finance\/due-requests\/[^/]+\/transition$/.test(path)) {
    const reqId = path.split('/')[3];
    const dueReq = findById(db.duerequests, reqId);
    if (!dueReq) throw new HttpError('Due amount request not found', 404);

    const action = body.action;
    const remarks = String(body.remarks || '').trim();
    const role = user.primaryRole;
    dueReq.history = dueReq.history || [];

    if (action === 'FORWARD_TO_COORDINATOR') {
      if (role !== 'MENTOR' || dueReq.status !== 'Pending Mentor') {
        throw new HttpError('Only Mentor can forward a Pending Mentor due request to Coordinator', 403);
      }
      dueReq.status = 'Pending Coordinator';
      dueReq.history.push({
        step: 'Mentor Forwarded',
        actorId: user._id,
        actorName: user.fullName,
        actorRole: role,
        action,
        remarks: remarks || 'Forwarded by Mentor to Course Coordinator',
        timestamp: nowIso(),
      });
      const coordIds = db.users.filter((u) => u.primaryRole === 'COORDINATOR' && u.status === 'ACTIVE').map((u) => u._id);
      pushNotifications(
        db,
        coordIds,
        {
          type: 'DUE_REQUEST_FORWARDED',
          category: 'FINANCE_APPROVALS',
          title: `Due Request Forwarded (${dueReq.requestCode})`,
          message: `Mentor ${user.fullName} forwarded ${dueReq.applicantName}'s due request to Coordinator.`,
          link: '/finance',
          actionLabel: 'Review Due Request',
        },
        uid,
        { includeCeo: false }
      );
    } else if (action === 'FORWARD_TO_ADMIN') {
      if (role !== 'COORDINATOR' || dueReq.status !== 'Pending Coordinator') {
        throw new HttpError('Only Coordinator can forward a Pending Coordinator due request to Admin / Super Admin', 403);
      }
      dueReq.status = 'Pending Admin';
      dueReq.history.push({
        step: 'Coordinator Forwarded',
        actorId: user._id,
        actorName: user.fullName,
        actorRole: role,
        action,
        remarks: remarks || 'Forwarded by Coordinator to Admin / Super Admin',
        timestamp: nowIso(),
      });
      const adminIds = db.users
        .filter((u) => ['ADMIN', 'SUPER_ADMIN'].includes(u.primaryRole) && u.status === 'ACTIVE')
        .map((u) => u._id);
      pushNotifications(
        db,
        adminIds,
        {
          type: 'DUE_REQUEST_PENDING_APPROVAL',
          category: 'FINANCE_APPROVALS',
          title: `Due Request Awaiting Approval (${dueReq.requestCode})`,
          message: `Coordinator ${user.fullName} forwarded ${dueReq.applicantName}'s due request (${dueReq.invoiceNumber}) for Admin/Super Admin decision.`,
          link: '/finance',
          actionLabel: 'Approve / Reject',
        },
        uid
      );
    } else if (action === 'FORWARD_TO_SUPER_ADMIN') {
      if (role !== 'ADMIN' || dueReq.status !== 'Pending Admin') {
        throw new HttpError('Only Admin can escalate a Pending Admin due request to Super Admin', 403);
      }
      dueReq.status = 'Pending Super Admin';
      dueReq.history.push({
        step: 'Forwarded to Super Admin',
        actorId: user._id,
        actorName: user.fullName,
        actorRole: role,
        action,
        remarks: remarks || 'Forwarded by Admin to Super Admin for decision',
        timestamp: nowIso(),
      });
      const saIds = db.users.filter((u) => u.primaryRole === 'SUPER_ADMIN' && u.status === 'ACTIVE').map((u) => u._id);
      pushNotifications(
        db,
        saIds,
        {
          type: 'DUE_REQUEST_ESCALATED',
          category: 'FINANCE_APPROVALS',
          title: `Due Request Escalated (${dueReq.requestCode})`,
          message: `Admin ${user.fullName} forwarded ${dueReq.applicantName}'s due request (${dueReq.invoiceNumber}) to Super Admin.`,
          link: '/finance',
          actionLabel: 'Review Due Request',
        },
        uid
      );
    } else if (action === 'APPROVE' || action === 'REJECT') {
      const canDecide =
        (role === 'ADMIN' && dueReq.status === 'Pending Admin') ||
        (role === 'SUPER_ADMIN' && ['Pending Admin', 'Pending Super Admin'].includes(dueReq.status));
      if (!canDecide) {
        throw new HttpError('Only Admin or Super Admin can approve or reject at this stage', 403);
      }
      const isApprove = action === 'APPROVE';
      dueReq.decisionOutcome = isApprove ? 'APPROVED' : 'REJECTED';
      dueReq.decisionByRole = role;
      dueReq.decisionByName = user.fullName;
      dueReq.status = isApprove ? 'Approved - Forwarded to Coordinator' : 'Rejected - Forwarded to Coordinator';
      dueReq.finalStatus = isApprove ? 'APPROVED_PENDING_COORDINATOR' : 'REJECTED_PENDING_COORDINATOR';
      dueReq.history.push({
        step: isApprove ? 'Approved' : 'Rejected',
        actorId: user._id,
        actorName: user.fullName,
        actorRole: role,
        action,
        remarks: remarks || `${isApprove ? 'Approved' : 'Rejected'} by ${role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'} and forwarded to Coordinator`,
        timestamp: nowIso(),
      });
      const coordIds = db.users.filter((u) => u.primaryRole === 'COORDINATOR' && u.status === 'ACTIVE').map((u) => u._id);
      pushNotifications(
        db,
        coordIds,
        {
          type: isApprove ? 'DUE_REQUEST_APPROVED' : 'DUE_REQUEST_REJECTED',
          category: 'FINANCE_APPROVALS',
          title: `Due Request ${isApprove ? 'Approved' : 'Rejected'} (${dueReq.requestCode})`,
          message: `${role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'} ${user.fullName} ${isApprove ? 'approved' : 'rejected'} ${dueReq.applicantName}'s due request. Forward decision to Student.`,
          link: '/finance',
          actionLabel: 'Forward to Student',
        },
        uid
      );
    } else if (action === 'FORWARD_DECISION_TO_STUDENT') {
      if (
        role !== 'COORDINATOR' ||
        !['Approved - Forwarded to Coordinator', 'Rejected - Forwarded to Coordinator'].includes(dueReq.status)
      ) {
        throw new HttpError('Only Coordinator can forward the final decision to the Student', 403);
      }
      const isApproved = dueReq.decisionOutcome === 'APPROVED';
      dueReq.status = isApproved ? 'Completed' : 'Rejected';
      dueReq.finalStatus = isApproved ? 'APPROVED' : 'REJECTED';
      if (isApproved && dueReq.proposedDate) {
        const inv = findById(db.invoices, dueReq.invoiceId);
        if (inv) {
          inv.dueDate = new Date(dueReq.proposedDate).toISOString();
          inv.updatedAt = nowIso();
        }
      }
      dueReq.history.push({
        step: 'Forwarded to Student',
        actorId: user._id,
        actorName: user.fullName,
        actorRole: role,
        action,
        remarks: remarks || `Final ${isApproved ? 'approval' : 'rejection'} forwarded to Student`,
        timestamp: nowIso(),
      });
      pushNotifications(
        db,
        [dueReq.applicantUserId],
        {
          type: isApproved ? 'DUE_REQUEST_APPROVED' : 'DUE_REQUEST_REJECTED',
          category: 'FINANCE_APPROVALS',
          title: `Due Request ${isApproved ? 'Approved' : 'Rejected'} (${dueReq.requestCode})`,
          message: `Your due amount request for ${dueReq.invoiceNumber} has been ${isApproved ? 'approved' : 'rejected'}${remarks ? `: ${remarks}` : '.'}`,
          link: '/finance',
          actionLabel: 'View Due Status',
        },
        uid,
        { includeCeo: false }
      );
    } else {
      throw new HttpError('Invalid due request transition action', 400);
    }

    dueReq.updatedAt = nowIso();
    appendAudit(db, {
      actor: user,
      action: `DUE_REQUEST_${action}`,
      module: 'finance',
      summary: `${user.fullName} (${role}) executed ${action} on ${dueReq.requestCode} -> ${dueReq.status}`,
    });
    writeDb(db, 'finance', 'updated');
    return ok(dueReq, `Due request updated: ${dueReq.status}`);
  }

  // ========= EVENTS & COMPETITIONS =========
  if (method === 'GET' && path === '/events') {
    return ok(db.events || []);
  }

  if (method === 'POST' && path === '/events') {
    requireRole(roles, 'SUPER_ADMIN', 'ADMIN', 'COORDINATOR');
    const ev = {
      _id: genId(),
      eventCode: body.eventCode || nextSeqCode(db.events, 'eventCode', 'EVT'),
      ...body,
      eventStatus: 'REGISTRATION_OPEN',
      judgingCriteria: [
        { criterion: 'Innovation', maxMarks: 25 },
        { criterion: 'Technical Execution', maxMarks: 25 },
        { criterion: 'UI/UX', maxMarks: 25 },
        { criterion: 'Impact', maxMarks: 25 },
      ],
      createdBy: user._id,
      createdAt: nowIso(),
    };
    db.events.unshift(ev);
    writeDb(db, 'events', 'created');
    return ok(ev, 'Event created', 201);
  }

  if (method === 'POST' && /^\/events\/[^/]+\/publish$/.test(path)) {
    requireRole(roles, 'SUPER_ADMIN', 'ADMIN', 'COORDINATOR');
    const ev = findById(db.events, path.split('/')[2]);
    if (!ev) throw new HttpError('Event not found', 404);
    ev.eventStatus = body.status || 'REGISTRATION_OPEN';
    writeDb(db, 'events', 'updated');
    return ok(ev, 'Event status updated');
  }

  if (method === 'POST' && /^\/events\/[^/]+\/register$/.test(path)) {
    const ev = findById(db.events, path.split('/')[2]);
    if (!ev) throw new HttpError('Event not found', 404);
    if (db.eventregistrations.some((r) => String(r.eventId) === String(ev._id) && String(r.userId) === uid)) {
      throw new HttpError('Already registered for this event', 409);
    }
    const reg = {
      _id: genId(),
      registrationNumber: nextSeqCode(db.eventregistrations, 'registrationNumber', 'REG'),
      eventId: ev._id,
      userId: user._id,
      participantType: user.primaryRole === 'GUEST' ? 'GUEST' : 'STUDENT',
      registrationStatus: 'CONFIRMED',
      access: { startsAt: nowIso(), expiresAt: ev.endDate, revokedAt: null },
      createdAt: nowIso(),
    };
    db.eventregistrations.unshift(reg);
    writeDb(db, 'events', 'updated');
    return ok(reg, 'Registered for event', 201);
  }

  if (method === 'GET' && /^\/events\/[^/]+\/registrations$/.test(path)) {
    const eventId = path.split('/')[2];
    const regs = db.eventregistrations
      .filter((r) => String(r.eventId) === eventId)
      .map((r) => ({ ...r, userId: populateUserBrief(db, r.userId) }));
    return ok(regs);
  }

  if (method === 'POST' && /^\/admin\/event-registrations\/[^/]+\/revoke-access$/.test(path)) {
    requireRole(roles, 'SUPER_ADMIN', 'ADMIN');
    const reg = findById(db.eventregistrations, path.split('/')[3]);
    if (reg) {
      reg.access = { ...(reg.access || {}), revokedAt: nowIso() };
      writeDb(db, 'events', 'updated');
    }
    return ok(reg, 'Access revoked');
  }

  if (method === 'GET' && /^\/events\/[^/]+\/teams$/.test(path)) {
    const eventId = path.split('/')[2];
    const teams = (db.eventteams || [])
      .filter((t) => String(t.eventId) === eventId)
      .map((t) => ({ ...t, members: (t.members || []).map((m) => populateUserBrief(db, m)).filter(Boolean) }));
    return ok(teams);
  }

  if (method === 'POST' && /^\/events\/[^/]+\/teams$/.test(path)) {
    const eventId = path.split('/')[2];
    const team = {
      _id: genId(),
      eventId,
      teamName: body.teamName,
      track: body.track || 'General',
      leaderId: user._id,
      members: [user._id],
      createdAt: nowIso(),
    };
    db.eventteams.unshift(team);
    writeDb(db, 'competitions', 'created');
    return ok(team, 'Team created', 201);
  }

  if (method === 'GET' && /^\/events\/[^/]+\/submissions$/.test(path)) {
    const eventId = path.split('/')[2];
    const subs = (db.eventsubmissions || [])
      .filter((s) => String(s.eventId) === eventId)
      .map((s) => ({
        ...s,
        teamId: findById(db.eventteams, s.teamId),
        submittedBy: populateUserBrief(db, s.submittedBy),
      }));
    return ok(subs);
  }

  if (method === 'POST' && /^\/events\/[^/]+\/submissions$/.test(path)) {
    const eventId = path.split('/')[2];
    const sub = {
      _id: genId(),
      eventId,
      ...body,
      submittedBy: user._id,
      status: 'SUBMITTED',
      submittedAt: nowIso(),
    };
    db.eventsubmissions.unshift(sub);
    let issuedCertificate = null;
    if (user.primaryRole === 'GUEST' || user.accountType === 'GUEST') {
      const ev = findById(db.events, eventId);
      const token = `CFX-QR-${genId()}`;
      issuedCertificate = {
        _id: genId(),
        certificateNumber: nextSeqCode(db.certificates, 'certificateNumber', 'CERT'),
        userId: user._id,
        certificateType: 'HACKATHON_PARTICIPATION',
        eventId,
        programTitle: ev?.title || 'CraffixWeb Event',
        issuedAt: nowIso(),
        verificationToken: token,
        qrPayload: `${window.location.origin}/verify/${token}`,
        status: 'ACTIVE',
        approvalStatus: 'APPROVED',
      };
      db.certificates.unshift(issuedCertificate);
    }
    writeDb(db, 'competitions', 'created');
    return ok({ ...sub, issuedCertificate }, 'Submission recorded', 201);
  }

  if (method === 'POST' && path === '/evaluations') {
    requireRole(roles, 'SUPER_ADMIN', 'ADMIN', 'COORDINATOR', 'MENTOR');
    const sub = findById(db.eventsubmissions, body.submissionId);
    if (!sub) throw new HttpError('Submission not found', 404);
    const totalScore = (body.scores || []).reduce((acc, s) => acc + Number(s.marks || 0), 0);
    sub.averageScore = totalScore;
    sub.feedback = body.feedback || '';
    sub.status = 'EVALUATED';
    db.evaluations.unshift({ _id: genId(), ...body, judgeId: user._id, totalScore, createdAt: nowIso() });
    writeDb(db, 'competitions', 'updated');
    return ok(sub, 'Evaluation saved');
  }

  if (method === 'GET' && /^\/events\/[^/]+\/results$/.test(path)) {
    const eventId = path.split('/')[2];
    const subs = (db.eventsubmissions || [])
      .filter((s) => String(s.eventId) === eventId)
      .sort((a, b) => Number(b.averageScore || 0) - Number(a.averageScore || 0))
      .map((s, idx) => ({
        rank: idx + 1,
        submissionId: s._id,
        projectTitle: s.projectTitle,
        teamName: findById(db.eventteams, s.teamId)?.teamName || populateUserBrief(db, s.submittedBy)?.fullName || 'Participant',
        totalScore: Number(s.averageScore || 0),
      }));
    return ok({ leaderboard: subs });
  }

  if (method === 'POST' && /^\/events\/[^/]+\/publish-results$/.test(path)) {
    requireRole(roles, 'SUPER_ADMIN', 'ADMIN', 'COORDINATOR');
    const ev = findById(db.events, path.split('/')[2]);
    if (ev) ev.eventStatus = 'RESULTS_PUBLISHED';
    writeDb(db, 'competitions', 'updated');
    return ok({ published: true }, 'Results published');
  }

  // ========= PROJECTS & TASKS =========
  if (method === 'GET' && path === '/projects') {
    const list = (db.projects || []).map((p) => {
      const pTasks = (db.tasks || []).filter((t) => String(t.projectId) === String(p._id));
      const completedTasks = pTasks.filter((t) => t.status === 'COMPLETED').length;
      const progressPercent = pTasks.length > 0 ? Math.round((completedTasks / pTasks.length) * 100) : 0;
      return {
        ...p,
        totalTasks: pTasks.length,
        completedTasks,
        progressPercent,
      };
    });
    return ok(list);
  }

  if (method === 'POST' && path === '/projects') {
    requireRole(roles, 'SUPER_ADMIN', 'ADMIN', 'COORDINATOR');
    const p = {
      _id: genId(),
      projectCode: nextSeqCode(db.projects, 'projectCode', 'PRJ'),
      ...body,
      status: 'ACTIVE',
      managerId: user._id,
      createdAt: nowIso(),
    };
    db.projects.unshift(p);
    writeDb(db, 'projects', 'created');
    return ok(p, 'Project created', 201);
  }

  if (method === 'GET' && path === '/tasks') {
    return ok(
      (db.tasks || []).map((t) => ({
        ...t,
        projectId: findById(db.projects, t.projectId),
        assignedTo: populateUserBrief(db, t.assignedTo),
      }))
    );
  }

  if (method === 'POST' && path === '/tasks') {
    requireRole(roles, 'SUPER_ADMIN', 'ADMIN', 'COORDINATOR', 'MENTOR');
    if (!body.assignedTo) throw new HttpError('Task must be assigned to a user', 400);
    const assignee = findById(db.users, body.assignedTo);
    if (!assignee) throw new HttpError('Assigned user not found', 404);
    if (user.primaryRole === 'MENTOR' && assignee.primaryRole !== 'STUDENT') {
      throw new HttpError('Mentors can only assign tasks to students', 403);
    }
    const t = { _id: genId(), ...body, workLogs: [], createdAt: nowIso() };
    db.tasks.unshift(t);
    writeDb(db, 'tasks', 'created');
    return ok(t, 'Task created', 201);
  }

  if (method === 'PATCH' && /^\/tasks\/[^/]+$/.test(path)) {
    const t = findById(db.tasks, path.split('/')[2]);
    if (!t) throw new HttpError('Task not found', 404);
    Object.assign(t, body, { updatedAt: nowIso() });
    writeDb(db, 'tasks', 'updated');
    return ok(t, 'Task updated');
  }

  if (method === 'POST' && /^\/tasks\/[^/]+\/work-logs$/.test(path)) {
    const t = findById(db.tasks, path.split('/')[2]);
    if (!t) throw new HttpError('Task not found', 404);
    t.workLogs = t.workLogs || [];
    t.workLogs.push({ _id: genId(), userId: user._id, hours: Number(body.hours || 1), note: body.note || '', loggedAt: nowIso() });
    writeDb(db, 'tasks', 'updated');
    return ok(t, 'Work logged');
  }

  // ========= CERTIFICATES =========
  if (method === 'GET' && path === '/certificates') {
    let list = [...(db.certificates || [])];
    if (['STUDENT', 'GUEST'].includes(user.primaryRole)) {
      list = list.filter((c) => String(c.userId) === uid && c.approvalStatus === 'APPROVED');
    }
    return ok(
      list.map((c) => ({
        ...c,
        userId: populateUserBrief(db, c.userId),
        courseId: c.courseId ? findById(db.courses, c.courseId) : null,
        eventId: c.eventId ? findById(db.events, c.eventId) : null,
      }))
    );
  }

  if (method === 'POST' && path === '/certificates/issue') {
    requireRole(roles, 'SUPER_ADMIN', 'ADMIN', 'COORDINATOR', 'MENTOR');
    const targetUser = findById(db.users, body.userId);
    if (!targetUser) throw new HttpError('Recipient not found', 404);
    if (targetUser.primaryRole !== 'STUDENT' && targetUser.accountType !== 'STUDENT') {
      throw new HttpError('Course & achievement certificates can only be issued to Student accounts', 400);
    }
    const isAdminLevel = roles.includes('SUPER_ADMIN') || roles.includes('ADMIN');
    const token = `CFX-QR-${genId()}`;
    const cert = {
      _id: genId(),
      certificateNumber: nextSeqCode(db.certificates, 'certificateNumber', 'CERT'),
      userId: targetUser._id,
      certificateType: body.certificateType || 'COURSE_COMPLETION',
      programTitle: body.programTitle,
      issuedAt: nowIso(),
      verificationToken: token,
      qrPayload: `${window.location.origin}/verify/${token}`,
      status: isAdminLevel ? 'ACTIVE' : 'PENDING',
      approvalStatus: isAdminLevel ? 'APPROVED' : 'PENDING_ADMIN_APPROVAL',
      requestedBy: user._id,
      approvedBy: isAdminLevel ? user._id : null,
      createdAt: nowIso(),
    };
    db.certificates.unshift(cert);
    appendAudit(db, {
      actor: user,
      action: 'ISSUE_CERTIFICATE',
      module: 'certificates',
      summary: `${cert.certificateNumber} for ${targetUser.fullName}`,
      notifyCeo: true,
      link: '/certificates',
      notifyTitle: isAdminLevel ? `Certificate Issued (${cert.certificateNumber})` : `Certificate Approval Requested`,
    });
    writeDb(db, 'certificates', 'created');
    return ok(cert, isAdminLevel ? 'Certificate issued' : 'Submitted for Admin approval', 201);
  }

  if (method === 'POST' && /^\/certificates\/[^/]+\/approve$/.test(path)) {
    requireRole(roles, 'SUPER_ADMIN', 'ADMIN');
    const cert = findById(db.certificates, path.split('/')[2]);
    if (!cert) throw new HttpError('Certificate not found', 404);
    const approved = body.decision === 'APPROVE';
    cert.approvalStatus = approved ? 'APPROVED' : 'REJECTED';
    cert.status = approved ? 'ACTIVE' : 'REVOKED';
    cert.approvedBy = user._id;
    writeDb(db, 'certificates', 'updated');
    return ok(cert, `Certificate ${body.decision}`);
  }

  if (method === 'POST' && /^\/certificates\/[^/]+\/revoke$/.test(path)) {
    requireRole(roles, 'SUPER_ADMIN', 'ADMIN');
    const cert = findById(db.certificates, path.split('/')[2]);
    if (!cert) throw new HttpError('Certificate not found', 404);
    cert.status = 'REVOKED';
    writeDb(db, 'certificates', 'updated');
    return ok(cert, 'Certificate revoked');
  }

  if (method === 'GET' && /^\/certificates\/[^/]+\/pdf$/.test(path)) {
    const cert = findById(db.certificates, path.split('/')[2]);
    if (!cert) throw new HttpError('Certificate not found', 404);
    const recipient = findById(db.users, cert.userId);
    const blob = generateSimplePdfBlob({
      certificateNumber: cert.certificateNumber,
      recipientName: recipient?.fullName || 'Student',
      programTitle: cert.programTitle,
      certificateType: cert.certificateType,
      issuedAt: cert.issuedAt,
      verificationToken: cert.verificationToken,
    });
    return { status: 200, data: blob };
  }

  // ========= NOTIFICATIONS, IDEA PITCHING, MULTI-LEVEL LEAVES, SUPPORT & AUDIT =========
  if (method === 'GET' && path === '/notifications') {
    const canReviewPitch = ['SUPER_ADMIN', 'ADMIN'].includes(user.primaryRole);
    const items = (db.notifications || [])
      .filter((n) => String(n.recipientId) === uid)
      .slice(0, 60)
      .map((n) => {
        if (canReviewPitch && n.type === 'NEW_PITCH' && n.meta?.pitchId) {
          const pitch = findById(db.ideapitches, n.meta.pitchId);
          if (pitch) {
            const guest = findById(db.users, pitch.guestUserId);
            return {
              ...n,
              pitch: {
                ...pitch,
                guestUser: guest ? { _id: guest._id, fullName: guest.fullName, email: guest.email } : null,
              },
            };
          }
        }
        return n;
      });
    const unreadCount = items.filter((n) => !n.readAt).length;
    const pendingPitchesCount = canReviewPitch
      ? (db.ideapitches || []).filter((p) => p.status === 'Pending Review').length
      : 0;
    return ok({ items, unreadCount, pendingPitchesCount });
  }

  if (method === 'POST' && /^\/notifications\/[^/]+\/read$/.test(path)) {
    const nid = path.split('/')[2];
    const target = (db.notifications || []).find((n) => String(n._id) === nid && String(n.recipientId) === uid);
    if (target && !target.readAt) {
      target.readAt = nowIso();
      writeDb(db, 'notifications', 'updated');
    }
    return ok({ updated: true });
  }

  if (method === 'POST' && path === '/notifications/read-all') {
    for (const n of db.notifications || []) {
      if (String(n.recipientId) === uid && !n.readAt) n.readAt = nowIso();
    }
    writeDb(db, 'notifications', 'updated');
    return ok({ updated: true });
  }

  // ---- GUEST IDEA PITCHING & ADMIN / SUPER ADMIN REVIEW ----
  if (method === 'GET' && path === '/idea-pitches') {
    const isAdminLevel = roles.includes('SUPER_ADMIN') || roles.includes('ADMIN');
    let list = [...(db.ideapitches || [])];
    if (!isAdminLevel) {
      list = list.filter((p) => String(p.guestUserId) === uid);
    }
    const hydrated = list.map((p) => {
      const guest = findById(db.users, p.guestUserId);
      const reviewer = p.reviewedBy ? findById(db.users, p.reviewedBy) : null;
      return {
        ...p,
        guestUser: guest ? { _id: guest._id, fullName: guest.fullName, email: guest.email, phone: guest.phone || '' } : null,
        reviewedByUser: reviewer ? { _id: reviewer._id, fullName: reviewer.fullName, primaryRole: reviewer.primaryRole } : null,
      };
    });
    return ok(hydrated);
  }

  if (method === 'POST' && path === '/idea-pitches') {
    requireRole(roles, 'GUEST');
    const pitch = {
      _id: genId(),
      pitchCode: nextSeqCode(db.ideapitches, 'pitchCode', 'IDEA'),
      guestUserId: user._id,
      problemStatement: String(body.problemStatement || '').trim(),
      abstractSolution: String(body.abstractSolution || '').trim(),
      pitchDeckUrl: String(body.pitchDeckUrl || '').trim(),
      pitchDeckName: String(body.pitchDeckName || '').trim(),
      category: body.category || 'Open Innovation',
      status: 'Pending Review',
      reviewRemarks: '',
      reviewedBy: null,
      reviewedAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    if (!pitch.problemStatement || !pitch.abstractSolution) {
      throw new HttpError('Problem statement and abstract solution are required', 400);
    }
    db.ideapitches.unshift(pitch);
    const adminIds = db.users
      .filter((u) => ['SUPER_ADMIN', 'ADMIN'].includes(u.primaryRole) && u.status === 'ACTIVE')
      .map((u) => u._id);
    pushNotifications(
      db,
      adminIds,
      {
        type: 'NEW_PITCH',
        category: 'SUBMISSIONS',
        title: `New Guest Idea Pitch (${pitch.category})`,
        message: `${user.fullName} submitted "${pitch.problemStatement.slice(0, 72)}..."`,
        link: '/idea-pitches',
        actionLabel: 'Review Pitch',
        meta: { pitchId: pitch._id, pitchCode: pitch.pitchCode },
      },
      uid
    );
    appendAudit(db, {
      actor: user,
      action: 'SUBMIT_IDEA_PITCH',
      module: 'competitions',
      summary: `${user.fullName} submitted idea pitch ${pitch.pitchCode} (${pitch.category})`,
    });
    writeDb(db, 'ideas', 'created');
    return ok(pitch, 'Submitted for Admin & Super Admin Review', 201);
  }

  if (method === 'POST' && /^\/idea-pitches\/[^/]+\/review$/.test(path)) {
    requireRole(roles, 'ADMIN', 'SUPER_ADMIN');
    const pitchId = path.split('/')[2];
    const pitch = findById(db.ideapitches, pitchId);
    if (!pitch) throw new HttpError('Idea pitch not found', 404);
    const statusMap = {
      APPROVE: 'Approved',
      SHORTLIST: 'Shortlisted',
      REVIEWED: 'Reviewed',
      REJECT: 'Rejected',
      CLARIFICATION: 'Clarification Requested',
    };
    pitch.status = statusMap[body.decision] || body.status || 'Reviewed';
    pitch.reviewRemarks = String(body.remarks || '').trim();
    pitch.reviewedBy = user._id;
    pitch.reviewedAt = nowIso();
    pitch.updatedAt = nowIso();

    pushNotifications(
      db,
      [pitch.guestUserId],
      {
        type: 'PITCH_REVIEWED',
        category: 'SUBMISSIONS',
        title: `Idea Pitch ${pitch.status}`,
        message: pitch.reviewRemarks
          ? `${pitch.pitchCode}: ${pitch.status} — "${pitch.reviewRemarks}"`
          : `Your idea pitch ${pitch.pitchCode} was marked ${pitch.status}.`,
        link: '/idea-pitching',
        actionLabel: 'View Submission',
      },
      uid,
      { includeCeo: false }
    );
    appendAudit(db, {
      actor: user,
      action: 'REVIEW_IDEA_PITCH',
      module: 'competitions',
      summary: `Marked ${pitch.pitchCode} as ${pitch.status}`,
    });
    writeDb(db, 'ideas', 'updated');
    return ok(pitch, `Idea pitch marked ${pitch.status}`);
  }

  // ---- MULTI-LEVEL LEAVE HIERARCHY WORKFLOW ----
  function abstractLeaveForApplicant(l) {
    const isApproved = l.status === 'Completed' || l.status === 'Approved' || l.finalStatus === 'APPROVED';
    const isRejected = l.status === 'Rejected' || l.finalStatus === 'REJECTED';
    const abstractedStatus = isApproved ? 'Approved' : isRejected ? 'Rejected' : 'Submitted';
    const abstractedHistory = [
      {
        step: 'Submitted',
        remarks: 'Leave application submitted',
        timestamp: l.createdAt,
      },
    ];
    if (isApproved || isRejected) {
      abstractedHistory.push({
        step: abstractedStatus,
        remarks: `Leave request ${abstractedStatus.toLowerCase()}`,
        timestamp: l.updatedAt || l.createdAt,
      });
    }
    const {
      assignedMentorId,
      assignedMentorName,
      rejectedByRole,
      approvedByRole,
      ...rest
    } = l;
    return {
      ...rest,
      status: abstractedStatus,
      finalStatus: isApproved ? 'APPROVED' : isRejected ? 'REJECTED' : 'SUBMITTED',
      history: abstractedHistory,
      abstracted: true,
    };
  }

  if (method === 'GET' && path === '/leaves') {
    const role = user.primaryRole;
    let list = [...(db.leaverequests || [])].map((l) => {
      const applicant = findById(db.users, l.applicantUserId || l.userId || findById(db.employees, l.employeeId)?.userId);
      const mentor = l.assignedMentorId ? findById(db.users, l.assignedMentorId) : null;
      const appRole = l.applicantRole || applicant?.primaryRole || 'MENTOR';
      return {
        ...l,
        applicantName: l.applicantName || applicant?.fullName || 'Applicant',
        applicantEmail: applicant?.email || '',
        applicantRole: appRole,
        assignedMentorName: mentor?.fullName || (l.assignedMentorId ? 'Batch Mentor' : 'Unassigned'),
      };
    });

    if (role === 'STUDENT') {
      list = list
        .filter((l) => String(l.applicantUserId || l.userId) === uid)
        .map(abstractLeaveForApplicant);
      return ok(list);
    }

    if (role === 'MENTOR') {
      list = list
        .filter(
          (l) =>
            String(l.applicantUserId || l.userId) === uid ||
            (l.applicantRole === 'STUDENT' && (!l.assignedMentorId || String(l.assignedMentorId) === uid))
        )
        .map((l) => (String(l.applicantUserId || l.userId) === uid ? abstractLeaveForApplicant(l) : l));
    } else if (role === 'COORDINATOR') {
      list = list
        .filter((l) => String(l.applicantUserId || l.userId) === uid || l.applicantRole === 'STUDENT')
        .map((l) => (String(l.applicantUserId || l.userId) === uid ? abstractLeaveForApplicant(l) : l));
    }
    // ADMIN and SUPER_ADMIN see all leaves with full internal workflow history (Admin primary, Super Admin fallback/oversight)

    return ok(list);
  }

  if (method === 'POST' && path === '/leaves') {
    requireRole(roles, 'STUDENT', 'MENTOR', 'COORDINATOR');
    const role = user.primaryRole;
    const isStaffLeave = role === 'MENTOR' || role === 'COORDINATOR';
    const days = Number(body.days || 1);
    let initialStatus = 'Pending Admin';
    let targetNotifUsers = [];
    let routeNote = '';

    if (role === 'STUDENT') {
      if (days <= 1) {
        initialStatus = 'Pending Mentor';
        targetNotifUsers = body.assignedMentorId
          ? [body.assignedMentorId]
          : db.users.filter((u) => u.primaryRole === 'MENTOR' && u.status === 'ACTIVE').map((u) => u._id);
        routeNote = '1-day student leave assigned to Mentor';
      } else if (days <= 2) {
        initialStatus = 'Pending Coordinator';
        targetNotifUsers = db.users.filter((u) => u.primaryRole === 'COORDINATOR' && u.status === 'ACTIVE').map((u) => u._id);
        routeNote = '2-day student leave assigned to Course Coordinator';
      } else {
        initialStatus = 'Pending Admin';
        targetNotifUsers = db.users
          .filter((u) => ['ADMIN', 'SUPER_ADMIN'].includes(u.primaryRole) && u.status === 'ACTIVE')
          .map((u) => u._id);
        routeNote = `${days}-day student leave assigned to Admin (Super Admin fallback)`;
      }
    } else {
      // Staff leave (Mentor / Coordinator) -> Admin (primary) / Super Admin (fallback if Admin unavailable)
      initialStatus = 'Pending Admin';
      targetNotifUsers = db.users
        .filter((u) => ['ADMIN', 'SUPER_ADMIN'].includes(u.primaryRole) && u.status === 'ACTIVE')
        .map((u) => u._id);
      routeNote = `Submitted by ${role === 'MENTOR' ? 'Mentor' : 'Course Coordinator'} for Admin decision`;
    }

    const leave = {
      _id: genId(),
      leaveCode: nextSeqCode(db.leaverequests, 'leaveCode', 'LVE'),
      applicantUserId: user._id,
      applicantRole: role,
      applicantName: user.fullName,
      leaveType: body.leaveType || 'Medical',
      startDate: body.startDate,
      endDate: body.endDate,
      days,
      reason: String(body.reason || '').trim(),
      assignedMentorId: role === 'STUDENT' ? body.assignedMentorId || null : null,
      status: initialStatus,
      finalStatus: 'SUBMITTED',
      history: [
        {
          step: 'Submitted',
          actorId: user._id,
          actorName: user.fullName,
          actorRole: role,
          action: 'SUBMITTED',
          remarks: routeNote,
          timestamp: nowIso(),
        },
      ],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    db.leaverequests.unshift(leave);
    pushNotifications(
      db,
      targetNotifUsers,
      {
        type: 'LEAVE_SUBMITTED',
        category: 'LEAVE_UPDATES',
        title: `${role === 'STUDENT' ? 'Student' : role === 'MENTOR' ? 'Mentor' : 'Course Coordinator'} Leave Request (${days}d)`,
        message: `${user.fullName} requested ${leave.days} day(s) (${leave.leaveType}): "${leave.reason.slice(0, 60)}"`,
        link: '/leaves',
        actionLabel: 'Review Request',
      },
      uid,
      { includeCeo: false }
    );

    // Mandatory Requirement 1 & 2: Super Admin receives an informational notification for EVERY student leave
    // (including 1-day and 2-day) without changing assigned approval authority
    if (role === 'STUDENT' && days <= 2) {
      const superAdminIds = db.users
        .filter((u) => u.primaryRole === 'SUPER_ADMIN' && u.status === 'ACTIVE')
        .map((u) => u._id);
      pushNotifications(
        db,
        superAdminIds,
        {
          type: 'LEAVE_INFO',
          category: 'LEAVE_UPDATES',
          title: `Student Leave Info (${days}d • ${leave.leaveCode})`,
          message: `${user.fullName} submitted a ${days}-day leave. Assigned authority: ${
            days <= 1 ? 'Mentor' : 'Course Coordinator'
          }.`,
          link: '/leaves',
          actionLabel: 'Inspect Leave',
        },
        uid,
        { includeCeo: false }
      );
    }

    appendAudit(db, {
      actor: user,
      action: 'SUBMIT_LEAVE',
      module: 'leaves',
      summary: isStaffLeave
        ? `Staff leave ${leave.leaveCode} submitted (${days}d) -> ${initialStatus}`
        : `${user.fullName} (Student) applied for ${days}-day leave ${leave.leaveCode} -> ${initialStatus}`,
    });
    writeDb(db, 'leaves', 'created');
    return ok(
      leave,
      'Leave request submitted',
      201
    );
  }

  if (method === 'POST' && /^\/leaves\/[^/]+\/transition$/.test(path)) {
    const leaveId = path.split('/')[2];
    const leave = findById(db.leaverequests, leaveId);
    if (!leave) throw new HttpError('Leave request not found', 404);

    const action = body.action;
    const remarks = String(body.remarks || '').trim();
    const role = user.primaryRole;
    const days = Number(leave.days || 1);
    const appRole = leave.applicantRole || 'STUDENT';
    const isStaffLeave = appRole === 'MENTOR' || appRole === 'COORDINATOR';
    leave.history = leave.history || [];

    if (isStaffLeave) {
      if (!['ADMIN', 'SUPER_ADMIN'].includes(role) || leave.status !== 'Pending Admin') {
        throw new HttpError('Only Admin (or Super Admin if Admin unavailable) can decide staff leave requests', 403);
      }
      if (!['APPROVE', 'REJECT'].includes(action)) {
        throw new HttpError('Staff leave requests can only be approved or rejected', 400);
      }
      const isApproved = action === 'APPROVE';
      leave.status = isApproved ? 'Completed' : 'Rejected';
      leave.finalStatus = isApproved ? 'APPROVED' : 'REJECTED';
      if (isApproved) leave.approvedByRole = role;
      else leave.rejectedByRole = role;
      leave.history.push({
        step: isApproved ? `${role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'} Approved` : 'Rejected',
        actorId: user._id,
        actorName: user.fullName,
        actorRole: role,
        action,
        remarks: remarks || `${isApproved ? 'Approved' : 'Rejected'} by ${role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}`,
        timestamp: nowIso(),
      });
      // Requirement 7: Mentors and Course Coordinators see ONLY Submitted, Approved or Rejected (no approver identity or remarks)
      pushNotifications(
        db,
        [leave.applicantUserId],
        {
          type: isApproved ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
          category: 'LEAVE_UPDATES',
          title: `Leave ${isApproved ? 'Approved' : 'Rejected'} (${leave.leaveCode})`,
          message: `Your leave request ${leave.leaveCode} (${leave.days} day(s)) has been ${isApproved ? 'approved' : 'rejected'}.`,
          link: '/leaves',
          actionLabel: 'View Leave',
        },
        uid,
        { includeCeo: false }
      );
      leave.updatedAt = nowIso();
      appendAudit(db, {
        actor: user,
        action: `LEAVE_${action}`,
        module: 'leaves',
        summary: `${user.fullName} (${role}) ${isApproved ? 'approved' : 'rejected'} staff leave ${leave.leaveCode}`,
      });
      writeDb(db, 'leaves', 'updated');
      return ok(leave, `Leave updated: ${leave.status}`);
    }

    // Student leave FINAL hierarchy:
    // - Exactly 1 day (days <= 1): Assigned Mentor ONLY
    // - Exactly 2 days (days === 2): Assigned Course Coordinator ONLY
    // - More than 2 days (days > 2): Admin (primary) / Super Admin (fallback)
    if (action === 'APPROVE') {
      const canMentorApprove = days <= 1 && role === 'MENTOR' && leave.status === 'Pending Mentor';
      const canCoordApprove = days > 1 && days <= 2 && role === 'COORDINATOR' && leave.status === 'Pending Coordinator';
      const canAdminOrSaApprove = days > 2 && ['ADMIN', 'SUPER_ADMIN'].includes(role) && leave.status === 'Pending Admin';

      if (!canMentorApprove && !canCoordApprove && !canAdminOrSaApprove) {
        throw new HttpError('You do not have approval authority for this leave duration or stage', 403);
      }

      const stepLabel =
        role === 'MENTOR'
          ? 'Mentor Approved'
          : role === 'COORDINATOR'
          ? 'Coordinator Approved'
          : role === 'SUPER_ADMIN'
          ? 'Super Admin Approved'
          : 'Admin Approved';

      leave.status = 'Completed';
      leave.finalStatus = 'APPROVED';
      leave.approvedByRole = role;
      leave.history.push({
        step: stepLabel,
        actorId: user._id,
        actorName: user.fullName,
        actorRole: role,
        action,
        remarks: remarks || `Approved by ${role === 'SUPER_ADMIN' ? 'Super Admin' : role}`,
        timestamp: nowIso(),
      });

      // Notify student with abstracted message (no approver identity or internal workflow history)
      pushNotifications(
        db,
        [leave.applicantUserId],
        {
          type: 'LEAVE_APPROVED',
          category: 'LEAVE_UPDATES',
          title: `Leave Approved (${leave.leaveCode})`,
          message: `Your leave request ${leave.leaveCode} (${leave.days} day(s)) has been approved.`,
          link: '/leaves',
          actionLabel: 'View Leave',
        },
        uid,
        { includeCeo: false }
      );
    } else if (action === 'REJECT') {
      const canMentorReject = days <= 1 && role === 'MENTOR' && leave.status === 'Pending Mentor';
      const canCoordReject = days > 1 && days <= 2 && role === 'COORDINATOR' && leave.status === 'Pending Coordinator';
      const canAdminOrSaReject = days > 2 && ['ADMIN', 'SUPER_ADMIN'].includes(role) && leave.status === 'Pending Admin';

      if (!canMentorReject && !canCoordReject && !canAdminOrSaReject) {
        throw new HttpError('You cannot reject this leave at its current duration or workflow stage', 403);
      }

      leave.status = 'Rejected';
      leave.finalStatus = 'REJECTED';
      leave.rejectedByRole = role;
      leave.history.push({
        step: 'Rejected',
        actorId: user._id,
        actorName: user.fullName,
        actorRole: role,
        action,
        remarks: remarks || `Rejected by ${role === 'SUPER_ADMIN' ? 'Super Admin' : role}`,
        timestamp: nowIso(),
      });

      const coordIds = db.users.filter((u) => u.primaryRole === 'COORDINATOR' && u.status === 'ACTIVE').map((u) => u._id);
      const mentorIds = leave.assignedMentorId
        ? [leave.assignedMentorId]
        : db.users.filter((u) => u.primaryRole === 'MENTOR' && u.status === 'ACTIVE').map((u) => u._id);

      // Requirements 3, 4, 5: Internal rejection forwarding chain for student communication
      if (days <= 1 && role === 'MENTOR') {
        // Req 3: 1-day rejected by Mentor -> forward internal rejection info to Course Coordinator and Mentor
        leave.history.push({
          step: 'Internal Rejection Forwarded',
          actorId: user._id,
          actorName: user.fullName,
          actorRole: role,
          action: 'REJECTION_ESCALATION',
          remarks: 'Forwarded internal rejection to Course Coordinator and Mentor for student communication',
          timestamp: nowIso(),
        });
        pushNotifications(
          db,
          [...coordIds, ...mentorIds],
          {
            type: 'LEAVE_REJECTED',
            category: 'LEAVE_UPDATES',
            title: `1-Day Leave Rejection Notice (${leave.leaveCode})`,
            message: `Mentor rejected ${leave.applicantName}'s 1-day leave (${leave.leaveCode}). Forwarded to Course Coordinator & Mentor for communication.`,
            link: '/leaves',
            actionLabel: 'View Leave',
          },
          uid,
          { includeCeo: false }
        );
      } else if (days <= 2 && role === 'COORDINATOR') {
        // Req 4: 2-day rejected by Course Coordinator -> forward internal rejection info to Mentor
        leave.history.push({
          step: 'Internal Rejection Forwarded',
          actorId: user._id,
          actorName: user.fullName,
          actorRole: role,
          action: 'REJECTION_ESCALATION',
          remarks: 'Forwarded internal rejection to Mentor for student communication',
          timestamp: nowIso(),
        });
        pushNotifications(
          db,
          mentorIds,
          {
            type: 'LEAVE_REJECTED',
            category: 'LEAVE_UPDATES',
            title: `2-Day Leave Rejection Notice (${leave.leaveCode})`,
            message: `Course Coordinator rejected ${leave.applicantName}'s 2-day leave (${leave.leaveCode}). Forwarded to Mentor for communication.`,
            link: '/leaves',
            actionLabel: 'View Leave',
          },
          uid,
          { includeCeo: false }
        );
      } else if (days > 2 && ['ADMIN', 'SUPER_ADMIN'].includes(role)) {
        // Req 5: >2 days rejected by Admin / Super Admin -> forward to Course Coordinator, Mentor, and finally student
        leave.history.push({
          step: 'Internal Rejection Forwarded',
          actorId: user._id,
          actorName: user.fullName,
          actorRole: role,
          action: 'REJECTION_ESCALATION',
          remarks: 'Forwarded internal rejection to Course Coordinator, Mentor, and Student',
          timestamp: nowIso(),
        });
        pushNotifications(
          db,
          [...coordIds, ...mentorIds],
          {
            type: 'LEAVE_REJECTED',
            category: 'LEAVE_UPDATES',
            title: `${days}-Day Leave Rejection Notice (${leave.leaveCode})`,
            message: `${role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'} rejected ${leave.applicantName}'s ${days}-day leave (${leave.leaveCode}). Forwarded to Course Coordinator & Mentor.`,
            link: '/leaves',
            actionLabel: 'View Leave',
          },
          uid,
          { includeCeo: false }
        );
      }

      // Notify student with abstracted message ONLY (no approver identity, no rejection remarks)
      pushNotifications(
        db,
        [leave.applicantUserId],
        {
          type: 'LEAVE_REJECTED',
          category: 'LEAVE_UPDATES',
          title: `Leave Rejected (${leave.leaveCode})`,
          message: `Your leave request ${leave.leaveCode} has been rejected.`,
          link: '/leaves',
          actionLabel: 'View Leave',
        },
        uid,
        { includeCeo: false }
      );
    } else {
      throw new HttpError('Invalid leave transition action', 400);
    }

    leave.updatedAt = nowIso();
    appendAudit(db, {
      actor: user,
      action: `LEAVE_${action}`,
      module: 'leaves',
      summary: `${user.fullName} (${role}) executed ${action} on ${leave.leaveCode} -> ${leave.status}`,
    });
    writeDb(db, 'leaves', 'updated');
    return ok(leave, `Leave updated: ${leave.status}`);
  }

  if (method === 'GET' && path === '/audit-logs') {
    const lim = Number(query.limit || 25);
    let logs = db.auditlogs || [];
    if (user.primaryRole !== 'ADMIN') {
      logs = logs.filter((a) => !a.staffLeavePrivate);
    }
    return ok(logs.slice(0, lim));
  }

  // ========= REPORTS & DASHBOARD AGGREGATIONS =========
  if (method === 'GET' && path === '/reports/search') {
    const q = (query.q || '').toLowerCase();
    return ok({
      students: db.students
        .map((s) => ({ ...s, userId: populateUserBrief(db, s.userId) }))
        .filter((s) => s.userId?.fullName?.toLowerCase().includes(q) || s.studentId?.toLowerCase().includes(q))
        .slice(0, 5),
      courses: db.courses.filter((c) => c.title?.toLowerCase().includes(q) || c.courseCode?.toLowerCase().includes(q)).slice(0, 5),
      events: db.events.filter((e) => e.title?.toLowerCase().includes(q)).slice(0, 5),
    });
  }

  if (method === 'GET' && path === '/reports/finance') {
    const verified = (db.payments || []).filter((p) => p.paymentStatus === 'VERIFIED');
    const totalCollected = verified.reduce((s, p) => s + Number(p.amount || 0), 0);
    const totalOutstanding = (db.invoices || []).reduce((s, i) => s + Number(i.dueAmount || 0), 0);
    const approvedExpenses = (db.expenses || []).filter((e) => e.approvalStatus === 'APPROVED').reduce((s, e) => s + Number(e.amount || 0), 0);
    const courseWiseRevenue = (db.courses || []).map((c) => {
      const courseEnrIds = new Set(db.enrollments.filter((e) => String(e.courseId) === String(c._id)).map((e) => String(e._id)));
      const rev = verified.filter((p) => courseEnrIds.has(String(p.enrollmentId))).reduce((s, p) => s + Number(p.amount || 0), 0);
      return { courseCode: c.courseCode, title: c.title, revenue: rev };
    });
    return ok({
      summary: { totalCollected, totalOutstanding, approvedExpenses, netCashflow: totalCollected - approvedExpenses },
      courseWiseRevenue,
    });
  }

  if (method === 'GET' && path === '/reports/courses') {
    return ok(
      (db.courses || []).map((c) => ({
        courseCode: c.courseCode,
        title: c.title,
        enrollments: (db.enrollments || []).filter((e) => String(e.courseId) === String(c._id)).length,
      }))
    );
  }

  if (method === 'GET' && path === '/reports/events') {
    return ok(
      (db.events || []).map((e) => ({
        title: e.title,
        participants: (db.eventregistrations || []).filter((r) => String(r.eventId) === String(e._id)).length,
      }))
    );
  }

  if (method === 'GET' && path === '/reports/dashboard') {
    const role = user.primaryRole;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { year: d.getFullYear(), monthIdx: d.getMonth(), label: months[d.getMonth()] };
    });

    if (role === 'SUPER_ADMIN') {
      const verifiedPayments = (db.payments || []).filter((p) => p.paymentStatus === 'VERIFIED');
      const totalRevenue = verifiedPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
      const series = last6Months.map((m) => ({
        month: m.label,
        revenue: verifiedPayments
          .filter((p) => {
            const pd = new Date(p.paidAt || p.createdAt);
            return pd.getFullYear() === m.year && pd.getMonth() === m.monthIdx;
          })
          .reduce((s, p) => s + Number(p.amount || 0), 0),
      }));
      const myNotifs = (db.notifications || []).filter((n) => String(n.recipientId) === uid);
      const categoryBreakdown = {
        ACADEMY_ENROLMENTS: myNotifs.filter((n) => n.category === 'ACADEMY_ENROLMENTS').length,
        LEAVE_UPDATES: myNotifs.filter((n) => n.category === 'LEAVE_UPDATES').length,
        FINANCE_APPROVALS: myNotifs.filter((n) => n.category === 'FINANCE_APPROVALS').length,
        SUBMISSIONS: myNotifs.filter((n) => n.category === 'SUBMISSIONS').length,
      };
      const ideaPitches = (db.ideapitches || []).slice(0, 8).map((p) => {
        const guest = findById(db.users, p.guestUserId);
        return {
          ...p,
          guestUser: guest ? { _id: guest._id, fullName: guest.fullName, email: guest.email } : null,
        };
      });
      return ok({
        role,
        kpis: {
          employees: { value: db.employees.length, delta: '+Active' },
          students: { value: db.students.length, delta: '+Registered' },
          activeCourses: { value: db.courses.filter((c) => c.courseStatus === 'ACTIVE').length, delta: 'Live' },
          upcomingEvents: { value: db.events.length },
        },
        categoryBreakdown,
        revenueOverview: { totalRevenue, growthPercent: 0, series },
        recentActivities: (db.auditlogs || []).filter((a) => !a.staffLeavePrivate).slice(0, 12),
        upcomingEvents: (db.events || []).slice(0, 5),
        ideaPitches,
      });
    }

    if (role === 'ADMIN') {
      const verified = (db.payments || []).filter((p) => p.paymentStatus === 'VERIFIED');
      const thisMonthRev = verified
        .filter((p) => {
          const d = new Date(p.paidAt || p.createdAt);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        })
        .reduce((s, p) => s + Number(p.amount || 0), 0);
      const enrollmentsTrend = last6Months.map((m) => ({
        month: m.label,
        enrollments: (db.enrollments || []).filter((e) => {
          const d = new Date(e.enrolledAt || e.createdAt);
          return d.getFullYear() === m.year && d.getMonth() === m.monthIdx;
        }).length,
      }));
      const ideaPitches = (db.ideapitches || []).slice(0, 8).map((p) => {
        const guest = findById(db.users, p.guestUserId);
        return {
          ...p,
          guestUser: guest ? { _id: guest._id, fullName: guest.fullName, email: guest.email } : null,
        };
      });
      return ok({
        role,
        kpis: {
          employees: db.employees.length,
          students: db.students.length,
          activeBatches: db.batches.filter((b) => b.batchStatus === 'ACTIVE').length,
          thisMonthRevenue: thisMonthRev,
        },
        enrollmentsTrend,
        pendingApprovals: {
          leaveRequests: (db.leaverequests || []).filter((l) => ['Pending Admin', 'PENDING_MANAGER'].includes(l.status || l.finalStatus)).length,
          paymentVerification: (db.payments || []).filter((p) => p.paymentStatus === 'PENDING_VERIFICATION').length,
          studentEnrollments: (db.enrollments || []).filter((e) => e.status === 'PENDING_REVIEW').length,
        },
        ideaPitches,
      });
    }

    if (role === 'COORDINATOR') {
      const adminIds = new Set(db.users.filter((u) => ['SUPER_ADMIN', 'ADMIN'].includes(u.primaryRole)).map((u) => String(u._id)));
      const batches = (db.batches || []).filter(
        (b) => !b.coordinatorId || String(b.coordinatorId) === uid || adminIds.has(String(b.coordinatorId))
      );
      const batchIdSet = new Set(batches.map((b) => String(b._id)));
      const uniqueCourses = new Set(batches.map((b) => String(b.courseId)));
      const activeEnrolls = (db.enrollments || []).filter(
        (e) => batchIdSet.has(String(e.batchId)) && ['APPROVED', 'ACTIVE', 'COMPLETED'].includes(e.status)
      );
      const attRecs = (db.studentattendances || []).filter((a) => batchIdSet.has(String(a.batchId)));
      const pres = attRecs.filter((a) => ['PRESENT', 'LATE'].includes(a.status)).length;
      const avgAtt = attRecs.length > 0 ? Math.round((pres / attRecs.length) * 100) : 0;
      const myBatches = batches.map((b) => ({
        _id: b._id,
        batchCode: b.batchCode,
        courseTitle: findById(db.courses, b.courseId)?.title || 'Course',
        students: activeEnrolls.filter((e) => String(e.batchId) === String(b._id)).length,
        progress: b.progressPercent || 0,
        status: b.batchStatus,
      }));
      const enrollmentSessions = (db.enrollmentsessions || []).map((s) => ({
        ...s,
        courseId: s.courseId ? findById(db.courses, s.courseId) : null,
        batchId: s.batchId ? findById(db.batches, s.batchId) : null,
      }));
      const kanbanEnrollments = (db.enrollments || [])
        .filter((e) => !['CANCELLED', 'DROPPED'].includes(e.status))
        .map((e) => {
          const pop = populateEnrollment(db, e, 'COORDINATOR');
          const derivedStage =
            e.kanbanStage ||
            (['ACTIVE', 'COMPLETED'].includes(e.status)
              ? 'ENROLLED'
              : e.status === 'APPROVED'
              ? 'ADMIN_APPROVAL'
              : e.priceUnlocked
              ? 'FEE_UNLOCKED'
              : 'NEW_INQUIRY');
          return { ...pop, kanbanStage: derivedStage };
        });
      return ok({
        role,
        kpis: {
          assignedCourses: uniqueCourses.size,
          batches: batches.length,
          totalStudents: activeEnrolls.length,
          avgAttendance: avgAtt,
        },
        myBatches,
        enrollmentSessions,
        kanbanEnrollments,
        courses: (db.courses || []).map((c) => ({ _id: c._id, title: c.title, courseCode: c.courseCode })),
        batches: batches.map((b) => ({ _id: b._id, batchCode: b.batchCode, name: b.name, courseId: b.courseId })),
      });
    }

    if (role === 'MENTOR') {
      const myBatches = (db.batches || []).filter((b) => (b.mentors || []).some((m) => String(m) === uid));
      const bIds = new Set(myBatches.map((b) => String(b._id)));
      const stuCount = (db.enrollments || []).filter((e) => bIds.has(String(e.batchId)) && ['APPROVED', 'ACTIVE'].includes(e.status)).length;
      const myAssigns = (db.assignments || []).filter((a) => String(a.mentorId) === uid);
      const pending = myAssigns
        .map((a) => {
          const pendingSubs = (db.submissions || []).filter((s) => String(s.assignmentId) === String(a._id) && s.status === 'SUBMITTED');
          return pendingSubs.length > 0
            ? { _id: a._id, title: a.title, batchCode: findById(db.batches, a.batchId)?.batchCode || '', pendingCount: pendingSubs.length }
            : null;
        })
        .filter(Boolean);
      return ok({
        role,
        kpis: {
          assignedBatches: myBatches.length,
          students: stuCount,
          assignments: myAssigns.length,
          submissionRate: myAssigns.length > 0 ? Math.round(((db.submissions || []).length / myAssigns.length) * 100) : 0,
        },
        todaysSchedule: [],
        pendingEvaluations: pending,
      });
    }

    if (role === 'STUDENT') {
      const stu = db.students.find((s) => String(s.userId) === uid);
      const myEnrolls = stu ? db.enrollments.filter((e) => String(e.studentId) === String(stu._id) && !['CANCELLED', 'DROPPED'].includes(e.status)) : [];
      const myCourses = myEnrolls.map((e) => {
        const c = findById(db.courses, e.courseId);
        const b = findById(db.batches, e.batchId);
        return { _id: e._id, title: c?.title || 'Course', batchCode: b?.batchCode || 'Pending', progressPercent: b?.progressPercent || e.progressPercent || 0 };
      });
      const avgProgress = myCourses.length > 0 ? Math.round(myCourses.reduce((s, c) => s + Number(c.progressPercent || 0), 0) / myCourses.length) : 0;
      const att = stu ? db.studentattendances.filter((a) => String(a.studentId) === String(stu._id)) : [];
      const pres = att.filter((a) => ['PRESENT', 'LATE'].includes(a.status)).length;
      const attRate = att.length > 0 ? Math.round((pres / att.length) * 100) : 0;
      const myCerts = db.certificates.filter((c) => String(c.userId) === uid && c.approvalStatus === 'APPROVED').length;
      return ok({
        role,
        kpis: { enrolledCourses: myCourses.length, avgProgress, attendanceRate: attRate, certificates: myCerts },
        myCourses,
        upcomingEvent: db.events[0] || null,
      });
    }

    // GUEST
    const reg = db.eventregistrations.find((r) => String(r.userId) === uid);
    const ev = reg ? findById(db.events, reg.eventId) : db.events[0] || null;
    const team = ev ? (db.eventteams || []).find((t) => String(t.eventId) === String(ev._id) && (t.members || []).some((m) => String(m) === uid)) : null;
    const sub = ev ? (db.eventsubmissions || []).find((s) => String(s.eventId) === String(ev._id) && String(s.submittedBy) === uid) : null;
    return ok({
      role: 'GUEST',
      event: ev,
      registration: reg || null,
      steps: {
        registration: reg ? 'COMPLETED' : 'PENDING',
        team: team ? 'FORMED' : 'NOT_FORMED',
        submission: sub ? 'SUBMITTED' : 'PENDING',
        evaluation: sub?.status === 'EVALUATED' ? 'COMPLETED' : 'PENDING',
        results: ev?.eventStatus === 'RESULTS_PUBLISHED' ? 'PUBLISHED' : 'PENDING',
      },
    });
  }

  throw new HttpError(`Endpoint not implemented in local browser store: ${method} ${path}`, 404);
}
