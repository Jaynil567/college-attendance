import React, { useState, useEffect } from 'react';
import { ApiService } from '../services/api.js';
import { Radio, Play, Square, ShieldCheck, Wifi, Download, Building2, User, BookOpen, Trash2 } from 'lucide-react';
import { Modal } from '../components/Modal.js';
import { useAuth } from '../context/AuthContext.js';

interface AuditoriumState {
  id: string;
  name: string;
  isLive: boolean;
  activeSession: {
    id: string;
    subject: string;
    sessionName: string;
    teacherName: string;
    startTime: string;
    presentCount: number;
  } | null;
}

const ALL_DIVISIONS = [
  'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9',
  'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9',
  'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9',
];

export const LiveSession: React.FC<{
  classes?: any[];
  devices?: any[];
  onRefresh: () => void;
}> = ({ onRefresh }) => {
  const { user } = useAuth();
  const [auditoriums, setAuditoriums] = useState<AuditoriumState[]>([
    { id: 'AUDITORIUM_01', name: 'Engineering Auditorium', isLive: false, activeSession: null },
    { id: 'AUDITORIUM_02', name: 'Architecture Auditorium', isLive: false, activeSession: null },
    { id: 'AUDITORIUM_03', name: 'LAW Auditorium', isLive: false, activeSession: null },
  ]);
  const [selectedAudiId, setSelectedAudiId] = useState<string>('AUDITORIUM_01');
  const [sessionRecords, setSessionRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);

  // Start Session Form State
  const [formAuditoriumId, setFormAuditoriumId] = useState<'AUDITORIUM_01' | 'AUDITORIUM_02' | 'AUDITORIUM_03'>('AUDITORIUM_01');
  const [subjectTitle, setSubjectTitle] = useState('');
  const [selectedDivisions, setSelectedDivisions] = useState<string[]>(['A1']);
  const [requireSimVerification, setRequireSimVerification] = useState<boolean>(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const toggleDivision = (div: string) => {
    setSelectedDivisions((prev) =>
      prev.includes(div) ? prev.filter((d) => d !== div) : [...prev, div]
    );
  };

  const selectDivCategory = (cat: 'A' | 'B' | 'C' | 'ALL' | 'NONE') => {
    if (cat === 'ALL') setSelectedDivisions([...ALL_DIVISIONS]);
    else if (cat === 'NONE') setSelectedDivisions([]);
    else setSelectedDivisions(ALL_DIVISIONS.filter((d) => d.startsWith(cat)));
  };

  // Poll 3 Auditoriums real-time status & active feed
  const fetchAuditoriumStatus = async () => {
    try {
      const res = await ApiService.getAuditoriumsStatus();
      if (res.data.success && res.data.auditoriums) {
        setAuditoriums(res.data.auditoriums);

        // Find active session for selected auditorium to load check-in feed
        const selectedAudi = res.data.auditoriums.find((a: any) => a.id === selectedAudiId);
        if (selectedAudi?.activeSession) {
          const feedRes = await ApiService.getSessionById(selectedAudi.activeSession.id);
          if (feedRes.data.success) {
            setSessionRecords(feedRes.data.records || []);
          }
        } else {
          setSessionRecords([]);
        }
      }
    } catch (err) {
      console.error('Error fetching auditorium status', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditoriumStatus();
    const interval = setInterval(fetchAuditoriumStatus, 3000); // 3-second live sync
    return () => clearInterval(interval);
  }, [selectedAudiId]);

  const handleOpenStartModal = (preselectedAudiId?: string) => {
    if (preselectedAudiId) {
      setFormAuditoriumId(preselectedAudiId as any);
    }
    setSubjectTitle('');
    setRequireSimVerification(true);
    setFormError(null);
    setIsStartModalOpen(true);
  };

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectTitle.trim()) {
      setFormError('Please enter a subject or lecture title');
      return;
    }
    if (selectedDivisions.length === 0) {
      setFormError('Please select at least one target division');
      return;
    }

    setFormError(null);
    setSubmitting(true);

    try {
      const res = await ApiService.startSession({
        auditoriumId: formAuditoriumId,
        subject: subjectTitle.trim(),
        targetDivisions: selectedDivisions,
        requireSimVerification,
      });

      if (res.data.success) {
        setIsStartModalOpen(false);
        setSelectedAudiId(formAuditoriumId);
        await fetchAuditoriumStatus();
        onRefresh();
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to start auditorium session');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEndSession = async (sessionId: string, audiName: string) => {
    if (window.confirm(`Are you sure you want to end the live lecture session in ${audiName}?`)) {
      try {
        await ApiService.endSession(sessionId);
        await fetchAuditoriumStatus();
        onRefresh();
      } catch (err) {
        console.error('Error ending session', err);
      }
    }
  };

  const handleRemoveRecord = async (recordId: string, studentName: string) => {
    if (!window.confirm(`Are you sure you want to remove attendance for '${studentName}' from this live session?`)) return;
    try {
      await ApiService.deleteAttendanceRecord(recordId);
      await fetchAuditoriumStatus();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to remove attendance record');
    }
  };

  const handleExportExcel = async (sessionId: string) => {
    try {
      setExporting(true);
      await ApiService.exportExcel({ sessionId });
    } catch (err) {
      console.error('Failed to export Excel', err);
    } finally {
      setExporting(false);
    }
  };

  const currentAuditorium = auditoriums.find((a) => a.id === selectedAudiId) || auditoriums[0];
  const currentActiveSession = currentAuditorium?.activeSession;

  return (
    <div className="space-y-6">
      {/* Page Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Building2 className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-extrabold text-slate-900">3-Auditorium Lecture Center</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Concurrent lectures in 3 auditoriums. Select an auditorium and subject to go live.
          </p>
        </div>

        <button
          onClick={() => handleOpenStartModal()}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md flex items-center space-x-2 transition-all"
        >
          <Play className="w-4 h-4 fill-white" />
          <span>Go Live / Start Lecture</span>
        </button>
      </div>

      {/* 3 Auditoriums Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {auditoriums.map((audi) => {
          const isSelected = selectedAudiId === audi.id;
          const isLive = audi.isLive && !!audi.activeSession;

          return (
            <div
              key={audi.id}
              onClick={() => setSelectedAudiId(audi.id)}
              className={`cursor-pointer rounded-2xl p-5 border transition-all relative overflow-hidden ${
                isSelected
                  ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md bg-white'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <span className={`w-3 h-3 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
                  <h3 className="font-extrabold text-slate-900 text-base">{audi.name}</h3>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    isLive
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {isLive ? 'LIVE NOW' : 'VACANT'}
                </span>
              </div>

              {/* Status Info */}
              {isLive ? (
                <div className="space-y-2 mt-2">
                  <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3">
                    <p className="text-xs text-emerald-900 font-bold truncate">
                      {audi.activeSession?.subject}
                    </p>
                    <div className="flex items-center space-x-1.5 text-[11px] text-emerald-700 mt-1">
                      <User className="w-3 h-3" />
                      <span>{audi.activeSession?.teacherName || 'Faculty'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-slate-500">
                      Attendance: <strong className="text-emerald-700 font-bold">{audi.activeSession?.presentCount || 0}</strong> present
                    </span>
                    <span className="text-[11px] text-blue-600 font-semibold hover:underline">
                      View Feed →
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center">
                  <p className="text-xs text-slate-400 mb-3">No lecture running currently</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenStartModal(audi.id);
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 text-xs font-semibold rounded-lg transition-colors inline-flex items-center space-x-1"
                  >
                    <Play className="w-3 h-3" />
                    <span>Start Lecture Here</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Auditorium Active View */}
      {currentActiveSession ? (
        <div className="space-y-6">
          {/* Active Banner */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-3xl p-6 text-white shadow-xl shadow-emerald-900/10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping"></span>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">
                  Live Attendance Active • {currentAuditorium.name}
                </span>
              </div>
              <h3 className="text-2xl font-black">{currentActiveSession.subject}</h3>
              <p className="text-emerald-100 text-sm flex items-center space-x-3">
                <span>Faculty: <strong>{currentActiveSession.teacherName}</strong></span>
                <span>•</span>
                <span>Started: <strong>{new Date(currentActiveSession.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span>
              </p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-emerald-100/90 pt-1">
                <span>ESP32 Node: <strong>{currentAuditorium.id}</strong></span>
                <span>•</span>
                <span>Students verify automatically via ESP32 BLE Challenge-Response</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl px-6 py-4 text-center min-w-[140px]">
                <span className="text-xs text-emerald-100 font-semibold uppercase tracking-wider block">Checked In</span>
                <span className="text-3xl font-black">{sessionRecords.length}</span>
                <span className="text-[11px] text-emerald-100 block mt-0.5">Students Present</span>
              </div>

              <div className="flex flex-col gap-2 w-full sm:w-auto">
                <button
                  onClick={() => handleExportExcel(currentActiveSession.id)}
                  disabled={exporting}
                  className="px-4 py-2.5 bg-white text-emerald-900 font-bold text-xs rounded-xl shadow-sm hover:bg-emerald-50 transition-all flex items-center justify-center space-x-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{exporting ? 'Exporting...' : 'Export Excel (.xlsx)'}</span>
                </button>

                <button
                  onClick={() => handleEndSession(currentActiveSession.id, currentAuditorium.name)}
                  className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center space-x-1.5"
                >
                  <Square className="w-3.5 h-3.5 fill-white" />
                  <span>End Live Session</span>
                </button>
              </div>
            </div>
          </div>

          {/* Live Attendance Table */}
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900">
                  Live Attendance Feed for {currentAuditorium.name} ({sessionRecords.length} Students)
                </h4>
                <p className="text-xs text-slate-400">
                  Cryptographically verified via {currentAuditorium.id} BLE hardware beacon
                </p>
              </div>
              <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Auto-Refreshing Stream</span>
              </div>
            </div>

            {sessionRecords.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                Waiting for students in {currentAuditorium.name} to tap "Mark Attendance" on their phone...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3.5">#</th>
                      <th className="px-6 py-3.5">Group</th>
                      <th className="px-6 py-3.5">Div</th>
                      <th className="px-6 py-3.5">Roll No</th>
                      <th className="px-6 py-3.5">Enrollment No</th>
                      <th className="px-6 py-3.5">Student Name</th>
                      <th className="px-6 py-3.5">Time Checked In</th>
                      <th className="px-6 py-3.5">BLE Signal (RSSI)</th>
                      <th className="px-6 py-3.5">Security Verification</th>
                      <th className="px-6 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {sessionRecords.map((rec, index) => (
                      <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-3.5 font-semibold text-slate-400">{index + 1}</td>
                        <td className="px-6 py-3.5 font-bold text-slate-700">{rec.group_name || '-'}</td>
                        <td className="px-6 py-3.5 font-bold text-slate-700">{rec.division || '-'}</td>
                        <td className="px-6 py-3.5 font-mono font-bold text-slate-900">{rec.roll_number || '-'}</td>
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
                            <span>ESP32 HMAC VERIFIED</span>
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <button
                            onClick={() => handleRemoveRecord(rec.id, rec.full_name || rec.student_name)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove Student Attendance"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center shadow-sm">
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl mx-auto flex items-center justify-center mb-3">
            <Radio className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {currentAuditorium.name} is Currently Vacant
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
            No lecture is taking place right now. Click below to start taking attendance in {currentAuditorium.name}.
          </p>
          <button
            onClick={() => handleOpenStartModal(currentAuditorium.id)}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all inline-flex items-center space-x-2"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Start Lecture in {currentAuditorium.name}</span>
          </button>
        </div>
      )}

      {/* Start Session Modal (Auditorium + Subject only; NO DURATION) */}
      <Modal
        isOpen={isStartModalOpen}
        onClose={() => setIsStartModalOpen(false)}
        title="Start Live Lecture Session"
      >
        <form onSubmit={handleStartSession} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs">
              {formError}
            </div>
          )}

          {/* Auditorium Selection */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-2">
              Select Auditorium
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'AUDITORIUM_01', name: 'Engineering Auditorium' },
                { id: 'AUDITORIUM_02', name: 'Architecture Auditorium' },
                { id: 'AUDITORIUM_03', name: 'LAW Auditorium' },
              ].map((audi) => (
                <button
                  key={audi.id}
                  type="button"
                  onClick={() => setFormAuditoriumId(audi.id as any)}
                  className={`py-3 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                    formAuditoriumId === audi.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {audi.name}
                </button>
              ))}
            </div>
          </div>

          {/* Subject / Lecture Title */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
              Subject / Lecture Title
            </label>
            <div className="relative">
              <BookOpen className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={subjectTitle}
                onChange={(e) => setSubjectTitle(e.target.value)}
                placeholder="e.g. Data Structures & Algorithms, Physics, AI"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Target Divisions Selector */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold uppercase text-slate-600">
                Target Divisions ({selectedDivisions.length} Selected)
              </label>
              <div className="flex items-center space-x-1 text-[11px]">
                <button type="button" onClick={() => selectDivCategory('A')} className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded">All A</button>
                <button type="button" onClick={() => selectDivCategory('B')} className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded">All B</button>
                <button type="button" onClick={() => selectDivCategory('C')} className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded">All C</button>
                <button type="button" onClick={() => selectDivCategory('ALL')} className="px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded">All</button>
                <button type="button" onClick={() => selectDivCategory('NONE')} className="px-1.5 py-0.5 bg-red-50 hover:bg-red-100 text-red-700 font-semibold rounded">Clear</button>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">
              Only students in selected divisions will be shown the attendance button on their phone.
            </p>
            <div className="grid grid-cols-9 gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-50 border border-slate-200 rounded-xl">
              {ALL_DIVISIONS.map((div) => {
                const isSelected = selectedDivisions.includes(div);
                return (
                  <button
                    key={div}
                    type="button"
                    onClick={() => toggleDivision(div)}
                    className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {div}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SIM Card Verification Toggle */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div className="pr-3">
              <div className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                <span>📱 Require Registered SIM Card Verification</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Students must have their registered SIM card inside their phone. Uncheck if students have carrier issues in class.
              </div>
            </div>
            <input
              type="checkbox"
              checked={requireSimVerification}
              onChange={(e) => setRequireSimVerification(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
            />
          </div>

          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800">
            ℹ️ <strong>Open Duration</strong>: Session will remain active until you click "End Session".
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
              className="px-5 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 inline-flex items-center space-x-1.5 shadow-md"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>{submitting ? 'Starting...' : 'Go Live Now'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

