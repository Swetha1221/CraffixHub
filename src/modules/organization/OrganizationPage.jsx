import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Building2, Megaphone, Plus } from 'lucide-react';
import api from '../../services/api';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { pushToast } from '../../app/uiSlice';
import { Modal } from '../../components/common/Modal';
import { StatusBadge } from '../../components/common/UI';
import { formatDate } from '../../utils/format';

export function OrganizationPage() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const canManage = ['ADMIN'].includes(user?.primaryRole);

  const [org, setOrg] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [deptModal, setDeptModal] = useState(false);
  const [annModal, setAnnModal] = useState(false);
  const [deptForm, setDeptForm] = useState({ name: '', code: '', description: '' });
  const [annForm, setAnnForm] = useState({ title: '', content: '', audience: 'ALL', priority: 'NORMAL' });

  const loadData = useCallback(async () => {
    const [oRes, dRes, desRes, aRes] = await Promise.all([
      api.get('/organization/settings'),
      api.get('/organization/departments'),
      api.get('/organization/designations'),
      api.get('/organization/announcements'),
    ]);
    setOrg(oRes.data.data);
    setDepartments(dRes.data.data || []);
    setDesignations(desRes.data.data || []);
    setAnnouncements(aRes.data.data || []);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRealtimeSync(loadData, ['organization', 'announcements']);

  const createDept = async (e) => {
    e.preventDefault();
    try {
      await api.post('/organization/departments', deptForm);
      dispatch(pushToast({ type: 'success', title: 'Department Added', message: deptForm.name }));
      setDeptModal(false);
      setDeptForm({ name: '', code: '', description: '' });
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed' }));
    }
  };

  const createAnnouncement = async (e) => {
    e.preventDefault();
    try {
      await api.post('/organization/announcements', annForm);
      dispatch(pushToast({ type: 'success', title: 'Published', message: 'Announcement sent' }));
      setAnnModal(false);
      setAnnForm({ title: '', content: '', audience: 'ALL', priority: 'NORMAL' });
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed' }));
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Organization Management</h1>
          <p className="page-subtitle">Departments, designations, branches & internal announcements</p>
        </div>
        {canManage && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-outline" onClick={() => setAnnModal(true)}>
              <Megaphone size={15} /> New Announcement
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setDeptModal(true)}>
              <Plus size={15} /> Add Department
            </button>
          </div>
        )}
      </div>

      {org && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="kpi-icon-box" style={{ background: 'var(--color-secondary-soft)', color: 'var(--color-secondary)' }}>
              <Building2 size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{org.name}</h3>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {org.tagline} • {org.email} • {org.phone}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Departments ({departments.length})</h3>
          </div>
          <div className="table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Department</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((d) => (
                  <tr key={d._id}>
                    <td><span className="badge badge-primary">{d.code}</span></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{d.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d.description}</div>
                    </td>
                    <td><StatusBadge status={d.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Announcements</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {announcements.map((a) => (
              <div key={a._id} style={{ padding: 14, borderRadius: 12, background: 'var(--bg-subtle)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700 }}>{a.title}</span>
                  <StatusBadge status={a.priority} />
                </div>
                <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--text-secondary)' }}>{a.content}</p>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  Audience: {a.audience} • {formatDate(a.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-header">
          <h3 className="card-title">Designations ({designations.length})</h3>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {designations.map((des) => (
            <div key={des._id} className="stepper-item" style={{ padding: '10px 14px' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{des.title}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  {des.code} • {des.departmentId?.name || 'General'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal open={deptModal} onClose={() => setDeptModal(false)} title="Create Department">
        <form onSubmit={createDept} className="form-grid">
          <div className="form-field">
            <label className="form-label">Name</label>
            <input className="form-input" required value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Code</label>
            <input className="form-input" required value={deptForm.code} onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })} />
          </div>
          <div className="form-field full">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" rows={3} value={deptForm.description} onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })} />
          </div>
          <div className="form-field full">
            <button type="submit" className="btn btn-primary">Save Department</button>
          </div>
        </form>
      </Modal>

      <Modal open={annModal} onClose={() => setAnnModal(false)} title="Publish Announcement">
        <form onSubmit={createAnnouncement} className="form-grid">
          <div className="form-field full">
            <label className="form-label">Title</label>
            <input className="form-input" required value={annForm.title} onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Audience</label>
            <select className="form-select" value={annForm.audience} onChange={(e) => setAnnForm({ ...annForm, audience: e.target.value })}>
              <option value="ALL">All Users</option>
              <option value="EMPLOYEES">Employees</option>
              <option value="STUDENTS">Students</option>
              <option value="MENTORS">Mentors</option>
              <option value="EVENT">Event Participants</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Priority</label>
            <select className="form-select" value={annForm.priority} onChange={(e) => setAnnForm({ ...annForm, priority: e.target.value })}>
              <option value="NORMAL">Normal</option>
              <option value="IMPORTANT">Important</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
          <div className="form-field full">
            <label className="form-label">Content</label>
            <textarea className="form-textarea" rows={4} required value={annForm.content} onChange={(e) => setAnnForm({ ...annForm, content: e.target.value })} />
          </div>
          <div className="form-field full">
            <button type="submit" className="btn btn-primary">Publish</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
