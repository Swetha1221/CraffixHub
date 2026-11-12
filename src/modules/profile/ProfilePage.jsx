import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Camera,
  UserCheck,
  Briefcase,
  GraduationCap,
  Shield,
  KeyRound,
  Save,
  CalendarDays,
  History,
} from 'lucide-react';
import api from '../../services/api';
import { updateUserProfile } from '../../app/authSlice';
import { pushToast } from '../../app/uiSlice';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { StatusBadge } from '../../components/common/UI';
import { formatDate, formatDateTime, formatRoleLabel, getInitials } from '../../utils/format';

export function ProfilePage() {
  const dispatch = useDispatch();
  const authUser = useSelector((state) => state.auth.user);
  const [profile, setProfile] = useState(authUser);
  const [departments, setDepartments] = useState([]);
  const [loginHistory, setLoginHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('personal');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [personalForm, setPersonalForm] = useState({
    fullName: '',
    phone: '',
    bio: '',
    departmentId: '',
  });

  const [studentForm, setStudentForm] = useState({
    college: '',
    department: '',
    academicYear: '',
    dateOfBirth: '',
    addressLine1: '',
    city: '',
    state: '',
    postalCode: '',
    guardianName: '',
    guardianRelationship: '',
    guardianPhone: '',
    internshipCompany: '',
    internshipRole: '',
    internshipStatus: 'NOT_STARTED',
    placementCompany: '',
    placementRole: '',
    packageLpa: 0,
    placementStatus: 'SEEKING',
  });

  const [pwdForm, setPwdForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const hydrateForms = useCallback((p) => {
    if (!p) return;
    setPersonalForm({
      fullName: p.fullName || '',
      phone: p.phone || '',
      bio: p.bio || '',
      departmentId: p.departmentId?._id || p.departmentId || p.employeeProfile?.departmentId?._id || '',
    });

    if (p.studentProfile) {
      const sp = p.studentProfile;
      setStudentForm({
        college: sp.college || '',
        department: sp.department || '',
        academicYear: sp.academicYear || '',
        dateOfBirth: sp.dateOfBirth ? String(sp.dateOfBirth).slice(0, 10) : '',
        addressLine1: sp.address?.line1 || '',
        city: sp.address?.city || '',
        state: sp.address?.state || '',
        postalCode: sp.address?.postalCode || '',
        guardianName: sp.guardian?.name || '',
        guardianRelationship: sp.guardian?.relationship || '',
        guardianPhone: sp.guardian?.phone || '',
        internshipCompany: sp.internshipDetails?.company || '',
        internshipRole: sp.internshipDetails?.role || '',
        internshipStatus: sp.internshipDetails?.status || 'NOT_STARTED',
        placementCompany: sp.placementDetails?.company || '',
        placementRole: sp.placementDetails?.role || '',
        packageLpa: sp.placementDetails?.packageLpa ?? 0,
        placementStatus: sp.placementDetails?.status || 'SEEKING',
      });
    }
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      const [meRes, histRes] = await Promise.all([
        api.get('/auth/me'),
        api.get('/auth/login-history'),
      ]);
      const me = meRes.data.data;
      setProfile(me);
      dispatch(updateUserProfile(me));
      hydrateForms(me);
      setLoginHistory(histRes.data.data || []);

      if (['SUPER_ADMIN', 'ADMIN'].includes(me?.primaryRole)) {
        const deptRes = await api.get('/organization/departments');
        setDepartments(deptRes.data.data || []);
      }
    } catch {
      // Handled gracefully
    }
  }, [dispatch, hydrateForms]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useRealtimeSync(loadProfile, ['users', 'students', 'employees']);

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const res = await api.post('/auth/me/avatar', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const updated = res.data.data;
      setProfile(updated);
      dispatch(updateUserProfile(updated));
      dispatch(pushToast({ type: 'success', title: 'Photo Updated', message: 'Profile avatar saved' }));
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Upload Failed', message: err.response?.data?.message || 'Could not upload avatar image' }));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSavePersonal = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        fullName: personalForm.fullName,
        phone: personalForm.phone,
        bio: personalForm.bio,
      };
      if (['SUPER_ADMIN', 'ADMIN'].includes(profile?.primaryRole) && personalForm.departmentId) {
        payload.departmentId = personalForm.departmentId;
      }
      const res = await api.patch('/auth/me', payload);
      const updated = res.data.data;
      setProfile(updated);
      dispatch(updateUserProfile(updated));
      hydrateForms(updated);
      dispatch(pushToast({ type: 'success', title: 'Profile Updated', message: 'Your personal details have been saved' }));
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Update Failed', message: err.response?.data?.message || 'Failed to update profile' }));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStudentProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.patch('/auth/me', {
        studentProfile: {
          college: studentForm.college,
          department: studentForm.department,
          academicYear: studentForm.academicYear,
          dateOfBirth: studentForm.dateOfBirth || null,
          address: {
            line1: studentForm.addressLine1,
            city: studentForm.city,
            state: studentForm.state,
            postalCode: studentForm.postalCode,
          },
          guardian: {
            name: studentForm.guardianName,
            relationship: studentForm.guardianRelationship,
            phone: studentForm.guardianPhone,
          },
          internshipDetails: {
            company: studentForm.internshipCompany,
            role: studentForm.internshipRole,
            status: studentForm.internshipStatus,
          },
          placementDetails: {
            company: studentForm.placementCompany,
            role: studentForm.placementRole,
            packageLpa: Number(studentForm.packageLpa || 0),
            status: studentForm.placementStatus,
          },
        },
      });
      const updated = res.data.data;
      setProfile(updated);
      dispatch(updateUserProfile(updated));
      hydrateForms(updated);
      dispatch(pushToast({ type: 'success', title: 'Academic Profile Saved', message: 'Student profile updated successfully' }));
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Update Failed', message: err.response?.data?.message || 'Could not update student details' }));
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      dispatch(pushToast({ type: 'error', title: 'Mismatch', message: 'New password and confirmation do not match' }));
      return;
    }
    setChangingPassword(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword,
      });
      setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      dispatch(pushToast({ type: 'success', title: 'Password Updated', message: 'Your password has been changed securely' }));
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Password Error', message: err.response?.data?.message || 'Failed to change password' }));
    } finally {
      setChangingPassword(false);
    }
  };

  const role = profile?.primaryRole || 'STUDENT';
  const isStudent = role === 'STUDENT' || profile?.accountType === 'STUDENT';
  const isGuest = role === 'GUEST' || profile?.accountType === 'GUEST';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Profile & Account</h1>
          <p className="page-subtitle">Manage your personal profile, role details, avatar photo, and account security</p>
        </div>
      </div>

      {/* Profile Header Banner */}
      <div
        className="card"
        style={{
          marginBottom: 20,
          background: 'linear-gradient(135deg, #271E62 0%, #4E45D5 60%, #7C5CFA 100%)',
          color: '#FFFFFF',
          border: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.18)',
                  border: '3px solid rgba(255,255,255,0.45)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 26,
                  fontWeight: 800,
                  overflow: 'hidden',
                }}
              >
                {profile?.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile?.fullName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  getInitials(profile?.fullName)
                )}
              </div>
              <label
                title="Upload profile photo"
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: '#FFFFFF',
                  color: '#4E45D5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: uploadingAvatar ? 'wait' : 'pointer',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                }}
              >
                <Camera size={14} />
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleAvatarChange}
                  disabled={uploadingAvatar}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#FFFFFF' }}>{profile?.fullName}</h2>
                <span
                  className="badge"
                  style={{
                    background: 'rgba(255,255,255,0.16)',
                    color: '#FFFFFF',
                    border: '1px solid rgba(255,255,255,0.28)',
                    fontSize: 11,
                    letterSpacing: '0.02em',
                  }}
                >
                  Role: {formatRoleLabel(role)}
                </span>
                <span
                  className="badge"
                  style={{ background: 'rgba(16, 185, 129, 0.25)', color: '#ECFDF5', border: '1px solid rgba(16,185,129,0.5)' }}
                >
                  {profile?.status || 'ACTIVE'}
                </span>
              </div>
              <div style={{ fontSize: 13.5, opacity: 0.92, marginTop: 4 }}>{profile?.email}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {profile?.employeeProfile?.employeeId && (
                  <span style={{ fontSize: 11.5, padding: '3px 9px', borderRadius: 6, background: 'rgba(255,255,255,0.12)' }}>
                    ID: {profile.employeeProfile.employeeId}
                  </span>
                )}
                {profile?.studentProfile?.studentId && (
                  <span style={{ fontSize: 11.5, padding: '3px 9px', borderRadius: 6, background: 'rgba(255,255,255,0.12)' }}>
                    ID: {profile.studentProfile.studentId}
                  </span>
                )}
                {profile?.department?.name && (
                  <span style={{ fontSize: 11.5, padding: '3px 9px', borderRadius: 6, background: 'rgba(255,255,255,0.12)' }}>
                    Dept: {profile.department.name}
                  </span>
                )}
                <span style={{ fontSize: 11.5, padding: '3px 9px', borderRadius: 6, background: 'rgba(255,255,255,0.12)' }}>
                  Last Login: {formatDateTime(profile?.lastLoginAt)}
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'inline-flex',
              gap: 6,
              flexWrap: 'wrap',
              padding: 4,
              borderRadius: 12,
              background: 'rgba(15, 23, 42, 0.22)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
            }}
          >
            <button
              type="button"
              className="btn btn-sm"
              style={{
                background: activeTab === 'personal' ? '#FFFFFF' : 'rgba(255,255,255,0.16)',
                color: activeTab === 'personal' ? '#271E62' : '#FFFFFF',
                border: 'none',
              }}
              onClick={() => setActiveTab('personal')}
            >
              <UserCheck size={14} /> Personal Info
            </button>
            <button
              type="button"
              className="btn btn-sm"
              style={{
                background: activeTab === 'role' ? '#FFFFFF' : 'rgba(255,255,255,0.16)',
                color: activeTab === 'role' ? '#271E62' : '#FFFFFF',
                border: 'none',
              }}
              onClick={() => setActiveTab('role')}
            >
              {isStudent ? <GraduationCap size={14} /> : isGuest ? <CalendarDays size={14} /> : <Briefcase size={14} />}
              {isStudent ? 'Academic Profile' : isGuest ? 'Event Access' : 'Work & Role Profile'}
            </button>
            <button
              type="button"
              className="btn btn-sm"
              style={{
                background: activeTab === 'security' ? '#FFFFFF' : 'rgba(255,255,255,0.16)',
                color: activeTab === 'security' ? '#271E62' : '#FFFFFF',
                border: 'none',
              }}
              onClick={() => setActiveTab('security')}
            >
              <KeyRound size={14} /> Security & Activity
            </button>
          </div>
        </div>
      </div>

      {/* Tab 1: Personal Info */}
      {activeTab === 'personal' && (
        <div className="grid-2" style={{ gap: 20 }}>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Personal Information</h3>
            </div>
            <form onSubmit={handleSavePersonal} className="form-grid">
              <div className="form-field full">
                <label className="form-label">Full Name</label>
                <input
                  className="form-input"
                  required
                  value={personalForm.fullName}
                  onChange={(e) => setPersonalForm({ ...personalForm, fullName: e.target.value })}
                />
              </div>
              <div className="form-field">
                <label className="form-label">Email Address</label>
                <input className="form-input" value={profile?.email || ''} disabled />
              </div>
              <div className="form-field">
                <label className="form-label">Phone Number</label>
                <input
                  className="form-input"
                  placeholder="+91 98765 43210"
                  value={personalForm.phone}
                  onChange={(e) => setPersonalForm({ ...personalForm, phone: e.target.value })}
                />
              </div>
              {['SUPER_ADMIN', 'ADMIN'].includes(role) && (
                <div className="form-field full">
                  <label className="form-label">Department</label>
                  <select
                    className="form-select"
                    value={personalForm.departmentId}
                    onChange={(e) => setPersonalForm({ ...personalForm, departmentId: e.target.value })}
                  >
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-field full">
                <label className="form-label">Bio / Professional Summary</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Share your role focus, technical stack, or academic goals..."
                  value={personalForm.bio}
                  onChange={(e) => setPersonalForm({ ...personalForm, bio: e.target.value })}
                />
              </div>
              <div className="form-field full">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <Save size={15} /> {saving ? 'Saving...' : 'Save Personal Details'}
                </button>
              </div>
            </form>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Account Identity & Verification</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="stepper-item" style={{ justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Primary Role</span>
                <span className="badge badge-primary">{role}</span>
              </div>
              <div className="stepper-item" style={{ justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Account Type</span>
                <strong>{profile?.accountType}</strong>
              </div>
              <div className="stepper-item" style={{ justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Account Status</span>
                <StatusBadge status={profile?.status || 'ACTIVE'} />
              </div>
              <div className="stepper-item" style={{ justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Email Verified</span>
                <span className={`badge ${profile?.emailVerified ? 'badge-success' : 'badge-warning'}`}>
                  {profile?.emailVerified ? 'Verified' : 'Pending'}
                </span>
              </div>
              <div className="stepper-item" style={{ justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Permissions Granted</span>
                <strong>{profile?.permissions?.length || 0} RBAC Scopes</strong>
              </div>
              <div className="stepper-item" style={{ justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Member Since</span>
                <strong>{formatDate(profile?.createdAt)}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Role-Specific Profile */}
      {activeTab === 'role' && isStudent && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Student Academic & Placement Profile</h3>
              <p className="page-subtitle">Student ID: {profile?.studentProfile?.studentId || 'Auto-assigned on save'}</p>
            </div>
            <StatusBadge status={profile?.studentProfile?.studentStatus || 'REGISTERED'} />
          </div>
          <form onSubmit={handleSaveStudentProfile} className="form-grid">
            <div className="form-field">
              <label className="form-label">College / University</label>
              <input className="form-input" value={studentForm.college} onChange={(e) => setStudentForm({ ...studentForm, college: e.target.value })} />
            </div>
            <div className="form-field">
              <label className="form-label">Academic Department / Stream</label>
              <input className="form-input" value={studentForm.department} onChange={(e) => setStudentForm({ ...studentForm, department: e.target.value })} />
            </div>
            <div className="form-field">
              <label className="form-label">Academic Year / Semester</label>
              <input className="form-input" placeholder="e.g. Final Year / Sem 7" value={studentForm.academicYear} onChange={(e) => setStudentForm({ ...studentForm, academicYear: e.target.value })} />
            </div>
            <div className="form-field">
              <label className="form-label">Date of Birth</label>
              <input type="date" className="form-input" value={studentForm.dateOfBirth} onChange={(e) => setStudentForm({ ...studentForm, dateOfBirth: e.target.value })} />
            </div>

            <div className="form-field">
              <label className="form-label">Address Line</label>
              <input className="form-input" value={studentForm.addressLine1} onChange={(e) => setStudentForm({ ...studentForm, addressLine1: e.target.value })} />
            </div>
            <div className="form-field">
              <label className="form-label">City</label>
              <input className="form-input" value={studentForm.city} onChange={(e) => setStudentForm({ ...studentForm, city: e.target.value })} />
            </div>
            <div className="form-field">
              <label className="form-label">State</label>
              <input className="form-input" value={studentForm.state} onChange={(e) => setStudentForm({ ...studentForm, state: e.target.value })} />
            </div>
            <div className="form-field">
              <label className="form-label">Postal Code</label>
              <input className="form-input" value={studentForm.postalCode} onChange={(e) => setStudentForm({ ...studentForm, postalCode: e.target.value })} />
            </div>

            <div className="form-field">
              <label className="form-label">Guardian Name</label>
              <input className="form-input" value={studentForm.guardianName} onChange={(e) => setStudentForm({ ...studentForm, guardianName: e.target.value })} />
            </div>
            <div className="form-field">
              <label className="form-label">Relationship</label>
              <input className="form-input" placeholder="Father / Mother / Guardian" value={studentForm.guardianRelationship} onChange={(e) => setStudentForm({ ...studentForm, guardianRelationship: e.target.value })} />
            </div>
            <div className="form-field">
              <label className="form-label">Guardian Phone</label>
              <input className="form-input" value={studentForm.guardianPhone} onChange={(e) => setStudentForm({ ...studentForm, guardianPhone: e.target.value })} />
            </div>
            <div className="form-field">
              <label className="form-label">Internship Company</label>
              <input className="form-input" value={studentForm.internshipCompany} onChange={(e) => setStudentForm({ ...studentForm, internshipCompany: e.target.value })} />
            </div>
            <div className="form-field">
              <label className="form-label">Internship Role</label>
              <input className="form-input" value={studentForm.internshipRole} onChange={(e) => setStudentForm({ ...studentForm, internshipRole: e.target.value })} />
            </div>
            <div className="form-field">
              <label className="form-label">Placement Status</label>
              <select className="form-select" value={studentForm.placementStatus} onChange={(e) => setStudentForm({ ...studentForm, placementStatus: e.target.value })}>
                <option value="SEEKING">Seeking</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="PLACED">Placed</option>
                <option value="NOT_APPLICABLE">Not Applicable</option>
              </select>
            </div>
            <div className="form-field full">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                <Save size={15} /> {saving ? 'Saving...' : 'Save Student Profile'}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'role' && !isStudent && !isGuest && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Internal Employee & Role Assignment</h3>
            <StatusBadge status={profile?.employeeProfile?.employmentStatus || 'ACTIVE'} />
          </div>
          {profile?.employeeProfile ? (
            <div className="grid-2" style={{ gap: 14 }}>
              <div className="stepper-item" style={{ justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Employee Code</span>
                <strong>{profile.employeeProfile.employeeId}</strong>
              </div>
              <div className="stepper-item" style={{ justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Department</span>
                <strong>{profile.employeeProfile.departmentId?.name || profile?.department?.name || 'General'}</strong>
              </div>
              <div className="stepper-item" style={{ justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Designation</span>
                <strong>{profile.employeeProfile.designationId?.title || role}</strong>
              </div>
              <div className="stepper-item" style={{ justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Employment Type</span>
                <strong>{profile.employeeProfile.employmentType}</strong>
              </div>
              <div className="stepper-item" style={{ justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Joining Date</span>
                <strong>{formatDate(profile.employeeProfile.joiningDate)}</strong>
              </div>
              <div className="stepper-item" style={{ justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Assigned Roles</span>
                <strong>{(profile.roles || [role]).join(', ')}</strong>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', padding: '14px 0' }}>
              No linked employee HRMS record found for this account yet. An Admin can assign your department and employee record in Users & Roles.
            </div>
          )}
        </div>
      )}

      {activeTab === 'role' && isGuest && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Guest Event & Hackathon Registrations</h3>
          </div>
          <div className="table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Reg #</th>
                  <th>Event</th>
                  <th>Venue</th>
                  <th>Access Expiry</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(profile?.guestRegistrations || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      No active event registrations
                    </td>
                  </tr>
                ) : (
                  profile.guestRegistrations.map((reg) => (
                    <tr key={reg._id}>
                      <td style={{ fontWeight: 700 }}>{reg.registrationNumber}</td>
                      <td>{reg.eventId?.title} ({reg.eventId?.eventCode})</td>
                      <td>{reg.eventId?.venue || 'Online'}</td>
                      <td>{formatDateTime(reg.access?.expiresAt)}</td>
                      <td><StatusBadge status={reg.registrationStatus} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Security & Activity */}
      {activeTab === 'security' && (
        <div className="grid-2" style={{ gap: 20 }}>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title"><Shield size={16} /> Change Password</h3>
            </div>
            <form onSubmit={handleChangePassword} className="form-grid">
              <div className="form-field full">
                <label className="form-label">Current Password</label>
                <input
                  type="password"
                  required
                  className="form-input"
                  value={pwdForm.currentPassword}
                  onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
                />
              </div>
              <div className="form-field full">
                <label className="form-label">New Password (min 8 chars)</label>
                <input
                  type="password"
                  minLength={8}
                  required
                  className="form-input"
                  value={pwdForm.newPassword}
                  onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                />
              </div>
              <div className="form-field full">
                <label className="form-label">Confirm New Password</label>
                <input
                  type="password"
                  minLength={8}
                  required
                  className="form-input"
                  value={pwdForm.confirmPassword}
                  onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                />
              </div>
              <div className="form-field full">
                <button type="submit" className="btn btn-primary" disabled={changingPassword}>
                  <KeyRound size={15} /> {changingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title"><History size={16} /> Recent Login Activity</h3>
            </div>
            <div className="table-wrap">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Email / Role</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loginHistory.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No login events recorded yet
                      </td>
                    </tr>
                  ) : (
                    loginHistory.slice(0, 8).map((h) => (
                      <tr key={h._id}>
                        <td style={{ fontSize: 12 }}>{formatDateTime(h.createdAt)}</td>
                        <td style={{ fontSize: 12 }}>{h.email || profile?.email}</td>
                        <td><StatusBadge status={h.success ? 'ACTIVE' : 'FAILED'} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
