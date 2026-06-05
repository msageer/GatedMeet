import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [formData, setFormData] = useState<{
    displayName: string,
    username: string,
    bio: string,
    price: number | '',
    duration: number | '',
    walletAddress: string,
    meetingUrl: string
  }>({
    displayName: '',
    username: '',
    bio: '',
    price: 50,
    duration: 60,
    walletAddress: '',
    meetingUrl: ''
  });

  const handleNext = () => {
    if (step === 1) {
      if (!formData.displayName) return toast.error('Name is required');
      if (!formData.username) return toast.error('Username is required');
      // Basic username validation: alphanumeric and underscores only
      if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
        return toast.error('Username can only contain letters, numbers, and underscores');
      }
      setStep(2);
    } else if (step === 2) {
      if (formData.price === '' || formData.duration === '' || Number(formData.duration) <= 0 || Number(formData.price) < 0) {
        return toast.error('Valid pricing, duration required');
      }
      setStep(3);
    }
  };

  const handleFinish = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    const DAYS = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ];

    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        displayName: formData.displayName,
        username: formData.username.toLowerCase(),
        bio: formData.bio,
        pricing: { price: formData.price, currency: 'USD', duration: formData.duration },
        walletAddress: formData.walletAddress,
        meetingUrl: formData.meetingUrl,
        setupComplete: true,
        availability: DAYS.reduce(
          (acc, day) => ({
            ...acc,
            [day]: {
              enabled: day !== "saturday" && day !== "sunday",
              slots: [{ start: "09:00", end: "17:00" }],
            },
          }),
          {} as any,
        ),
      });
      toast.success('Profile setup complete!');
      navigate('/dashboard');
    } catch (e: any) {
      toast.error('Failed to save: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-12">
      <Card className="rounded-[2rem] border-2 shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-display">Welcome to GatedMeet</CardTitle>
          <CardDescription>Let's get your expert profile set up in a few simple steps.</CardDescription>
        </CardHeader>
        <CardContent>
           <AnimatePresence mode="wait">
             {step === 1 && (
               <motion.div key="step1" initial={{opacity:0, x:10}} animate={{opacity:1, x:0}} exit={{opacity:0, x:-10}} className="space-y-6">
                 <div className="space-y-2">
                   <Label>Display Name</Label>
                   <Input value={formData.displayName} onChange={e => setFormData({...formData, displayName: e.target.value})} className="h-12 border-2 rounded-xl" placeholder="John Doe" />
                 </div>
                 <div className="space-y-2">
                   <Label>Username</Label>
                   <Input value={formData.username} onChange={e => setFormData({...formData, username: e.target.value.toLowerCase()})} className="h-12 border-2 rounded-xl" placeholder="johndoe" />
                   <p className="text-xs text-slate-500">This will be your booking link: gatedmeet.com/johndoe</p>
                 </div>
                 <div className="space-y-2">
                   <Label>Short Bio</Label>
                   <Textarea value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} className="resize-none border-2 rounded-xl" placeholder="I help people..." />
                 </div>
                 <Button className="w-full h-14 rounded-2xl" onClick={handleNext}>Next: Pricing</Button>
               </motion.div>
             )}
             {step === 2 && (
               <motion.div key="step2" initial={{opacity:0, x:10}} animate={{opacity:1, x:0}} exit={{opacity:0, x:-10}} className="space-y-6">
                 <div className="space-y-2">
                   <Label>Standard Session Rate ($)</Label>
                   <Input type="number" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value === '' ? '' : Number(e.target.value)})} className="h-12 border-2 rounded-xl" />
                 </div>
                 <div className="space-y-2">
                   <Label>Duration (Minutes)</Label>
                   <Input type="number" value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value === '' ? '' : Number(e.target.value)})} className="h-12 border-2 rounded-xl" />
                 </div>
                 <div className="flex gap-4">
                   <Button variant="outline" className="flex-1 h-14 rounded-2xl" onClick={() => setStep(1)}>Back</Button>  
                   <Button className="flex-1 h-14 rounded-2xl" onClick={handleNext}>Next: Payments</Button>
                 </div>
               </motion.div>
             )}
             {step === 3 && (
               <motion.div key="step3" initial={{opacity:0, x:10}} animate={{opacity:1, x:0}} exit={{opacity:0, x:-10}} className="space-y-6">
                 <div className="space-y-2">
                   <Label>Personal Meeting Link (Optional)</Label>
                   <Input value={formData.meetingUrl} onChange={e => setFormData({...formData, meetingUrl: e.target.value})} className="h-12 border-2 rounded-xl" placeholder="https://meet.google.com/..." />
                   <p className="text-xs text-slate-500">Your Google Meet or Zoom link. If left blank, a random Google Meet link will be generated.</p>
                 </div>
                 <div className="space-y-2">
                   <Label>Crypto Wallet Address (Optional)</Label>
                   <Input value={formData.walletAddress} onChange={e => setFormData({...formData, walletAddress: e.target.value})} className="h-12 border-2 rounded-xl" placeholder="0x..." />
                   <p className="text-xs text-slate-500">Enable clients to pay you in crypto natively.</p>
                 </div>
                 <div className="flex gap-4">
                   <Button variant="outline" className="flex-1 h-14 rounded-2xl" onClick={() => setStep(2)}>Back</Button>  
                   <Button className="flex-1 h-14 rounded-2xl gap-2" onClick={handleFinish} disabled={loading}>
                      <CheckCircle className="w-5 h-5"/> {loading ? 'Saving...' : 'Finish Setup'}
                   </Button>
                 </div>
               </motion.div>
             )}
           </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}
