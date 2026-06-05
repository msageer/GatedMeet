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
  const { creatorId } = useParams();
  const navigate = useNavigate();
  const [creator, setCreator] = useState<any>(null);
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
      if (!creatorId) return;
      try {
        const [d, s] = await Promise.all([
          getDoc(doc(db, "users", creatorId)),
          getDoc(doc(db, "settings", "global"))
        ]);
        if (d.exists()) setCreator(d.data());
        if (s.exists()) setSystemSettings(s.data());
      } catch (err: any) {
        console.error("Error fetching creator:", err);
        setError(err.message || "Failed to load expert profile.");
      } finally {
        setLoading(false);
      }
    };
    fetchCreator();
  }, [creatorId]);

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
    <div className="max-w-4xl mx-auto space-y-12 pb-24">
      {/* Hero Section */}
      <section className="flex flex-col items-center text-center space-y-6 pt-12">
        <div className="w-32 h-32 bg-primary rounded-full overflow-hidden shadow-xl border-4 border-white">
          {creator.photoURL ? (
            <img
              src={creator.photoURL}
              alt={creator.displayName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl text-white font-bold">
              {creator.displayName?.[0]}
            </div>
          )}
        </div>
        <div>
          <h1 className="text-4xl md:text-5xl font-display font-extrabold text-slate-900 tracking-tight">
            {creator.displayName}
          </h1>
          <Badge
            variant="secondary"
            className="mt-3 font-bold text-primary bg-primary/10 text-sm px-4 py-1"
          >
            Verified Creator
          </Badge>
        </div>
        <p className="text-slate-600 leading-relaxed text-xl max-w-2xl font-light">
          {creator.bio || "Ready to help you scale your tech skills and reach your goals."}
        </p>

        {creator.cancellationPolicy && (
          <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-2 rounded-full text-sm font-medium border border-amber-100">
            <AlertCircle className="w-4 h-4" />
            <span>Strict cancellation policy applies</span>
          </div>
        )}
      </section>

      {/* Booking Section at the top below Hero */}
      <section id="book" className="scroll-mt-8">
        <Card className="rounded-[2.5rem] border-2 shadow-xl overflow-hidden">
          <CardHeader className="bg-slate-50 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 sm:p-8">
            <div>
              <CardTitle className="text-2xl">Book a Session</CardTitle>
              <CardDescription className="text-base mt-1">Select a slot, choose your meeting type, and secure your spot.</CardDescription>
            </div>
            <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl shadow-sm border border-slate-100">
              <span className="flex items-center gap-2 text-slate-500 font-medium whitespace-nowrap">
                <Clock className="w-5 h-5 text-indigo-500" /> {creator.pricing.duration} Mins
              </span>
              <div className="w-px h-6 bg-slate-200"></div>
              <span className="font-extrabold text-2xl text-slate-900 whitespace-nowrap">
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
                  className="space-y-8"
                >
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <Label className="text-base font-bold">1. Select Date</Label>
                      <div className="border-2 rounded-2xl p-4 bg-white shadow-sm overflow-hidden flex justify-center">
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
                          className="pointer-events-auto"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Label className="text-base font-bold">
                        2. Select Time{" "}
                        <span className="text-slate-400 font-normal">
                           {creator.timezone ? `(${creator.timezone})` : "(Local Time)"}
                        </span>
                      </Label>
                      
                      {!formData.date ? (
                        <div className="flex flex-col items-center justify-center h-[300px] border-2 border-dashed rounded-2xl text-slate-400 bg-slate-50/50">
                          <CalendarIcon className="w-10 h-10 mb-3 opacity-20" />
                          <p>Select a date to see availability</p>
                        </div>
                      ) : availableSlots.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 auto-rows-max h-[300px] overflow-y-auto content-start pr-2">
                          {availableSlots.map((time) => (
                            <Button
                              key={time}
                              variant={formData.time === time ? "default" : "outline"}
                              className={`h-12 rounded-xl font-bold transition-all ${
                                formData.time === time 
                                ? "bg-primary text-white border-primary shadow-md scale-[1.02]" 
                                : "hover:border-primary/50 text-slate-700"
                              }`}
                              onClick={() => setFormData({ ...formData, time })}
                            >
                              {time}
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-[300px] rounded-2xl border-2 border-dashed text-center text-slate-500 font-medium bg-slate-50/50">
                          <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                          <p>No available slots for this date.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {formData.time && (
                    <motion.div 
                      className="space-y-6 pt-8 border-t-2"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <Label className="text-base font-bold">Meeting Type (Required)</Label>
                          <Select
                            value={formData.meetingType}
                            onValueChange={(val: any) =>
                              setFormData({ ...formData, meetingType: val })
                            }
                          >
                            <SelectTrigger className="h-14 border-2 rounded-xl text-md font-medium px-4">
                              <SelectValue placeholder="Select platform" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="google_meet">
                                <div className="flex items-center gap-2">
                                  <Video className="w-4 h-4 text-emerald-600" />
                                  <span>Google Meet link via Email</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="platform_meeting">
                                <div className="flex items-center gap-2">
                                  <Globe className="w-4 h-4 text-indigo-600" />
                                  <span>Built-in Platform Meeting</span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-slate-500 ml-1">
                            {formData.meetingType === 'google_meet' 
                              ? 'A standard Google Meet link will be generated automatically.' 
                              : 'You and the creator will join an embedded meeting room on this platform.'}
                          </p>
                        </div>
                        <div className="space-y-3">
                          <Label className="text-base font-bold">Recurring Sessions (Optional)</Label>
                          <Select
                            value={formData.recurring}
                            onValueChange={(val) =>
                              setFormData({ ...formData, recurring: val })
                            }
                          >
                            <SelectTrigger className="h-14 border-2 rounded-xl text-md">
                              <SelectValue placeholder="Select Frequency" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">One-time Session</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {formData.recurring !== "none" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border">
                          <div className="space-y-2">
                            <Label className="font-bold">Number of Sessions</Label>
                            <Input
                              type="number"
                              min={2}
                              max={10}
                              value={formData.sessionsCount}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  sessionsCount: parseInt(e.target.value) || 2,
                                })
                              }
                              className="h-12 border-2 rounded-xl bg-white"
                            />
                            <p className="text-xs text-slate-500">Max 10 sessions</p>
                          </div>
                          <div className="space-y-2">
                             <Label className="font-bold">Billing Method</Label>
                             <Select
                               value={formData.billingMode}
                               onValueChange={(val) =>
                                 setFormData({ ...formData, billingMode: val })
                               }
                             >
                               <SelectTrigger className="h-12 border-2 rounded-xl bg-white">
                                 <SelectValue placeholder="Billing Method" />
                               </SelectTrigger>
                               <SelectContent>
                                 <SelectItem value="upfront">Pay Upfront (Full Amount)</SelectItem>
                                 <SelectItem value="recurring">Subscribe (Pay per session)</SelectItem>
                               </SelectContent>
                             </Select>
                          </div>
                        </div>
                      )}

                      <div className="space-y-5 pt-8 border-t-2">
                        <Label className="text-xl font-bold block mb-4">Your Details</Label>
                        <div className="grid md:grid-cols-2 gap-5">
                          <div className="space-y-2">
                            <Label className="font-bold text-slate-700">Full Name</Label>
                            <Input
                              placeholder="John Doe"
                              value={formData.name}
                              onChange={(e) =>
                                setFormData({ ...formData, name: e.target.value })
                              }
                              className="h-14 border-2 rounded-xl px-4 text-base"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="font-bold text-slate-700">Email Address</Label>
                            <Input
                              type="email"
                              placeholder="john@example.com"
                              value={formData.email}
                              onChange={(e) =>
                                setFormData({ ...formData, email: e.target.value })
                              }
                              className="h-14 border-2 rounded-xl px-4 text-base"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="font-bold text-slate-700">What would you like to discuss? (Optional)</Label>
                          <Textarea
                            placeholder="Help the creator prepare for your session..."
                            value={formData.details}
                            onChange={(e) =>
                              setFormData({ ...formData, details: e.target.value })
                            }
                            className="min-h-[120px] border-2 rounded-xl p-4 text-base resize-y"
                          />
                        </div>
                        <Button
                          className="w-full h-16 rounded-2xl font-bold text-xl shadow-lg hover:shadow-xl transition-all"
                          onClick={() => setStep(2)}
                        >
                          Review Booking & Pay
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
                  <div className="p-6 rounded-[2rem] bg-slate-50 border-2 space-y-4">
                    <h3 className="font-bold text-lg text-slate-900 border-b pb-2">Booking Summary</h3>
                    <div className="grid grid-cols-2 gap-y-3 text-sm">
                      <span className="text-slate-500">Selected Session:</span>
                      <span className="font-bold text-right text-slate-900">
                        {formData.date ? format(formData.date, "PPP") : ""} <br className="md:hidden"/>at {formData.time}
                      </span>
                      <span className="text-slate-500">Meeting Location:</span>
                      <span className="font-bold text-right text-slate-900 flex items-center justify-end gap-1">
                        {formData.meetingType === 'google_meet' ? (
                          <><Video className="w-3 h-3 text-emerald-500" /> Google Meet</>
                        ) : (
                          <><Globe className="w-3 h-3 text-indigo-500" /> In-Platform Meeting</>
                        )}
                      </span>
                      <span className="text-slate-500">Client Name:</span>
                      <span className="font-bold text-right text-slate-900">{formData.name}</span>
                      <span className="text-slate-500">Client Email:</span>
                      <span className="font-bold text-right break-all text-slate-900">{formData.email}</span>
                      <span className="text-slate-500">Total Amount:</span>
                      <span className="font-black text-right text-primary text-lg">
                         ${totalAmountValue} {formData.billingMode === "recurring" && formData.recurring !== "none" ? " / session" : ""}
                      </span>
                    </div>
                  </div>

                  <h3 className="font-bold text-lg text-slate-900 pt-2">Select Payment Method</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Button
                      variant="outline"
                      className="h-20 rounded-2xl font-bold text-left justify-start gap-4 border-2 group hover:border-primary transition-colors hover:shadow-md"
                      onClick={() => handleBookingClick("fiat")}
                    >
                      <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors shrink-0">
                        <Banknote className="w-6 h-6" />
                      </div>
                      <div className="overflow-hidden">
                        <div className="text-base truncate">Pay via Card / Bank</div>
                        <div className="text-xs text-slate-400 truncate">
                          Secured by Flutterwave
                        </div>
                      </div>
                    </Button>

                    <Button
                      variant="outline"
                      className="h-20 rounded-2xl font-bold text-left justify-start gap-4 border-2 group hover:border-blue-500 transition-colors hover:shadow-md"
                      onClick={() => handleBookingClick("crypto")}
                    >
                      <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                        <CreditCard className="w-6 h-6" />
                      </div>
                      <div className="overflow-hidden">
                        <div className="text-base truncate">Pay with Crypto</div>
                        <div className="text-xs text-slate-400 truncate">
                          TON, SOL, BASE, ETH
                        </div>
                      </div>
                    </Button>
                  </div>

                  <div className="pt-2">
                    <Button
                      variant="ghost"
                      className="w-full h-12 text-slate-500 hover:text-slate-900"
                      onClick={() => setStep(1)}
                    >
                      Go Back to Edit Details
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </section>

      {/* Portfolio & About Section */}
      <section className="grid md:grid-cols-2 gap-8">
        {/* About Card */}
        <div className="p-8 rounded-[2.5rem] bg-white border shadow-sm space-y-6 self-start">
          <h2 className="text-2xl font-bold text-slate-900">About Me</h2>
          
          {(creator.skills || creator.twitterUrl || creator.youtubeUrl || creator.instagramUrl || creator.githubUrl || creator.linkedinUrl) && (
            <div className="space-y-6">
              {creator.skills && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Expertise</h3>
                  <div className="flex flex-wrap gap-2">
                    {creator.skills.split(',').map((skill: string, i: number) => (
                      <Badge key={i} variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200 px-3 py-1 font-medium text-sm">
                        {skill.trim()}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Connect</h3>
                <div className="flex flex-wrap gap-3">
                  {creator.twitterUrl && (
                    <a href={creator.twitterUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-xl bg-slate-50 border hover:bg-slate-100 text-sm font-semibold text-slate-700 transition flex items-center gap-2">
                      X (Twitter)
                    </a>
                  )}
                  {creator.linkedinUrl && (
                    <a href={creator.linkedinUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-xl bg-slate-50 border hover:bg-slate-100 text-sm font-semibold text-slate-700 transition flex items-center gap-2">
                      LinkedIn
                    </a>
                  )}
                  {creator.githubUrl && (
                    <a href={creator.githubUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-xl bg-slate-50 border hover:bg-slate-100 text-sm font-semibold text-slate-700 transition flex items-center gap-2">
                      GitHub
                    </a>
                  )}
                  {creator.youtubeUrl && (
                    <a href={creator.youtubeUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-xl bg-slate-50 border hover:bg-slate-100 text-sm font-semibold text-slate-700 transition flex items-center gap-2">
                      YouTube
                    </a>
                  )}
                  {creator.instagramUrl && (
                    <a href={creator.instagramUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-xl bg-slate-50 border hover:bg-slate-100 text-sm font-semibold text-slate-700 transition flex items-center gap-2">
                      Instagram
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Portfolio / Links Card */}
        {creator.proofOfWork && (
          <div className="p-8 rounded-[2.5rem] bg-slate-900 border-none shadow-xl text-white space-y-6 self-start">
            <h2 className="text-2xl font-bold">Portfolio / Proof of Work</h2>
            <p className="text-slate-400 font-light leading-relaxed">
              Check out my latest projects, articles, and public work to see what we can achieve together.
            </p>
            <a 
              href={creator.proofOfWork} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="inline-flex items-center gap-2 px-6 py-4 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition shadow-lg"
            >
              <Globe className="w-5 h-5" />
              View Portfolio
            </a>
          </div>
        )}
      </section>

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

