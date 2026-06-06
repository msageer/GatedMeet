import { getDocWrapper as getDoc, getDocsWrapper as getDocs } from "@/lib/firestore-utils";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { db } from "@/lib/firebase";
import {
  doc,
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  limit,
} from "firebase/firestore";
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
import { Badge } from "@/components/ui/badge";
import {
  Calendar as CalendarIcon,
  Clock,
  CreditCard,
  Banknote,
  ShieldCheck,
  Globe,
  AlertCircle,
  Video,
} from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { useFlutterwave, closePaymentModal } from "flutterwave-react-v3";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function BookingPage() {
  const { username } = useParams();
  const navigate = useNavigate();
  const [creator, setCreator] = useState<any>(null);
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [existingBookings, setExistingBookings] = useState<any[]>([]);
  const [systemSettings, setSystemSettings] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    details: "",
    date: undefined as Date | undefined,
    time: "",
    recurring: "none",
    sessionsCount: 1,
    billingMode: "upfront",
    meetingType: "google_meet" as "google_meet" | "platform_meeting"
  });
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"fiat" | "crypto" | null>(null);

  useEffect(() => {
    const fetchCreator = async () => {
      if (!username) return;
      try {
        const q = query(collection(db, "users"), where("username", "==", username.toLowerCase()), limit(1));
        const [userSnap, settingsSnap] = await Promise.all([
          getDocs(q),
          getDoc(doc(db, "settings", "global"))
        ]);
        
        if (!userSnap.empty) {
          setCreator(userSnap.docs[0].data());
          setCreatorId(userSnap.docs[0].id);
        } else {
          const fallbackDoc = await getDoc(doc(db, "users", username));
          if (fallbackDoc.exists()) {
            setCreator(fallbackDoc.data());
            setCreatorId(fallbackDoc.id);
          } else {
            setError("Creator not found.");
          }
        }
        
        if (settingsSnap.exists()) {
          setSystemSettings(settingsSnap.data());
        }
      } catch (err: any) {
        console.error("Error fetching creator:", err);
        setError(err.message || "Failed to load expert profile.");
      } finally {
        setLoading(false);
      }
    };
    fetchCreator();
  }, [username]);

  useEffect(() => {
    const fetchBookings = async () => {
      if (!creatorId || !formData.date) return;
      try {
        const startOfDay = new Date(formData.date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(formData.date);
        endOfDay.setHours(23, 59, 59, 999);

        const { query, where } = await import("firebase/firestore");
        const q = query(
          collection(db, "bookings"),
          where("creatorId", "==", creatorId),
        );
        const snap = await getDocs(q);
        const bookings = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((b: any) => {
            const d = new Date(b.startTime);
            return (
              d.getFullYear() === startOfDay.getFullYear() &&
              d.getMonth() === startOfDay.getMonth() &&
              d.getDate() === startOfDay.getDate() &&
              (b.status === "paid" || b.status === "confirmed")
            );
          });
        setExistingBookings(bookings);
      } catch (err) {
        console.error(err);
      }
    };
    fetchBookings();
  }, [creatorId, formData.date]);

  const generateTimeSlots = () => {
    if (!creator || !formData.date) return [];
    const dateObj = new Date(formData.date);
    const dayOfWeek = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ][dateObj.getDay()];

    const defaultAvailability = {
      enabled: dayOfWeek !== "saturday" && dayOfWeek !== "sunday",
      slots: [{ start: "09:00", end: "17:00" }]
    };

    const availability = creator.availability?.[dayOfWeek] || defaultAvailability;

    if (!availability || !availability.enabled || !availability.slots)
      return [];

    const durationMins = creator.pricing?.duration || 60;
    const generatedSlots: string[] = [];
    const dateString = format(formData.date, "yyyy-MM-dd");

    availability.slots.forEach((slot: { start: string; end: string }) => {
      if (!slot.start || !slot.end) return;
      const parseTime = (timeStr: string) => {
        const [h, m] = timeStr.split(":").map(Number);
        return h * 60 + m;
      };
      let startMins = parseTime(slot.start);
      const endMins = parseTime(slot.end);

      while (startMins + durationMins <= endMins) {
        const h = Math.floor(startMins / 60)
          .toString()
          .padStart(2, "0");
        const m = (startMins % 60).toString().padStart(2, "0");
        const timeString = `${h}:${m}`;

        const slotStart = new Date(`${dateString}T${timeString}`);
        const slotEnd = new Date(slotStart.getTime() + durationMins * 60000);

        const isBooked = existingBookings.some((b) => {
          const bStart = new Date(b.startTime).getTime();
          const bEnd = new Date(b.endTime).getTime();
          return slotStart.getTime() < bEnd && slotEnd.getTime() > bStart;
        });

        if (!isBooked) {
          generatedSlots.push(timeString);
        }
        startMins += durationMins;
      }
    });

    return generatedSlots;
  };

  const availableSlots = generateTimeSlots();

  const isEmailValid = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleBookingClick = (method: "fiat" | "crypto") => {
    if (!formData.name || !formData.email || !formData.date || !formData.time) {
      toast.error("Please fill in all details");
      return;
    }
    if (!isEmailValid(formData.email)) {
      toast.error("Please enter a valid email address");
      return;
    }
    setPaymentMethod(method);
    setShowConfirmDialog(true);
  };

  const getScheduledDates = () => {
    if (!formData.date || !formData.time) return [];
    const isRecurring = formData.recurring !== "none";
    const totalSessions = isRecurring ? formData.sessionsCount : 1;
    const intervalDays =
      formData.recurring === "weekly"
        ? 7
        : formData.recurring === "bi-weekly"
          ? 14
          : 0;
          
    const dates = [];
    for (let i = 0; i < totalSessions; i++) {
        const sessionDate = new Date(formData.date);
        sessionDate.setDate(sessionDate.getDate() + (i * intervalDays));
        dates.push(sessionDate);
    }
    return dates;
  };

  const totalSessionsCount = formData.recurring !== "none" ? formData.sessionsCount : 1;
  const totalAmountValue = formData.billingMode === "recurring" 
      ? Number(creator?.pricing?.price || 0)
      : Number(creator?.pricing?.price || 0) * totalSessionsCount;

  const flutterConfig = {
    public_key: systemSettings?.flutterwavePublicKey || "",
    tx_ref: Date.now().toString(),
    amount: totalAmountValue * 1500, // Converting to NGN
    currency: "NGN",
    payment_options: "card,mobilemoney,ussd",
    customer: {
      email: formData.email,
      phone_number: "",
      name: formData.name,
    },
    customizations: {
      title: "Coach Session Booking",
      description: `Payment for ${totalSessionsCount} session(s) with ${creator?.displayName}`,
      logo: "https://st2.depositphotos.com/4403291/7418/v/450/depositphotos_74189661-stock-illustration-online-shop-log.jpg",
    },
  };

  const handleFlutterPayment = useFlutterwave(flutterConfig);

  const executeBooking = async () => {
    setShowConfirmDialog(false);
    if (!formData.date || !paymentMethod || !creator) return;

    try {
      const isRecurring = formData.recurring !== "none";
      const totalSessions = isRecurring ? formData.sessionsCount : 1;
      const intervalDays =
        formData.recurring === "weekly"
          ? 7
          : formData.recurring === "bi-weekly"
            ? 14
            : 0;
      let firstDocId = "";

      for (let i = 0; i < totalSessions; i++) {
        const sessionDate = new Date(formData.date);
        sessionDate.setDate(sessionDate.getDate() + i * intervalDays);
        const sessionDateString = format(sessionDate, "yyyy-MM-dd");

        const sessionStart = new Date(`${sessionDateString}T${formData.time}`);
        const sessionEnd = new Date(
          sessionStart.getTime() + creator.pricing.duration * 60000,
        );

        const bookingData = {
          creatorId,
          clientName: formData.name,
          clientEmail: formData.email,
          clientDetails: formData.details,
          startTime: sessionStart.toISOString(),
          endTime: sessionEnd.toISOString(),
          status: "pending",
          amount: Number(creator?.pricing?.price || 0),
          paymentType: paymentMethod,
          meetingType: formData.meetingType,
          createdAt: serverTimestamp(),
          isRecurring: isRecurring,
          recurringGroupId: firstDocId || null,
        };

        const docRef = await addDoc(collection(db, "bookings"), bookingData);
        if (i === 0) {
          firstDocId = docRef.id;
        }
      }

      if (paymentMethod === "crypto") {
        toast.info("Generating crypto invoice...");
        
        const response = await fetch("/api/create-nowpayments-invoice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amountUsd: totalAmountValue,
            orderId: firstDocId,
            orderDescription: `Session with ${creator.displayName} (${totalSessions} sessions)`,
            successUrl: `${window.location.origin}/success?creatorId=${creatorId}&bookingId=${firstDocId}&crypto=true`,
            cancelUrl: `${window.location.origin}/booking/${creatorId}`,
          }),
        });

        const { url, error } = await response.json();
        if (error) {
          toast.error("Failed to generate crypto invoice.");
          console.error(error);
        } else if (url) {
          window.location.href = url;
        }
        return;
      }

      if (!systemSettings?.flutterwavePublicKey) {
         toast.error("Flutterwave is not configured by admin.");
         return;
      }

      handleFlutterPayment({
        callback: (response) => {
          if (response.status === "successful") {
            toast.success("Payment successful!");
            navigate(`/success?creatorId=${creatorId}&bookingId=${firstDocId}&tx_ref=${response.tx_ref}`);
          } else {
            toast.error("Payment failed or cancelled.");
          }
          closePaymentModal();
        },
        onClose: () => {
          toast.info("Payment window closed.");
        },
      });

    } catch (err) {
      console.error("Booking error:", err);
      toast.error("Booking failed. Please try again.");
    }
  };

  if (loading)
    return (
      <div className="p-12 text-center animate-pulse">
        Loading creator profile...
      </div>
    );
  if (error)
    return (
      <div className="p-12 text-center font-medium text-red-500">
        {error}
      </div>
    );
  if (!creator)
    return (
      <div className="p-12 text-center font-bold text-red-500 text-2xl">
        Creator not found.
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-10 items-start">
        {/* Left Column (Profile Info) */}
        <div className="w-full lg:w-3/5 xl:w-2/3 space-y-10">
          {/* Creator Header */}
          <section className="bg-white p-8 sm:p-10 rounded-[3rem] border shadow-sm">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-8 text-center md:text-left">
              <div className="w-40 h-40 bg-slate-100 rounded-full overflow-hidden shadow-md shrink-0 border-4 border-white">
                {creator.photoURL ? (
                  <img
                    src={creator.photoURL}
                    alt={creator.displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl text-slate-400 font-bold">
                    {creator.displayName?.[0]}
                  </div>
                )}
              </div>
              <div className="space-y-4 flex-1">
                <div>
                  <h1 className="text-4xl sm:text-5xl font-display font-extrabold text-slate-900 tracking-tight">
                    {creator.displayName}
                  </h1>
                  <Badge
                    variant="secondary"
                    className="mt-3 font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-1.5 text-sm uppercase tracking-wider rounded-full shadow-sm"
                  >
                    <ShieldCheck className="w-4 h-4 mr-1.5 inline-block -mt-0.5" />
                    Verified Creator
                  </Badge>
                </div>
                <p className="text-slate-600 leading-relaxed text-lg sm:text-xl font-medium max-w-2xl">
                  {creator.bio || "Ready to help you scale your skills and reach your goals."}
                </p>

                {creator.cancellationPolicy && (
                  <div className="inline-flex items-center gap-2 text-amber-700 bg-amber-50 px-4 py-2 rounded-2xl text-sm font-bold border border-amber-200 mt-2">
                    <AlertCircle className="w-4 h-4" />
                    Strict cancellation policy
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* About & Portfolio Blocks */}
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="p-8 rounded-[2.5rem] bg-white border shadow-sm space-y-6">
              <h2 className="text-2xl font-bold text-slate-900">About</h2>
              {(creator.skills || creator.twitterUrl || creator.youtubeUrl || creator.instagramUrl || creator.githubUrl || creator.linkedinUrl) ? (
                <div className="space-y-6">
                  {creator.skills && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Expertise</h3>
                      <div className="flex flex-wrap gap-2">
                        {creator.skills.split(',').map((skill: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-slate-700 font-bold border-slate-200 rounded-xl px-3 py-1">
                            {skill.trim()}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Connect</h3>
                    <div className="flex flex-wrap gap-2">
                      {creator.twitterUrl && (
                        <a href={creator.twitterUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-xl bg-slate-50 border hover:bg-slate-100 text-sm font-bold text-slate-700 transition">
                          X
                        </a>
                      )}
                      {creator.linkedinUrl && (
                        <a href={creator.linkedinUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-xl bg-slate-50 border hover:bg-slate-100 text-sm font-bold text-slate-700 transition">
                          LinkedIn
                        </a>
                      )}
                      {creator.githubUrl && (
                        <a href={creator.githubUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-xl bg-slate-50 border hover:bg-slate-100 text-sm font-bold text-slate-700 transition">
                          GitHub
                        </a>
                      )}
                      {creator.youtubeUrl && (
                        <a href={creator.youtubeUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-xl bg-slate-50 border hover:bg-slate-100 text-sm font-bold text-slate-700 transition">
                          YouTube
                        </a>
                      )}
                      {creator.instagramUrl && (
                        <a href={creator.instagramUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-xl bg-slate-50 border hover:bg-slate-100 text-sm font-bold text-slate-700 transition">
                          Instagram
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500">More details about this creator will be added soon.</p>
              )}
            </div>

            {creator.proofOfWork && (
              <div className="p-8 rounded-[2.5rem] bg-slate-900 border-none shadow-xl text-white space-y-6 flex flex-col justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-3">Portfolio</h2>
                  <p className="text-slate-400 font-medium leading-relaxed">
                    Check out my latest projects, articles, and public work.
                  </p>
                </div>
                <a 
                  href={creator.proofOfWork} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="inline-flex items-center justify-center w-full gap-2 px-6 py-4 rounded-2xl bg-white text-slate-900 font-bold hover:bg-slate-100 transition shadow-lg shrink-0 mt-4"
                >
                  <Globe className="w-5 h-5" />
                  View Proof of Work
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (Booking Widget) */}
        <div className="w-full lg:w-2/5 xl:w-1/3 lg:sticky lg:top-10">
          <Card className="rounded-[2.5rem] border-0 shadow-2xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-900 text-white p-6 sm:p-8 space-y-4">
              <div>
                <CardTitle className="text-2xl font-black">Book a Session</CardTitle>
                <CardDescription className="text-slate-400 mt-2 font-medium">Select a slot to meet 1-on-1.</CardDescription>
              </div>
              <div className="flex items-center gap-3 bg-white/10 px-5 py-4 rounded-2xl border border-white/10">
                <span className="flex items-center gap-2 text-white/80 font-bold text-sm">
                  <Clock className="w-5 h-5" /> {creator.pricing.duration} Mins
                </span>
                <div className="w-px h-6 bg-white/20"></div>
                <span className="font-black text-2xl text-white flex-1 text-right">
                  ${creator.pricing.price}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-6 sm:p-8">
              <AnimatePresence mode="wait">
                {step === 1 ? (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-6"
                  >
                    <div className="space-y-6">
                      {/* Date & Time Selection */}
                      <div className="space-y-3">
                        <Label className="text-sm font-bold text-slate-600 uppercase tracking-widest">Date & Time</Label>
                        <div className="border border-slate-200 rounded-3xl p-4 bg-slate-50/50 shadow-inner">
                          <Calendar
                            mode="single"
                            selected={formData.date}
                            onSelect={(date) => {
                              setFormData({
                                ...formData,
                                date: date || undefined,
                                time: "",
                              });
                            }}
                            disabled={(date) => {
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              if (date < today) return true;
                              const dayOfWeek = [
                                "sunday",
                                "monday",
                                "tuesday",
                                "wednesday",
                                "thursday",
                                "friday",
                                "saturday",
                              ][date.getDay()];
                              
                              if (!creator.availability || !creator.availability[dayOfWeek]) {
                                return dayOfWeek === "saturday" || dayOfWeek === "sunday";
                              }
                              return !creator.availability[dayOfWeek].enabled;
                            }}
                            className="pointer-events-auto bg-transparent w-full flex justify-center"
                          />
                        </div>
                      </div>

                      {formData.date && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
                          <Label className="text-sm font-bold text-slate-600 uppercase tracking-widest">
                            Available Slots{" "}
                            <span className="text-slate-400 font-normal normal-case">
                               {creator.timezone ? `(${creator.timezone})` : "(Local Time)"}
                            </span>
                          </Label>
                          {availableSlots.length > 0 ? (
                            <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                              {availableSlots.map((time) => (
                                <Button
                                  key={time}
                                  variant={formData.time === time ? "default" : "outline"}
                                  className={`h-12 rounded-xl font-bold transition-all ${
                                    formData.time === time 
                                    ? "bg-slate-900 text-white shadow-md scale-105 border-0" 
                                    : "hover:bg-slate-100 text-slate-700 bg-white"
                                  }`}
                                  onClick={() => setFormData({ ...formData, time })}
                                >
                                  {time}
                                </Button>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-slate-200 text-center text-slate-500 bg-slate-50">
                              <p className="font-medium text-sm">No slots available.</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {formData.time && (
                      <motion.div 
                        className="space-y-6 pt-6 border-t"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <div className="space-y-4">
                            <div className="space-y-2">
                              <Label className="font-bold text-slate-700 text-sm">Meeting Platform</Label>
                              <Select
                                value={formData.meetingType}
                                onValueChange={(val: any) =>
                                  setFormData({ ...formData, meetingType: val })
                                }
                              >
                                <SelectTrigger className="h-12 border rounded-xl font-medium bg-slate-50">
                                  <SelectValue placeholder="Select platform" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="google_meet">
                                    <div className="flex items-center gap-2">
                                      <Video className="w-4 h-4 text-emerald-600" />
                                      <span>Google Meet</span>
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="platform_meeting">
                                    <div className="flex items-center gap-2">
                                      <Globe className="w-4 h-4 text-indigo-600" />
                                      <span>Private Platform Room</span>
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2 flex flex-col justify-start">
                              <Label className="font-bold text-slate-700 text-sm">Want to subscribe? (Optional)</Label>
                              <Select
                                value={formData.recurring}
                                onValueChange={(val) =>
                                  setFormData({ ...formData, recurring: val })
                                }
                              >
                                <SelectTrigger className="h-12 border rounded-xl bg-slate-50 font-medium">
                                  <SelectValue placeholder="Frequency" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">One-time Session</SelectItem>
                                  <SelectItem value="weekly">Weekly</SelectItem>
                                  <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                          {formData.recurring !== "none" && (
                            <div className="grid grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-2xl border">
                              <div className="space-y-2">
                                <Label className="font-bold text-sm">Sessions Count</Label>
                                <Input
                                  type="number"
                                  min={2}
                                  max={10}
                                  value={formData.sessionsCount}
                                  onChange={(e) =>
                                    setFormData({ ...formData, sessionsCount: parseInt(e.target.value) || 2 })
                                  }
                                  className="h-12 rounded-xl bg-white"
                                />
                              </div>
                              <div className="space-y-2">
                                 <Label className="font-bold text-sm">Billing Method</Label>
                                 <Select
                                   value={formData.billingMode}
                                   onValueChange={(val) => setFormData({ ...formData, billingMode: val })}
                                 >
                                   <SelectTrigger className="h-12 rounded-xl bg-white">
                                     <SelectValue placeholder="Method" />
                                   </SelectTrigger>
                                   <SelectContent>
                                     <SelectItem value="upfront">Upfront</SelectItem>
                                     <SelectItem value="recurring">Per Session</SelectItem>
                                   </SelectContent>
                                 </Select>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="space-y-4 pt-6 border-t">
                          <Label className="text-sm font-bold text-slate-600 uppercase tracking-widest">Your Details</Label>
                          <Input
                            placeholder="Full Name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="h-12 border rounded-xl px-4 font-medium"
                          />
                          <Input
                            type="email"
                            placeholder="Email Address"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="h-12 border rounded-xl px-4 font-medium"
                          />
                          <Textarea
                            placeholder="What would you like to discuss? (optional)"
                            value={formData.details}
                            onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                            className="min-h-[100px] border rounded-xl p-4 text-sm font-medium resize-none bg-slate-50"
                          />
                          
                          <Button
                            className="w-full h-14 rounded-2xl font-black text-lg bg-slate-900 text-white hover:bg-slate-800 shadow-xl shadow-slate-900/20"
                            onClick={() => setStep(2)}
                          >
                            Continue to Payment
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                ) : (
                   <motion.div
                      key="step2"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="space-y-6"
                    >
                      <div className="p-5 rounded-2xl bg-slate-50 border space-y-4">
                        <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Booking Final Summary</h3>
                        <div className="space-y-2 text-sm text-slate-600">
                          <div className="flex justify-between items-center">
                            <span>Selected Session:</span>
                            <span className="font-bold text-slate-900 text-right leading-tight">
                              {formData.date ? format(formData.date, "MMM d, yyyy") : ""} <br/> at {formData.time}
                            </span>
                          </div>
                          <div className="flex justify-between items-center pt-2">
                             <span>Location:</span>
                             <span className="font-bold text-slate-900 flex items-center gap-1">
                               {formData.meetingType === 'google_meet' ? <><Video className="w-3 h-3 text-emerald-500"/> Google Meet</> : <><Globe className="w-3 h-3 text-indigo-500"/> Built-in</>}
                             </span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t mt-2">
                            <span>Total Due:</span>
                            <span className="font-black text-slate-900 text-xl">
                              ${totalAmountValue} {formData.billingMode === "recurring" && formData.recurring !== "none" ? " / session" : ""}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-sm font-bold text-slate-600 uppercase tracking-widest">Select Payment</Label>
                        <Button
                          variant="outline"
                          className="w-full h-16 rounded-2xl font-bold flex text-left items-center gap-4 border bg-white hover:bg-slate-50 hover:border-slate-300 transition-all text-slate-800 shadow-sm"
                          onClick={() => handleBookingClick("fiat")}
                        >
                           <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                             <Banknote className="w-5 h-5 text-slate-600" />
                           </div>
                           <div className="flex-1">
                             <div className="text-base text-slate-900">Card or Bank Transfer</div>
                             <div className="text-xs text-slate-500 font-medium tracking-tight">Secured by Flutterwave</div>
                           </div>
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full h-16 rounded-2xl font-bold flex text-left items-center gap-4 border bg-white hover:bg-slate-50 hover:border-slate-300 transition-all text-slate-800 shadow-sm"
                          onClick={() => handleBookingClick("crypto")}
                        >
                           <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                             <CreditCard className="w-5 h-5 text-slate-600" />
                           </div>
                           <div className="flex-1">
                             <div className="text-base text-slate-900">Cryptocurrency</div>
                             <div className="text-xs text-slate-500 font-medium tracking-tight">TON, SOL, BASE, ETH via NOWPayments</div>
                           </div>
                        </Button>
                      </div>

                      <div className="pt-4 border-t text-center">
                        <Button
                          variant="ghost"
                          className="h-10 text-slate-400 hover:text-slate-700 font-bold text-sm"
                          onClick={() => setStep(1)}
                        >
                          Go Back and Edit details
                        </Button>
                      </div>
                    </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="rounded-3xl sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Booking</DialogTitle>
            <DialogDescription>
              Please review your details before payment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-between border-b pb-2 items-center">
              <span className="text-slate-500">Creator</span>
              <span className="font-bold flex items-center gap-2">
                 <div className="w-6 h-6 bg-slate-200 rounded-full overflow-hidden shrink-0">
                    {creator.photoURL && <img src={creator.photoURL} alt="avatar" className="w-full h-full object-cover"/>}
                 </div>
                 {creator.displayName}
              </span>
            </div>
            {formData.recurring === "none" ? (
                <>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Date</span>
                      <span className="font-bold">
                        {formData.date ? format(formData.date, "PPP") : ""}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Time</span>
                      <span className="font-bold">
                        {formData.time}{" "}
                        {creator.timezone ? `(${creator.timezone})` : ""}
                      </span>
                    </div>
                </>
            ) : (
                <div className="space-y-2 border-b pb-2">
                   <div className="flex justify-between">
                      <span className="text-slate-500">Scheduled Sessions</span>
                      <span className="font-bold">{formData.sessionsCount}</span>
                   </div>
                   <div className="bg-slate-50 p-2 rounded-xl text-sm max-h-32 overflow-y-auto space-y-1 border">
                      {getScheduledDates().map((d, i) => (
                         <div key={i} className="flex justify-between items-center text-slate-700">
                           <span className="font-medium text-xs">Session {i+1}</span>
                           <span>{format(d, "MMM d, yyyy")} {formData.time}</span>
                         </div>
                      ))}
                   </div>
                </div>
            )}
            
            <div className="flex justify-between text-sm py-1 bg-slate-50 px-3 rounded-lg border">
               <span className="text-slate-500 font-medium">Meeting Type</span>
               <span className="font-bold text-slate-800">
                 {formData.meetingType === 'google_meet' ? 'Google Meet Entry' : 'Platform Room'}
               </span>
            </div>

            {formData.recurring !== "none" && (
              <div className="flex justify-between border-t pt-2 mt-2">
                <span className="text-slate-500">Frequency</span>
                <span className="font-bold uppercase text-indigo-600">
                  {formData.recurring} ({formData.sessionsCount} sessions)
                </span>
              </div>
            )}
            <div className="flex justify-between items-end pt-2">
              <span className="text-slate-500 text-lg font-medium">Total Price</span>
              <span className="font-black text-3xl text-primary flex flex-col items-end leading-none">
                <span>
                 $
                 {formData.billingMode === "recurring" 
                   ? creator.pricing.price 
                   : creator.pricing.price * (formData.recurring !== "none" ? formData.sessionsCount : 1)}
                </span>
                {formData.billingMode === "recurring" && formData.recurring !== "none" && (
                   <span className="text-xs text-slate-400 font-medium tracking-normal mt-1 leading-normal">/ session</span>
                )}
              </span>
            </div>
          </div>
          <DialogFooter className="gap-3 sm:gap-0 mt-4">
            <Button
              variant="outline"
              className="rounded-xl h-12"
              onClick={() => setShowConfirmDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={executeBooking} className="rounded-xl h-12 font-bold px-8 shadow-md">
              Complete Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

