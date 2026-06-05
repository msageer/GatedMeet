import { getDocWrapper as getDoc, getDocsWrapper as getDocs } from "@/lib/firestore-utils";
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { db, handleFirestoreError, OperationType } from "@/lib/firebase";
import {
  collection,
  collectionGroup,
  query,
  orderBy,
  limit,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import {
  BarChart3,
  TrendingUp,
  Users,
  DollarSign,
  Activity,
  Settings,
  Check,
  X,
  Eye,
  Search,
  Trash2,
} from "lucide-react";
import { Transaction, UserProfile, PayoutRequest } from "../types";
import { toast } from "sonner";

export default function AdminDashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [payouts, setPayouts] = useState<
    (PayoutRequest & { userId: string })[]
  >([]);
  const [stats, setStats] = useState({
    gmv: 0,
    totalFees: 0,
    creators: 0,
    bookings: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [systemSettings, setSystemSettings] = useState<any>({
    flutterwavePublicKey: "",
    merchantTonAddress: "",
    merchantSolanaAddress: "",
    merchantBaseAddress: "",
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      // Fetch settings
      const settingsSnap = await getDoc(doc(db, "settings", "global"));
      if (settingsSnap.exists()) {
        setSystemSettings(settingsSnap.data());
      }

      // Fetch users
      const usersSnap = await getDocs(collection(db, "users"));
      const usersData = usersSnap.docs.map((d) => d.data() as UserProfile);
      setUsers(usersData);

      // Fetch all transactions
      const txSnap = await getDocs(
        query(collection(db, "transactions"), orderBy("timestamp", "desc")),
      );
      const txData = txSnap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Transaction,
      );
      setTransactions(txData);

      // Fetch all payouts
      const payoutsSnap = await getDocs(collectionGroup(db, "payouts"));
      const payoutsData = payoutsSnap.docs.map((doc) => {
        // Doc ref path: /users/{userId}/payouts/{payoutId}
        const pathSegments = doc.ref.path.split("/");
        const userId = pathSegments[1];
        return { id: doc.id, userId, ...doc.data() } as PayoutRequest & {
          userId: string;
        };
      });
      // Sort in JS to avoid missing index
      payoutsData.sort((a, b) => b.timestamp?.seconds - a.timestamp?.seconds);
      setPayouts(payoutsData);

      // Calculate stats
      const gmv = txData
        .filter((t) => t.type === "payment")
        .reduce((acc, t) => acc + t.amount, 0);
      const fee = gmv * 0.1; // Simple 10%

      setStats({
        gmv,
        totalFees: fee,
        creators: usersData.length,
        bookings: Math.floor(txData.length / 2), // Rough estimate for UI
      });
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load admin data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRoleChange = async (uid: string, currentRole: string) => {
    if (
      !window.confirm(
        `Are you sure you want to ${currentRole === "admin" ? "revoke" : "grant"} admin rights?`,
      )
    )
      return;
    try {
      const newRole = currentRole === "admin" ? "creator" : "admin";
      await updateDoc(doc(db, "users", uid), { role: newRole });
      toast.success(`User role updated to ${newRole}`);
      fetchData();
    } catch (err: any) {
      toast.error("Failed to update role: " + err.message);
    }
  };

  const handleDeleteUser = async (uid: string, email: string) => {
    if (
      !window.confirm(
        `Are you sure you want to PERMANENTLY delete user ${email}? This only removes their data from Firestore, not from Firebase Auth.`,
      )
    )
      return;
    try {
      await deleteDoc(doc(db, "users", uid));
      toast.success(`User ${email} deleted from database`);
      fetchData();
    } catch (err: any) {
      toast.error("Failed to delete user: " + err.message);
    }
  };

  const handlePayoutStatus = async (
    userId: string,
    payoutId: string,
    status: "approved" | "rejected",
  ) => {
    try {
      await updateDoc(doc(db, "users", userId, "payouts", payoutId), {
        status,
      });
      toast.success(`Payout ${status}`);
      fetchData();
    } catch (err: any) {
      toast.error("Failed to update payout: " + err.message);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    const path = "settings/global";
    try {
      await setDoc(doc(db, "settings", "global"), {
        ...systemSettings,
        updatedAt: new Date().toISOString(),
      });
      toast.success("System settings updated!");
    } catch (err: any) {
      console.error("Save settings error:", err);
      handleFirestoreError(err, OperationType.WRITE, path);
    } finally {
      setSavingSettings(false);
    }
  };

  const pendingPayouts = payouts.filter((p) => p.status === "pending");
  const totalPendingAmount = pendingPayouts.reduce(
    (acc, p) => acc + p.amount,
    0,
  );

  const filteredUsers = users.filter(
    (u) =>
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="space-y-10 max-w-7xl mx-auto px-4 md:px-8 py-8">
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-6 bg-slate-950 p-8 md:p-10 rounded-[3rem] border border-slate-900 shadow-2xl relative overflow-hidden text-white">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        <div className="relative z-10">
          <h1 className="text-5xl font-display font-black tracking-tighter mb-2 flex items-center gap-3">
            <span className="bg-primary text-slate-950 px-3 py-1 rounded-xl text-3xl">🚀</span>
            Master Admin
          </h1>
          <p className="text-slate-400 text-lg max-w-xl">
            Global platform health, revenue overview, and critical system controls.
          </p>
        </div>
        <div className="flex gap-3 relative z-10 mt-4 md:mt-0">
           <Button variant="secondary" className="h-12 px-6 rounded-2xl font-bold bg-white text-slate-900 hover:bg-slate-200" onClick={() => navigate("/admin-setup")}>
             Admin Setup
           </Button>
           <Button variant="outline" className="h-12 px-6 rounded-2xl font-bold border-slate-700 hover:bg-slate-800 text-white" onClick={fetchData}>
             <RefreshCw className="w-4 h-4 mr-2" />
             Refresh
           </Button>
        </div>
      </header>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="rounded-[2.5rem] border-0 bg-red-500/10 hover:bg-red-500/20 transition-colors">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest text-red-600 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Emergency Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
             <Button 
              variant="destructive" 
              className="rounded-xl font-bold shadow-lg shadow-red-500/20"
              onClick={() => {
                const emails = ["msageertv@gmail.com", "msageeroffice@gmail.com"];
                if (window.confirm(`Delete data for the following users? \n${emails.join("\n")}`)) {
                  emails.forEach(async (email) => {
                    const u = users.find(user => user.email === email);
                    if (u) {
                      await handleDeleteUser(u.uid, u.email);
                    } else {
                      toast.error(`User ${email} not found in database.`);
                    }
                  });
                }
              }}
             >
               Purge Test Users
             </Button>
          </CardContent>
        </Card>

        <Card className="rounded-[2.5rem] border-0 bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
              <Settings className="w-4 h-4" /> System Config
            </CardTitle>
          </CardHeader>
          <CardContent>
             <p className="text-sm text-indigo-800/70 font-medium">Global settings controls (API Keys, Merchant Wallets) are available at the bottom of the dashboard.</p>
          </CardContent>
        </Card>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          {
            label: "Gross Merch Volume",
            value: `$${stats.gmv.toLocaleString()}`,
            icon: TrendingUp,
            color: "text-green-600",
            bg: "bg-green-100"
          },
          {
            label: "Total Fees Collected",
            value: `$${stats.totalFees.toLocaleString()}`,
            icon: DollarSign,
            color: "text-blue-600",
            bg: "bg-blue-100"
          },
          {
            label: "Active Creators",
            value: stats.creators,
            icon: Users,
            color: "text-purple-600",
            bg: "bg-purple-100"
          },
          {
            label: "Pending Payouts",
            value: `$${totalPendingAmount.toLocaleString()}`,
            icon: Activity,
            color: "text-orange-600",
            bg: "bg-orange-100"
          },
        ].map((item, i) => (
          <Card key={i} className="rounded-[2.5rem] border-0 bg-slate-50 hover:bg-slate-100 transition-colors relative overflow-hidden">
             <CardContent className="p-8 pb-6">
              <div className="flex items-start justify-between mb-4 z-10 relative">
                <div className={`p-4 rounded-[2rem] ${item.bg} ${item.color} shadow-sm`}>
                  <item.icon className={`w-6 h-6`} />
                </div>
              </div>
              <div className="z-10 relative space-y-1">
                 <h3 className="text-4xl font-display font-black text-slate-900">{item.value}</h3>
                 <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  {item.label}
                 </p>
              </div>
              <div className={`absolute -right-6 -bottom-6 w-32 h-32 ${item.bg} rounded-full opacity-50 blur-3xl pointer-events-none`} />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Payout Management */}
        <Card className="md:col-span-3 rounded-[2rem] border-2 shadow-sm border-blue-100 bg-blue-50/30">
          <CardHeader>
            <CardTitle className="text-blue-900">
              Payout Requests ({pendingPayouts.length} Pending)
            </CardTitle>
            <CardDescription>
              Review and process creator payout requests.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Creator ID</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.length > 0 ? (
                  payouts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">
                        {p.userId}
                      </TableCell>
                      <TableCell className="font-bold">
                        ${p.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {p.timestamp?.seconds
                          ? new Date(
                              p.timestamp.seconds * 1000,
                            ).toLocaleDateString()
                          : "Unknown"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            p.status === "approved"
                              ? "default"
                              : p.status === "rejected"
                                ? "destructive"
                                : "secondary"
                          }
                          className="capitalize"
                        >
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {p.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-green-50 text-green-700 hover:bg-green-100"
                              onClick={() =>
                                handlePayoutStatus(p.userId, p.id!, "approved")
                              }
                            >
                              <Check className="w-4 h-4 mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-red-50 text-red-700 hover:bg-red-100"
                              onClick={() =>
                                handlePayoutStatus(p.userId, p.id!, "rejected")
                              }
                            >
                              <X className="w-4 h-4 mr-1" /> Reject
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-slate-400"
                    >
                      No payout requests found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* User Management */}
        <Card className="md:col-span-3 rounded-[2rem] border-2 shadow-sm">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                Manage platform creators and administrators.
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by email..."
                className="pl-9 rounded-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((u) => (
                    <TableRow key={u.uid}>
                      <TableCell className="font-medium">{u.email}</TableCell>
                      <TableCell>
                        <Badge
                          variant={u.role === "admin" ? "default" : "secondary"}
                          className="capitalize"
                        >
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {u.createdAt
                          ? new Date(
                              (u.createdAt as any).seconds
                                ? (u.createdAt as any).seconds * 1000
                                : u.createdAt,
                            ).toLocaleDateString()
                          : "N/A"}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Dialog>
                          <DialogTrigger
                            render={<Button variant="outline" size="sm" />}
                          >
                            <Eye className="w-4 h-4 mr-1" /> View Activity
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Activity for {u.email}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-6 pt-4">
                              <div>
                                <h3 className="font-semibold mb-2">
                                  Transactions
                                </h3>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Type</TableHead>
                                      <TableHead>Amount</TableHead>
                                      <TableHead>Status</TableHead>
                                      <TableHead>Date</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {transactions.filter(
                                      (t) => t.userId === u.uid,
                                    ).length > 0 ? (
                                      transactions
                                        .filter((t) => t.userId === u.uid)
                                        .map((t) => (
                                          <TableRow key={t.id}>
                                            <TableCell className="capitalize">
                                              {t.type}
                                            </TableCell>
                                            <TableCell
                                              className={
                                                t.type === "payment"
                                                  ? "text-green-600 font-bold"
                                                  : ""
                                              }
                                            >
                                              ${t.amount.toFixed(2)}
                                            </TableCell>
                                            <TableCell>{t.status}</TableCell>
                                            <TableCell>
                                              {new Date(
                                                t.timestamp,
                                              ).toLocaleDateString()}
                                            </TableCell>
                                          </TableRow>
                                        ))
                                    ) : (
                                      <TableRow>
                                        <TableCell
                                          colSpan={4}
                                          className="text-center text-slate-500"
                                        >
                                          No transactions
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </TableBody>
                                </Table>
                              </div>
                              <div>
                                <h3 className="font-semibold mb-2">Payouts</h3>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Amount</TableHead>
                                      <TableHead>Status</TableHead>
                                      <TableHead>Date</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {payouts.filter((p) => p.userId === u.uid)
                                      .length > 0 ? (
                                      payouts
                                        .filter((p) => p.userId === u.uid)
                                        .map((p) => (
                                          <TableRow key={p.id}>
                                            <TableCell className="font-bold">
                                              ${p.amount.toFixed(2)}
                                            </TableCell>
                                            <TableCell className="capitalize">
                                              {p.status}
                                            </TableCell>
                                            <TableCell>
                                              {p.timestamp?.seconds
                                                ? new Date(
                                                    p.timestamp.seconds * 1000,
                                                  ).toLocaleDateString()
                                                : "N/A"}
                                            </TableCell>
                                          </TableRow>
                                        ))
                                    ) : (
                                      <TableRow>
                                        <TableCell
                                          colSpan={3}
                                          className="text-center text-slate-500"
                                        >
                                          No payouts
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant={
                            u.role === "admin" ? "destructive" : "secondary"
                          }
                          size="sm"
                          onClick={() => handleRoleChange(u.uid, u.role)}
                        >
                          <Settings className="w-4 h-4 mr-1" />
                          {u.role === "admin" ? "Revoke Admin" : "Make Admin"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteUser(u.uid, u.email)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center py-8 text-slate-400"
                    >
                      No users recorded yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Transaction log */}
        <Card className="md:col-span-3 rounded-[2rem] border-2 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Global Transactions</CardTitle>
              <p className="text-sm text-slate-500">
                Live feed of all system payments & payouts.
              </p>
            </div>
            <BarChart3 className="w-5 h-5 text-slate-400" />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length > 0 ? (
                  transactions.slice(0, 15).map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="capitalize font-medium">
                        {tx.type}
                      </TableCell>
                      <TableCell>${tx.amount.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className="rounded-full capitalize"
                        >
                          {tx.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="uppercase text-xs font-bold text-slate-400">
                        {tx.method}
                      </TableCell>
                      <TableCell>
                        {new Date(tx.timestamp).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-slate-400"
                    >
                      No transactions recorded yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Special Configuration Section */}
        <Card className="md:col-span-2 rounded-[2rem] border-2 border-blue-100 shadow-xl overflow-hidden self-start">
          <CardHeader className="bg-blue-50/50">
            <CardTitle className="text-blue-900 flex items-center gap-2">
              <Settings className="w-5 h-5" /> Special Configuration
            </CardTitle>
            <CardDescription>
              Manage global payment keys and merchant wallet addresses.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label className="text-xs uppercase font-black text-slate-400">Flutterwave Public Key</Label>
                <Input 
                  value={systemSettings.flutterwavePublicKey} 
                  onChange={(e) => setSystemSettings({...systemSettings, flutterwavePublicKey: e.target.value})}
                  placeholder="FLWPUBK_TEST-..."
                  className="font-mono"
                />
              </div>
              
              <div className="pt-4 border-t space-y-4">
                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-widest">Merchant Wallet Addresses</h4>
                <div className="grid gap-2">
                  <Label className="text-xs text-slate-500">TON Merchant Address</Label>
                  <Input 
                    value={systemSettings.merchantTonAddress} 
                    onChange={(e) => setSystemSettings({...systemSettings, merchantTonAddress: e.target.value})}
                    placeholder="EQ..."
                    className="font-mono text-xs"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs text-slate-500">Solana Merchant Address</Label>
                  <Input 
                    value={systemSettings.merchantSolanaAddress} 
                    onChange={(e) => setSystemSettings({...systemSettings, merchantSolanaAddress: e.target.value})}
                    placeholder="Solana address..."
                    className="font-mono text-xs"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs text-slate-500">Base (ETH/USDC) Merchant Address</Label>
                  <Input 
                    value={systemSettings.merchantBaseAddress} 
                    onChange={(e) => setSystemSettings({...systemSettings, merchantBaseAddress: e.target.value})}
                    placeholder="0x..."
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            <Button 
              onClick={handleSaveSettings} 
              disabled={savingSettings}
              className="w-full bg-blue-600 hover:bg-blue-700 font-bold"
            >
              {savingSettings ? "Saving..." : "Save Global Configuration"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
