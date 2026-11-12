import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { FileText, FileSpreadsheet, FileType2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import api from '../../services/api';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { StatCard } from '../../components/common/UI';
import { formatINR, formatDateTime, formatRoleLabel } from '../../utils/format';
import { exportToPdf, exportToXlsx, exportToDocx } from '../../utils/exporters';

export function ReportsPage() {
  const user = useSelector((state) => state.auth.user);
  const canAudit = ['SUPER_ADMIN', 'ADMIN'].includes(user?.primaryRole);

  const [financeReport, setFinanceReport] = useState(null);
  const [courseReport, setCourseReport] = useState([]);
  const [eventReport, setEventReport] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  const loadData = useCallback(async () => {
    const reqs = [
      api.get('/reports/finance'),
      api.get('/reports/courses'),
      api.get('/reports/events'),
    ];
    if (canAudit) reqs.push(api.get('/audit-logs?limit=25'));
    const [fRes, cRes, eRes, aRes] = await Promise.all(reqs);
    setFinanceReport(fRes.data.data);
    setCourseReport(cRes.data.data || []);
    setEventReport(eRes.data.data || []);
    if (aRes) setAuditLogs(aRes.data.data || []);
  }, [canAudit]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRealtimeSync(loadData);

  const buildReportExportRows = () => {
    const rows = [];
    if (financeReport?.summary) {
      rows.push({
        Section: 'Finance Summary',
        Item: 'Total Collected',
        Value: formatINR(financeReport.summary.totalCollected),
        Count: '',
      });
      rows.push({
        Section: 'Finance Summary',
        Item: 'Outstanding Dues',
        Value: formatINR(financeReport.summary.totalOutstanding),
        Count: '',
      });
      rows.push({
        Section: 'Finance Summary',
        Item: 'Approved Expenses',
        Value: formatINR(financeReport.summary.approvedExpenses),
        Count: '',
      });
      rows.push({
        Section: 'Finance Summary',
        Item: 'Net Cashflow',
        Value: formatINR(financeReport.summary.netCashflow),
        Count: '',
      });
    }
    (financeReport?.courseWiseRevenue || []).forEach((c) => {
      rows.push({
        Section: 'Course Revenue',
        Item: c.courseTitle || c.courseCode || c._id || 'Course',
        Value: formatINR(c.revenue || c.collected || 0),
        Count: c.enrollments ?? '',
      });
    });
    courseReport.forEach((c) => {
      rows.push({
        Section: 'Course Enrolments',
        Item: `${c.courseCode || ''} ${c.courseTitle || ''}`.trim(),
        Value: '',
        Count: c.enrollments ?? 0,
      });
    });
    eventReport.forEach((ev) => {
      rows.push({
        Section: 'Event Participation',
        Item: ev.title || 'Event',
        Value: '',
        Count: ev.participants ?? 0,
      });
    });
    return rows;
  };

  const buildAuditExportRows = () =>
    auditLogs.map((log) => ({
      Timestamp: formatDateTime(log.createdAt),
      Actor: log.actorName || 'System',
      Role: formatRoleLabel(log.actorRole),
      Module: log.module || '-',
      Action: log.action || '-',
      Summary: log.summary || '-',
    }));

  const exportReports = (type) => {
    const rows = buildReportExportRows();
    const subtitle = `Generated ${formatDateTime(new Date())} by ${user?.fullName || 'CraffixHub'}`;
    if (type === 'pdf') exportToPdf('craffixhub-reports.pdf', 'CraffixHub Reports & Analytics', rows, subtitle);
    if (type === 'xlsx') exportToXlsx('craffixhub-reports.xlsx', 'Reports', rows);
    if (type === 'docx') exportToDocx('craffixhub-reports.docx', 'CraffixHub Reports & Analytics', rows, subtitle);
  };

  const exportAudit = (type) => {
    const rows = buildAuditExportRows();
    const subtitle = `Generated ${formatDateTime(new Date())} by ${user?.fullName || 'CraffixHub'}`;
    if (type === 'pdf') exportToPdf('craffixhub-audit-logs.pdf', 'System Audit Logs', rows, subtitle);
    if (type === 'xlsx') exportToXlsx('craffixhub-audit-logs.xlsx', 'Audit Logs', rows);
    if (type === 'docx') exportToDocx('craffixhub-audit-logs.docx', 'System Audit Logs', rows, subtitle);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Real-time aggregation pipelines, course revenue, and system audit logs</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => exportReports('pdf')}>
            <FileText size={14} /> Export PDF
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => exportReports('xlsx')}>
            <FileSpreadsheet size={14} /> Export Excel (.xlsx)
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => exportReports('docx')}>
            <FileType2 size={14} /> Export Word (.docx)
          </button>
        </div>
      </div>

      {financeReport && (
        <div className="kpi-grid">
          <StatCard label="Total Collected" value={formatINR(financeReport.summary.totalCollected)} />
          <StatCard label="Outstanding Dues" value={formatINR(financeReport.summary.totalOutstanding)} />
          <StatCard label="Approved Expenses" value={formatINR(financeReport.summary.approvedExpenses)} />
          <StatCard label="Net Cashflow" value={formatINR(financeReport.summary.netCashflow)} />
        </div>
      )}

      <div className="grid-2" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Course-Wise Enrolments</h3>
          </div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={courseReport}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="courseCode" stroke="var(--text-muted)" fontSize={12} />
                <YAxis stroke="var(--text-muted)" fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="enrollments" fill="#6C63FF" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Event Participation</h3>
          </div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={eventReport}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="title" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="participants" fill="#4136B6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {canAudit && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h3 className="card-title">System Audit Logs (Append-Only)</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => exportAudit('pdf')}>
                <FileText size={14} /> PDF
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => exportAudit('xlsx')}>
                <FileSpreadsheet size={14} /> Excel (.xlsx)
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => exportAudit('docx')}>
                <FileType2 size={14} /> Word (.docx)
              </button>
            </div>
          </div>
          <div className="table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor</th>
                  <th>Module</th>
                  <th>Action</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log._id}>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDateTime(log.createdAt)}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{log.actorName}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatRoleLabel(log.actorRole)}</div>
                    </td>
                    <td><span className="badge badge-primary">{log.module}</span></td>
                    <td style={{ fontWeight: 600 }}>{log.action}</td>
                    <td>{log.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
