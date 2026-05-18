import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth, db } from "@/lib/firebase";
import {
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
import {
  setDoc,
  doc,
  getDoc,
  serverTimestamp,
  query,
  collection,
  where,
  getDocs,
  updateDoc,
  increment,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const isEmailValid = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const generateReferralCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export default function Auth() {
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCodeInput, setReferralCodeInput] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleReferral = async (code: string) => {
    if (!code) return null;
    const q = query(
      collection(db, "users"),
      where("referralCode", "==", code.toUpperCase()),
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const referrer = snap.docs[0];
      // Increment referrer's bonus and count
      await updateDoc(doc(db, "users", referrer.id), {
        referralCount: increment(1),
        referralBonuses: increment(10), // $10 bonus
      });
      return referrer.id;
    }
    return null;
  };

  const handleGoogleAuth = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);

      const userRef = doc(db, "users", result.user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        const referredBy =
          mode === "signup" && referralCodeInput
            ? await handleReferral(referralCodeInput)
            : null;

        await setDoc(userRef, {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName || "",
          photoURL: result.user.photoURL || "",
          role: "creator",
          createdAt: serverTimestamp(),
          platformFeeTier: 10,
          referralCode: generateReferralCode(),
          referralCount: 0,
          referralBonuses: referredBy ? 10 : 0,
          referredBy: referredBy || "",
          setupComplete: false,
        });
        toast.success("Account created! Please set up your profile.");
        navigate("/onboarding");
      } else {
        toast.success("Successfully authenticated!");
        navigate("/dashboard");
      }
    } catch (error: any) {
      if (error.code === "auth/operation-not-allowed") {
        toast.error("Google Sign-In is not enabled.");
      } else {
        toast.error("Authentication failed: " + error.message);
      }
      console.error(error);
    }
  };

  const handleGithubAuth = async () => {
    try {
      const provider = new GithubAuthProvider();
      const result = await signInWithPopup(auth, provider);

      const userRef = doc(db, "users", result.user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        const referredBy =
          mode === "signup" && referralCodeInput
            ? await handleReferral(referralCodeInput)
            : null;

        await setDoc(userRef, {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName || "",
          photoURL: result.user.photoURL || "",
          role: "creator",
          createdAt: serverTimestamp(),
          platformFeeTier: 10,
          referralCode: generateReferralCode(),
          referralCount: 0,
          referralBonuses: referredBy ? 10 : 0,
          referredBy: referredBy || "",
          setupComplete: false,
        });
        toast.success("Account created! Please set up your profile.");
        navigate("/onboarding");
      } else {
        toast.success("Successfully authenticated!");
        navigate("/dashboard");
      }
    } catch (error: any) {
      if (error.code === "auth/operation-not-allowed") {
        toast.error("GitHub Sign-In is not enabled. Please enable it in Firebase Console.");
      } else {
        toast.error("Authentication failed: " + error.message);
      }
      console.error(error);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmailValid(email)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const result = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
        const referredBy = referralCodeInput
          ? await handleReferral(referralCodeInput)
          : null;

        await sendEmailVerification(result.user);

        await setDoc(doc(db, "users", result.user.uid), {
          uid: result.user.uid,
          email: result.user.email,
          role: "creator",
          createdAt: serverTimestamp(),
          platformFeeTier: 10,
          referralCode: generateReferralCode(),
          referralCount: 0,
          referralBonuses: referredBy ? 10 : 0,
          referredBy: referredBy || "",
          setupComplete: false,
        });
        toast.success("Account created! Please set up your profile.");
        navigate("/onboarding");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success("Logged in!");
        navigate("/dashboard");
      }
    } catch (error: any) {
      if (error.code === "auth/operation-not-allowed") {
        toast.error("Sign-in method is not enabled.");
      } else {
        toast.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto pt-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="rounded-[2rem] border-2 shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center font-bold text-white text-3xl shadow-lg shadow-orange-100">
              M
            </div>
            <div>
              <CardTitle className="text-3xl font-display font-extrabold tracking-tight">
                {mode === "signup" ? "Create an account" : "Welcome back"}
              </CardTitle>
              <CardDescription>
                Build your tech education empire today
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="w-full h-12 rounded-xl font-bold border-2"
                onClick={handleGoogleAuth}
              >
                Continue with Google
              </Button>
              <Button
                variant="outline"
                className="w-full h-12 rounded-xl font-bold border-2 bg-slate-900 text-white hover:bg-slate-800 hover:text-white"
                onClick={handleGithubAuth}
              >
                Continue with GitHub
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or with email
                </span>
              </div>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="rounded-xl h-12 border-2 focus-visible:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="rounded-xl h-12 border-2 focus-visible:ring-primary"
                />
              </div>
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="referral">Referral Code (Optional)</Label>
                  <Input
                    id="referral"
                    type="text"
                    placeholder="e.g. A1B2C3"
                    value={referralCodeInput}
                    onChange={(e) =>
                      setReferralCodeInput(e.target.value.toUpperCase())
                    }
                    className="rounded-xl h-12 border-2 focus-visible:ring-primary"
                  />
                </div>
              )}
              <Button
                type="submit"
                className="w-full h-12 rounded-xl font-bold text-lg"
                disabled={loading}
              >
                {loading
                  ? "Processing..."
                  : mode === "signup"
                    ? "Sign Up"
                    : "Log In"}
              </Button>
            </form>

            <div className="text-center">
              <Button
                variant="link"
                className="text-slate-500 font-medium"
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
              >
                {mode === "login"
                  ? "Don't have an account? Sign up"
                  : "Already have an account? Log in"}
              </Button>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/admin-setup")}
                className="text-[10px] uppercase tracking-widest text-slate-400 hover:text-primary transition-colors"
              >
                Admin Gateway
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
