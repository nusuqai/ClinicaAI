import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, Activity, Plus, Pencil, Trash2, X, Check,
  AlertCircle, ToggleLeft, ToggleRight, Calendar, Search
} from 'lucide-react';

export default function MedicalHistoryView({ session }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState('all'); // 'all' | 'active' | 'inactive'

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form, setForm] = useState({ condition: '', diagnosed_at: '', is_active: true });
  const [formError, setFormError] = useState('');

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRecords = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('medical_history')
        .select('*')
        .eq('user_id', session.user.id)
        .order('diagnosed_at', { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (err) {
      console.error('Error fetching medical history:', err);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // ─── Filtered records ───
  const filteredRecords = records.filter(r => {
    const matchesSearch = r.condition.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter =
      filterActive === 'all' ||
      (filterActive === 'active' && r.is_active) ||
      (filterActive === 'inactive' && !r.is_active);
    return matchesSearch && matchesFilter;
  });

  // ─── Open modal for Add / Edit ───
  const openAddModal = () => {
    setEditingRecord(null);
    setForm({ condition: '', diagnosed_at: '', is_active: true });
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (record) => {
    setEditingRecord(record);
    setForm({
      condition: record.condition,
      diagnosed_at: record.diagnosed_at || '',
      is_active: record.is_active,
    });
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingRecord(null);
    setFormError('');
  };

  // ─── Save (Create or Update) ───
  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.condition.trim()) {
      setFormError('يرجى إدخال اسم الحالة الطبية');
      return;
    }

    try {
      setSaving(true);
      setFormError('');

      if (editingRecord) {
        // Update
        const { error } = await supabase
          .from('medical_history')
          .update({
            condition: form.condition.trim(),
            diagnosed_at: form.diagnosed_at || null,
            is_active: form.is_active,
          })
          .eq('id', editingRecord.id)
          .eq('user_id', session.user.id);

        if (error) throw error;
      } else {
        // Create
        const { error } = await supabase
          .from('medical_history')
          .insert({
            user_id: session.user.id,
            condition: form.condition.trim(),
            diagnosed_at: form.diagnosed_at || null,
            is_active: form.is_active,
          });

        if (error) throw error;
      }

      closeModal();
      await fetchRecords();
    } catch (err) {
      console.error('Error saving medical record:', err);
      setFormError('حدث خطأ أثناء الحفظ. يرجى المحاولة مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete ───
  const handleDelete = async (id) => {
    try {
      setDeleting(true);
      const { error } = await supabase
        .from('medical_history')
        .delete()
        .eq('id', id)
        .eq('user_id', session.user.id);

      if (error) throw error;
      setDeleteConfirm(null);
      await fetchRecords();
    } catch (err) {
      console.error('Error deleting medical record:', err);
    } finally {
      setDeleting(false);
    }
  };

  // ─── Toggle active ───
  const handleToggleActive = async (record) => {
    try {
      const { error } = await supabase
        .from('medical_history')
        .update({ is_active: !record.is_active })
        .eq('id', record.id)
        .eq('user_id', session.user.id);

      if (error) throw error;

      setRecords(prev =>
        prev.map(r => r.id === record.id ? { ...r, is_active: !r.is_active } : r)
      );
    } catch (err) {
      console.error('Error toggling status:', err);
    }
  };

  // ─── Format date ───
  const formatDate = (dateStr) => {
    if (!dateStr) return 'غير محدد';
    return new Intl.DateTimeFormat('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(dateStr));
  };

  // ─── Loading state ───
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-accent/10 rounded-xl text-accent">
            <Activity size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading text-primary">السجل الطبي</h1>
            <p className="text-sm font-sans text-text/50 mt-0.5">{records.length} سجل طبي</p>
          </div>
        </div>

        <button
          onClick={openAddModal}
          className="bg-accent text-primary font-sans font-semibold px-5 py-2.5 rounded-xl hover:bg-accent/90 transition-all flex items-center gap-2 shadow-sm hover:shadow-md self-start sm:self-auto"
        >
          <Plus size={18} />
          إضافة حالة جديدة
        </button>
      </motion.div>

      {/* Search & Filter Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-white rounded-2xl p-4 shadow-sm border border-primary/5 flex flex-col sm:flex-row gap-3"
      >
        <div className="relative flex-1">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/30" />
          <input
            type="text"
            placeholder="ابحث عن حالة طبية..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-primary/10 bg-background font-sans text-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div className="flex gap-2">
          {[
            { key: 'all', label: 'الكل' },
            { key: 'active', label: 'نشطة' },
            { key: 'inactive', label: 'سابقة' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilterActive(f.key)}
              className={`px-4 py-2 rounded-xl text-sm font-sans font-medium transition-colors ${
                filterActive === f.key
                  ? 'bg-primary text-white'
                  : 'bg-background text-text/60 hover:bg-primary/5'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Records Grid */}
      {filteredRecords.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white border border-primary/5 rounded-2xl p-12 text-center shadow-sm"
        >
          <div className="w-16 h-16 bg-primary/5 rounded-full mx-auto flex items-center justify-center mb-4">
            <Activity size={28} className="text-primary/30" />
          </div>
          <p className="font-sans text-text/60 text-lg">
            {searchTerm || filterActive !== 'all'
              ? 'لا توجد نتائج مطابقة للبحث'
              : 'لا يوجد سجلات طبية مضافة حتى الآن'}
          </p>
          {!searchTerm && filterActive === 'all' && (
            <button
              onClick={openAddModal}
              className="mt-4 text-accent font-sans font-medium hover:text-primary transition-colors"
            >
              أضف أول حالة طبية
            </button>
          )}
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredRecords.map((record, i) => (
              <motion.div
                key={record.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.03 }}
                className="bg-white border border-primary/5 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-accent/20 transition-all group"
              >
                <div className="flex items-start gap-4">
                  {/* Status indicator */}
                  <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${record.is_active ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-heading font-bold text-lg text-primary truncate">{record.condition}</h4>
                    <p className="font-sans text-sm text-text/50 mt-1 flex items-center gap-1.5">
                      <Calendar size={14} />
                      تاريخ التشخيص: {formatDate(record.diagnosed_at)}
                    </p>
                    <span className={`inline-block mt-3 px-2.5 py-1 text-xs font-sans font-medium rounded-lg ${
                      record.is_active ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {record.is_active ? 'حالة نشطة' : 'حالة سابقة'}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleToggleActive(record)}
                      title={record.is_active ? 'تحويل لحالة سابقة' : 'تحويل لحالة نشطة'}
                      className="p-1.5 rounded-lg hover:bg-primary/5 text-primary/40 hover:text-accent transition-colors"
                    >
                      {record.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                    </button>
                    <button
                      onClick={() => openEditModal(record)}
                      title="تعديل"
                      className="p-1.5 rounded-lg hover:bg-primary/5 text-primary/40 hover:text-accent transition-colors"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(record.id)}
                      title="حذف"
                      className="p-1.5 rounded-lg hover:bg-red-50 text-primary/40 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ─── Add/Edit Modal ─── */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl z-10"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold font-heading text-primary">
                  {editingRecord ? 'تعديل الحالة الطبية' : 'إضافة حالة طبية جديدة'}
                </h3>
                <button
                  onClick={closeModal}
                  className="p-2 rounded-xl hover:bg-primary/5 text-primary/40 hover:text-primary transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-5">
                {/* Condition name */}
                <div className="space-y-2">
                  <label className="text-sm font-medium font-sans text-text/70">اسم الحالة الطبية *</label>
                  <input
                    type="text"
                    value={form.condition}
                    onChange={(e) => setForm(prev => ({ ...prev, condition: e.target.value }))}
                    placeholder="مثال: ضغط الدم المرتفع"
                    className="w-full px-4 py-3 rounded-xl border border-primary/10 bg-background font-sans text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                    autoFocus
                  />
                </div>

                {/* Diagnosis date */}
                <div className="space-y-2">
                  <label className="text-sm font-medium font-sans text-text/70">تاريخ التشخيص</label>
                  <div className="relative">
                    <Calendar size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/30" />
                    <input
                      type="date"
                      value={form.diagnosed_at}
                      onChange={(e) => setForm(prev => ({ ...prev, diagnosed_at: e.target.value }))}
                      className="w-full pl-4 pr-10 py-3 rounded-xl border border-primary/10 bg-background font-sans text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>
                </div>

                {/* Active toggle */}
                <div className="flex items-center justify-between bg-background rounded-xl p-4 border border-primary/5">
                  <div>
                    <p className="font-sans font-medium text-primary text-sm">الحالة نشطة حاليا</p>
                    <p className="font-sans text-xs text-text/50 mt-0.5">هل هذه الحالة لا تزال نشطة؟</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, is_active: !prev.is_active }))}
                    className={`relative w-12 h-7 rounded-full transition-colors ${form.is_active ? 'bg-accent' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all ${form.is_active ? 'left-0.5' : 'left-[22px]'}`} />
                  </button>
                </div>

                {/* Error */}
                {formError && (
                  <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-xl">
                    <AlertCircle size={16} />
                    <span className="font-sans text-sm">{formError}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-primary text-white font-sans font-medium py-3 rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                    {editingRecord ? 'حفظ التعديلات' : 'إضافة'}
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-6 py-3 rounded-xl border border-primary/10 text-text/60 font-sans font-medium hover:bg-primary/5 transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Delete Confirmation Modal ─── */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl z-10 text-center"
            >
              <div className="w-14 h-14 bg-red-50 rounded-full mx-auto flex items-center justify-center mb-4">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <h3 className="text-lg font-bold font-heading text-primary mb-2">حذف السجل الطبي</h3>
              <p className="font-sans text-text/60 text-sm mb-6">هل أنت متأكد من حذف هذا السجل؟ لا يمكن التراجع عن هذا الإجراء.</p>

              <div className="flex gap-3">
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  disabled={deleting}
                  className="flex-1 bg-red-500 text-white font-sans font-medium py-2.5 rounded-xl hover:bg-red-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  حذف
                </button>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2.5 rounded-xl border border-primary/10 text-text/60 font-sans font-medium hover:bg-primary/5 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
