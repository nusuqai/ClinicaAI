import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';

import LandingPage from './pages/LandingPage';
import Auth from './components/Auth';
import DashboardLayout from './components/DashboardLayout';
import DashboardHome from './components/DashboardHome';
import CalendarView from './components/dashboard/CalendarView';
import ProfileView from './components/dashboard/ProfileView';

function PrivateRoute({ children, session }) {
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <Router>
      <div className="font-sans text-text antialiased selection:bg-accent/30 selection:text-primary max-w-[100vw] overflow-x-hidden min-h-screen flex flex-col">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Auth />} />

          {/* Protected Dashboard Routes */}
          <Route path="/dashboard" element={
            <PrivateRoute session={session}>
              <DashboardLayout />
            </PrivateRoute>
          }>
            <Route index element={<DashboardHome session={session} />} />
            <Route path="appointments" element={<CalendarView session={session} />} />
            <Route path="profile" element={<ProfileView session={session} />} />
          </Route>
        </Routes>
      </div>
    </Router>
  );
}
