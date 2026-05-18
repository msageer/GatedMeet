import { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  limit, 
  doc, 
  updateDoc 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppNotification } from "@/types";
import { Bell, Check, X, Calendar, Clock } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function NotificationCenter({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!userId) return;

    // Use email as key if userId is guest email, or actual UID
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      orderBy("timestamp", "desc"),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as AppNotification[];
      setNotifications(data);
    }, (error) => {
      console.error("Notifications listener error:", error);
    });

    return () => unsubscribe();
  }, [userId]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
    } catch (err) {
      console.error("Mark as read failed:", err);
    }
  };

  const markAllAsRead = async () => {
    notifications
      .filter((n) => !n.read)
      .forEach((n) => markAsRead(n.id!));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5 text-slate-600" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 p-0 rounded-2xl overflow-hidden shadow-2xl border-primary/10" align="end">
        <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
           <h3 className="font-bold text-sm">Notifications</h3>
           {unreadCount > 0 && (
             <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-[10px] h-6 uppercase tracking-widest font-bold">
               Mark all read
             </Button>
           )}
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm italic">
              No notifications yet.
            </div>
          ) : (
            notifications.map((n) => (
              <DropdownMenuItem 
                key={n.id} 
                className={`p-4 flex gap-3 border-b last:border-0 cursor-pointer transition-colors ${n.read ? 'opacity-60' : 'bg-primary/5'}`}
                onClick={() => markAsRead(n.id!)}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  n.type === 'reschedule' ? 'bg-indigo-100 text-indigo-600' : 
                  n.type === 'cancellation' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'
                }`}>
                  {n.type === 'reschedule' ? <Clock className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-bold text-xs">{n.title}</span>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                      {n.timestamp?.toDate ? format(n.timestamp.toDate(), "MMM dd") : "just now"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-tight">{n.message}</p>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
