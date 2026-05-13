import { Routes, Route, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Toaster } from 'sonner';
import { Button } from './components/ui/button';
import { toast } from 'sonner';

// Pages (to be created)
import Home from './pages/Home';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Wallet from './pages/Wallet';
import BookingPage from './pages/BookingPage';
import LeaveFeedback from './pages/LeaveFeedback';
import AdminDashboard from './pages/AdminDashboard';
import CryptoPayment from './pages/CryptoPayment';
import CustomPayment from './pages/CustomPayment';
import PaymentSuccess from './pages/PaymentSuccess';
import Onboarding from './pages/Onboarding';
import Navbar from './components/Navbar';



import { sendEmailVerification } from 'firebase/auth';

function EmailVerificationBanner({ user }: { user: User }) {
  const [sent, setSent] = useState(false);

  // We only show this for email/password users who haven't verified
  if (!user || user.emailVerified || user.providerData.some(p => p.providerId === 'google.com')) {
    return null;
  }

  const handleResend = async () => {
    try {
      await sendEmailVerification(user);
      setSent(true);
      toast.success("Verification email sent!");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="bg-amber-100 border-b border-amber-200 px-4 py-3 text-center text-sm text-amber-900 flex flex-col sm:flex-row items-center justify-center gap-2">
      <span>Please verify your email address. It might take a few minutes to arrive.</span>
      <Button variant="outline" size="sm" onClick={handleResend} disabled={sent} className="h-8 bg-white text-xs border-amber-300">
        {sent ? "Sent!" : "Resend Email"}
      </Button>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'creator' | 'admin' | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (user.email === 'admin@test.com') {
            setRole('admin');
          } else if (userDoc.exists()) {
            console.log('App.tsx: Found user doc:', userDoc.data());
            setRole(userDoc.data().role);
          } else {
            console.log('App.tsx: User doc does not exist for uid:', user.uid);
            setRole(null);
          }
        } catch (e) {
          console.error('App.tsx: error fetching userdoc', e);
        }
      } else {
        setRole(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) return <div className="h-screen w-screen flex items-center justify-center font-mono animate-pulse">GatedMeet...</div>;

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#1a1a1a] font-sans selection:bg-orange-200">
      <Navbar user={user} role={role} />
      {user && <EmailVerificationBanner user={user} />}
      <main className="container mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/onboarding" element={user ? <Onboarding /> : <Auth />} />
          <Route path="/booking/:creatorId" element={<BookingPage />} />
          <Route path="/success" element={<PaymentSuccess />} />
          <Route path="/crypto-payment/:bookingId" element={<CryptoPayment />} />
          <Route path="/pay/:id" element={<CustomPayment />} />
          <Route path="/feedback/:bookingId" element={<LeaveFeedback />} />
          
          {/* Protected Creator Routes */}
          <Route path="/dashboard" element={user ? <Dashboard /> : <Auth />} />
          <Route path="/dashboard/profile" element={user ? <Profile /> : <Auth />} />
          <Route path="/dashboard/wallet" element={user ? <Wallet /> : <Auth />} />
          
          {/* Protected Admin Routes */}
          <Route path="/admin" element={role === 'admin' ? <AdminDashboard /> : <div className="p-12 text-center">Unauthorized</div>} />
        </Routes>
      </main>
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
