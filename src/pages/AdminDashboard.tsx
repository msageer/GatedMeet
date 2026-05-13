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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { db } from "@/lib/firebase";
import {
  collection,
  collectionGroup,
  query,
  getDocs,
  orderBy,
  limit,
  doc,
  updateDoc,
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

  const fetchData = async () => {
    try {
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
    <div className="space-y-8 max-w-7xl mx-auto">
      <header>
        <h1 className="text-4xl font-display font-extrabold tracking-tight">
          Master Admin
        </h1>
        <p className="text-slate-500 text-lg">
          Platform health and revenue overview.
        </p>
      </header>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          {
            label: "Gross Merch Volume",
            value: `$${stats.gmv.toLocaleString()}`,
            icon: TrendingUp,
            color: "text-green-600",
          },
          {
            label: "Total Platform Fees",
            value: `$${stats.totalFees.toLocaleString()}`,
            icon: DollarSign,
            color: "text-primary",
          },
          {
            label: "Active Creators",
            value: stats.creators,
            icon: Users,
            color: "text-blue-600",
          },
          {
            label: "Pending Payouts",
            value: `$${totalPendingAmount.toLocaleString()}`,
            icon: Activity,
            color: "text-orange-500",
          },
        ].map((item, i) => (
          <Card key={i} className="rounded-3xl border-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                  {item.label}
                </p>
                <item.icon className={`w-5 h-5 ${item.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <h3 className="text-3xl font-extrabold">{item.value}</h3>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Payout Management */}
        <Card className="md:col-span-3 rounded-[2rem] border-2 shadow-sm border-orange-100 bg-orange-50/30">
          <CardHeader>
            <CardTitle className="text-orange-900">
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
      </div>
    </div>
  );
}
