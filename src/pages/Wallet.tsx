import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  Wallet as WalletIcon,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  DollarSign,
  Link as LinkIcon,
  Copy
} from "lucide-react";
import { Transaction, PayoutRequest } from "../types";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Link } from "react-router-dom";

export default function Wallet() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [isPayoutDialogOpen, setIsPayoutDialogOpen] = useState(false);
  const [balance, setBalance] = useState({
    available: 0,
    pending: 0,
    lifetime: 0,
    referrals: 0,
  });

  const [linkTitle, setLinkTitle] = useState("");
  const [linkAmount, setLinkAmount] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");
  const [generatingLink, setGeneratingLink] = useState(false);

  const handleGenerateLink = async () => {
    if (!auth.currentUser || !linkTitle || !linkAmount) return;
    setGeneratingLink(true);
    try {
      const docRef = await addDoc(collection(db, "paymentLinks"), {
         creatorId: auth.currentUser.uid,
         title: linkTitle,
         amount: Number(linkAmount),
         createdAt: serverTimestamp(),
      });
      const url = `${window.location.origin}/pay/${docRef.id}`;
      setGeneratedLink(url);
      toast.success("Payment link generated!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate link");
    } finally {
      setGeneratingLink(false);
    }
  };

  const copyGeneratedLink = () => {
     navigator.clipboard.writeText(generatedLink);
     toast.success("Link copied!");
  };

  const fetchTransactionsAndPayouts = async () => {
    if (!auth.currentUser) return;
    try {
      // Get user profile first to get referral bonuses
      const userSnap = await import("firebase/firestore").then((m) =>
        m.getDoc(m.doc(db, "users", auth.currentUser!.uid)),
      );
      const userData = userSnap.exists()
        ? userSnap.data()
        : { referralBonuses: 0 };

      const q = query(
        collection(db, "transactions"),
        where("userId", "==", auth.currentUser.uid),
        orderBy("timestamp", "desc"),
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Transaction,
      );
      setTransactions(data);

      const payoutsQuery = query(
        collection(db, "users", auth.currentUser.uid, "payouts"),
        orderBy("timestamp", "desc"),
      );
      const payoutsSnapshot = await getDocs(payoutsQuery);
      const payoutsData = payoutsSnapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as PayoutRequest,
      );
      setPayouts(payoutsData);

      // Aggregate stats
      const total = data
        .filter((t) => t.type === "payment")
        .reduce((acc, t) => acc + t.amount, 0);

      // Calculate amount already paid out or pending
      const payoutsAmount = payoutsData.reduce((acc, p) => acc + p.amount, 0);

      // We add referral bonuses to lifetime and available
      const refBonus = userData.referralBonuses || 0;

      setBalance({
        available: total * 0.8 + refBonus - payoutsAmount,
        pending: total * 0.1,
        lifetime: total + refBonus,
        referrals: refBonus,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactionsAndPayouts();
  }, []);

  const handleRequestPayout = async () => {
    if (!auth.currentUser) return;
    if (balance.available <= 0) {
      toast.error("Insufficient balance for payout.");
      return;
    }
    setRequestingPayout(true);
    try {
      await addDoc(collection(db, "users", auth.currentUser.uid, "payouts"), {
        amount: balance.available,
        status: "pending",
        timestamp: serverTimestamp(),
      });
      toast.success(
        `Successfully requested payout of $${balance.available.toFixed(2)}`,
      );
      setIsPayoutDialogOpen(false);
      fetchTransactionsAndPayouts();
    } catch (err: any) {
      toast.error("Failed to request payout: " + err.message);
    } finally {
      setRequestingPayout(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <header>
        <h1 className="text-3xl font-bold font-display">Wallet & Earnings</h1>
        <p className="text-slate-500">
          Track your payouts and revenue streams.
        </p>
      </header>

      {/* Balance Cards */}
      <div className="grid md:grid-cols-4 gap-6">
        <Card className="rounded-[2rem] border-2 bg-primary text-white shadow-xl shadow-orange-100">
          <CardContent className="pt-6 space-y-2">
            <DollarSign className="w-8 h-8 opacity-50" />
            <p className="text-orange-100 font-medium">Available for Payout</p>
            <h3 className="text-4xl font-extrabold">
              ${balance.available.toFixed(2)}
            </h3>
            <Dialog open={isPayoutDialogOpen} onOpenChange={setIsPayoutDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="secondary"
                  className="w-full mt-4 bg-white text-primary hover:bg-orange-50 font-bold rounded-xl"
                  disabled={requestingPayout || balance.available <= 0}
                >
                  Request Payout
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Confirm Payout Request</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to request a payout? This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="text-slate-500 font-medium">Available Balance</span>
                    <span className="text-xl font-bold text-slate-900">${balance.available.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                    <span className="text-indigo-700 font-medium">Requested Amount</span>
                    <span className="text-xl font-bold text-indigo-700">${balance.available.toFixed(2)}</span>
                  </div>
                </div>
                <DialogFooter className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsPayoutDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleRequestPayout} disabled={requestingPayout}>
                    {requestingPayout ? "Processing..." : "Confirm Request"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-2">
          <CardHeader className="pb-0">
            <CardDescription>Pending (Escrow)</CardDescription>
            <CardTitle className="text-2xl">
              ${balance.pending.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-2">
              <TrendingUp className="w-3 h-3" /> Average payout time: 3-5 days
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-2">
          <CardHeader className="pb-0">
            <CardDescription>Referral Bonuses</CardDescription>
            <CardTitle className="text-2xl">
              ${balance.referrals.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-xs text-indigo-500 mt-2 font-bold uppercase">
              From invites
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-2">
          <CardHeader className="pb-0">
            <CardDescription>Lifetime Earnings</CardDescription>
            <CardTitle className="text-2xl">
              ${balance.lifetime.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-xs text-green-500 mt-2 font-bold uppercase">
              Active Growth
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[2rem] border-2 bg-indigo-50/50">
         <CardHeader>
           <CardTitle className="flex items-center gap-2 text-indigo-900">
             <LinkIcon className="w-5 h-5 text-indigo-500" />
             Create Custom Payment Link
           </CardTitle>
           <CardDescription>Generate a standard payment link for specific requests or one-off services.</CardDescription>
         </CardHeader>
         <CardContent>
            <div className="flex flex-col md:flex-row items-end gap-4">
               <div className="space-y-2 flex-grow">
                 <label className="text-sm font-bold text-slate-700">Link Title</label>
                 <Input 
                   placeholder="e.g. Logo Design Deposit" 
                   value={linkTitle} 
                   onChange={(e) => setLinkTitle(e.target.value)} 
                   className="bg-white rounded-xl h-12"
                 />
               </div>
               <div className="space-y-2 w-full md:w-48">
                 <label className="text-sm font-bold text-slate-700">Amount (USD)</label>
                 <Input 
                   type="number"
                   placeholder="0.00" 
                   value={linkAmount} 
                   onChange={(e) => setLinkAmount(e.target.value)} 
                   className="bg-white rounded-xl h-12"
                 />
               </div>
               <Button 
                 onClick={handleGenerateLink} 
                 disabled={generatingLink || !linkTitle || !linkAmount}
                 className="rounded-xl h-12 px-6 font-bold"
               >
                 {generatingLink ? "Generating..." : "Generate"}
               </Button>
            </div>
            
            {generatedLink && (
              <div className="mt-6 p-4 bg-white border rounded-xl flex items-center justify-between shadow-sm">
                 <div className="font-mono text-sm text-slate-600 truncate mr-4">
                    {generatedLink}
                 </div>
                 <Button variant="outline" size="sm" onClick={copyGeneratedLink} className="flex gap-2">
                    <Copy className="w-4 h-4" /> Copy
                 </Button>
              </div>
            )}
         </CardContent>
      </Card>

      {/* Transaction Table */}
      <Card className="rounded-[2rem] border-2">
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length > 0 ? (
                transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${tx.type === "payment" ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600"}`}
                      >
                        {tx.type === "payment" ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </div>
                      <span className="font-semibold capitalize">
                        {tx.type}
                      </span>
                    </TableCell>
                    <TableCell
                      className={`font-bold ${tx.type === "payment" ? "text-green-600" : "text-slate-900"}`}
                    >
                      {tx.type === "payment" ? "+" : "-"}${tx.amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="uppercase text-xs font-bold text-slate-400">
                      {tx.method}
                    </TableCell>
                    <TableCell>
                      {new Date(tx.timestamp).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          tx.status === "success" ? "default" : "secondary"
                        }
                        className="rounded-full px-3 capitalize"
                      >
                        {tx.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-12 text-slate-400"
                  >
                    <div className="flex flex-col items-center justify-center gap-3">
                      <p>No transactions found.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        render={<Link to="/dashboard" />}
                      >
                        View Your Earnings
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Payout Requests Table */}
      <Card className="rounded-[2rem] border-2">
        <CardHeader>
          <CardTitle>Payout Requests</CardTitle>
          <CardDescription>History of your requested payouts.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.length > 0 ? (
                payouts.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-bold text-slate-900 border-none">
                      ${request.amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="border-none">
                      {request.timestamp?.seconds
                        ? new Date(
                            request.timestamp.seconds * 1000,
                          ).toLocaleDateString()
                        : "Just now"}
                    </TableCell>
                    <TableCell className="border-none">
                      <Badge
                        variant={
                          request.status === "approved"
                            ? "default"
                            : request.status === "rejected"
                              ? "destructive"
                              : "secondary"
                        }
                        className="rounded-full px-3 capitalize"
                      >
                        {request.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center py-12 text-slate-400"
                  >
                    <div className="flex flex-col items-center justify-center gap-3">
                      <p>No payout requests found.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsPayoutDialogOpen(true)}
                        disabled={balance.available <= 0}
                      >
                        Request Payout
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
