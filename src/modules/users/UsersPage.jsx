import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { UserPlus, Shield, Edit3, Crown } from 'lucide-react';
import api from '../../services/api';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { pushToast } from '../../app/uiSlice';
import { fetchCurrentUser } from '../../app/authSlice';
import { Modal } from '../../components/common/Modal';
import { StatusBadge } from '../../components/common/UI';
import { formatDateTime, formatRoleLabel } from '../../utils/format';

export function UsersPage() {
  const dispatch = useDispatch();
  const currentUser = useSelector((state) => state.auth.user);
  const isSuperAdmin = currentUser?.primaryRole === 'SUPER_ADMIN';

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [openModal, setOpenModal] = useState(false);
  const [rectifyUser, setRectifyUser] = useState(null);
  const [rectifying, setRectifying] = useState(false);

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    primaryRole: 'MENTOR',
    departmentId: '',
  });

  const [editForm, setEditForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    bio: '',
    primaryRole: 'MENTOR',
    status: 'ACTIVE',
    departmentId: '',
    designationId: '',
    newPassword: '',
    college: '',
    academicDepartment: '',
    academicYear: '',
    studentStatus: 'REGISTERED',
    guardianName: '',
    guardianPhone: '',
    employmentType: 'FULL_TIME',
    employmentStatus: 'ACTIVE',
  });

  const loadData = useCallback(async () => {
    const [uRes, rRes, dRes, gRes] = await Promise.all([
      api.get('/users', { params: { search, role: roleFilter || undefined } }),
      api.get('/roles'),
      api.get('/organization/departments'),
      api.get('/organization/designations'),
    ]);
    setUsers(uRes.data.data || []);
    setRoles(rRes.data.data || []);
    setDepartments(dRes.data.data || []);
    setDesignations(gRes.data.data || []);
  }, [search, roleFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRealtimeSync(loadData, ['users']);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users', {
        ...form,
        departmentId: form.departmentId || undefined,
      });
      dispatch(pushToast({ type: 'success', title: 'User Created', message: `${form.fullName} added` }));
      setOpenModal(false);
      setForm({ fullName: '', email: '', phone: '', password: '', primaryRole: 'MENTOR', departmentId: '' });
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed' }));
    }
  };

  const openRectifyModal = async (u) => {
    try {
      const res = await api.get(`/users/${u._id}`);
      const detail = res.data.data;
      setRectifyUser(detail);
      setEditForm({
        fullName: detail.fullName || '',
        email: detail.email || '',
        phone: detail.phone || '',
        bio: detail.bio || '',
        primaryRole: detail.primaryRole || 'STUDENT',
        status: detail.status || 'ACTIVE',
        departmentId: detail.departmentId?._id || detail.departmentId || detail.employeeProfile?.departmentId?._id || '',
        designationId: detail.employeeProfile?.designationId?._id || '',
        newPassword: '',
        college: detail.studentProfile?.college || '',
        academicDepartment: detail.studentProfile?.department || '',
        academicYear: detail.studentProfile?.academicYear || '',
        studentStatus: detail.studentProfile?.studentStatus || 'REGISTERED',
        guardianName: detail.studentProfile?.guardian?.name || '',
        guardianPhone: detail.studentProfile?.guardian?.phone || '',
        employmentType: detail.employeeProfile?.employmentType || 'FULL_TIME',
        employmentStatus: detail.employeeProfile?.employmentStatus || 'ACTIVE',
      });
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Could not load user profile' }));
    }
  };

  const handleRectifySave = async (e) => {
    e.preventDefault();
    if (!rectifyUser) return;
    setRectifying(true);
    try {
      const payload = {
        fullName: editForm.fullName,
        email: editForm.email,
        phone: editForm.phone,
        bio: editForm.bio,
        primaryRole: editForm.primaryRole,
        status: editForm.status,
        departmentId: editForm.departmentId || null,
        designationId: editForm.designationId || null,
        ...(editForm.newPassword ? { newPassword: editForm.newPassword } : {}),
      };

      if (editForm.primaryRole === 'STUDENT') {
        payload.studentProfile = {
          college: editForm.college,
          department: editForm.academicDepartment,
          academicYear: editForm.academicYear,
          studentStatus: editForm.studentStatus,
          guardian: {
            name: editForm.guardianName,
            phone: editForm.guardianPhone,
          },
        };
      } else if (editForm.primaryRole !== 'GUEST') {
        payload.employeeProfile = {
          employmentType: editForm.employmentType,
          employmentStatus: editForm.employmentStatus,
        };
      }

      await api.patch(`/users/${rectifyUser._id}`, payload);
      dispatch(pushToast({ type: 'success', title: 'Profile Rectified', message: `${editForm.fullName} updated successfully` }));
      if (String(rectifyUser._id) === String(currentUser?._id)) {
        dispatch(fetchCurrentUser());
      }
      setRectifyUser(null);
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Rectification Failed', message: err.response?.data?.message || 'Failed to update profile' }));
    } finally {
      setRectifying(false);
    }
  };

  const toggleStatus = async (user) => {
    const nextStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.patch(`/users/${user._id}/status`, { status: nextStatus });
      dispatch(pushToast({ type: 'info', title: 'Status Updated', message: `${user.fullName} is now ${nextStatus}` }));
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed' }));
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Users & Role Management{' '}
            {isSuperAdmin && (
              <span className="badge badge-info" style={{ verticalAlign: 'middle', marginLeft: 8 }}>
                <Crown size={12} /> CEO Read-Only
              </span>
            )}
          </h1>
          <p className="page-subtitle">
            {isSuperAdmin
              ? 'Read-only directory view of organization users, roles, and access scopes (managed operationally by Admin)'
              : 'Manage accounts, profile rectification, role assignments, and RBAC permission scopes'}
          </p>
        </div>
        {!isSuperAdmin && (
          <button type="button" className="btn btn-primary" onClick={() => setOpenModal(true)}>
            <UserPlus size={15} /> Add User
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <input
            className="form-input"
            style={{ maxWidth: 300 }}
            placeholder="Search name, email or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="form-select" style={{ maxWidth: 200 }} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="">All Roles</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="ADMIN">Admin</option>
            <option value="COORDINATOR">Course Coordinator</option>
            <option value="MENTOR">Mentor</option>
            <option value="STUDENT">Student</option>
            <option value="GUEST">Guest</option>
          </select>
        </div>

        <div className="table-wrap">
          <table className="erp-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Department / Type</th>
                <th>Status</th>
                <th>Last Login</th>
                {!isSuperAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{u.fullName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {u.email}{u.phone ? ` • ${u.phone}` : ''}
                    </div>
                  </td>
                  <td><span className="badge badge-primary">{formatRoleLabel(u.primaryRole)}</span></td>
                  <td>{u.departmentId?.name || u.accountType}</td>
                  <td><StatusBadge status={u.status} /></td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDateTime(u.lastLoginAt)}</td>
                  {!isSuperAdmin && (
                    <td>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {u.primaryRole !== 'SUPER_ADMIN' && (
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => openRectifyModal(u)}>
                            <Edit3 size={13} /> Rectify
                          </button>
                        )}
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => toggleStatus(u)}>
                          {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      <Modal open={openModal} onClose={() => setOpenModal(false)} title="Create User Account">
        <form onSubmit={handleCreate} className="form-grid">
          <div className="form-field full">
            <label className="form-label">Full Name</label>
            <input className="form-input" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Email</label>
            <input type="email" className="form-input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Phone</label>
            <input className="form-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Primary Role</label>
            <select className="form-select" value={form.primaryRole} onChange={(e) => setForm({ ...form, primaryRole: e.target.value })}>
              <option value="ADMIN">Admin</option>
              <option value="COORDINATOR">Course Coordinator</option>
              <option value="MENTOR">Mentor</option>
              <option value="STUDENT">Student</option>
              <option value="GUEST">Guest</option>
              {isSuperAdmin && <option value="SUPER_ADMIN">Super Admin</option>}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Department</label>
            <select className="form-select" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
              <option value="">Default Department</option>
              {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>
          <div className="form-field full">
            <label className="form-label">Password (min 8 chars)</label>
            <input type="password" minLength={8} required className="form-input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="form-field full">
            <button type="submit" className="btn btn-primary">Create User</button>
          </div>
        </form>
      </Modal>

      {/* Rectify User Profile Modal */}
      <Modal
        open={Boolean(rectifyUser)}
        onClose={() => setRectifyUser(null)}
        title={`Rectify Profile — ${rectifyUser?.fullName || ''}`}
        maxWidth={680}
      >
        <form onSubmit={handleRectifySave} className="form-grid">
          <div className="form-field">
            <label className="form-label">Full Name</label>
            <input className="form-input" required value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Email Address</label>
            <input type="email" className="form-input" required value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Phone</label>
            <input className="form-input" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Primary Role</label>
            <select className="form-select" value={editForm.primaryRole} onChange={(e) => setEditForm({ ...editForm, primaryRole: e.target.value })}>
              <option value="ADMIN">Admin</option>
              <option value="COORDINATOR">Course Coordinator</option>
              <option value="MENTOR">Mentor</option>
              <option value="STUDENT">Student</option>
              <option value="GUEST">Guest</option>
              {isSuperAdmin && <option value="SUPER_ADMIN">Super Admin</option>}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Account Status</label>
            <select className="form-select" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="PENDING_VERIFICATION">PENDING VERIFICATION</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Reset Password (Optional)</label>
            <input
              type="password"
              minLength={8}
              placeholder="Leave blank to keep existing"
              className="form-input"
              value={editForm.newPassword}
              onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
            />
          </div>

          {editForm.primaryRole === 'STUDENT' ? (
            <>
              <div className="form-field">
                <label className="form-label">College</label>
                <input className="form-input" value={editForm.college} onChange={(e) => setEditForm({ ...editForm, college: e.target.value })} />
              </div>
              <div className="form-field">
                <label className="form-label">Academic Department</label>
                <input className="form-input" value={editForm.academicDepartment} onChange={(e) => setEditForm({ ...editForm, academicDepartment: e.target.value })} />
              </div>
              <div className="form-field">
                <label className="form-label">Academic Year</label>
                <input className="form-input" value={editForm.academicYear} onChange={(e) => setEditForm({ ...editForm, academicYear: e.target.value })} />
              </div>
              <div className="form-field">
                <label className="form-label">Student Status</label>
                <select className="form-select" value={editForm.studentStatus} onChange={(e) => setEditForm({ ...editForm, studentStatus: e.target.value })}>
                  <option value="REGISTERED">REGISTERED</option>
                  <option value="ENROLLED">ENROLLED</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="ON_HOLD">ON HOLD</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">Guardian Name</label>
                <input className="form-input" value={editForm.guardianName} onChange={(e) => setEditForm({ ...editForm, guardianName: e.target.value })} />
              </div>
              <div className="form-field">
                <label className="form-label">Guardian Phone</label>
                <input className="form-input" value={editForm.guardianPhone} onChange={(e) => setEditForm({ ...editForm, guardianPhone: e.target.value })} />
              </div>
            </>
          ) : editForm.primaryRole !== 'GUEST' ? (
            <>
              <div className="form-field">
                <label className="form-label">Department</label>
                <select className="form-select" value={editForm.departmentId} onChange={(e) => setEditForm({ ...editForm, departmentId: e.target.value })}>
                  <option value="">Select Department</option>
                  {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">Designation</label>
                <select className="form-select" value={editForm.designationId} onChange={(e) => setEditForm({ ...editForm, designationId: e.target.value })}>
                  <option value="">Select Designation</option>
                  {designations.map((g) => <option key={g._id} value={g._id}>{g.title}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">Employment Type</label>
                <select className="form-select" value={editForm.employmentType} onChange={(e) => setEditForm({ ...editForm, employmentType: e.target.value })}>
                  <option value="FULL_TIME">FULL TIME</option>
                  <option value="PART_TIME">PART TIME</option>
                  <option value="CONTRACT">CONTRACT</option>
                  <option value="INTERN">INTERN</option>
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">Employment Status</label>
                <select className="form-select" value={editForm.employmentStatus} onChange={(e) => setEditForm({ ...editForm, employmentStatus: e.target.value })}>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PROBATION">PROBATION</option>
                  <option value="ON_LEAVE">ON LEAVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
            </>
          ) : null}

          <div className="form-field full">
            <label className="form-label">Bio / Notes</label>
            <textarea className="form-input" rows={2} value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} />
          </div>

          <div className="form-field full">
            <button type="submit" className="btn btn-primary" disabled={rectifying}>
              {rectifying ? 'Saving Rectification...' : 'Save Rectified Profile'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
