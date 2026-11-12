import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, Search } from 'lucide-react';
import api from '../../services/api';
import { CraffixLogo } from '../../components/common/CraffixLogo';
import { StatusBadge } from '../../components/common/UI';
import { formatDate } from '../../utils/format';

export function PublicVerifyPage() {
  const { token: urlToken } = useParams();
  const [query, setQuery] = useState(urlToken || '');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const verifyToken = async (val) => {
    if (!val?.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await api.get(`/public/certificates/verify/${encodeURIComponent(val.trim())}`);
      setResult(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Certificate not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (urlToken) verifyToken(urlToken);
  }, [urlToken]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)' }}>
      <header className="erp-topbar">
        <CraffixLogo variant="light" size={28} showWordmark />
        <Link to="/login" className="btn btn-primary btn-sm">Sign In to Portal</Link>
      </header>

      <div className="erp-content" style={{ maxWidth: 680 }}>
        <div className="card" style={{ padding: 28 }}>
          <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800 }}>Certificate Verification</h1>
          <p style={{ margin: '0 0 20px', fontSize: 13.5, color: 'var(--text-muted)' }}>
            Enter a Certificate Number (e.g. CFX-CERT-2026-0001) or QR verification token to verify authenticity.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              verifyToken(query);
            }}
            style={{ display: 'flex', gap: 10, marginBottom: 20 }}
          >
            <input
              className="form-input"
              placeholder="Certificate Number or Verification Token..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <Search size={15} /> {loading ? 'Checking...' : 'Verify'}
            </button>
          </form>

          {error && (
            <div style={{ padding: 16, borderRadius: 12, background: 'var(--color-danger-soft)', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <ShieldAlert size={20} />
              <span style={{ fontWeight: 600 }}>{error}</span>
            </div>
          )}

          {result && (
            <div
              style={{
                padding: 20,
                borderRadius: 14,
                border: '1px solid var(--border-color)',
                background: 'var(--bg-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: result.valid ? '#059669' : 'var(--color-danger)', fontWeight: 800 }}>
                  {result.valid ? <ShieldCheck size={22} /> : <ShieldAlert size={22} />}
                  <span>{result.valid ? 'VERIFIED AUTHENTIC CERTIFICATE' : 'CERTIFICATE REVOKED'}</span>
                </div>
                <StatusBadge status={result.status} />
              </div>

              <div className="form-grid">
                <div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Recipient</div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{result.recipientName}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Certificate Number</div>
                  <div style={{ fontWeight: 700 }}>{result.certificateNumber}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Program / Event</div>
                  <div style={{ fontWeight: 600 }}>{result.programTitle}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Issued Date</div>
                  <div style={{ fontWeight: 600 }}>{formatDate(result.issuedAt)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
