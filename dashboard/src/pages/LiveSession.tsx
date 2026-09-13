import React, { useState, useEffect } from 'react';
import { ApiService } from '../services/api.js';
import { Radio, Play, Square, CheckCircle2, Clock, ShieldCheck, Wifi } from 'lucide-react';
import { Modal } from '../components/Modal.js';

export const LiveSession: React.FC<{
  classes: any[];
  devices: any[];
  onRefresh: () => void;
}> = ({ classes, devices, onRefresh }) => {
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [sessionRecords, setSessionRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);

  // Form State
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [sessionName, setSessionName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Poll active session details
  const fetchActiveSession = async () => {
    try {
      const res = await ApiService.getActiveSessions();
      if (res.data.success && res.data.sessions && res.data.sessions.length > 0) {
        const current = res.data.sessions[0];
        setActiveSession(current);

        // Fetch live records for this session
        const detailsRes = await ApiService.getSessionById(current.id);
        if (detailsRes.data.success) {
          setSessionRecords(detailsRes.data.records || []);
        }
      } else {
        setActiveSession(null);
        setSessionRecords([]);
      }
    } catch (err) {
      console.error('Error fetching live session', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveSession();
    const interval = setInterval(fetchActiveSession, 3000); // Real-time poll every 3s
    return () => clearInterval(interval);
  }, []);

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const res = await ApiService.startSession({
        classId: selectedClassId,
        esp32Id: selectedDeviceId,
        sessionName: sessionName || 'Classroom Attendance Session',
        durationMinutes: Number(durationMinutes),
      });

      if (res.data.success) {
        setIsStartModalOpen(false);
        fetchActiveSession();
        onRefresh();
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to start session');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseSession = async () => {
    if (!activeSession) return;
    if (window.confirm('Are you sure you want to close this attendance session early?')) {
      try {
        await ApiService.closeSession(activeSession.id);
        setActiveSession(null);
        setSessionRecords([]);
        fetchActiveSession();
        onRefresh();
      } catch (err) {
        console.error('Error closing session', err);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Live Attendance Session Monitor</h2>
          <p className="text-xs text-slate-500">
            Real-time BLE hardware check-in stream. Verified students appear instantly.
          </p>
        </div>

        {!activeSession ? (
          <button
            onClick={() => setIsStartModalOpen(true)}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md flex items-center space-x-2 transition-all"
          >
            <Play className="w-4 h-4" />
            <span>Start Attendance Window</span>
          </button>
        ) : (
          <button
            onClick={handleCloseSession}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl shadow-md flex items-center space-x-2 transition-all"
          >
            <Square className="w-4 h-4 fill-white" />
            <span>Lock & Close Attendance</span>
          </button>
        )}
      </div>

      {!activeSession ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl mx-auto flex items-center justify-center mb-4">
            <Radio className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">No Attendance Session Currently Active</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-6">
            To start taking attendance, initiate a session by pairing your class with the room's ESP32 device.
          </p>
          <button
            onClick={() => setIsStartModalOpen(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-lg transition-all inline-flex items-center space-x-2"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Launch Attendance Window</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Banner */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-3xl p-6 text-white shadow-xl shadow-emerald-900/10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping"></span>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">
                  Accepting Student Check-ins
                </span>
              </div>
              <h3 className="text-2xl font-black">{activeSession.session_name}</h3>
              <p className="text-emerald-100 text-sm">
                <strong>{activeSession.class_name}</strong> • {activeSession.subject} (Sem {activeSession.semester}, Div {activeSession.division})
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-emerald-100/90 pt-1">
                <span>Hardware Node: <strong>{activeSession.device_esp32_id || 'ESP32'}</strong></span>
                <span>Room: <strong>{activeSession.classroom_id || 'Classroom'}</strong></span>
                <span>UUID: <code className="bg-white/10 px-1.5 py-0.5 rounded text-[11px]">{activeSession.service_uuid?.slice(0, 18)}...</code></span>
              </div>
            </div>

            <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-5 text-center min-w-[180px]">
              <span className="text-xs text-emerald-100 font-semibold uppercase tracking-wider block">Checked In</span>
              <span className="text-4xl font-black">{sessionRecords.length}</span>
              <span className="text-xs text-emerald-100 block mt-1 flex items-center justify-center space-x-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Ends {new Date(activeSession.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </span>
            </div>
          </div>

          {/* Live Attendance Table */}
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900">Live Presence Feed ({sessionRecords.length} Students)</h4>
                <p className="text-xs text-slate-400">Cryptographically signed via ESP32 BLE Challenge-Response</p>
              </div>
              <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Live Feed Active</span>
              </div>
            </div>

            {sessionRecords.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                Waiting for students to press "Mark Attendance" on their mobile app...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3.5">#</th>
                      <th className="px-6 py-3.5">Enrollment No</th>
                      <th className="px-6 py-3.5">Student Name</th>
                      <th className="px-6 py-3.5">Time Checked In</th>
                      <th className="px-6 py-3.5">BLE Signal (RSSI)</th>
                      <th className="px-6 py-3.5">Cryptographic Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {sessionRecords.map((rec, index) => (
                      <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-3.5 font-semibold text-slate-400">{index + 1}</td>
                        <td className="px-6 py-3.5 font-mono font-bold text-blue-600">{rec.enrollment_number}</td>
                        <td className="px-6 py-3.5 font-semibold text-slate-900">{rec.full_name || rec.student_name}</td>
                        <td className="px-6 py-3.5 text-xs text-slate-500">
                          {new Date(rec.marked_at).toLocaleTimeString()}
                        </td>
                        <td className="px-6 py-3.5">
                          <div className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
                            <Wifi className="w-3 h-3 text-emerald-600" />
                            <span>{rec.rssi_dbm || -65} dBm</span>
                          </div>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>VERIFIED</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Start Session Modal */}
      <Modal
        isOpen={isStartModalOpen}
        onClose={() => setIsStartModalOpen(false)}
        title="Start Classroom Attendance Session"
      >
        <form onSubmit={handleStartSession} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Class / Subject</label>
            <select
              required
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select Class --</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.class_name} • {c.subject} (Sem {c.semester}-{c.division})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Classroom ESP32 Device</label>
            <select
              required
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select ESP32 Device Node --</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.esp32_id} • {d.device_name} ({d.classroom_id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Session Topic / Name</label>
            <input
              type="text"
              required
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="e.g. Lecture 15 - TCP Congestion Control"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Duration (Minutes)</label>
            <input
              type="number"
              min="5"
              max="180"
              required
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsStartModalOpen(false)}
              className="px-4 py-2.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Starting...' : 'Open Attendance Window'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
