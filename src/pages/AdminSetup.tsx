import { useState } from "react";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword 
} from "firebase/auth";
import { 
  doc, 
  setDoc, 
  serverTimestamp, 
  getDoc 
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ShieldAlert, Loader2 } from "lucide-react";

export default function AdminSetup() {
  const [loading, setLoading] = useState(false);
  const adminEmail = "msagirgroup@gmail.com";
  const [password, setPassword] = useState("Admin1234");

  const handleSetup = async () => {
    setLoading(true);
    try {
      // 1. Try to create the user
      let user;
      try {
        const result = await createUserWithEmailAndPassword(auth, adminEmail, password);
        user = result.user;
        toast.success("Admin account created successfully!");
      } catch (error: any) {
        if (error.code === "auth/email-already-in-use") {
          // 2. If already exists, try to sign in to confirm password
          const result = await signInWithEmailAndPassword(auth, adminEmail, password);
          user = result.user;
          toast.success("Admin already exists, signed in to verify.");
        } else {
          throw error;
        }
      }

      if (user) {
        // 3. Create or update the admin document in Firestore
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          email: user.email,
          role: "admin",
          createdAt: serverTimestamp(),
          platformFeeTier: 10,
          isVerifiedAdmin: true
        }, { merge: true });

        toast.success("System Admin privileges granted!");
      }
    } catch (error: any) {
      console.error("Admin setup failed:", error);
      if (error.code === "auth/network-request-failed") {
          toast.error("Network error. Please check your connection or wait a moment.");
      } else {
          toast.error("Admin setup failed: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto pt-20">
      <Card className="border-primary/20 shadow-2xl shadow-primary/10">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
            <ShieldAlert className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold italic uppercase tracking-tighter">Admin Initializer</CardTitle>
          <CardDescription>
            This utility will configure the system administrator account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Admin Email</label>
            <Input value={adminEmail} disabled className="bg-slate-50 text-slate-900 font-mono" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Target Password</label>
            <Input 
              type="text" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              className="font-mono"
            />
          </div>
          
          <div className="p-4 rounded-xl bg-orange-50 border border-orange-100 text-orange-800 text-sm italic">
            This will create the account if it doesn't exist and set its role to "admin" in the database.
          </div>

          <Button 
            className="w-full h-12 text-lg font-bold uppercase tracking-wider"
            onClick={handleSetup}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Bootstrap Admin Account"}
          </Button>

          <p className="text-center text-[10px] text-slate-400 font-mono uppercase tracking-widest">
            Restricted System Utility • 2026-05-18
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
