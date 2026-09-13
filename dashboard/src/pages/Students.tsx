import React, { useState, useEffect } from 'react';
import { ApiService } from '../services/api.js';
import { Users, UserPlus, Search, Filter, Trash2, Edit2, CheckCircle2, XCircle, Eye, EyeOff, Key } from 'lucide-react';
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
  const [isAddModalOpen, setIsAddModalOpen] = useState(initialAddModalOpen);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentEditStudent, setCurrentEditStudent] = useState<Student | null>(null);
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});

  // Form fields
  const [enrollmentNumber, setEnrollmentNumber] = useState('');
  const [fullName, setFullName] = useState('');
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
      });
      if (res.data.success) {
        setStudents(res.data.students || []);
      }
    } catch (err) {
      console.error('Error fetching students', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [selectedClassFilter]);

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

  const resetForm = () => {
    setEnrollmentNumber('');
    setFullName('');
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
            Authoritative registry. Self-registration is strictly blocked. Admin/Teacher provisions access.
          </p>
        </div>

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

      {/* Search & Class Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="w-full md:w-96 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by enrollment number or student name..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </form>

        <div className="flex items-center space-x-3 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={selectedClassFilter}
            onChange={(e) => setSelectedClassFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Assigned Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.class_name} • {c.subject} (Sem {c.semester}-{c.division})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h4 className="font-bold text-slate-900">Enrolled Students ({students.length})</h4>
          <span className="text-xs text-slate-400">Searchable by Unique Enrollment ID</span>
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
                  <th className="px-6 py-3.5">Enrollment No</th>
                  <th className="px-6 py-3.5">Full Name</th>
                  <th className="px-6 py-3.5">Password (App Login)</th>
                  <th className="px-6 py-3.5">Email / Phone</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {students.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3.5 font-mono font-bold text-blue-600">{st.enrollment_number}</td>
                    <td className="px-6 py-3.5 font-semibold text-slate-900">{st.full_name}</td>
                    <td className="px-6 py-3.5">
                      <div className="inline-flex items-center space-x-2 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                        <span className="font-mono text-xs font-semibold text-slate-800">
                          {showPasswordMap[st.id] ? (st.plain_password || 'student123') : '••••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowPasswordMap((prev) => ({ ...prev, [st.id]: !prev[st.id] }))}
                          className="text-slate-400 hover:text-blue-600 transition-colors"
                          title={showPasswordMap[st.id] ? 'Hide password' : 'Show password'}
                        >
                          {showPasswordMap[st.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-xs text-slate-500">
                      <div>{st.email || 'No email'}</div>
                      <div className="text-[11px] text-slate-400">{st.phone_number || 'No phone'}</div>
                    </td>
                    <td className="px-6 py-3.5">
                      {st.status === 'active' ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-bold border border-red-200">
                          <XCircle className="w-3 h-3" />
                          <span>Inactive</span>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right space-x-2">
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
