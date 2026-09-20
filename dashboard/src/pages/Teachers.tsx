import React, { useState, useEffect } from 'react';
import { ApiService } from '../services/api.js';
import { GraduationCap, UserPlus, Search, Trash2, Edit2, Mail, Phone, Building } from 'lucide-react';
import { Modal } from '../components/Modal.js';
import { Teacher } from '../types/index.js';

export const Teachers: React.FC<{ onRefresh?: () => void }> = ({ onRefresh }) => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentEditTeacher, setCurrentEditTeacher] = useState<Teacher | null>(null);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('Teacher@123');
  const [department, setDepartment] = useState('Computer Engineering');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchTeachers = async () => {
    try {
      setLoading(true);
      const res = await ApiService.getTeachers();
      if (res.data.success) {
        setTeachers(res.data.teachers || []);
      }
    } catch (err) {
      console.error('Error fetching teachers', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      await ApiService.createTeacher({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password: password || 'Teacher@123',
        department: department.trim(),
        phoneNumber: phoneNumber.trim() || undefined,
      });

      setIsAddModalOpen(false);
      resetForm();
      fetchTeachers();
      onRefresh?.();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to create teacher account');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEditTeacher) return;
    setFormError(null);
    setSubmitting(true);

    try {
      await ApiService.updateTeacher(currentEditTeacher.id, {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        department: department.trim(),
        phoneNumber: phoneNumber.trim() || null,
        password: password ? password.trim() : undefined,
      });

      setIsEditModalOpen(false);
      resetForm();
      fetchTeachers();
      onRefresh?.();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to update teacher');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (teacher: Teacher) => {
    setCurrentEditTeacher(teacher);
    setFullName(teacher.full_name);
    setEmail(teacher.email);
    setDepartment(teacher.department || 'Computer Engineering');
    setPhoneNumber(teacher.phone_number || '');
    setPassword('');
    setIsEditModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete teacher '${name}'?`)) {
      try {
        await ApiService.deleteTeacher(id);
        fetchTeachers();
        onRefresh?.();
      } catch (err: any) {
        alert(err.response?.data?.message || 'Error deleting teacher');
      }
    }
  };

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setPassword('Teacher@123');
    setDepartment('Computer Engineering');
    setPhoneNumber('');
    setFormError(null);
    setCurrentEditTeacher(null);
  };

  const filteredTeachers = teachers.filter(
    (t) =>
      t.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.department && t.department.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <GraduationCap className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-extrabold text-slate-900">Faculty & Teachers Management</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Admin management of professors and teaching staff authorized to host live auditorium sessions.
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
          <span>Add New Teacher</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search faculty by name, email, department..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <span className="text-xs text-slate-400 font-medium">
          Total Faculty: <strong className="text-slate-700">{filteredTeachers.length}</strong>
        </span>
      </div>

      {/* Faculty Table */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h4 className="font-bold text-slate-900">Registered Faculty Members</h4>
          <span className="text-xs text-slate-400">Can start concurrent auditorium attendance</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading faculty records...</div>
        ) : filteredTeachers.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">No faculty members found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Full Name</th>
                  <th className="px-6 py-3.5">Email (Login ID)</th>
                  <th className="px-6 py-3.5">Department</th>
                  <th className="px-6 py-3.5">Phone Number</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredTeachers.map((teacher) => (
                  <tr key={teacher.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3.5 font-semibold text-slate-900 flex items-center space-x-2">
                      <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                        {teacher.full_name.charAt(0).toUpperCase()}
                      </div>
                      <span>{teacher.full_name}</span>
                    </td>
                    <td className="px-6 py-3.5 font-mono text-xs text-blue-600">
                      <div className="flex items-center space-x-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>{teacher.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-xs text-slate-600">
                      <div className="flex items-center space-x-1.5">
                        <Building className="w-3.5 h-3.5 text-slate-400" />
                        <span>{teacher.department || 'General'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-xs text-slate-500">
                      {teacher.phone_number ? (
                        <div className="flex items-center space-x-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{teacher.phone_number}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Not set</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right space-x-2">
                      <button
                        onClick={() => openEditModal(teacher)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Teacher"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(teacher.id, teacher.full_name)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Teacher"
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

      {/* Add Teacher Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Faculty / Teacher Account"
      >
        <form onSubmit={handleAddTeacher} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Prof. Alan Turing"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
              Email Address (Login Username)
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. teacher@college.edu"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
              Password
            </label>
            <input
              type="text"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="e.g. Teacher@123"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                Department
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Computer Engineering"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g. +91 9876543210"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
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
              {submitting ? 'Creating...' : 'Create Teacher Account'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Teacher Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Faculty Details"
      >
        <form onSubmit={handleEditTeacher} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs">
              {formError}
            </div>
          )}

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
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Email (Login ID)</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
              Reset Password (leave empty to keep current)
            </label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password or leave blank"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Department</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
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
              {submitting ? 'Saving...' : 'Update Teacher'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
