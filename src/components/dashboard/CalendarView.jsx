import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { motion } from 'framer-motion';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  startOfMonth, 
  endOfMonth, 
  isSameMonth, 
  isSameDay, 
  isToday 
} from 'date-fns';
import { ar } from 'date-fns/locale';
import { ChevronRight, ChevronLeft, Loader2, Calendar as CalendarIcon, Clock, User, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

export default function CalendarView({ session }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    async function fetchAppointments() {
      try {
        setLoading(true);
        if (!session?.user?.id) return;

        // Fetch using the view we created before
        const { data, error } = await supabase
          .from('v_appointments')
          .select('*')
          .eq('patient_email', session.user.email) // The view uses patient_email 
          .order('scheduled_at', { ascending: true });
        
        // If view fails, try direct table fetch (fallback)
        if (error) {
             const { data: directData, error: directError } = await supabase
              .from('appointments')
              .select(`
                id,
                scheduled_at,
                status,
                reason,
                notes,
                doctors (full_name, specialty)
              `)
              .eq('user_id', session.user.id);
              
              if(directError) throw directError;
              
              const formattedAppointments = directData.map(apt => ({
                  id: apt.id,
                  scheduled_at: apt.scheduled_at,
                  status: apt.status,
                  reason: apt.reason,
                  notes: apt.notes,
                  doctor_name: apt.doctors.full_name,
                  doctor_specialty: apt.doctors.specialty
              }));
              
              setAppointments(formattedAppointments || []);
        } else {
             setAppointments(data || []);
        }

      } catch (error) {
        console.error('Error fetching appointments:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAppointments();
  }, [session, currentMonth]); // Re-fetch if month changes, though typically we fetch all future

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 6 }); // Starts on Saturday in Arab world usually
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 6 });

  const dateFormat = "MMMM yyyy";
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const weekDays = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

  // Get appointments for the selected date
  const selectedDayAppointments = appointments.filter(apt => 
    isSameDay(new Date(apt.scheduled_at), selectedDate)
  );

  const getStatusConfig = (status) => {
    switch (status) {
      case 'confirmed': return { color: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500', icon: <CheckCircle2 size={16} /> };
      case 'pending': return { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500', icon: <AlertCircle size={16} /> };
      case 'cancelled': return { color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500', icon: <XCircle size={16} /> };
      case 'completed': return { color: 'bg-primary/10 text-primary border-primary/20', dot: 'bg-primary', icon: <CheckCircle2 size={16} /> };
      default: return { color: 'bg-gray-100 text-gray-700 border-gray-200', dot: 'bg-gray-500', icon: <CalendarIcon size={16} /> };
    }
  };

  const getStatusTextInArabic = (status) => {
    const map = {
        'confirmed': 'مؤكد',
        'pending': 'قيد الانتظار',
        'cancelled': 'ملغي',
        'completed': 'مكتمل'
    };
    return map[status] || status;
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
       <div className="flex flex-col md:flex-row gap-6">
           
           {/* Calendar Grid (Right Side) */}
           <motion.div 
             initial={{ opacity: 0, x: 20 }}
             animate={{ opacity: 1, x: 0 }}
             className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-primary/5 flex-grow md:w-2/3"
           >
               <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-bold font-heading text-primary capitalize">
                        {format(currentMonth, dateFormat, { locale: ar })}
                    </h2>
                    <div className="flex gap-2">
                        <button onClick={nextMonth} className="p-2 rounded-xl bg-primary/5 text-primary hover:bg-accent hover:text-white transition-colors">
                            <ChevronRight size={20} />
                        </button>
                        <button onClick={prevMonth} className="p-2 rounded-xl bg-primary/5 text-primary hover:bg-accent hover:text-white transition-colors">
                            <ChevronLeft size={20} />
                        </button>
                    </div>
               </div>

               <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2">
                   {weekDays.map(day => (
                       <div key={day} className="text-center font-sans font-bold text-sm text-text/50 py-2">
                           {day}
                       </div>
                   ))}
               </div>

               <div className="grid grid-cols-7 gap-1 md:gap-2">
                   {days.map((day, idx) => {
                       const isCurrentMonth = isSameMonth(day, monthStart);
                       const isSelected = isSameDay(day, selectedDate);
                       const isDayToday = isToday(day);
                       
                       // Check if day has appointments
                       const dayAppointments = appointments.filter(apt => isSameDay(new Date(apt.scheduled_at), day));
                       const hasConfirmed = dayAppointments.some(a => a.status === 'confirmed');
                       const hasPending = dayAppointments.some(a => a.status === 'pending');

                       return (
                           <div 
                               key={idx}
                               onClick={() => setCurrentMonth(day) || setSelectedDate(day)}
                               className={`
                                   min-h-[80px] p-2 rounded-2xl border transition-all cursor-pointer relative group
                                   ${!isCurrentMonth ? 'text-gray-300 bg-gray-50/50 border-transparent' : 'bg-white border-primary/5'}
                                   ${isSelected ? 'border-accent shadow-md bg-accent/5' : 'hover:border-primary/20'}
                                   ${isDayToday && !isSelected ? 'border-primary/30 bg-primary/tele5' : ''}
                               `}
                           >
                               <span className={`font-sans font-bold text-sm ${isDayToday ? 'text-accent' : (!isCurrentMonth ? 'text-gray-400' : 'text-primary')}`}>
                                   {format(day, 'd')}
                               </span>
                               
                               {/* Dots indicator container */}
                               <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                                    {hasConfirmed && <span className="w-2 h-2 rounded-full bg-green-500" />}
                                    {hasPending && <span className="w-2 h-2 rounded-full bg-yellow-400" />}
                               </div>
                           </div>
                       );
                   })}
               </div>
           </motion.div>

           {/* Selected Day Agenda (Left Side) */}
           <motion.div 
             initial={{ opacity: 0, x: -20 }}
             animate={{ opacity: 1, x: 0 }}
             transition={{ delay: 0.1 }}
             className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-primary/5 md:w-1/3 flex flex-col"
           >
                <div className="mb-6">
                    <h3 className="text-xl font-bold font-heading text-primary">المواعيد</h3>
                    <p className="font-sans text-text/60">{format(selectedDate, 'EEEE, d MMMM', { locale: ar })}</p>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                    {selectedDayAppointments.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-50 space-y-3 py-10">
                            <CalendarIcon size={48} className="text-primary/30" />
                            <p className="font-sans font-medium text-primary">لا توجد مواعيد في هذا اليوم</p>
                        </div>
                    ) : (
                        selectedDayAppointments.map((apt) => {
                            const config = getStatusConfig(apt.status);
                            
                            return (
                                <div key={apt.id} className={`p-5 rounded-2xl border ${config.color} bg-white shadow-sm hover:shadow-md transition-shadow`}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className={`px-2 py-1 rounded-md flex items-center gap-1 text-xs font-bold ${config.color.split(' ')[0]} ${config.color.split(' ')[1]}`}>
                                            {config.icon}
                                            {getStatusTextInArabic(apt.status)}
                                        </div>
                                        <div className="flex items-center gap-1 text-primary/70 font-sans text-sm font-bold bg-gray-50 px-2 py-1 rounded-md">
                                            <Clock size={14} />
                                            {format(new Date(apt.scheduled_at), 'hh:mm a', { locale: ar })}
                                        </div>
                                    </div>
                                    
                                    <h4 className="font-heading font-bold text-lg text-primary mb-1">
                                        د. {apt.doctor_name || 'طبيب غير محدد'}
                                    </h4>
                                    <p className="font-sans text-sm text-text/70 flex items-center gap-1 mb-3">
                                        <User size={14} />
                                        {apt.doctor_specialty}
                                    </p>
                                    
                                    {apt.reason && (
                                        <p className="font-sans text-sm text-text/80 bg-background/50 p-2 rounded-xl mt-2 line-clamp-2">
                                            <span className="font-bold opacity-70">السبب: </span>{apt.reason}
                                        </p>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="pt-6 mt-auto">
                    <a href="/#book" className="w-full flex items-center justify-center gap-2 bg-primary/5 text-primary hover:bg-accent hover:text-white font-sans font-bold py-3 px-4 rounded-xl transition-colors">
                        <CalendarIcon size={18} />
                        حجز موعد جديد
                    </a>
                </div>
           </motion.div>
       </div>
    </div>
  );
}
