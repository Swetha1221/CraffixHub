import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { CalendarCheck, FileText, FileSpreadsheet, FileType2 } from 'lucide-react';
import api from '../../services/api';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { pushToast } from '../../app/uiSlice';
import { StatusBadge } from '../../components/common/UI';
import { formatDate, formatDateTime } from '../../utils/format';
import { exportToPdf, exportToXlsx, exportToDocx } from '../../utils/exporters';

export function AttendancePage() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const canMark = ['ADMIN', 'COORDINATOR', 'MENTOR'].includes(user?.primaryRole);
  const canExport = true;

  const [records, setRecords] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().slice(0, 10));
  const [enrollments, setEnrollments] = useState([]);
  const [marks, setMarks] = useState({});

  const loadData = useCallback(async () => {
    const aRes = await api.get('/attendance/students', { params: { batchId: selectedBatch || undefined } });
    setRecords(aRes.data.data || []);
    if (canMark) {
      const bRes = await api.get('/batches');
      const bList = bRes.data.data || [];
      setBatches(bList);
      if (!selectedBatch && bList[0]?._id) {
        setSelectedBatch(bList[0]._id);
      }
    }
  }, [selectedBatch, canMark]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!canMark || !selectedBatch) return;
    api.get('/enrollments', { params: { batchId: selectedBatch } }).then((res) => {
      const list = res.data.data || [];
      setEnrollments(list);
      const init = {};
      list.forEach((e) => {
        init[e.studentId?._id] = 'PRESENT';
      });
      setMarks(init);
    });
  }, [selectedBatch, canMark]);

  useRealtimeSync(loadData, ['attendance']);

  const submitBatchAttendance = async () => {
    const entries = Object.entries(marks)
      .filter(([sid]) => sid)
      .map(([studentId, status]) => ({ studentId, status }));
    if (entries.length === 0) return;

    await api.post('/attendance/students/mark', {
      batchId: selectedBatch,
      sessionDate,
      entries,
    });
    dispatch(pushToast({ type: 'success', title: 'Attendance Saved', message: `Marked ${entries.length} student(s)` }));
    loadData();
  };

  const buildAttendanceRows = () =>
    records.map((r) => ({
      Date: formatDate(r.sessionDate),
      Batch: r.batchId?.batchCode || '-',
      Student: r.studentId?.userId?.fullName || '-',
      Status: r.status || '-',
      MarkedBy: r.markedBy?.fullName || '-',
    }));

  const handleExportAttendance = (type) => {
    const rows = buildAttendanceRows();
    const subtitle = `Generated ${formatDateTime(new Date())} by ${user?.fullName || 'CraffixHub'}`;
    if (type === 'pdf') exportToPdf('craffixhub-attendance.pdf', 'Attendance History Report', rows, subtitle);
    if (type === 'xlsx') exportToXlsx('craffixhub-attendance.xlsx', 'Attendance', rows);
    if (type === 'docx') exportToDocx('craffixhub-attendance.docx', 'Attendance History Report', rows, subtitle);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance Management</h1>
          <p className="page-subtitle">Batch session attendance marking and audit history</p>
        </div>
        {canExport && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => handleExportAttendance('pdf')}>
              <FileText size={14} /> Export PDF
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => handleExportAttendance('xlsx')}>
              <FileSpreadsheet size={14} /> Export Excel (.xlsx)
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => handleExportAttendance('docx')}>
              <FileType2 size={14} /> Export Word (.docx)
            </button>
          </div>
        )}
      </div>

      {canMark && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-header">
            <h3 className="card-title">Mark Batch Attendance</h3>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <select className="form-select" style={{ width: 200 }} value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)}>
                {batches.map((b) => <option key={b._id} value={b._id}>{b.batchCode} — {b.courseId?.title}</option>)}
              </select>
              <input type="date" className="form-input" style={{ width: 160 }} value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
              <button type="button" className="btn btn-primary" onClick={submitBatchAttendance}>
                <CalendarCheck size={15} /> Save Attendance
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Name</th>
                  <th>Attendance Status</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((enr) => {
                  const sid = enr.studentId?._id;
                  return (
                    <tr key={enr._id}>
                      <td style={{ fontWeight: 700 }}>{enr.studentId?.studentId}</td>
                      <td>{enr.studentId?.userId?.fullName}</td>
                      <td>
                        <select
                          className="form-select"
                          style={{ maxWidth: 160 }}
                          value={marks[sid] || 'PRESENT'}
                          onChange={(e) => setMarks({ ...marks, [sid]: e.target.value })}
                        >
                          <option value="PRESENT">Present</option>
                          <option value="ABSENT">Absent</option>
                          <option value="LATE">Late</option>
                          <option value="EXCUSED">Excused</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Attendance History ({records.length})</h3>
        </div>
        <div className="table-wrap">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Batch</th>
                <th>Student</th>
                <th>Status</th>
                <th>Marked By</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r._id}>
                  <td>{formatDate(r.sessionDate)}</td>
                  <td style={{ fontWeight: 700 }}>{r.batchId?.batchCode}</td>
                  <td>{r.studentId?.userId?.fullName}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{r.markedBy?.fullName || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
