import React from 'react';
import { Star, Calendar, Clock, User, CheckCircle2, XCircle, Activity, Sparkles } from 'lucide-react';

/**
 * Renders rich UI for a single tool result based on toolName.
 */
export default function ToolResultCard({ toolName, data, onFillInput }) {
  if (!data) return null;

  switch (toolName) {
    case 'search_doctors':
    case 'list_doctors':
      return <DoctorList doctors={Array.isArray(data) ? data : (data.doctors || [])} onFillInput={onFillInput} />;

    case 'get_doctor':
      return <DoctorProfile doctor={data} />;

    case 'get_available_slots':
      return <SlotGrid slots={Array.isArray(data) ? data : (data.slots || [])} onFillInput={onFillInput} />;

    case 'book_appointment':
      return <ConfirmationCard type="booked" data={data} />;

    case 'cancel_appointment':
      return <ConfirmationCard type="cancelled" data={data} />;

    case 'get_my_appointments':
      return <AppointmentList appointments={Array.isArray(data) ? data : (data.appointments || [])} />;

    case 'get_my_medical_history':
      return <MedicalHistoryList records={Array.isArray(data) ? data : (data.records || [])} />;

    case 'get_my_doctor_suggestions':
      return <SuggestionList suggestions={Array.isArray(data) ? data : (data.suggestions || [])} />;

    case 'get_my_profile':
    case 'lookup_user':
      return <UserProfileCard user={data} />;

    case 'register_user':
      return <ConfirmationCard type="registered" data={data} />;

    default:
      return <FallbackCard toolName={toolName} data={data} />;
  }
}

// ─── Doctor List ───
function DoctorList({ doctors, onFillInput }) {
  if (!doctors.length) return <EmptyState text="لم يتم العثور على أطباء" />;
  // Deduplicate by id
  const unique = doctors.filter((doc, i, arr) => doc.id ? arr.findIndex(d => d.id === doc.id) === i : true);
  return (
    <div className="space-y-2">
      {unique.slice(0, 5).map((doc, i) => (
        <div
          key={doc.id || i}
          onClick={() => onFillInput?.(`اعرض مواعيد الدكتور ${doc.full_name}`)}
          className="flex items-center gap-3 bg-white/60 rounded-xl p-3 border border-primary/5 cursor-pointer hover:border-accent/30 hover:bg-accent/5 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent font-bold text-sm shrink-0">
            {doc.full_name?.charAt(0) || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-heading font-bold text-sm text-primary truncate">{doc.full_name_ar || doc.full_name}</p>
            <p className="text-xs font-sans text-text/50">{doc.specialty_ar || doc.specialty}</p>
          </div>
          {doc.rating && (
            <div className="flex items-center gap-1 text-xs shrink-0">
              <Star size={12} className="fill-accent text-accent" />
              <span className="font-bold text-primary">{doc.rating}</span>
            </div>
          )}
        </div>
      ))}
      {doctors.length > 5 && (
        <p className="text-xs text-text/40 text-center font-sans">+{doctors.length - 5} المزيد</p>
      )}
    </div>
  );
}

// ─── Doctor Profile ───
function DoctorProfile({ doctor }) {
  if (!doctor) return null;
  return (
    <div className="bg-white/60 rounded-xl p-4 border border-primary/5 space-y-2">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent font-bold text-lg">
          {doctor.full_name?.charAt(0) || '?'}
        </div>
        <div>
          <p className="font-heading font-bold text-primary">{doctor.full_name_ar || doctor.full_name}</p>
          <p className="text-xs font-sans text-text/50">{doctor.specialty_ar || doctor.specialty}</p>
        </div>
      </div>
      {doctor.bio && <p className="text-xs font-sans text-text/60 leading-relaxed">{doctor.bio_ar || doctor.bio}</p>}
      <div className="flex gap-3 text-xs font-sans text-text/50">
        {doctor.rating && (
          <span className="flex items-center gap-1">
            <Star size={12} className="fill-accent text-accent" /> {doctor.rating}
          </span>
        )}
        {doctor.availability_note && (
          <span className="flex items-center gap-1">
            <Clock size={12} className="text-accent" /> {doctor.availability_note_ar || doctor.availability_note}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Slot Grid ───
function SlotGrid({ slots, onFillInput }) {
  if (!slots.length) return <EmptyState text="لا توجد مواعيد متاحة حاليا" />;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {slots.slice(0, 12).map((slot, i) => {
          const start = slot.starts_at ? new Date(slot.starts_at) : null;
          const fillText = start
            ? `احجز موعد يوم ${start.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' })} الساعة ${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
            : '';
          return (
            <div
              key={slot.id || i}
              onClick={() => fillText && onFillInput?.(fillText)}
              className="bg-white/60 border border-primary/10 rounded-lg px-3 py-2 text-xs font-sans cursor-pointer hover:border-accent hover:bg-accent/5 transition-colors"
              dir="ltr"
            >              {start ? (
                <>
                  <span className="font-bold text-primary">{start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                  <span className="text-text/40 block">{start.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}</span>
                </>
              ) : (
                <span className="text-text/50">موعد متاح</span>
              )}
            </div>
          );
        })}
      </div>
      {slots.length > 12 && (
        <p className="text-xs text-text/40 text-center font-sans">+{slots.length - 12} موعد آخر</p>
      )}
    </div>
  );
}

// ─── Appointment List ───
function AppointmentList({ appointments }) {
  if (!appointments.length) return <EmptyState text="لا توجد مواعيد" />;

  const statusMap = {
    pending: { label: 'قيد الانتظار', color: 'bg-yellow-50 text-yellow-700' },
    confirmed: { label: 'مؤكد', color: 'bg-green-50 text-green-700' },
    cancelled: { label: 'ملغى', color: 'bg-red-50 text-red-700' },
    completed: { label: 'مكتمل', color: 'bg-gray-100 text-gray-600' },
  };

  return (
    <div className="space-y-2">
      {appointments.slice(0, 5).map((apt, i) => {
        const s = statusMap[apt.status] || statusMap.pending;
        return (
          <div key={apt.id || i} className="bg-white/60 rounded-xl p-3 border border-primary/5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center text-accent shrink-0">
              <Calendar size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-heading font-bold text-sm text-primary truncate">{apt.doctor_name || 'طبيب'}</p>
              <p className="text-xs font-sans text-text/50">
                {apt.scheduled_at ? new Date(apt.scheduled_at).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
              </p>
            </div>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-sans font-medium ${s.color}`}>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Medical History ───
function MedicalHistoryList({ records }) {
  if (!records.length) return <EmptyState text="لا يوجد سجل طبي" />;
  return (
    <div className="space-y-2">
      {records.map((rec, i) => (
        <div key={rec.id || i} className="bg-white/60 rounded-xl p-3 border border-primary/5 flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${rec.is_active ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`} />
          <div className="flex-1">
            <p className="font-heading font-bold text-sm text-primary">{rec.condition}</p>
            <p className="text-xs font-sans text-text/50">
              {rec.diagnosed_at ? new Date(rec.diagnosed_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long' }) : 'غير محدد'}
            </p>
          </div>
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-sans font-medium ${rec.is_active ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
            {rec.is_active ? 'نشطة' : 'سابقة'}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── AI Suggestions ───
function SuggestionList({ suggestions }) {
  if (!suggestions.length) return <EmptyState text="لا توجد اقتراحات" />;
  return (
    <div className="space-y-2">
      {suggestions.map((sug, i) => (
        <div key={sug.id || i} className="bg-white/60 rounded-xl p-3 border border-accent/10">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={14} className="text-accent" />
            <p className="font-heading font-bold text-sm text-primary">{sug.doctor_name || 'طبيب مقترح'}</p>
          </div>
          {sug.reason && <p className="text-xs font-sans text-text/60 leading-relaxed">{sug.reason}</p>}
        </div>
      ))}
    </div>
  );
}

// ─── User Profile ───
function UserProfileCard({ user }) {
  if (!user) return null;
  return (
    <div className="bg-white/60 rounded-xl p-4 border border-primary/5 flex items-center gap-3">
      <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-heading font-bold">
        <User size={20} />
      </div>
      <div>
        <p className="font-heading font-bold text-primary">{user.full_name}</p>
        <p className="text-xs font-sans text-text/50">{user.email}</p>
        {user.phone && <p className="text-xs font-sans text-text/40" dir="ltr">{user.phone}</p>}
      </div>
    </div>
  );
}

// ─── Confirmation Card ───
function ConfirmationCard({ type, data }) {
  const config = {
    booked: { icon: <CheckCircle2 size={18} />, label: 'تم الحجز بنجاح', color: 'bg-green-50 border-green-200 text-green-700' },
    cancelled: { icon: <XCircle size={18} />, label: 'تم إلغاء الموعد', color: 'bg-red-50 border-red-200 text-red-600' },
    registered: { icon: <CheckCircle2 size={18} />, label: 'تم التسجيل بنجاح', color: 'bg-green-50 border-green-200 text-green-700' },
  };
  const c = config[type] || config.booked;
  return (
    <div className={`rounded-xl p-3 border flex items-center gap-3 ${c.color}`}>
      {c.icon}
      <span className="font-sans font-medium text-sm">{c.label}</span>
    </div>
  );
}

// ─── Fallback ───
function FallbackCard({ toolName, data }) {
  return (
    <details className="bg-white/60 rounded-xl border border-primary/5 overflow-hidden">
      <summary className="px-3 py-2 text-xs font-sans font-medium text-text/50 cursor-pointer hover:bg-primary/5">
        {toolName}
      </summary>
      <pre className="px-3 py-2 text-[10px] font-mono text-text/60 overflow-x-auto max-h-32" dir="ltr">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}

// ─── Empty State ───
function EmptyState({ text }) {
  return (
    <div className="bg-white/60 rounded-xl p-4 border border-primary/5 text-center">
      <p className="font-sans text-sm text-text/40">{text}</p>
    </div>
  );
}
