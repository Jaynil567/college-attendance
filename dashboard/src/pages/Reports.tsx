import React, { useState, useEffect } from 'react';
import { ApiService } from '../services/api.js';
import { FileSpreadsheet, Download, Filter, Search, Calendar, CheckCircle2, XCircle, ShieldCheck, Building2, Clock, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { ClassItem, AttendanceRecord } from '../types/index.js';

export const Reports: React.FC<{ classes: ClassItem[] }> = ({ classes }) => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'sessions' | 'ledger'>('sessions');

  // Filters
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [searchStudent, setSearchStudent] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  const fetchSessions = async () => {
    try {
      const res = await ApiService.getAllSessions();
      if (res.data.success) {
        setSessions(res.data.sessions || []);
      }
    } catch (err) {
      console.error('Error fetching sessions list', err);
    }
  };

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await ApiService.getAttendanceReport({
        classId: selectedClassId || undefined,
        sessionId: selectedSessionId || undefined,
        status: statusFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      if (res.data.success) {
        let rows = res.data.records || [];
        if (searchStudent.trim()) {
          const q = searchStudent.toLowerCase().trim();
          rows = rows.filter(
            (r: any) =>
              r.student_name?.toLowerCase().includes(q) ||
              r.enrollment_number?.toLowerCase().includes(q)
          );
        }
        setRecords(rows);
      }
    } catch (err) {
      console.error('Error fetching attendance report', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    fetchReport();
  }, [selectedSessionId, selectedClassId, statusFilter, startDate, endDate]);

  const handleExportXlsx = async () => {
    try {
      setExporting(true);
      await ApiService.exportExcel({
        sessionId: selectedSessionId || undefined,
        classId: selectedClassId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
    } catch (err) {
      alert('Failed to download Excel attendance report');
    } finally {
      setExporting(false);
    }
  };

  const handleExportSessionXlsx = async (sessionId: string, sessionName: string) => {
    try {
      setExporting(true);
      await ApiService.exportExcel({ sessionId });
    } catch (err) {
      alert(`Failed to download sheet for ${sessionName}`);
    } finally {
      setExporting(false);
    }
  };

  const total = records.length;
  const present = records.filter((r) => r.status === 'present').length;
  const rate = total > 0 ? Math.round((present / total) * 100) : 0;

  // Format target divisions JSON or string
  const formatDivisions = (rawDivs: any) => {
    if (!rawDivs) return 'All Divisions';
    try {
      const arr = typeof rawDivs === 'string' ? JSON.parse(rawDivs) : rawDivs;
      if (Array.isArray(arr) && arr.length > 0) return arr.join(', ');
    } catch (e) {
      // ignore
    }
    return String(rawDivs);
  };

  return (
    <div className="space-y-6">
      {/* Header & Main Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Attendance Reports & Session Ledger</h2>
          <p className="text-xs text-slate-500">
            Session-wise breakdown of lectures and official XLSX attendance sheet downloads.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Tab Switcher */}
          <div className="bg-slate-200/80 p-1 rounded-xl flex space-x-1">
            <button
              onClick={() => setActiveTab('sessions')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'sessions' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Session-Wise View
            </button>
            <button
              onClick={() => setActiveTab('ledger')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'ledger' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Records Table
            </button>
          </div>

          <button
            onClick={handleExportXlsx}
            disabled={exporting}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-md flex items-center space-x-2 transition-all disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{exporting ? 'Exporting...' : selectedSessionId ? 'Download Selected Session Sheet (.XLSX)' : 'Download Full Ledger (.XLSX)'}</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Session Selector Filter */}
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Filter by Session</label>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="">All Sessions ({sessions.length})</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.session_name} • {s.auditorium_name || 'Auditorium'} ({new Date(s.start_time).toLocaleDateString([], { month: 'short', day: 'numeric' })})
                </option>
              ))}
            </select>
          </div>

          {/* Class Filter */}
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Filter Class</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.class_name} • {c.subject} (Sem {c.semester}-{c.division})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="present">Present (Verified)</option>
              <option value="rejected">Rejected (Cryptographic/Proximity)</option>
            </select>
          </div>

          {/* Date Range Filters */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Search Input */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-80 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchStudent}
              onChange={(e) => setSearchStudent(e.target.value)}
              placeholder="Search student name or enrollment number..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Summary Mini Pills */}
          <div className="flex items-center space-x-3 text-xs font-semibold text-slate-600">
            <span>Total Log Entries: <strong className="text-slate-900">{total}</strong></span>
            <span>Present: <strong className="text-emerald-700">{present}</strong></span>
            <span>Attendance Rate: <strong className="text-blue-700">{rate}%</strong></span>
          </div>
        </div>
      </div>

      {/* SESSION-WISE CARDS VIEW */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-base font-extrabold text-slate-800">
              Session Roster Ledger ({sessions.filter((s) => !selectedSessionId || s.id === selectedSessionId).length} Sessions)
            </h3>
            <span className="text-xs text-slate-400">Click "Download Sheet" on any session to export its XLSX attendance roster</span>
          </div>

          {sessions.filter((s) => !selectedSessionId || s.id === selectedSessionId).length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-400 text-sm">
              No lecture sessions found matching the selected filter.
            </div>
          ) : (
            sessions
              .filter((s) => !selectedSessionId || s.id === selectedSessionId)
              .map((sess) => {
                const isExpanded = expandedSessionId === sess.id;
                const sessionRecordsList = records.filter((r: any) => r.session_id === sess.id || r.session_name === sess.session_name);
                const isLive = sess.status === 'active';

                return (
                  <div key={sess.id} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3 transition-all hover:border-slate-300">
                    {/* Session Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                          <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${isLive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                            {isLive ? 'LIVE SESSION' : 'CLOSED / COMPLETED'}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">ID: {sess.id.slice(0, 8)}...</span>
                        </div>

                        <h4 className="text-lg font-black text-slate-900">{sess.session_name}</h4>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                          <span className="flex items-center space-x-1 font-semibold text-slate-800">
                            <Building2 className="w-3.5 h-3.5 text-blue-600" />
                            <span>{sess.auditorium_name || sess.auditorium_id || 'Auditorium'}</span>
                          </span>
                          <span>•</span>
                          <span className="flex items-center space-x-1">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            <span>Faculty: <strong>{sess.teacher_name || 'Faculty'}</strong></span>
                          </span>
                          <span>•</span>
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{new Date(sess.start_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                          </span>
                          <span>•</span>
                          <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-bold text-[11px] border border-blue-100">
                            Divisions: {formatDivisions(sess.target_divisions)}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-slate-500 mr-2">
                          Present: <strong className="text-emerald-700 font-bold">{sess.present_count || sessionRecordsList.length}</strong>
                        </span>

                        <button
                          onClick={() => handleExportSessionXlsx(sess.id, sess.session_name)}
                          disabled={exporting}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-sm flex items-center space-x-1.5 transition-all disabled:opacity-50"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          <span>Download Sheet (.XLSX)</span>
                        </button>

                        <button
                          onClick={() => setExpandedSessionId(isExpanded ? null : sess.id)}
                          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
                          title={isExpanded ? 'Hide Details' : 'View Student Roster'}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Session Student Table */}
                    {isExpanded && (
                      <div className="pt-3 border-t border-slate-100">
                        {sessionRecordsList.length === 0 ? (
                          <div className="py-4 text-center text-slate-400 text-xs italic">
                            No student check-in records loaded for this session. (Download the Excel sheet to see full student roster with ABSENT entries).
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                                <tr>
                                  <th className="px-4 py-2">Group</th>
                                   <th className="px-4 py-2">Div</th>
                                   <th className="px-4 py-2">Roll No</th>
                                   <th className="px-4 py-2">Enrollment No</th>
                                  <th className="px-4 py-2">Student Name</th>
                                  <th className="px-4 py-2">Time Checked In</th>
                                  <th className="px-4 py-2">Signal</th>
                                  <th className="px-4 py-2">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {sessionRecordsList.map((r: any) => (
                                  <tr key={r.id}>
                                    <td className="px-4 py-2 font-bold text-slate-700">{r.group_name || "-"}</td>
                                      <td className="px-4 py-2 font-bold text-slate-700">{r.division || "-"}</td>
                                      <td className="px-4 py-2 font-mono font-bold text-slate-900">{r.roll_number || "-"}</td>
                                      <td className="px-4 py-2 font-mono font-bold text-blue-600">{r.enrollment_number}</td>
                                    <td className="px-4 py-2 font-semibold text-slate-900">{r.student_name}</td>
                                    <td className="px-4 py-2 text-slate-500">{new Date(r.marked_at).toLocaleTimeString()}</td>
                                    <td className="px-4 py-2 text-slate-500">{r.rssi_dbm || -65} dBm</td>
                                    <td className="px-4 py-2 text-emerald-700 font-bold">✅ PRESENT</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
          )}
        </div>
      )}

      {/* FULL LEDGER RAW TABLE VIEW */}
      {activeTab === 'ledger' && (
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h4 className="font-bold text-slate-900">Attendance Audit Log Table</h4>
            <span className="text-xs text-slate-400">Timestamped & Proximity Verified</span>
          </div>

          {records.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              No attendance records match the selected filter criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5">Group</th>
                    <th className="px-6 py-3.5">Division</th>
                    <th className="px-6 py-3.5">Roll No</th>
                    <th className="px-6 py-3.5">Enrollment No</th>
                    <th className="px-6 py-3.5">Student Name</th>
                    <th className="px-6 py-3.5">Class / Subject</th>
                    <th className="px-6 py-3.5">Session / Lecture</th>
                    <th className="px-6 py-3.5">Timestamp</th>
                    <th className="px-6 py-3.5">ESP32 Device</th>
                    <th className="px-6 py-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {records.map((rec) => {
                    const isPresent = rec.status === 'present';
                    return (
                      <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-3.5 font-bold text-slate-700">{rec.group_name || "-"}</td>
                        <td className="px-6 py-3.5 font-bold text-slate-700">{rec.student_division || rec.division || "-"}</td>
                        <td className="px-6 py-3.5 font-mono font-bold text-slate-900">{rec.roll_number || "-"}</td>
                        <td className="px-6 py-3.5 font-mono font-bold text-blue-600">{rec.enrollment_number}</td>
                        <td className="px-6 py-3.5 font-semibold text-slate-900">{rec.student_name}</td>
                        <td className="px-6 py-3.5 text-xs text-slate-600">
                          {rec.subject} (Sem {rec.semester}-{rec.division})
                        </td>
                        <td className="px-6 py-3.5 text-xs font-medium text-slate-800">{rec.session_name}</td>
                        <td className="px-6 py-3.5 text-xs text-slate-500">
                          {new Date(rec.marked_at).toLocaleString([], {
                            dateStyle: 'short',
                            timeStyle: 'medium',
                          })}
                        </td>
                        <td className="px-6 py-3.5 font-mono text-xs text-slate-600">{rec.esp32_id}</td>
                        <td className="px-6 py-3.5">
                          {isPresent ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Present</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-xs font-bold border border-red-200" title={rec.rejection_reason || 'Rejected'}>
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Rejected</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
