import React, { useState, useEffect } from 'react';
import { ApiService, api } from '../services/api.js';
import { Users, UserPlus, Search, Filter, Trash2, Edit2, CheckCircle2, XCircle, Eye, EyeOff, Key, Download, RefreshCw, Smartphone } from 'lucide-react';
import { Modal } from '../components/Modal.js';
import { Student, ClassItem } from '../types/index.js';

export const Students: React.FC<{
  classes: ClassItem[];
  onRefresh: () => void;
  initialAddModalOpen?: boolean;
}> = ({ classes, onRefresh, initialAddModalOpen = false }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('');
  const [selectedDivisionFilter, setSelectedDivisionFilter] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(initialAddModalOpen);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentEditStudent, setCurrentEditStudent] = useState<Student | null>(null);
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const [resettingPasswords, setResettingPasswords] = useState(false);

  // Form fields
  const [enrollmentNumber, setEnrollmentNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [division, setDivision] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [groupName, setGroupName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('Student@123');
  const [classId, setClassId] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const res = await ApiService.getStudents({
        search: searchQuery || undefined,
        classId: selectedClassFilter || undefined,
        division: selectedDivisionFilter || undefined,
        groupName: selectedGroupFilter || undefined,
      } as any);
      if (res.data.success) {
        const raw = res.data.students || [];
        raw.sort((a: any, b: any) => {
          const gA = a.group_name || '';
          const gB = b.group_name || '';
          if (gA !== gB) return gA.localeCompare(gB);

          const dA = a.division || '';
          const dB = b.division || '';
          if (dA !== dB) return dA.localeCompare(dB);

          const rA = parseInt((a.roll_number || '0').replace(/\D/g, ''), 10) || 0;
          const rB = parseInt((b.roll_number || '0').replace(/\D/g, ''), 10) || 0;
          if (rA !== rB) return rA - rB;

          return (a.roll_number || '').localeCompare(b.roll_number || '');
        });
        setStudents(raw);
      }
    } catch (err) {
      console.error('Error fetching students', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [selectedClassFilter, selectedDivisionFilter, selectedGroupFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStudents();
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      await ApiService.createStudent({
        enrollmentNumber: enrollmentNumber.trim().toUpperCase(),
        fullName: fullName.trim(),
        division: division.trim() || undefined,
        rollNumber: rollNumber.trim() || undefined,
        groupName: groupName.trim() || undefined,
        email: email.trim() || undefined,
        phoneNumber: phoneNumber.trim() || undefined,
        password: password || 'Student@123',
        classId: classId || undefined,
        status,
      });

      setIsAddModalOpen(false);
      resetForm();
      fetchStudents();
      onRefresh();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to register student');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEditStudent) return;
    setFormError(null);
    setSubmitting(true);

    try {
      await ApiService.updateStudent(currentEditStudent.id, {
        fullName: fullName.trim(),
        division: division.trim() || null,
        rollNumber: rollNumber.trim() || null,
        groupName: groupName.trim() || null,
        email: email.trim() || null,
        phoneNumber: phoneNumber.trim() || null,
        password: password ? password.trim() : undefined,
        classId: classId || null,
        status,
      });

      setIsEditModalOpen(false);
      resetForm();
      fetchStudents();
      onRefresh();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to update student');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (student: Student) => {
    setCurrentEditStudent(student);
    setFullName(student.full_name);
    setDivision(student.division || '');
    setRollNumber(student.roll_number || '');
    setGroupName(student.group_name || '');
    setEmail(student.email || '');
    setPhoneNumber(student.phone_number || '');
    setPassword(student.plain_password || '');
    setClassId(student.class_id || '');
    setStatus(student.status);
    setIsEditModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Delete student '${name}'? This will remove all associated attendance logs.`)) {
      try {
        await ApiService.deleteStudent(id);
        fetchStudents();
        onRefresh();
      } catch (err: any) {
        alert(err.response?.data?.message || 'Error deleting student');
      }
    }
  };

  const handleDownloadCredentials = async () => {
    try {
      const response = await api.get('/students/export-credentials', {
        params: {
          search: searchQuery || undefined,
          division: selectedDivisionFilter || undefined,
          groupName: selectedGroupFilter || undefined,
        },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Student_Details_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to download student details');
    }
  };

  const handleResetAllPasswords = async () => {
    if (!window.confirm('⚠️ This will generate new random 4-digit passwords for ALL students. Students who are already logged in will NOT be affected (their sessions stay active). Continue?')) return;
    setResettingPasswords(true);
    try {
      const res = await api.post('/students/reset-all-passwords');
      if (res.data.success) {
        alert(`✅ Passwords reset for ${res.data.count} students. Download the credentials sheet to see new passwords.`);
        fetchStudents();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to reset passwords');
    } finally {
      setResettingPasswords(false);
    }
  };

  const handleResetDevice = async (studentId: string, studentName: string) => {
    if (!window.confirm(`Reset device binding for '${studentName}'? They will need to login again from their new phone.`)) return;
    try {
      await ApiService.updateStudent(studentId, { device_id: null } as any);
      alert(`✅ Device reset for ${studentName}. They can now login from a new phone.`);
      fetchStudents();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to reset device');
    }
  };

  const resetForm = () => {
    setEnrollmentNumber('');
    setFullName('');
    setDivision('');
    setRollNumber('');
    setGroupName('');
    setEmail('');
    setPhoneNumber('');
    setPassword('Student@123');
    setClassId('');
    setStatus('active');
    setFormError(null);
    setCurrentEditStudent(null);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Student Directory</h2>
          <p className="text-xs text-slate-500">
            Authoritative registry sorted by Group → Division → Roll Number with search & filters.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleDownloadCredentials}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md flex items-center space-x-2 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Download Sheet</span>
          </button>
          
          <button
            onClick={handleResetAllPasswords}
            disabled={resettingPasswords}
            className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm rounded-xl shadow-md flex items-center space-x-2 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${resettingPasswords ? 'animate-spin' : ''}`} />
            <span>{resettingPasswords ? 'Resetting...' : 'Reset Passwords'}</span>
          </button>

          <button
            onClick={() => {
              resetForm();
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md flex items-center space-x-2 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Register Student</span>
          </button>
        </div>
      </div>

      {/* Search & Division / Group Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="w-full md:w-80 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by enrollment, name..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </form>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedDivisionFilter}
              onChange={(e) => setSelectedDivisionFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Divisions</option>
              {['A1','A2','A3','A4','A5','A6','A7','A8','A9','B1','B2','B3','B4','B5','B6','B7','B8','B9','C1','C2','C3','C4','C5','C6','C7','C8','C9'].map((div) => (
                <option key={div} value={div}>Division {div}</option>
              ))}
            </select>
          </div>

          <select
            value={selectedGroupFilter}
            onChange={(e) => setSelectedGroupFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Groups</option>
            {['G1','G2','G3'].map((grp) => (
              <option key={grp} value={grp}>Group {grp}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h4 className="font-bold text-slate-900">Enrolled Students ({students.length})</h4>
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            Sorted by Group → Division → Roll Number
          </span>
        </div>

        {students.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            No students found matching your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Group</th>
                  <th className="px-6 py-3.5">Division</th>
                  <th className="px-6 py-3.5">Roll Number</th>
                  <th className="px-6 py-3.5">Enrollment Number</th>
                  <th className="px-6 py-3.5">Name Of Student</th>
                  <th className="px-6 py-3.5">Password</th>
                  <th className="px-6 py-3.5">Device</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {students.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3.5">
                      <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-xs font-bold text-slate-700">
                        {st.group_name || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-bold text-slate-700">{st.division || '-'}</td>
                    <td className="px-6 py-3.5 font-mono font-bold text-slate-900">{st.roll_number || '-'}</td>
                    <td className="px-6 py-3.5 font-mono font-bold text-blue-600">{st.enrollment_number}</td>
                    <td className="px-6 py-3.5 font-semibold text-slate-900">{st.full_name}</td>
                    <td className="px-6 py-3.5">
                      <div className="inline-flex items-center space-x-2 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                        <span className="font-mono text-xs font-semibold text-slate-800">
                          {showPasswordMap[st.id] ? (st.plain_password || '••••') : '••••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowPasswordMap((prev) => ({ ...prev, [st.id]: !prev[st.id] }))}
                          className="text-slate-400 hover:text-blue-600 transition-colors"
                        >
                          {showPasswordMap[st.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      {st.device_id ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
                          <Smartphone className="w-3 h-3" />
                          <span>Bound</span>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Not bound</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right space-x-2">
                      {st.device_id && (
                        <button
                          onClick={() => handleResetDevice(st.id, st.full_name)}
                          className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                          title="Reset Device Binding"
                        >
                          <Smartphone className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(st)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Student"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(st.id, st.full_name)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Student"
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

      {/* Add Student Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Register New Student"
      >
        <form onSubmit={handleAddStudent} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
              Enrollment Number (Unique)
            </label>
            <input
              type="text"
              required
              value={enrollmentNumber}
              onChange={(e) => setEnrollmentNumber(e.target.value)}
              placeholder="e.g. EN2024CS010"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
              Student Full Name
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. John Doe"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Division</label>
              <input
                type="text"
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                placeholder="e.g. A1"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Roll Number</label>
              <input
                type="text"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                placeholder="e.g. 1"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Group</label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. G1"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@college.edu"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Phone Number</label>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1-555-0100"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Assign to Class</label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- None (Assign Later) --</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.class_name} • {c.subject} (Sem {c.semester}-{c.division})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Initial Password</label>
            <input
              type="text"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Registering...' : 'Register Student'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Student Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Student Information"
      >
        <form onSubmit={handleEditStudent} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
              Enrollment Number
            </label>
            <input
              type="text"
              disabled
              value={currentEditStudent?.enrollment_number || ''}
              className="w-full px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-mono text-slate-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Division</label>
              <input
                type="text"
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                placeholder="e.g. A1"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Roll Number</label>
              <input
                type="text"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                placeholder="e.g. 1"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Group</label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. G1"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
              Password (App Login)
            </label>
            <input
              type="text"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="e.g. student123"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">Student uses this password to log in to the mobile app.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Phone</label>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Assigned Class</label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- None --</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.class_name} • {c.subject} (Sem {c.semester}-{c.division})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Account Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="active">Active (Can Mark Attendance)</option>
              <option value="inactive">Inactive / Suspended</option>
            </select>
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Update Student'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
