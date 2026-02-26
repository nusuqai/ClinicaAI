import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Star } from 'lucide-react';
import { motion } from 'framer-motion';

const specialtyMap = {
  'General Practitioner': 'طب عام',
  'Cardiologist': 'أمراض القلب',
  'Dermatologist': 'الأمراض الجلدية',
  'Neurologist': 'طب الأعصاب',
  'Endocrinologist': 'الغدد الصماء'
};

export default function DoctorsShowcase() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDoctors() {
      try {
        const { data, error } = await supabase.from('doctors').select('*');
        if (error) throw error;
        setDoctors(data);
      } catch (err) {
        console.error('Error fetching doctors:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDoctors();
  }, []);

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating || 5);
    for (let i = 0; i < 5; i++) {
        stars.push(
            <Star 
                key={i} 
                size={16} 
                className={i < fullStars ? "fill-accent text-accent" : "text-gray-300"} 
            />
        );
    }
    return stars;
  };

  const containerVariants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.15 }
    }
  };

  const cardVariants = {
    hidden: { y: 50, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.6, ease: "easeOut" } }
  };

  return (
    <section id="doctors" className="py-24 bg-white relative">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="text-center mb-16">
          <h2 className="font-heading font-bold text-4xl md:text-5xl text-primary mb-4">أطباؤنا</h2>
          <p className="font-sans text-xl text-text/70 max-w-2xl mx-auto">
            نخبة من أفضل الأطباء المتخصصين، يجمعون بين الخبرة الطويلة وأحدث التقنيات.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-accent rounded-full animate-spin" />
          </div>
        ) : doctors.length > 0 ? (
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {doctors.map((doc) => {
              const arabicSpec = specialtyMap[doc.specialty] || doc.specialty;
              const photoUrl = doc.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(doc.full_name)}&background=00C2CB&color=fff&size=200`;
              
              return (
                <motion.div 
                  key={doc.id} 
                  className="bg-background border border-primary/5 rounded-[2rem] overflow-hidden shadow-sm hover:-translate-y-2 hover:shadow-xl transition-all duration-300 group flex flex-col"
                  variants={cardVariants}
                >
                  <div className="h-64 overflow-hidden relative shrink-0">
                    <img 
                      src={photoUrl} 
                      alt={doc.full_name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-transparent" />
                    <div className="absolute bottom-4 right-4 flex gap-1" dir="ltr">
                        {renderStars(doc.rating)}
                    </div>
                  </div>
                  
                  <div className="p-6 flex flex-col flex-grow">
                    <div className="inline-block px-3 py-1 bg-accent/10 text-accent font-sans text-sm font-bold rounded-full mb-3 w-fit">
                      {arabicSpec}
                    </div>
                    
                    <h3 className="font-heading font-bold text-2xl text-primary mb-2">
                        {doc.full_name}
                    </h3>
                    
                    {doc.bio && (
                      <p className="font-sans text-text/70 text-sm mb-4 line-clamp-3 leading-relaxed flex-grow">
                        {doc.bio}
                      </p>
                    )}

                    {doc.availability_note && (
                      <div className="flex items-center gap-2 text-sm text-primary/80 mb-6 bg-primary/5 p-3 rounded-xl mt-auto">
                        <span className="w-2 h-2 rounded-full bg-accent animate-pulse shrink-0" />
                        <span>{doc.availability_note}</span>
                      </div>
                    )}
                    
                    <a 
                        href={`#book?doctor=${doc.id}`}
                        className="w-full block text-center bg-primary text-white font-sans font-medium py-3 rounded-xl hover:bg-accent hover:text-primary transition-colors duration-300 mt-auto"
                    >
                      احجز مع الدكتور
                    </a>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <div className="text-center py-12">
             <p className="font-sans text-xl text-text/60">لا يوجد أطباء متاحين حالياً.</p>
          </div>
        )}
      </div>
    </section>
  );
}
