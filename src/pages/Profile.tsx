import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>({
    displayName: "",
    bio: "",
    pricing: { price: 50, currency: "USD", duration: 60 },
    platformFeeTier: 10,
    walletAddress: "",
    tonAddress: "",
    solanaAddress: "",
    baseAddress: "",
    referralCode: "",
    referralCount: 0,
    referralBonuses: 0,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    cancellationPolicy:
      "Cancellations must be made at least 24 hours in advance for a full refund.",
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

  useEffect(() => {
    const fetchProfile = async () => {
      if (!auth.currentUser) return;
      try {
        const docRef = doc(db, "users", auth.currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();

          // Generate referral code if missing
          let currentReferralCode = data.referralCode;
          if (!currentReferralCode) {
            currentReferralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            try {
              await updateDoc(docRef, { referralCode: currentReferralCode });
            } catch (updateErr) {
              console.error("Failed to generate and save new referral code", updateErr);
            }
          }

          // Migrate old availability shape if needed
          let availability = data.availability;
          if (
            availability &&
            Object.values(availability).some((a: any) => a.start && !a.slots)
          ) {
            // Old format had { enabled, start, end }
            availability = Object.keys(availability).reduce((acc, key) => {
              const old = availability[key];
              return {
                ...acc,
                [key]: {
                  enabled: old.enabled,
                  slots: old.enabled
                    ? [{ start: old.start || "09:00", end: old.end || "17:00" }]
                    : [],
                },
              };
            }, {});
          }

          setProfile({
            displayName: data.displayName || "",
            bio: data.bio || "",
            photoBase64: data.photoBase64 || "",
            pricing: data.pricing || {
              price: 50,
              currency: "USD",
              duration: 60,
            },
            platformFeeTier: data.platformFeeTier || 10,
            walletAddress: data.walletAddress || "",
            tonAddress: data.tonAddress || "",
            solanaAddress: data.solanaAddress || "",
            baseAddress: data.baseAddress || "",
            meetingUrl: data.meetingUrl || "",
            referralCode: currentReferralCode,
            referralCount: data.referralCount || 0,
            referralBonuses: data.referralBonuses || 0,
            timezone:
              data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
            cancellationPolicy:
              data.cancellationPolicy ||
              "Cancellations must be made at least 24 hours in advance for a full refund.",
            availability:
              availability ||
              DAYS.reduce(
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
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setSaving(true);
    try {
      if (profile.photoBase64) {
         const { updateProfile } = await import("firebase/auth");
         try {
           await updateProfile(auth.currentUser, {
             photoURL: profile.photoBase64,
             displayName: profile.displayName || auth.currentUser.displayName,
           });
         } catch (e) {
           console.warn("Could not update auth profile photo (URL too long?)", e);
         }
      }

      const { platformFeeTier, referralCount, referralBonuses, referredBy, referralCode, role, uid, email, createdAt, ...allowedUpdates } = profile;

      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        ...allowedUpdates,
        updatedAt: new Date().toISOString(),
      });
      toast.success("Profile updated successfully!");
    } catch (err) {
      toast.error("Failed to update profile");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleCalendarConnect = () => {
    // In a full implementation, this would trigger an OAuth flow to request Google Calendar permissions
    // e.g. using Firebase auth: signInWithPopup(auth, new GoogleAuthProvider().addScope('https://www.googleapis.com/auth/calendar'))
    toast.info("Google Calendar OAuth flow triggered! (Mocked for preview)");
  };

  if (loading) return <div>Loading profile...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold font-display">Profile Settings</h1>
        <p className="text-slate-500">
          Configure your booking parameters and identity.
        </p>
      </header>

      <form onSubmit={handleSave} className="space-y-6">
        <Card className="rounded-[2rem] border-2">
          <CardHeader>
            <CardTitle>Public Information</CardTitle>
            <CardDescription>
              This information will be visible to your clients.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 flex flex-col items-center sm:flex-row sm:space-y-0 sm:space-x-6 pb-4">
              <div className="w-24 h-24 rounded-full bg-slate-100 border-2 overflow-hidden flex items-center justify-center relative group">
                {profile.photoBase64 || auth.currentUser?.photoURL ? (
                  <img src={profile.photoBase64 || auth.currentUser?.photoURL || ''} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-slate-400 text-3xl font-bold bg-slate-100 w-full h-full flex items-center justify-center">
                    {profile.displayName?.charAt(0) || 'U'}
                  </span>
                )}
                <label className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <span className="text-xs font-semibold">Change</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        // resize and compress in an image element using canvas to save firestore space
                        const img = new Image();
                        img.onload = () => {
                          const canvas = document.createElement("canvas");
                          const MAX_WIDTH = 256;
                          const scaleSize = MAX_WIDTH / img.width;
                          canvas.width = MAX_WIDTH;
                          canvas.height = img.height * scaleSize;
                          const ctx = canvas.getContext("2d");
                          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
                          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
                          setProfile({ ...profile, photoBase64: dataUrl });
                        };
                        img.src = event.target?.result as string;
                      };
                      reader.readAsDataURL(file);
                    }
                  }} />
                </label>
              </div>
              <div className="text-center sm:text-left space-y-1">
                <h3 className="font-semibold text-lg">Profile Picture</h3>
                <p className="text-sm text-slate-500">JPG, GIF or PNG. Max size of 800K</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input
                value={profile.displayName}
                onChange={(e) =>
                  setProfile({ ...profile, displayName: e.target.value })
                }
                placeholder="Coach Msageer"
                className="h-12 border-2 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Bio / Expertise</Label>
              <Textarea
                value={profile.bio}
                onChange={(e) =>
                  setProfile({ ...profile, bio: e.target.value })
                }
                placeholder="Full Stack Educator with 10 years experience..."
                className="min-h-[120px] border-2 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select 
                value={profile.timezone} 
                onValueChange={(val) => setProfile({ ...profile, timezone: val })}
              >
                <SelectTrigger className="h-12 border-2 rounded-xl">
                  <SelectValue placeholder="Select Timezone" />
                </SelectTrigger>
                <SelectContent>
                  {typeof Intl !== 'undefined' && (Intl as any).supportedValuesOf ? (Intl as any).supportedValuesOf('timeZone').map((tz: string) => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  )) : (
                    <SelectItem value={profile.timezone}>{profile.timezone}</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Your current local timezone is used as a default.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Cancellation Policy</Label>
              <Textarea
                value={profile.cancellationPolicy}
                onChange={(e) =>
                  setProfile({ ...profile, cancellationPolicy: e.target.value })
                }
                placeholder="e.g. Cancellations must be made at least 24 hours in advance..."
                className="min-h-[100px] border-2 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Personal Meeting Link (Google Meet / Zoom)</Label>
              <Input
                value={profile.meetingUrl || ''}
                onChange={(e) =>
                  setProfile({ ...profile, meetingUrl: e.target.value })
                }
                placeholder="https://meet.google.com/..."
                className="h-12 border-2 rounded-xl"
              />
              <p className="text-xs text-slate-500">
                Your static meeting link. If left blank, a random Google Meet link is generated for each booking.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-2">
          <CardHeader>
            <CardTitle>Session & Rates</CardTitle>
            <CardDescription>
              How much you charge for your time.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Price (USD)</Label>
              <Input
                type="number"
                value={profile.pricing.price}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    pricing: {
                      ...profile.pricing,
                      price: e.target.value === '' ? '' : Number(e.target.value),
                    },
                  })
                }
                className="h-12 border-2 rounded-xl text-lg font-bold"
              />
            </div>
            <div className="space-y-2">
              <Label>Duration (Minutes)</Label>
              <Input
                type="number"
                value={profile.pricing.duration}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    pricing: {
                      ...profile.pricing,
                      duration: e.target.value === '' ? '' : Number(e.target.value),
                    },
                  })
                }
                className="h-12 border-2 rounded-xl text-lg font-bold"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-2">
          <CardHeader>
            <CardTitle>Weekly Availability</CardTitle>
            <CardDescription>
              Set the days and hours you are available for bookings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {DAYS.map((day) => (
              <div
                key={day}
                className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl border bg-slate-50/50"
              >
                <div className="w-32 flex items-center gap-2 pt-2 sm:pt-0">
                  <input
                    type="checkbox"
                    checked={profile.availability?.[day]?.enabled}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        availability: {
                          ...profile.availability,
                          [day]: {
                            ...profile.availability[day],
                            enabled: e.target.checked,
                            slots:
                              e.target.checked &&
                              profile.availability[day].slots?.length === 0
                                ? [{ start: "09:00", end: "17:00" }]
                                : profile.availability[day].slots,
                          },
                        },
                      })
                    }
                    className="w-4 h-4 rounded text-primary focus:ring-primary"
                  />
                  <Label className="capitalize font-semibold">{day}</Label>
                </div>
                {profile.availability?.[day]?.enabled ? (
                  <div className="flex-1 space-y-2">
                    {profile.availability[day].slots?.map(
                      (slot: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Input
                            type="time"
                            value={slot.start}
                            onChange={(e) => {
                              const newSlots = [
                                ...profile.availability[day].slots,
                              ];
                              newSlots[idx].start = e.target.value;
                              setProfile({
                                ...profile,
                                availability: {
                                  ...profile.availability,
                                  [day]: {
                                    ...profile.availability[day],
                                    slots: newSlots,
                                  },
                                },
                              });
                            }}
                            className="h-10 border-2 rounded-lg"
                          />
                          <span className="text-slate-400 font-medium">to</span>
                          <Input
                            type="time"
                            value={slot.end}
                            onChange={(e) => {
                              const newSlots = [
                                ...profile.availability[day].slots,
                              ];
                              newSlots[idx].end = e.target.value;
                              setProfile({
                                ...profile,
                                availability: {
                                  ...profile.availability,
                                  [day]: {
                                    ...profile.availability[day],
                                    slots: newSlots,
                                  },
                                },
                              });
                            }}
                            className="h-10 border-2 rounded-lg"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-slate-400 hover:text-red-500"
                            onClick={() => {
                              const newSlots = profile.availability[
                                day
                              ].slots.filter((_: any, i: number) => i !== idx);
                              setProfile({
                                ...profile,
                                availability: {
                                  ...profile.availability,
                                  [day]: {
                                    ...profile.availability[day],
                                    slots: newSlots,
                                    enabled: newSlots.length > 0,
                                  },
                                },
                              });
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ),
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 rounded-lg mt-2 font-semibold"
                      onClick={() => {
                        const newSlots = [
                          ...(profile.availability[day].slots || []),
                          { start: "09:00", end: "17:00" },
                        ];
                        setProfile({
                          ...profile,
                          availability: {
                            ...profile.availability,
                            [day]: {
                              ...profile.availability[day],
                              slots: newSlots,
                            },
                          },
                        });
                      }}
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add time slot
                    </Button>
                  </div>
                ) : (
                  <div className="flex-1 text-slate-400 text-sm italic pt-2 sm:pt-0">
                    Fully Booked / Unavailable
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-2 border-blue-100 bg-blue-50/30">
          <CardHeader>
            <CardTitle>Calendar Integration</CardTitle>
            <CardDescription>
              Connect Google Calendar to prevent double-bookings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              onClick={handleCalendarConnect}
              variant="outline"
              className="h-12 border-2 rounded-xl flex gap-2 w-full sm:w-auto"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.2,4.73C15.29,4.73 17.1,6.7 17.1,6.7L19,4.72C19,4.72 16.56,2 12.1,2C6.42,2 2.03,6.8 2.03,12C2.03,17.05 6.16,22 12.25,22C17.6,22 21.5,18.33 21.5,12.91C21.5,11.76 21.35,11.1 21.35,11.1V11.1Z"
                />
              </svg>
              Connect Google Calendar
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-2">
          <CardHeader>
            <CardTitle>Crypto Wallets (Optional)</CardTitle>
            <CardDescription>
              Receive payments via various blockchain networks.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Platform Fee Tier (%)</Label>
              <div className="flex gap-4 items-center">
                <Input
                  type="range"
                  min="5"
                  max="20"
                  step="1"
                  value={profile.platformFeeTier || 10}
                  readOnly
                  disabled
                  className="w-full accent-indigo-600 opacity-50 cursor-not-allowed"
                />
                <span className="font-bold text-lg w-12 text-right">{profile.platformFeeTier || 10}%</span>
              </div>
              <p className="text-xs text-slate-500">
                Adjust the platform fee deducted from bookings (5-20%).
              </p>
            </div>
            <div className="space-y-2">
              <Label>TON Wallet Address</Label>
              <Input
                value={profile.tonAddress || profile.walletAddress || ""}
                onChange={(e) =>
                  setProfile({ ...profile, tonAddress: e.target.value })
                }
                placeholder="TON address (EQ...)"
                className="h-12 border-2 rounded-xl font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Solana Wallet Address</Label>
              <Input
                value={profile.solanaAddress || ""}
                onChange={(e) =>
                  setProfile({ ...profile, solanaAddress: e.target.value })
                }
                placeholder="Solana address..."
                className="h-12 border-2 rounded-xl font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Base Network (ETH/USDC) Address</Label>
              <Input
                value={profile.baseAddress || ""}
                onChange={(e) =>
                  setProfile({ ...profile, baseAddress: e.target.value })
                }
                placeholder="Base/EVM address (0x...)"
                className="h-12 border-2 rounded-xl font-mono"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-2">
          <CardHeader>
            <CardTitle>Account Settings</CardTitle>
            <CardDescription>
              Manage your email and password.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email Address</Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={profile.email || auth.currentUser?.email || ""}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className="h-12 border-2 rounded-xl"
                  placeholder="name@example.com"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 font-bold px-6 border-2 rounded-xl"
                  onClick={async () => {
                     if (!auth.currentUser || !profile.email || profile.email === auth.currentUser.email) return;
                     const { verifyBeforeUpdateEmail } = await import("firebase/auth");
                     try {
                        await verifyBeforeUpdateEmail(auth.currentUser, profile.email);
                        toast.success("Verification email sent to new address!");
                     } catch(e: any) {
                        if (e.code === 'auth/requires-recent-login') {
                           toast.error("Please log out and log back in to change your email.");
                        } else {
                           toast.error("Failed to update email: " + e.message);
                        }
                     }
                  }}
                >
                   Update
                </Button>
              </div>
            </div>
            <div className="pt-2">
                <Button 
                   type="button" 
                   variant="secondary"
                   className="font-bold border-2 rounded-xl"
                   onClick={async () => {
                     if (!auth.currentUser?.email) return;
                     const { sendPasswordResetEmail } = await import("firebase/auth");
                     try {
                       await sendPasswordResetEmail(auth, auth.currentUser.email);
                       toast.success("Password reset email sent!");
                     } catch(e: any) {
                       toast.error("Failed to send reset email.");
                     }
                   }}
                >
                   Send Password Reset Email
                </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-2 bg-gradient-to-br from-blue-50 to-blue-100">
          <CardHeader>
            <CardTitle className="text-blue-900">Referral Program</CardTitle>
            <CardDescription>
              Invite other creators to earn a bonus!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Your Referral Code</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={profile.referralCode || "Generating..."}
                  className="h-12 border-2 border-blue-200 rounded-xl font-mono font-bold text-lg text-blue-700 bg-white"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 px-6 border-2 border-blue-200 bg-white text-blue-700 hover:bg-blue-100 font-bold rounded-xl"
                  onClick={() => {
                    navigator.clipboard.writeText(profile.referralCode || "");
                    toast.success("Referral code copied!");
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="p-4 bg-white rounded-2xl border-2 border-blue-100">
                <div className="text-sm text-slate-500 font-medium">
                  Referred Creators
                </div>
                <div className="text-2xl font-black text-blue-900">
                  {profile.referralCount || 0}
                </div>
              </div>
              <div className="p-4 bg-white rounded-2xl border-2 border-blue-100">
                <div className="text-sm text-slate-500 font-medium">
                  Total Bonus Earned
                </div>
                <div className="text-2xl font-black text-green-600">
                  ${profile.referralBonuses || 0}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button
          type="submit"
          disabled={saving}
          className="w-full h-14 rounded-2xl text-lg font-bold shadow-xl shadow-primary/10"
        >
          {saving ? "Saving..." : "Save Profile"}
        </Button>
      </form>
    </div>
  );
}
