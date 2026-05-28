import { getDocWrapper as getDoc, getDocsWrapper as getDocs } from "@/lib/firestore-utils";
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { Copy, CheckCircle2, Wallet } from 'lucide-react';

export default function CryptoPayment() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<any>(null);
  const [creator, setCreator] = useState<any>(null);
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [selectedChain, setSelectedChain] = useState<'ton' | 'solana' | 'base'>('ton');
  const [txHash, setTxHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!bookingId) return;
      const [bSnap, sSnap] = await Promise.all([
        getDoc(doc(db, 'bookings', bookingId)),
        getDoc(doc(db, 'settings', 'global'))
      ]);

      if (bSnap.exists()) {
        const b = bSnap.data();
        setBooking(b);
        const uSnap = await getDoc(doc(db, 'users', b.creatorId));
        if (uSnap.exists()) setCreator(uSnap.data());
      }
      if (sSnap.exists()) {
        setSystemSettings(sSnap.data());
      }
    };
    fetchData();
  }, [bookingId]);

  if (!booking || !creator) return <div className="p-12 text-center">Loading payment details...</div>;

  const getWalletAddress = () => {
    switch (selectedChain) {
      case 'ton':
        return creator.tonAddress || creator.walletAddress || systemSettings?.merchantTonAddress || 'No TON address set';
      case 'solana':
        return creator.solanaAddress || systemSettings?.merchantSolanaAddress || 'No Solana address set';
      case 'base':
        return creator.baseAddress || systemSettings?.merchantBaseAddress || 'No Base address set';
      default:
        return 'Select a network';
    }
  };

  const walletAddress = getWalletAddress();

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
        cryptoNetwork: selectedChain,
        cryptoAddress: walletAddress,
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
    if (text.includes('No ')) return;
    navigator.clipboard.writeText(text);
    toast.success('Address copied!');
  };

  if (isSuccess) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <Card className="rounded-[2rem] border-2 shadow-xl items-center text-center">
          <CardContent className="pt-12 space-y-6">
            <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto" />
            <h1 className="text-3xl font-bold font-display">Payment Verified!</h1>
            <p className="text-slate-500">Your crypto payment has been submitted for verification. See your meeting details below.</p>
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
    <div className="max-w-2xl mx-auto py-12 px-4">
      <Card className="rounded-[2rem] border-2 shadow-xl overflow-hidden">
        <CardHeader className="text-center bg-slate-50/50 pb-8">
          <Wallet className="w-12 h-12 text-indigo-600 mx-auto mb-2" />
          <CardTitle className="text-3xl font-display font-black">Crypto Checkout</CardTitle>
          <CardDescription>Send the exact amount using your preferred network</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 p-8">
           <div className="p-6 bg-slate-50 border-2 border-indigo-100 rounded-[1.5rem] text-center space-y-2">
             <div className="text-sm text-slate-500 uppercase tracking-widest font-bold">Amount Due</div>
             <div className="text-5xl font-black text-indigo-600">${booking.amount}</div>
             <div className="text-xs text-slate-400 font-medium">Please send equivalent value in USDT/USDC or Native tokens</div>
           </div>

           <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-600">Step 1: Choose Network</Label>
                <Select 
                  value={selectedChain} 
                  onValueChange={(val: any) => setSelectedChain(val)}
                >
                  <SelectTrigger className="h-14 rounded-xl border-2">
                    <SelectValue placeholder="Select Blockchain" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ton">TON Network (USDT/TON)</SelectItem>
                    <SelectItem value="solana">Solana (USDC/SOL)</SelectItem>
                    <SelectItem value="base">Base Network (USDC/ETH)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-600">Step 2: Copy Receiver Address</Label>
                <div className="flex gap-2">
                  <Input 
                    readOnly 
                    value={walletAddress} 
                    className="font-mono bg-slate-50 h-12 border-2 rounded-xl text-xs" 
                  />
                  <Button 
                    variant="outline" 
                    className="h-12 w-12 rounded-xl border-2 p-0"
                    onClick={() => copyToClipboard(walletAddress)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                {walletAddress.includes('No ') && (
                  <p className="text-xs text-red-500 font-medium">This creator hasn't set up their {selectedChain} wallet yet.</p>
                )}
              </div>

              <div className="space-y-2 pt-4 border-t">
                <Label className="text-slate-600 font-bold underline">Step 3: Enter Transaction Hash</Label>
                <Input 
                  placeholder="Paste your Transaction ID / Hash here" 
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  className="h-14 border-2 rounded-xl font-mono text-xs"
                />
                <p className="text-[10px] text-slate-500 leading-tight">Paste the hash after completing the transfer in your wallet (e.g. Phantom, Tonkeeper, Metamask).</p>
              </div>
           </div>

           <Button 
            className="w-full h-16 rounded-[1.25rem] font-black text-xl shadow-lg shadow-indigo-100 transition-all active:scale-95" 
            onClick={confirmPayment} 
            disabled={loading || walletAddress.includes('No ')}
          >
             {loading ? 'Processing...' : 'Verify My Payment'}
           </Button>
        </CardContent>
      </Card>
      
      <p className="text-center mt-6 text-slate-400 text-xs">
        Secure peer-to-peer checkout powered by GatedMeet.
      </p>
    </div>
  );
}

