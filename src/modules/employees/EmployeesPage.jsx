import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { UserPlus } from 'lucide-react';
import api from '../../services/api';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { pushToast } from '../../app/uiSlice';
import { Modal } from '../../components/common/Modal';
import { StatusBadge } from '../../components/common/UI';
import { formatDate, formatINR, formatRoleLabel } from '../../utils/format';

export function EmployeesPage() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const canCreate = ['ADMIN'].includes(user?.primaryRole);

  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    primaryRole: 'MENTOR',
    departmentId: '',
    designationId: '',
    employmentType: 'FULL_TIME',
    basicSalary: '',
    allowances: '',
  });

  const loadData = useCallback(async () => {
    const [eRes, dRes, desRes] = await Promise.all([
      api.get('/employees', { params: { search } }),
      api.get('/organization/departments'),
      api.get('/organization/designations'),
    ]);
    setEmployees(eRes.data.data || []);
    const depts = dRes.data.data || [];
    const desigs = desRes.data.data || [];
    setDepartments(depts);
    setDesignations(desigs);
    setForm((prev) => ({
      ...prev,
      departmentId: prev.departmentId || depts[0]?._id || '',
      designationId: prev.designationId || desigs[0]?._id || '',
    }));
  }, [search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRealtimeSync(loadData, ['employees']);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/employees', {
        ...form,
        basicSalary: Number(form.basicSalary),
        allowances: Number(form.allowances),
      });
      dispatch(pushToast({ type: 'success', title: 'Employee Added', message: form.fullName }));
      setModalOpen(false);
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed' }));
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Employee Management</h1>
          <p className="page-subtitle">Employee directory, department assignments & employment status</p>
        </div>
        {canCreate && (
          <button type="button" className="btn btn-primary" onClick={() => setModalOpen(true)}>
            <UserPlus size={15} /> Onboard Employee
          </button>
        )}
      </div>

      <div className="card">
        <div style={{ marginBottom: 16 }}>
          <input
            className="form-input"
            style={{ maxWidth: 320 }}
            placeholder="Search employee ID, name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="table-wrap">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Employee ID</th>
                <th>Name</th>
                <th>Department</th>
                <th>Designation</th>
                <th>Role</th>
                <th>Joined</th>
                {canCreate && <th>Compensation</th>}
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp._id}>
                  <td style={{ fontWeight: 700 }}>{emp.employeeId}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{emp.userId?.fullName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{emp.userId?.email}</div>
                  </td>
                  <td>{emp.departmentId?.name || '—'}</td>
                  <td>{emp.designationId?.title || '—'}</td>
                  <td><span className="badge badge-primary">{formatRoleLabel(emp.userId?.primaryRole)}</span></td>
                  <td>{formatDate(emp.joiningDate)}</td>
                  {canCreate && (
                    <td style={{ fontWeight: 600 }}>
                      {formatINR((emp.salaryStructure?.basic || 0) + (emp.salaryStructure?.allowances || 0))}
                    </td>
                  )}
                  <td><StatusBadge status={emp.employmentStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Onboard New Employee">
        <form onSubmit={handleCreate} className="form-grid">
          <div className="form-field">
            <label className="form-label">Full Name</label>
            <input className="form-input" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Email</label>
            <input type="email" className="form-input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Account Password (min 8 chars)</label>
            <input type="password" minLength={8} className="form-input" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Phone</label>
            <input className="form-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Role</label>
            <select className="form-select" value={form.primaryRole} onChange={(e) => setForm({ ...form, primaryRole: e.target.value })}>
              <option value="MENTOR">Mentor</option>
              <option value="COORDINATOR">Course Coordinator</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Employment Type</label>
            <select className="form-select" value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })}>
              <option value="FULL_TIME">Full Time</option>
              <option value="PART_TIME">Part Time</option>
              <option value="CONTRACT">Contract</option>
              <option value="INTERN">Intern</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Department</label>
            <select className="form-select" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
              {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Designation</label>
            <select className="form-select" value={form.designationId} onChange={(e) => setForm({ ...form, designationId: e.target.value })}>
              {designations.map((d) => <option key={d._id} value={d._id}>{d.title}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Basic Salary (INR)</label>
            <input type="number" className="form-input" value={form.basicSalary} onChange={(e) => setForm({ ...form, basicSalary: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Allowances (INR)</label>
            <input type="number" className="form-input" value={form.allowances} onChange={(e) => setForm({ ...form, allowances: e.target.value })} />
          </div>
          <div className="form-field full">
            <button type="submit" className="btn btn-primary">Register Employee</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
