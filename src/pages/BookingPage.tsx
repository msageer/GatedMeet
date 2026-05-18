import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
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
  DialogTrigger,
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
  const [step, setStep] = useState(1);
  const [existingBookings, setExistingBookings] = useState<any[]>([]);
  const [systemSettings, setSystemSettings] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    details: "",
    date: undefined as Date | undefined,
    time: "",
    recurring: "none", // none, weekly, bi-weekly
    sessionsCount: 1, // for recurring
    billingMode: "upfront" // upfront, recurring
  });
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"fiat" | "crypto" | null>(
    null,
  );

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
      } catch (err) {
        console.error(err);
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

        const { query, where, getDocs } = await import("firebase/firestore");
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

    // Provide default fallback if availability is completely missing
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

        // Check if booked
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
      ? (creator?.pricing?.price || 0)
      : (creator?.pricing?.price || 0) * totalSessionsCount;

  const flutterConfig = {
    public_key: systemSettings?.flutterwavePublicKey || "",
    tx_ref: Date.now().toString(),
    amount: totalAmountValue,
    currency: "USD",
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
        // Calculate date for this session
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
          amount: creator.pricing.price,
          paymentType: paymentMethod,
          createdAt: serverTimestamp(),
          isRecurring: isRecurring,
          recurringGroupId: firstDocId || null, // group them by first doc ID
        };

        const docRef = await addDoc(collection(db, "bookings"), bookingData);
        if (i === 0) {
          firstDocId = docRef.id;
        }
      }

      if (paymentMethod === "crypto") {
        toast.info("Redirecting to crypto payment...");
        navigate(`/crypto-payment/${firstDocId}`);
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
      toast.error("Booking failed. Please try again.");
    }
  };

  if (loading)
    return (
      <div className="p-12 text-center animate-pulse">
        Loading expert profile...
      </div>
    );
  if (!creator)
    return (
      <div className="p-12 text-center font-bold text-red-500 text-2xl">
        Expert found!
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto grid md:grid-cols-5 gap-8">
      {/* Sidebar: Profile Info */}
      <div className="md:col-span-2 space-y-6">
        <div className="space-y-4">
          <div className="w-32 h-32 bg-primary rounded-[2rem] overflow-hidden shadow-2xl border-4 border-white">
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
            <h1 className="text-3xl font-display font-extrabold text-slate-900">
              {creator.displayName}
            </h1>
            <Badge
              variant="secondary"
              className="mt-1 font-bold text-primary bg-primary/5"
            >
              Verified Educator
            </Badge>
          </div>
          <p className="text-slate-600 leading-relaxed text-lg italic">
            "{creator.bio || "Ready to help you scale your tech skills."}"
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-white border-2 border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between text-lg">
            <span className="flex items-center gap-2 text-slate-500">
              <Clock className="w-5 h-5" /> {creator.pricing.duration} Minutes
            </span>
            <span className="font-extrabold text-2xl">
              ${creator.pricing.price}
            </span>
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <ShieldCheck className="w-3 h-3" /> Secure payment via GatedMeet
          </div>
        </div>

        {creator.cancellationPolicy && (
          <div className="p-6 rounded-3xl bg-amber-50 border-2 border-amber-100 space-y-2">
            <div className="font-bold flex items-center gap-2 text-amber-900">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              Cancellation Policy
            </div>
            <p className="text-sm text-amber-800 leading-relaxed whitespace-pre-wrap">
              {creator.cancellationPolicy}
            </p>
          </div>
        )}
      </div>

      {/* Main: Booking Flow */}
      <Card className="md:col-span-3 rounded-[2.5rem] border-2 shadow-xl overflow-hidden self-start">
        <CardHeader className="bg-slate-50/50 border-b">
          <CardTitle>Book your session</CardTitle>
          <CardDescription>Select a slot and secure your spot.</CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>1. Select Date</Label>
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
                          
                          // If availability is missing, assume Mon-Fri are enabled by default
                          if (!creator.availability || !creator.availability[dayOfWeek]) {
                            return dayOfWeek === "saturday" || dayOfWeek === "sunday";
                          }
                          
                          return !creator.availability[dayOfWeek].enabled;
                        }}
                        className="pointer-events-auto"
                      />
                    </div>
                  </div>
                  {formData.date && (
                    <div className="space-y-2">
                      <Label>
                        2. Select Time{" "}
                        {creator.timezone
                          ? `(${creator.timezone})`
                          : "(Local Time)"}
                      </Label>
                      {availableSlots.length > 0 ? (
                        <div className="grid grid-cols-3 gap-2">
                          {availableSlots.map((time) => (
                            <Button
                              key={time}
                              variant={
                                formData.time === time ? "default" : "outline"
                              }
                              className={`h-12 rounded-xl font-bold ${formData.time === time ? "bg-primary text-white border-primary" : "hover:border-primary"}`}
                              onClick={() => setFormData({ ...formData, time })}
                            >
                              {time}
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl border-2 border-dashed text-center text-slate-500 font-medium">
                          No available slots for this date.
                        </div>
                      )}
                    </div>
                  )}

                  {formData.time && (
                    <div className="space-y-4 pt-4 border-t-2">
                      <div className="space-y-2">
                        <Label>3. Recurring Sessions (Optional)</Label>
                        <Select
                          value={formData.recurring}
                          onValueChange={(val) =>
                            setFormData({ ...formData, recurring: val })
                          }
                        >
                          <SelectTrigger className="h-12 border-2 rounded-xl">
                            <SelectValue placeholder="Select Frequency" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              One-time Session
                            </SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {formData.recurring !== "none" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Number of Sessions</Label>
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
                              className="h-12 border-2 rounded-xl"
                            />
                          </div>
                          <div className="space-y-2">
                             <Label>Billing Method</Label>
                             <Select
                               value={formData.billingMode}
                               onValueChange={(val) =>
                                 setFormData({ ...formData, billingMode: val })
                               }
                             >
                               <SelectTrigger className="h-12 border-2 rounded-xl">
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
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Your Name</Label>
                    <Input
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="h-12 border-2 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email (for meeting link)</Label>
                    <Input
                      type="email"
                      placeholder="john@example.com"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      className="h-12 border-2 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Short Details (Optional)</Label>
                    <Textarea
                      placeholder="What would you like to discuss?"
                      value={formData.details}
                      onChange={(e) =>
                        setFormData({ ...formData, details: e.target.value })
                      }
                      className="min-h-[100px] border-2 rounded-xl"
                    />
                  </div>
                </div>
                <Button
                  className="w-full h-14 rounded-2xl font-bold text-lg"
                  onClick={() => setStep(2)}
                >
                  Review & Pay
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                <div className="p-4 rounded-2xl bg-slate-50 border space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Session</span>
                    <span className="font-bold">
                      {formData.date ? format(formData.date, "PPP") : "No date selected"} at {formData.time}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Client</span>
                    <span className="font-bold">{formData.name}</span>
                  </div>
                </div>

                <div className="grid gap-4">
                  <Button
                    variant="outline"
                    className="h-16 rounded-2xl font-bold text-left justify-start gap-4 border-2 group hover:border-primary transition-colors"
                    onClick={() => handleBookingClick("fiat")}
                  >
                    <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                      <Banknote className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm">Pay via Card / Bank</div>
                      <div className="text-xs text-slate-400">
                        Fiat (Flutterwave)
                      </div>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    className="h-16 rounded-2xl font-bold text-left justify-start gap-4 border-2 group hover:border-blue-500 transition-colors"
                    onClick={() => handleBookingClick("crypto")}
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm">Pay with Crypto</div>
                      <div className="text-xs text-slate-400">
                        TON / SOL / BASE
                      </div>
                    </div>
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setStep(1)}
                >
                  Go Back
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Your Booking</DialogTitle>
            <DialogDescription>
              Please review the details of your session before payment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-between">
              <span className="text-slate-500">Expert</span>
              <span className="font-bold">{creator.displayName}</span>
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
            {formData.recurring !== "none" && (
              <div className="flex justify-between border-t pt-2">
                <span className="text-slate-500">Frequency</span>
                <span className="font-bold uppercase text-indigo-600">
                  {formData.recurring} ({formData.sessionsCount} sessions)
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Total Price</span>
              <span className="font-black text-xl text-primary flex flex-col items-end">
                <span>
                 $
                 {formData.billingMode === "recurring" 
                   ? creator.pricing.price 
                   : creator.pricing.price * (formData.recurring !== "none" ? formData.sessionsCount : 1)}
                </span>
                {formData.billingMode === "recurring" && formData.recurring !== "none" && (
                   <span className="text-xs text-slate-400 font-medium tracking-normal mt-1">/ session (subscription)</span>
                )}
              </span>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={executeBooking} className="font-bold">
              Proceed to Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
