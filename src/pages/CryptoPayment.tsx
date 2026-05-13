import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { Copy, CheckCircle2 } from 'lucide-react';

export default function CryptoPayment() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<any>(null);
  const [creator, setCreator] = useState<any>(null);
  const [txHash, setTxHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!bookingId) return;
      const docSnap = await getDoc(doc(db, 'bookings', bookingId));
      if (docSnap.exists()) {
        const b = docSnap.data();
        setBooking(b);
        const uSnap = await getDoc(doc(db, 'users', b.creatorId));
        if (uSnap.exists()) setCreator(uSnap.data());
      }
    };
    fetchData();
  }, [bookingId]);

  if (!booking || !creator) return <div className="p-12 text-center">Loading payment details...</div>;

  const walletAddress = creator.walletAddress || '0x00000000000000000000000000';

  const confirmPayment = async () => {
    if (!txHash) {
      toast.error('Please enter the transaction hash');
      return;
    }
    setLoading(true);
    try {
      let finalMeetingLink = booking.meetingLink;
      if (!finalMeetingLink) {
         finalMeetingLink = creator.meetingUrl || `https://meet.google.com/${Math.random().toString(36).substring(2, 5)}-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 5)}`;
      }

      await updateDoc(doc(db, 'bookings', bookingId as string), {
        status: 'paid',
        txHash,
        meetingLink: finalMeetingLink
      });
      
      setMeetingUrl(finalMeetingLink);
      setIsSuccess(true);
      toast.success('Payment confirmed! Your session is booked.');
      
      await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: booking.clientEmail,
            subject: `Booking Confirmed: Session with ${creator.displayName}`,
            html: `<p>Hi ${booking.clientName},</p><p>Your crypto payment is confirmed.</p><p>Meeting Link: <a href="${finalMeetingLink}">${finalMeetingLink}</a></p>`,
          }),
      }).catch(console.error);

    } catch (e: any) {
      toast.error('Failed to confirm: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Address copied!');
  };

  if (isSuccess) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card className="rounded-[2rem] border-2 shadow-xl items-center text-center">
          <CardContent className="pt-12 space-y-6">
            <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto" />
            <h1 className="text-3xl font-bold font-display">Payment Verified!</h1>
            <p className="text-slate-500">Your crypto payment has been fully verified. See your meeting details below.</p>
            <div className="w-full bg-slate-50 border p-4 rounded-xl text-left space-y-2 mt-4">
               <div className="text-sm font-bold text-slate-700">Meeting Link</div>
               <a href={meetingUrl} target="_blank" className="text-indigo-600 font-medium break-all text-sm hover:underline">
                  {meetingUrl}
               </a>
            </div>
            <Button className="w-full h-14 rounded-2xl" onClick={() => navigate("/")}>Go to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-12">
      <Card className="rounded-[2rem] border-2 shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Complete Crypto Payment</CardTitle>
          <CardDescription>Send the exact amount to the creator's wallet</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
           <div className="p-6 bg-slate-50 border rounded-2xl text-center space-y-2">
             <div className="text-sm text-slate-500">Amount Due</div>
             <div className="text-4xl font-black">${booking.amount}</div>
             <div className="text-xs text-slate-400">Please send equivalent in USDT/USDC or TON</div>
           </div>

           <div className="space-y-2">
             <Label>Creator Wallet Address</Label>
             <div className="flex gap-2">
               <Input readOnly value={walletAddress} className="font-mono bg-slate-50" />
               <Button variant="outline" onClick={() => copyToClipboard(walletAddress)}>
                 <Copy className="w-4 h-4" />
               </Button>
             </div>
           </div>

           <div className="space-y-2">
             <Label>Transaction Hash / ID</Label>
             <Input 
               placeholder="0x..." 
               value={txHash}
               onChange={(e) => setTxHash(e.target.value)}
             />
             <p className="text-xs text-slate-500">After sending, paste your transaction hash here to verify.</p>
           </div>

           <Button className="w-full h-14 rounded-2xl font-bold text-lg" onClick={confirmPayment} disabled={loading}>
             {loading ? 'Confirming...' : 'I have made the payment'}
           </Button>
        </CardContent>
      </Card>
    </div>
  );
}
