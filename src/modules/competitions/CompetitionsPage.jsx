import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Trophy, Users, Upload, Star } from 'lucide-react';
import api from '../../services/api';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { pushToast } from '../../app/uiSlice';
import { Modal } from '../../components/common/Modal';
import { StatusBadge } from '../../components/common/UI';

export function CompetitionsPage() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const canJudge = ['ADMIN', 'COORDINATOR', 'MENTOR'].includes(user?.primaryRole);
  const canPublish = ['ADMIN', 'COORDINATOR'].includes(user?.primaryRole);
  const isParticipant = ['STUDENT', 'GUEST'].includes(user?.primaryRole);

  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [teams, setTeams] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);

  const [teamModal, setTeamModal] = useState(false);
  const [subModal, setSubModal] = useState(false);
  const [scoreTarget, setScoreTarget] = useState(null);

  const [teamForm, setTeamForm] = useState({ teamName: '', track: '' });
  const [subForm, setSubForm] = useState({ projectTitle: '', summary: '', githubUrl: '', teamId: '' });
  const [scoreMap, setScoreMap] = useState({});
  const [feedback, setFeedback] = useState('');

  const loadEvents = useCallback(async () => {
    const res = await api.get('/events');
    const list = res.data.data || [];
    setEvents(list);
    if (!selectedEventId && list[0]?._id) {
      setSelectedEventId(list[0]._id);
    }
  }, [selectedEventId]);

  const loadDetails = useCallback(async () => {
    if (!selectedEventId) return;
    const [tRes, sRes, rRes] = await Promise.all([
      api.get(`/events/${selectedEventId}/teams`),
      api.get(`/events/${selectedEventId}/submissions`),
      api.get(`/events/${selectedEventId}/results`),
    ]);
    const tList = tRes.data.data || [];
    setTeams(tList);
    setSubmissions(sRes.data.data || []);
    setLeaderboard(rRes.data.data?.leaderboard || []);
    setSubForm((prev) => ({ ...prev, teamId: prev.teamId || tList[0]?._id || '' }));
  }, [selectedEventId]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  useRealtimeSync(loadDetails, ['competitions', 'events']);

  const selectedEvent = events.find((e) => e._id === selectedEventId);

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/events/${selectedEventId}/teams`, teamForm);
      dispatch(pushToast({ type: 'success', title: 'Team Formed', message: teamForm.teamName }));
      setTeamModal(false);
      setTeamForm({ teamName: '', track: '' });
      loadDetails();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed' }));
    }
  };

  const handleSubmitProject = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/events/${selectedEventId}/submissions`, subForm);
      dispatch(pushToast({ type: 'success', title: 'Project Submitted', message: subForm.projectTitle }));
      setSubModal(false);
      loadDetails();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed' }));
    }
  };

  const openScoring = (sub) => {
    const criteria = selectedEvent?.judgingCriteria || [];
    const init = {};
    criteria.forEach((c) => {
      init[c.criterion] = '';
    });
    setScoreMap(init);
    setFeedback('');
    setScoreTarget(sub);
  };

  const handleScoreSubmit = async (e) => {
    e.preventDefault();
    const criteria = selectedEvent?.judgingCriteria || [];
    const scores = criteria.map((c) => ({
      criterion: c.criterion,
      maxMarks: c.maxMarks,
      score: Number(scoreMap[c.criterion] || 0),
    }));
    await api.post('/evaluations', {
      eventId: selectedEventId,
      submissionId: scoreTarget._id,
      scores,
      feedback,
    });
    dispatch(pushToast({ type: 'success', title: 'Score Saved', message: 'Leaderboard updated in real time' }));
    setScoreTarget(null);
    loadDetails();
  };

  const handlePublishResults = async () => {
    await api.post(`/events/${selectedEventId}/publish-results`);
    dispatch(pushToast({ type: 'success', title: 'Results Published', message: 'Winners & leaderboard finalized' }));
    loadDetails();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Competitions & Leaderboard</h1>
          <p className="page-subtitle">Teams, project submissions, criteria judging, and live rankings</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select className="form-select" style={{ width: 230 }} value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
            {events.map((ev) => <option key={ev._id} value={ev._id}>{ev.title}</option>)}
          </select>
          {isParticipant && (
            <>
              <button type="button" className="btn btn-outline" onClick={() => setTeamModal(true)}>
                <Users size={15} /> Form Team
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setSubModal(true)}>
                <Upload size={15} /> Submit Project
              </button>
            </>
          )}
          {canPublish && (
            <button type="button" className="btn btn-success" onClick={handlePublishResults}>
              <Trophy size={15} /> Publish Results
            </button>
          )}
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Project Submissions ({submissions.length})</h3>
          </div>
          <div className="table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Team / Participant</th>
                  <th>Score</th>
                  <th>Status</th>
                  {canJudge && <th>Judge</th>}
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub) => (
                  <tr key={sub._id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{sub.projectTitle}</div>
                      {sub.githubUrl && (
                        <a href={sub.githubUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--color-secondary)' }}>
                          Repository →
                        </a>
                      )}
                    </td>
                    <td>{sub.teamId?.teamName || sub.submittedBy?.fullName}</td>
                    <td style={{ fontWeight: 800 }}>{sub.averageScore} / 100</td>
                    <td><StatusBadge status={sub.status} /></td>
                    {canJudge && (
                      <td>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => openScoring(sub)}>
                          <Star size={14} /> Score
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Leaderboard</h3>
          </div>
          <div className="table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Team / Project</th>
                  <th>Score</th>
                  <th>Award</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((item, idx) => (
                  <tr key={item._id}>
                    <td style={{ fontWeight: 800 }}>#{item.rank || idx + 1}</td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{item.projectTitle}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {item.teamId?.teamName || item.submittedBy?.fullName}
                      </div>
                    </td>
                    <td style={{ fontWeight: 800, color: 'var(--color-secondary)' }}>{item.averageScore}</td>
                    <td>{item.awardTitle ? <span className="badge badge-success">{item.awardTitle}</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal open={teamModal} onClose={() => setTeamModal(false)} title="Register Competition Team">
        <form onSubmit={handleCreateTeam} className="form-grid">
          <div className="form-field full">
            <label className="form-label">Team Name</label>
            <input className="form-input" required value={teamForm.teamName} onChange={(e) => setTeamForm({ ...teamForm, teamName: e.target.value })} />
          </div>
          <div className="form-field full">
            <label className="form-label">Track / Domain</label>
            <input className="form-input" value={teamForm.track} onChange={(e) => setTeamForm({ ...teamForm, track: e.target.value })} />
          </div>
          <div className="form-field full">
            <button type="submit" className="btn btn-primary">Create Team</button>
          </div>
        </form>
      </Modal>

      <Modal open={subModal} onClose={() => setSubModal(false)} title="Submit Competition Project">
        <form onSubmit={handleSubmitProject} className="form-grid">
          <div className="form-field full">
            <label className="form-label">Project Title</label>
            <input className="form-input" required value={subForm.projectTitle} onChange={(e) => setSubForm({ ...subForm, projectTitle: e.target.value })} />
          </div>
          <div className="form-field full">
            <label className="form-label">Team (Optional)</label>
            <select className="form-select" value={subForm.teamId} onChange={(e) => setSubForm({ ...subForm, teamId: e.target.value })}>
              <option value="">Individual Participation</option>
              {teams.map((t) => <option key={t._id} value={t._id}>{t.teamName} ({t.teamCode})</option>)}
            </select>
          </div>
          <div className="form-field full">
            <label className="form-label">GitHub / Project URL</label>
            <input className="form-input" value={subForm.githubUrl} onChange={(e) => setSubForm({ ...subForm, githubUrl: e.target.value })} />
          </div>
          <div className="form-field full">
            <label className="form-label">Solution Summary</label>
            <textarea className="form-textarea" rows={3} required value={subForm.summary} onChange={(e) => setSubForm({ ...subForm, summary: e.target.value })} />
          </div>
          <div className="form-field full">
            <button type="submit" className="btn btn-primary">Submit Project</button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(scoreTarget)} onClose={() => setScoreTarget(null)} title={`Evaluate: ${scoreTarget?.projectTitle || ''}`}>
        <form onSubmit={handleScoreSubmit} className="form-grid">
          {(selectedEvent?.judgingCriteria || []).map((c) => (
            <div key={c.criterion} className="form-field">
              <label className="form-label">{c.criterion} (Max {c.maxMarks})</label>
              <input
                type="number"
                min="0"
                max={c.maxMarks}
                required
                className="form-input"
                value={scoreMap[c.criterion] ?? 0}
                onChange={(e) => setScoreMap({ ...scoreMap, [c.criterion]: e.target.value })}
              />
            </div>
          ))}
          <div className="form-field full">
            <label className="form-label">Judge Feedback</label>
            <textarea className="form-textarea" rows={2} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          </div>
          <div className="form-field full">
            <button type="submit" className="btn btn-primary">Submit Evaluation</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
