import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Save } from 'lucide-react';
import api from '../../services/api';
import { pushToast } from '../../app/uiSlice';

export function SettingsPage() {
  const dispatch = useDispatch();
  const [form, setForm] = useState({
    name: '',
    productName: '',
    tagline: '',
    email: '',
    phone: '',
    website: '',
    expenseApprovalLimit: 10000,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/organization/settings').then((res) => {
      if (res.data.data) {
        setForm((prev) => ({ ...prev, ...res.data.data }));
      }
    });
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch('/organization/settings', {
        ...form,
        expenseApprovalLimit: Number(form.expenseApprovalLimit),
      });
      dispatch(pushToast({ type: 'success', title: 'Saved', message: 'System settings updated' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">System Settings</h1>
          <p className="page-subtitle">Configure CraffixWeb Technologies organizational identity and approval thresholds</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 720 }}>
        <form onSubmit={handleSave} className="form-grid">
          <div className="form-field">
            <label className="form-label">Organization Name</label>
            <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Product Name</label>
            <input className="form-input" value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} />
          </div>
          <div className="form-field full">
            <label className="form-label">Official Tagline</label>
            <input className="form-input" value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Contact Email</label>
            <input className="form-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Contact Phone</label>
            <input className="form-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Website</label>
            <input className="form-input" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Expense Hierarchy Approval Limit (INR)</label>
            <input type="number" className="form-input" value={form.expenseApprovalLimit} onChange={(e) => setForm({ ...form, expenseApprovalLimit: e.target.value })} />
          </div>
          <div className="form-field full">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={15} /> {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
