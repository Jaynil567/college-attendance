import React, { useState, useEffect } from 'react';
import { ApiService } from '../services/api.js';
import { FileSpreadsheet, Download, Filter, Search, Calendar, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';
import { ClassItem, AttendanceRecord } from '../types/index.js';

export const Reports: React.FC<{ classes: ClassItem[] }> = ({ classes }) => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [selectedClassId, setSelectedClassId] = useState('');
  const [searchStudent, setSearchStudent] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await ApiService.getAttendanceReport({
        classId: selectedClassId || undefined,
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
    fetchReport();
  }, [selectedClassId, statusFilter, startDate, endDate]);

  const handleExportXlsx = async () => {
    try {
      setExporting(true);
      await ApiService.exportExcel({
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

  const total = records.length;
  const present = records.filter((r) => r.status === 'present').length;
  const rate = total > 0 ? Math.round((present / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header & Export Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Attendance Reports & Ledger</h2>
          <p className="text-xs text-slate-500">
            Audit logs of cryptographically verified check-ins. Filter and download official XLSX sheets.
          </p>
        </div>

        <button
          onClick={handleExportXlsx}
          disabled={exporting}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm rounded-xl shadow-md flex items-center space-x-2 transition-all disabled:opacity-50"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>{exporting ? 'Generating Spreadsheet...' : 'Download Attendance (.XLSX)'}</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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

          {/* Start Date */}
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
            <span>Total Records: <strong className="text-slate-900">{total}</strong></span>
            <span>Present: <strong className="text-emerald-700">{present}</strong></span>
            <span>Attendance Rate: <strong className="text-blue-700">{rate}%</strong></span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h4 className="font-bold text-slate-900">Attendance Verification Log</h4>
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
    </div>
  );
};
