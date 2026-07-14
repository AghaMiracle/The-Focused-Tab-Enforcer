import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';

// Landing
import Navbar from './components/landing/Navbar';
import HeroSection from './components/landing/HeroSection';
import BentoFeatures from './components/landing/BentoFeatures';
import HowItWorks from './components/landing/HowItWorks';
// import Pricing from './components/landing/Pricing';
// import Testimonials from './components/landing/Testimonials';
import Footer from './components/landing/Footer';

// Auth
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';

// Dashboard
import DashboardLayout from './layouts/DashboardLayout';
import OverviewPage from './pages/dashboard/OverviewPage';
import ExamsPage from './pages/dashboard/ExamsPage';
import StudentsPage from './pages/dashboard/StudentsPage';
import MonitoringPage from './pages/dashboard/MonitoringPage';
import ReportsPage from './pages/dashboard/ReportsPage';
import SettingsPage from './pages/dashboard/SettingsPage';

// ─── Landing page composite ───────────────────────────────────────────────────
function LandingPage() {
  return (
    <div
      className="relative min-h-screen"
      style={{ backgroundColor: '#000000' }}
    >
      {/* Global grid pattern */}
      <div className="fixed inset-0 grid-pattern opacity-20 pointer-events-none z-0" />

      {/* Floating shell container */}
      <div className="relative z-10 w-full max-w-[1600px] mx-auto">
        <Navbar />
        <main>
          <HeroSection />
          <BentoFeatures />
          <HowItWorks />
          {/* <Testimonials /> */}
          {/* <Pricing /> */}
          <Footer />
        </main>
      </div>
    </div>
  );
}

// ─── Protected route wrapper ──────────────────────────────────────────────────
function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// ─── Public route — redirect if already authenticated ────────────────────────
function PublicRoute({ children }) {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

// ─── Root router ─────────────────────────────────────────────────────────────
function AppRoutes() {
  return (
    <AnimatePresence mode="wait">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login"  element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />

        {/* Protected dashboard routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<OverviewPage />} />
          <Route path="exams" element={<ExamsPage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="monitoring" element={<MonitoringPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <AppRoutes />
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
