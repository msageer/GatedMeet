import { getDocWrapper as getDoc, getDocsWrapper as getDocs } from "@/lib/firestore-utils";
import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { auth, db, getAccessToken, setCachedAccessToken } from "@/lib/firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  doc,
  addDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { Link, useNavigate } from "react-router-dom";
import {
  Calendar as CalendarIcon,
  Wallet,
  Link as LinkIcon,
  Users,
  DollarSign,
  ExternalLink,
  XCircle,
  BarChart as BarChartIcon,
  TrendingUp,
  Star,
  Clock,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { Booking } from "../types";
import { Calendar } from "@/components/ui/calendar";
import { format, subDays, isSameDay, addHours } from "date-fns";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts';

import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { createNotification } from "@/lib/notifications";

const COLORS = ['#1e3a8a', '#e2e8f0']; // Navy Blue and Slate

export default function Dashboard() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [availability, setAvailability] = useState<any>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState({
    totalEarnings: 0,
    pendingBookings: 0,
    totalBookings: 0,
    avgRating: 0,
    retentionRate: 0,
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [earningsData, setEarningsData] = useState<any[]>([]);
  const [retentionData, setRetentionData] = useState<any[]>([]);
  const [ratingData, setRatingData] = useState<any[]>([]);
  const [username, setUsername] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date(),
  );
  const [googleEvents, setGoogleEvents] = useState<any[]>([]);
  const [googleTasks, setGoogleTasks] = useState<any[]>([]);
  const [isWorkspaceConnected, setIsWorkspaceConnected] = useState(false);

  const fetchWorkspaceData = async () => {
    const token = await getAccessToken();
    if (!token) return;
    setIsWorkspaceConnected(true);

    try {
      // Fetch upcoming events from Google Calendar
      const timeMin = new Date().toISOString();
      const eventsRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&maxResults=5&singleEvents=true&orderBy=startTime`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setGoogleEvents(eventsData.items || []);
      }

      // Fetch pending tasks from Google Tasks
      const tasklistsRes = await fetch("https://tasks.googleapis.com/tasks/v1/users/@me/lists", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (tasklistsRes.ok) {
        const tasklists = await tasklistsRes.json();
        const defaultList = tasklists.items?.[0]?.id;
        if (defaultList) {
          const tasksRes = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${defaultList}/tasks?showCompleted=false&maxResults=5`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          if (tasksRes.ok) {
            const tasksData = await tasksRes.json();
            setGoogleTasks(tasksData.items || []);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch workspace data", err);
    }
  };

  useEffect(() => {
    fetchWorkspaceData();
  }, [auth.currentUser]);

  const processAnalytics = (data: Booking[], reviews: any[]) => {


    const last30Days = Array.from({length: 30}).map((_, i) => {
      const d = subDays(new Date(), Math.abs(i - 29));
      return {
        dateStr: format(d, 'MMM dd'),
        dateObj: d,
        earnings: 0
      };
    });

    data.forEach(b => {
       if (b.status === "paid" || b.status === "confirmed") {
         const bd = new Date(b.startTime);
         const dObj = last30Days.find(d => isSameDay(d.dateObj, bd));
         if (dObj) {
           dObj.earnings += (b.amount || 0) * 0.9;
         }
       }
    });
    setEarningsData(last30Days);

    // Group by day for the last 7 days
    const last7Days = Array.from({length: 7}).map((_, i) => {
      const d = subDays(new Date(), Math.abs(i - 6));
      return {
        dateStr: format(d, 'MMM dd'),
        dateObj: d,
        bookings: 0
      };
    });

    data.forEach(b => {
       const bd = new Date(b.startTime);
       const dObj = last7Days.find(d => isSameDay(d.dateObj, bd));
       if (dObj) {
         dObj.bookings += 1;
       }
    });

    setChartData(last7Days);

    // Retention Rate: % of clients who booked more than once
    const counts: Record<string, number> = {};
    data.forEach(b => {
       if(b.clientEmail) {
         counts[b.clientEmail] = (counts[b.clientEmail] || 0) + 1;
       }
    });
    const totalClients = Object.keys(counts).length;
    const returningClients = Object.values(counts).filter(c => c > 1).length;
    const oneTimeClients = totalClients - returningClients;
    const retentionRate = totalClients === 0 ? 0 : Math.round((returningClients / totalClients) * 100);
    
    setRetentionData([
      { name: 'Returning', value: returningClients },
      { name: 'One-time', value: oneTimeClients }
    ]);

    // Average rating & Rating distribution
    const avgRating = reviews.length ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length) : 0;
    
    const rDist = [0,0,0,0,0];
    reviews.forEach(r => {
      if (r.rating >= 1 && r.rating <= 5) {
        rDist[r.rating - 1] += 1;
      }
    });
    setRatingData([
      { star: '5 Star', count: rDist[4] },
      { star: '4 Star', count: rDist[3] },
      { star: '3 Star', count: rDist[2] },
      { star: '2 Star', count: rDist[1] },
      { star: '1 Star', count: rDist[0] }
    ]);

    return { retentionRate, avgRating: Number(avgRating.toFixed(1)) };
  };

  const fetchBookings = async () => {
    if (!auth.currentUser) return;
    try {
      const q = query(
        collection(db, "bookings"),
        where("creatorId", "==", auth.currentUser.uid),
        orderBy("startTime", "desc"),
        limit(50), 
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Booking,
      );
      setBookings(data);

      const feq = query(
        collection(db, "feedbacks"),
        where("creatorId", "==", auth.currentUser.uid),
        orderBy("timestamp", "desc"),
      );
      const feSnapshot = await getDocs(feq);
      const revs = feSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setFeedbacks(revs.slice(0, 5)); // Keep only latest 5 for feed

      const earned = data
        .filter((b) => b.status === "paid" || b.status === "confirmed")
        .reduce((acc, b) => acc + (b.amount || 0), 0);
        
      const { retentionRate, avgRating } = processAnalytics(data, revs);
      
      setStats({
        totalEarnings: earned * 0.9,
        pendingBookings: data.filter((b) => b.status === "pending").length,
        totalBookings: data.length,
        avgRating,
        retentionRate
      });
    } catch (error) {
      console.error("Error fetching bookings", error);
    }
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      if (!auth.currentUser) return;
      try {
        const docRef = doc(db, "users", auth.currentUser.uid);
        const userDoc = await getDoc(docRef);

        if (userDoc?.exists() && userDoc.data().setupComplete === false) {
          navigate("/onboarding");
          return;
        }
        
        if (userDoc.exists()) {
           setAvailability(userDoc.data().availability || {});
           setUsername(userDoc.data().username || auth.currentUser.uid);
        }

        await fetchBookings();
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  const shareBookingLink = () => {
    const link = `${window.location.origin}/${username}`;
    navigator.clipboard.writeText(link);
    toast.success("Booking link copied to clipboard!");
  };

  const cancelBooking = async (bookingId: string) => {
    if (!window.confirm("Are you sure you want to cancel this booking?"))
      return;

    try {
      await updateDoc(doc(db, "bookings", bookingId), {
        status: "cancelled",
      });

      const bObj = bookings.find((b) => b.id === bookingId);
      if (bObj) {
        // Notification to client
        await createNotification({
          userId: bObj.clientEmail, // Using email as fallback for client userId if they don't have profile yet, or better, we should have clientUid if possible. But for now we use clientEmail for identification if they are guest.
          title: "Booking Cancelled",
          message: `Your booking with the creator for ${new Date(bObj.startTime).toLocaleString()} has been cancelled.`,
          type: "cancellation",
          relatedBookingId: bookingId
        });

        // Notify client via email
        await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: bObj.clientEmail,
            subject: `Booking Cancelled`,
            html: `<p>Hi ${bObj.clientName},</p><p>Your session on ${new Date(bObj.startTime).toLocaleString()} has been cancelled by the creator.</p>`,
          }),
        });
      }
      toast.success("Booking cancelled.");
      fetchBookings();
    } catch (error) {
      console.error(error);
      toast.error("Failed to cancel booking.");
    }
  };

  const rescheduleBooking = async (booking: Booking) => {
    const newDateStr = window.prompt("Enter new date/time (YYYY-MM-DD HH:MM):", format(new Date(booking.startTime), "yyyy-MM-dd HH:mm"));
    if (!newDateStr) return;

    try {
      const newStartTime = new Date(newDateStr).toISOString();
      const newEndTime = addHours(new Date(newStartTime), 1).toISOString(); // Default 1hr

      await updateDoc(doc(db, "bookings", booking.id!), {
        startTime: newStartTime,
        endTime: newEndTime,
        status: "rescheduled"
      });

      // Notification to client
      await createNotification({
        userId: booking.clientEmail,
        title: "Booking Rescheduled",
        message: `Your booking has been rescheduled to ${new Date(newStartTime).toLocaleString()}.`,
        type: "reschedule",
        relatedBookingId: booking.id
      });

      // Email to client
      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: booking.clientEmail,
          subject: `Booking Rescheduled`,
          html: `<p>Hi ${booking.clientName},</p><p>Your session has been rescheduled by the creator to <b>${new Date(newStartTime).toLocaleString()}</b>.</p>`,
        }),
      });

      toast.success("Booking rescheduled!");
      fetchBookings();
    } catch (err: any) {
      toast.error("Reschedule failed: " + err.message);
    }
  };

  const handleBulkSyncWorkspace = async () => {
    let token = await getAccessToken();
    if (!token) {
      if (!window.confirm("You need to authenticate with Google to connect your Workspace. Proceed?")) return;
      try {
        const provider = new GoogleAuthProvider();
        provider.addScope("https://www.googleapis.com/auth/calendar");
        provider.addScope("https://www.googleapis.com/auth/meetings.space.created");
        provider.addScope("https://www.googleapis.com/auth/tasks");
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          setCachedAccessToken(credential.accessToken);
          token = credential.accessToken;
        } else {
          throw new Error("No access token found");
        }
      } catch (err: any) {
        toast.error("Google authentication failed.");
        return;
      }
    }

    const unsyncedBookings = bookings.filter(b => (b.status === "confirmed" || b.status === "paid") && !b.meetingLink);

    if (unsyncedBookings.length === 0) {
      toast.info("All confirmed bookings are already synced.");
      return;
    }

    try {
      toast.loading(`Syncing ${unsyncedBookings.length} bookings with Workspace...`, { id: "workspace-bulk-sync" });

      for (const booking of unsyncedBookings) {
        // 1. Create Calendar Event with Google Meet & email notification
        const eventResponse = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            summary: `Session with ${booking.clientName}`,
            description: `Client Details: ${booking.clientDetails}\nBooking ID: ${booking.id}`,
            start: { dateTime: new Date(booking.startTime).toISOString() },
            end: { dateTime: new Date(booking.endTime).toISOString() },
            attendees: [{ email: booking.clientEmail }],
            conferenceData: {
              createRequest: {
                requestId: `booking-${booking.id}-${Date.now()}`,
                conferenceSolutionKey: { type: "hangoutsMeet" }
              }
            }
          })
        });

        if (eventResponse.ok) {
          const eventData = await eventResponse.json();
          const meetLink = eventData.hangoutLink;

          // 2. Create Google Task
          const tasklistsRes = await fetch("https://tasks.googleapis.com/tasks/v1/users/@me/lists", {
            headers: { "Authorization": `Bearer ${token}` }
          });
          if (tasklistsRes.ok) {
            const tasklists = await tasklistsRes.json();
            const defaultList = tasklists.items?.[0]?.id;
            if (defaultList) {
              await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${defaultList}/tasks`, {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${token}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  title: `Prepare for session with ${booking.clientName}`,
                  notes: `Booking ID: ${booking.id}\nClient Details: ${booking.clientDetails}`,
                  due: new Date(booking.startTime).toISOString()
                })
              });
            }
          }

          // 3. Update Firestore with meeting link
          if (meetLink) {
            await updateDoc(doc(db, "bookings", booking.id!), { meetingLink: meetLink });
          }
        }
      }

      toast.success("Workspace synced successfully and clients notified!", { id: "workspace-bulk-sync" });
      fetchBookings();
      fetchWorkspaceData();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to sync workspace: " + err.message, { id: "workspace-bulk-sync" });
    }
  };

  const handleSyncWorkspace = async (booking: Booking) => {
    let token = await getAccessToken();
    if (!token) {
      if (!window.confirm("You need to authenticate with Google to connect your Workspace. Proceed?")) return;
      try {
        const provider = new GoogleAuthProvider();
        provider.addScope("https://www.googleapis.com/auth/calendar");
        provider.addScope("https://www.googleapis.com/auth/meetings.space.created");
        provider.addScope("https://www.googleapis.com/auth/tasks");
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          setCachedAccessToken(credential.accessToken);
          token = credential.accessToken;
        } else {
          throw new Error("No access token found");
        }
      } catch (err: any) {
        toast.error("Google authentication failed.");
        return;
      }
    }

    try {
      toast.loading("Syncing with Google Workspace...", { id: "workspace-sync" });

      // 1. Create Calendar Event with Google Meet
      const eventResponse = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          summary: `Session with ${booking.clientName}`,
          description: `Client Details: ${booking.clientDetails}`,
          start: { dateTime: new Date(booking.startTime).toISOString() },
          end: { dateTime: new Date(booking.endTime).toISOString() },
          attendees: [{ email: booking.clientEmail }],
          conferenceData: {
            createRequest: {
              requestId: `booking-${booking.id}-${Date.now()}`,
              conferenceSolutionKey: { type: "hangoutsMeet" }
            }
          }
        })
      });

      if (!eventResponse.ok) throw new Error("Failed to create calendar event");
      const eventData = await eventResponse.json();
      const meetLink = eventData.hangoutLink;

      // 2. Create Google Task
      const tasklistsRes = await fetch("https://tasks.googleapis.com/tasks/v1/users/@me/lists", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (tasklistsRes.ok) {
        const tasklists = await tasklistsRes.json();
        const defaultList = tasklists.items?.[0]?.id;
        if (defaultList) {
          await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${defaultList}/tasks`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              title: `Prepare for session with ${booking.clientName}`,
              notes: `Booking ID: ${booking.id}\nClient Details: ${booking.clientDetails}`,
              due: new Date(booking.startTime).toISOString()
            })
          });
        }
      }

      // 3. Update Firestore with meeting link
      if (meetLink) {
        await updateDoc(doc(db, "bookings", booking.id!), { meetingLink: meetLink });
        toast.success("Added to Calendar & Meet link generated", { id: "workspace-sync" });
        fetchBookings();
      } else {
        toast.success("Added to Calendar, but no Meet link created", { id: "workspace-sync" });
      }

    } catch (err: any) {
      console.error(err);
      toast.error("Failed to sync workspace: " + err.message, { id: "workspace-sync" });
    }
  };

  const getDayBookings = (date: Date) => {
    return bookings.filter(
      (b) =>
        (b.status === "paid" || b.status === "confirmed") &&
        new Date(b.startTime).toDateString() === date.toDateString(),
    );
  };

  const getCalendarModifiers = () => {
    const paidBookings = bookings.filter(
      (b) => b.status === "paid" || b.status === "confirmed"
    );
    const bookedDays = paidBookings.map((b) => new Date(b.startTime));
    const cancelledBookings = bookings.filter((b) => b.status === "cancelled");
    const cancelledDays = cancelledBookings.map((b) => new Date(b.startTime));

    // Calculate available days for the current month based on settings
    const availableDays: Date[] = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
       const d = new Date(today);
       d.setDate(today.getDate() + i);
       const dayOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][d.getDay()];
       if (availability[dayOfWeek]?.enabled) {
          availableDays.push(d);
       }
    }

    return {
      booked: bookedDays,
      cancelled: cancelledDays,
      available: availableDays
    };
  };

  return (
    <div className="space-y-10 max-w-7xl mx-auto px-4 md:px-8 py-8">
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-6 bg-white py-8 px-6 md:p-10 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        <div className="relative z-10">
          <h1 className="text-5xl font-display font-black tracking-tighter text-slate-900 mb-2">
            Creator Dashboard
          </h1>
          <p className="text-slate-500 text-lg max-w-xl">
            Manage your sessions, track earnings, and synchronize with your workspace in real-time.
          </p>
          <div className="flex gap-3 mt-6 flex-wrap">
            <Link
              to="/dashboard/profile?tab=pricing"
              className={buttonVariants({
                variant: "outline",
                className: "rounded-2xl font-bold bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-700",
              })}
            >
              Services & Pricing
            </Link>
            <Button
              variant="outline"
              onClick={shareBookingLink}
              className="rounded-2xl border-2 font-bold flex gap-2 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary/30"
            >
              <LinkIcon className="w-4 h-4" />
              Copy Booking Link
            </Button>
          </div>
        </div>
        <div className="flex gap-3 relative z-10">
          <Button
            variant="secondary"
            onClick={handleBulkSyncWorkspace}
            className="rounded-2xl font-bold flex gap-2 h-12 px-6 shadow-sm bg-slate-900 text-white hover:bg-slate-800"
          >
            <RefreshCw className="w-4 h-4" />
            Sync Workspace
          </Button>
          <Link
            to="/dashboard/profile?tab=availability"
            className={buttonVariants({
              className: "rounded-2xl font-bold h-12 px-8 shadow-xl shadow-primary/20",
            })}
          >
            Set Availability
          </Link>
        </div>
      </header>

      {/* Google Workspace Section */}
      {isWorkspaceConnected && (googleEvents.length > 0 || googleTasks.length > 0) && (
        <Card className="rounded-[3rem] border-0 shadow-xl overflow-hidden bg-slate-900 text-white p-2">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 pb-6 pt-8 px-8">
            <div>
              <CardTitle className="flex items-center gap-3 text-3xl font-black tracking-tight">
                <CalendarIcon className="w-8 h-8 text-indigo-400" />
                Workspace Agenda
              </CardTitle>
              <CardDescription className="text-slate-400 text-base mt-2">Your synced Google Calendar events and pending tasks.</CardDescription>
            </div>
            <Button onClick={handleBulkSyncWorkspace} variant="secondary" className="hidden sm:flex rounded-2xl bg-slate-800 text-white hover:bg-slate-700 border border-slate-700 px-6 h-12 font-bold">
              <RefreshCw className="w-4 h-4 mr-2" />
              Sync Now
            </Button>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 max-h-[400px] overflow-y-auto custom-scrollbar">
            <div className="space-y-4">
              <h4 className="font-bold text-indigo-300 flex items-center gap-2 uppercase tracking-widest text-sm"><Clock className="w-4 h-4"/> Upcoming Events</h4>
              <div className="space-y-3">
                {googleEvents.length > 0 ? googleEvents.map(event => (
                  <div key={event.id} className="p-5 bg-slate-800/40 rounded-3xl border border-slate-700/50 shadow-sm backdrop-blur-sm">
                    <p className="font-bold text-white text-lg">{event.summary || "Untitled Event"}</p>
                    <p className="text-sm text-slate-400 mt-2 flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4" />
                      {event.start?.dateTime ? new Date(event.start.dateTime).toLocaleString() : 'All day'}
                    </p>
                    {event.hangoutLink && (
                      <a href={event.hangoutLink} target="_blank" className="inline-flex items-center gap-2 px-4 py-2 mt-4 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 text-sm font-bold rounded-2xl transition-colors">
                        <ExternalLink className="w-4 h-4" /> Join Google Meet
                      </a>
                    )}
                  </div>
                )) : <p className="text-sm text-slate-500">No upcoming events found.</p>}
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="font-bold text-orange-300 flex items-center gap-2 uppercase tracking-widest text-sm"><TrendingUp className="w-4 h-4"/> Pending Tasks</h4>
              <div className="space-y-3">
                {googleTasks.length > 0 ? googleTasks.map(task => (
                  <div key={task.id} className="p-5 bg-slate-800/40 rounded-3xl border border-slate-700/50 shadow-sm flex items-start gap-4 backdrop-blur-sm">
                    <div className="w-6 h-6 border-2 rounded-full mt-0.5 border-slate-500 flex-shrink-0 flex items-center justify-center">
                       {/* Empty task circle */}
                    </div>
                    <div>
                      <p className="font-bold text-white text-lg">{task.title}</p>
                      {task.due && <p className="text-sm text-slate-400 mt-1 font-medium">Due: {new Date(task.due).toLocaleDateString()}</p>}
                    </div>
                  </div>
                )) : <p className="text-sm text-slate-500">No pending tasks found.</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            label: "Net Earnings",
            value: `$${stats.totalEarnings.toFixed(2)}`,
            icon: DollarSign,
            color: "text-green-600",
            bg: "bg-green-100",
            tooltip: "Total revenue from all paid and confirmed bookings after fees.",
          },
          {
            label: "Total Bookings",
            value: stats.totalBookings,
            icon: Users,
            color: "text-indigo-600",
            bg: "bg-indigo-100",
            tooltip: "Total number of booking requests received, including pending and cancelled.",
          },
          {
            label: "Avg Rating",
            value: stats.avgRating > 0 ? `${stats.avgRating} / 5` : "N/A",
            icon: Star,
            color: "text-orange-600",
            bg: "bg-orange-100",
            tooltip: "Average star rating from client feedback.",
          },
        ].map((item, i) => (
          <div key={i} className="group relative">
            <Card className="rounded-[2.5rem] border-0 bg-slate-50 hover:bg-slate-100 transition-colors cursor-help relative overflow-hidden shadow-sm">
              <CardContent className="p-8 flex items-center justify-between">
                <div className="text-left space-y-2 z-10 relative">
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">{item.label}</p>
                  <h3 className="text-5xl font-display font-black text-slate-900">{item.value}</h3>
                </div>
                <div className={`p-4 rounded-[2rem] ${item.bg} ${item.color} shadow-sm z-10 relative`}>
                  <item.icon className="w-8 h-8" />
                </div>
                <div className={`absolute -right-6 -top-6 w-32 h-32 ${item.bg} rounded-full opacity-50 blur-3xl pointer-events-none`} />
              </CardContent>
            </Card>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 text-white text-xs rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none shadow-xl text-center">
              {item.tooltip}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-slate-900 border-4 border-l-transparent border-r-transparent border-b-transparent"></div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="rounded-[2.5rem] border-2 shadow-sm overflow-hidden lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
             <div>
               <CardTitle className="flex items-center gap-2">
                 <BarChartIcon className="w-5 h-5 text-blue-500" />
                 Bookings Over Time
               </CardTitle>
               <CardDescription>Bookings received over the last 7 days</CardDescription>
             </div>
             <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl font-bold text-sm">
                <TrendingUp className="w-4 h-4" />
                {stats.totalBookings} Total
             </div>
          </CardHeader>
          <CardContent>
             <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorB" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="dateStr" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                      <RechartsTooltip cursor={{stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3'}} contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Area type="monotone" dataKey="bookings" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorB)" />
                   </AreaChart>
                </ResponsiveContainer>
             </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2.5rem] border-2 shadow-sm overflow-hidden flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
               <Users className="w-5 h-5 text-blue-500" />
               Client Retention
            </CardTitle>
            <CardDescription>{stats.retentionRate}% Return Rate</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center -mt-4">
             <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                     <Pie
                       data={retentionData}
                       cx="50%"
                       cy="50%"
                       innerRadius={60}
                       outerRadius={80}
                       paddingAngle={5}
                       dataKey="value"
                     >
                       {retentionData.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                       ))}
                     </Pie>
                     <RechartsTooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                     <Legend verticalAlign="bottom" height={36} iconType="circle" />
                   </PieChart>
                </ResponsiveContainer>
             </div>
          </CardContent>
        </Card>

         <Card className="rounded-[2.5rem] border-2 shadow-sm overflow-hidden flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
               <Star className="w-5 h-5 text-yellow-500" />
               Avg Rating
            </CardTitle>
            <CardDescription>{stats.avgRating > 0 ? `${stats.avgRating} / 5 Rating` : "No ratings"}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center">
             <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={ratingData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                      <XAxis type="number" hide />
                      <YAxis dataKey="star" type="category" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                      <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="count" fill="#eab308" radius={[0, 4, 4, 0]} barSize={20} />
                   </BarChart>
                </ResponsiveContainer>
             </div>
          </CardContent>
        </Card>
      </div>

      {/* Earnings 30 days Chart */}
      <Card className="rounded-[2.5rem] border-2 shadow-sm overflow-hidden mb-6">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
             <div>
               <CardTitle className="flex items-center gap-2">
                 <DollarSign className="w-5 h-5 text-green-500" />
                 Earnings Overview (30 Days)
               </CardTitle>
               <CardDescription>Visualizing revenue trends over the last 30 days</CardDescription>
             </div>
          </CardHeader>
          <CardContent>
             <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={earningsData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="dateStr" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} minTickGap={20} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `$${val}`} />
                      <RechartsTooltip cursor={{stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3'}} formatter={(val: number) => [`$${val.toFixed(2)}`, 'Earnings']} contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Area type="monotone" dataKey="earnings" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorEarnings)" />
                   </AreaChart>
                </ResponsiveContainer>
             </div>
          </CardContent>
        </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar / Upcoming Sessions */}
        <Card className="col-span-1 border-2 rounded-[2.5rem] bg-blue-50/50 flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-blue-500" />
              Schedule
            </CardTitle>
            <CardDescription>
              Select a date to view confirmed sessions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 flex flex-col items-center flex-1">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              modifiers={getCalendarModifiers()}
              modifiersStyles={{
                booked: {
                  fontWeight: "bold",
                  backgroundColor: "#e0e7ff",
                  color: "#4338ca",
                },
                cancelled: {
                  textDecoration: "line-through",
                  color: "#ef4444",
                  backgroundColor: "#fef2f2"
                },
                available: {
                  borderBottom: "2px solid #22c55e"
                }
              }}
              className="bg-white rounded-2xl p-4 shadow-sm"
            />

            <div className="w-full mt-4 space-y-3">
              <h4 className="font-bold text-slate-700">
                {selectedDate
                  ? format(selectedDate, "MMM d, yyyy")
                  : "Selected Date"}
              </h4>
              {selectedDate && getDayBookings(selectedDate).length > 0 ? (
                getDayBookings(selectedDate).map((b) => (
                  <div
                    key={b.id}
                    className="p-3 bg-white rounded-xl border border-blue-100 flex flex-col shadow-sm relative overflow-hidden group"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400"></div>
                    <div className="flex justify-between items-center pl-2">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-slate-800 truncate">
                          {b.clientName}
                        </span>
                        {b.clientDetails && (
                          <span className="text-xs text-slate-500 mt-0.5 max-w-[150px] truncate" title={b.clientDetails}>
                            {b.clientDetails}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2 items-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => rescheduleBooking(b)}
                          className="h-6 text-xs text-indigo-600 hover:text-indigo-800"
                        >
                          <Clock className="w-3 h-3 mr-1" />
                          Reschedule
                        </Button>
                        <span className="text-xs bg-slate-100 px-2 py-1 rounded-md text-slate-600 font-medium">
                          {format(new Date(b.startTime), "HH:mm")}
                        </span>
                      </div>
                    </div>
                    <div className="pl-2 mt-2 flex justify-between items-center">
                      <a
                        href={b.meetingLink}
                        target="_blank"
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline"
                      >
                        Meeting Link
                      </a>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancelBooking(b.id)}
                        className="h-6 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded-sm"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 text-center py-4 bg-white/50 rounded-xl">
                  No sessions for this date.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="col-span-1 lg:col-span-2 space-y-6">
          {/* Recent Bookings */}
          <Card className="rounded-[2.5rem] border-2 shadow-sm overflow-hidden">
            <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-2xl font-bold">
                  Recent Bookings
                </CardTitle>
                <CardDescription>
                  A list of your latest booking attempts and successes.
                </CardDescription>
              </div>
              <div className="relative w-full md:w-64">
                 <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                 <Input 
                   placeholder="Search by name or email..." 
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="pl-9 rounded-xl border-2"
                 />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead>Client</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.filter(b => b.clientName?.toLowerCase().includes(searchQuery.toLowerCase()) || b.clientEmail?.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 ? (
                    bookings.filter(b => b.clientName?.toLowerCase().includes(searchQuery.toLowerCase()) || b.clientEmail?.toLowerCase().includes(searchQuery.toLowerCase())).map((booking) => (
                      <TableRow
                        key={booking.id}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <TableCell>
                          <div className="font-semibold">{booking.clientName}</div>
                          {booking.clientDetails && (
                            <div className="text-sm text-slate-500 mt-1 max-w-[200px] truncate" title={booking.clientDetails}>
                              {booking.clientDetails}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(booking.startTime).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              booking.status === "paid" ? "default" : "outline"
                            }
                            className="rounded-full"
                          >
                            {booking.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize">
                          {booking.paymentType}
                        </TableCell>
                        <TableCell className="text-right">
                          {booking.status !== "cancelled" &&
                          booking.status !== "pending" ? (
                            <div className="flex items-center justify-end gap-2">
                              {!booking.meetingLink && (
                                <>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleSyncWorkspace(booking)}
                                    className="text-blue-600 bg-blue-50 hover:bg-blue-100 font-bold"
                                  >
                                    Google Meet
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={async () => {
                                      try {
                                        await updateDoc(doc(db, "bookings", booking.id!), { 
                                          meetingLink: `${window.location.origin}/meet/${booking.id}` 
                                        });
                                        toast.success("Built-in meeting room created!");
                                        fetchBookings();
                                      } catch (err) {
                                        toast.error("Error creating meeting room: " + err);
                                      }
                                    }}
                                    className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 font-bold"
                                  >
                                    Built-in Room
                                  </Button>
                                </>
                              )}
                              {booking.meetingLink && (
                                <a
                                  href={booking.meetingLink}
                                  target="_blank"
                                  className={buttonVariants({
                                    variant: "ghost",
                                    size: "sm",
                                    className: "text-primary font-bold",
                                  })}
                                >
                                  Join Link
                                  <ExternalLink className="w-3 h-3 ml-1" />
                                </a>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => rescheduleBooking(booking)}
                                className="text-indigo-600 hover:text-indigo-800"
                              >
                                Reschedule
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => cancelBooking(booking.id!)}
                                className="text-red-500 hover:text-red-700"
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : booking.status === "cancelled" ? (
                            <span className="text-xs text-red-400 font-bold">
                              Cancelled
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">
                              Waiting for payment
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-12 text-slate-400 font-medium"
                      >
                        No bookings found. Share your link to get started!
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Client Feedback */}
          <Card className="rounded-[2.5rem] border-2 shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl font-bold">
                Client Feedback
              </CardTitle>
              <CardDescription>
                See what clients are saying about your sessions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {feedbacks.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-4">
                  {feedbacks.map((fb) => (
                    <div
                      key={fb.id}
                      className="p-4 rounded-2xl border-2 bg-slate-50"
                    >
                      <div className="flex items-center gap-1 mb-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span
                            key={star}
                            className={
                              star <= fb.rating
                                ? "text-yellow-400"
                                : "text-slate-200"
                            }
                          >
                            ★
                          </span>
                        ))}
                      </div>
                      <p className="text-slate-700 italic">"{fb.comment}"</p>
                      <div className="text-xs text-slate-400 mt-2">
                        {new Date(fb.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  No feedback received yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
