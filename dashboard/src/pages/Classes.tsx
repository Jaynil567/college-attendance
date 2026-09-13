import React, { useState } from 'react';
import { ApiService } from '../services/api.js';
import { BookOpen, Plus, Trash2, Users, GraduationCap } from 'lucide-react';
import { Modal } from '../components/Modal.js';
import { ClassItem } from '../types/index.js';

export const Classes: React.FC<{
  classes: ClassItem[];
  onRefresh: () => void;
}> = ({ classes, onRefresh }) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [className, setClassName] = useState('Computer Engineering');
  const [subject, setSubject] = useState('');
  const [semester, setSemester] = useState('5');
  const [division, setDivision] = useState('A');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await ApiService.createClass({
        className,
        subject,
        semester,
        division,
      });
      setIsCreateModalOpen(false);
      setSubject('');
      onRefresh();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create class');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Delete class '${name}'? This will also remove associated session records.`)) {
      try {
        await ApiService.deleteClass(id);
        onRefresh();
      } catch (err: any) {
        alert(err.response?.data?.message || 'Error deleting class');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Class & Subject Management</h2>
          <p className="text-xs text-slate-500">
            Configure academic courses, semesters, divisions, and assigned classrooms.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md flex items-center space-x-2 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Class</span>
        </button>
      </div>

      {classes.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-sm">
          <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-800">No Classes Registered Yet</h4>
          <p className="text-xs text-slate-400 mt-1 mb-4">Create your first class to start taking attendance.</p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl"
          >
            Create Class
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {classes.map((cls) => (
            <div
              key={cls.id}
              className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
            >
              <div className="flex items-start justify-between">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleDelete(cls.id, cls.subject)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-[11px] font-bold rounded-md uppercase">
                  Semester {cls.semester} • Division {cls.division}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-2">{cls.subject}</h3>
                <p className="text-xs text-slate-500 font-medium">{cls.class_name}</p>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center space-x-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  <span className="font-semibold text-slate-700">{cls.student_count || 0} Students Enrolled</span>
                </div>
                <span>{cls.teacher_name || 'Prof. Alan Turing'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Class Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add Academic Class / Subject"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
              Class / Department Name
            </label>
            <input
              type="text"
              required
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="e.g. Computer Engineering"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
              Course / Subject Title
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Computer Networks"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Semester</label>
              <input
                type="text"
                required
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                placeholder="5"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Division / Section</label>
              <input
                type="text"
                required
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                placeholder="A"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Save Class'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
