import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { CheckCircle2, Loader2, AlertCircle, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";

import { createNotification } from "@/lib/notifications";

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [pageStatus, setPageStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [meetingLinkToShow, setMeetingLinkToShow] = useState("");
  const [bookingDetails, setBookingDetails] = useState<any>(null);
  const calledRef = useRef(false);

  const tx_ref = searchParams.get("tx_ref");
  const transaction_id = searchParams.get("transaction_id");
  const paymentStatus = searchParams.get("status");
  const mockPayment = searchParams.get("mockPayment");
  const creatorId = searchParams.get("creatorId");
  const bookingId = searchParams.get("bookingId");

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    async function verifyAndConfirm() {
      try {
        if (!bookingId) throw new Error("No booking ID");

        if (paymentStatus === "cancelled" || paymentStatus === "failed") {
           toast.error("Payment was cancelled or failed");
           setPageStatus("error");
           return;
        }

        const firstDocRef = doc(db, "bookings", bookingId);
        const firstDocSnap = await getDoc(firstDocRef);

        let targetDocs: any[] = [];
        if (firstDocSnap.exists()) {
          targetDocs.push({ id: firstDocSnap.id, ...firstDocSnap.data() });
          const docData = firstDocSnap.data();
          setBookingDetails(docData);

          if (docData.recurringGroupId) {
            const q = query(
              collection(db, "bookings"),
              where("recurringGroupId", "==", docData.recurringGroupId),
            );
            const childSnaps = await getDocs(q);
            childSnaps.docs.forEach((d) => {
              if (d.id !== firstDocSnap.id) {
                targetDocs.push({ id: d.id, ...d.data() });
              }
            });
          }

          // Update them all to paid and send emails
          let emailSent = false;
          for (const targetDoc of targetDocs) {
            await updateDoc(doc(db, "bookings", targetDoc.id), {
              status: "paid",
            });

            if (!emailSent && creatorId) {
              const creatorDoc = await getDoc(doc(db, "users", creatorId));
              if (creatorDoc.exists()) {
                const creatorData = creatorDoc.data();
                
                // If it was already paid by webhook it might have a link, otherwise generate one
                let meetingLink = docData.meetingLink;
                if (!meetingLink) {
                   meetingLink = creatorData.meetingUrl || `https://meet.google.com/${Math.random().toString(36).substring(2, 5)}-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 5)}`;
                   await updateDoc(doc(db, "bookings", firstDocSnap.id), { meetingLink });
                }

                await fetch("/api/send-email", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    to: docData.clientEmail,
                    subject: `Booking Confirmed: Session with ${creatorData.displayName}`,
                    html: `<p>Hi ${docData.clientName},</p><p>Your session(s) with ${creatorData.displayName} is confirmed.</p><p>Meeting Link: <a href="${meetingLink}">${meetingLink}</a></p>`,
                  }),
                });

                await fetch("/api/send-email", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    to: creatorData.email || "creator@example.com",
                    subject: `New Booking: ${docData.clientName}`,
                    html: `<p>New booking from ${docData.clientName} (${docData.clientEmail}).</p>${docData.clientDetails ? `<p>Details: ${docData.clientDetails}</p>` : ''}<p>Meeting Link: <a href="${meetingLink}">${meetingLink}</a></p>`,
                  }),
                });

                // In-app notifications
                await createNotification({
                  userId: creatorId,
                  title: "New Booking Confirmed",
                  message: `${docData.clientName} booked a session with you.`,
                  type: "success",
                  relatedBookingId: firstDocSnap.id
                });

                await createNotification({
                  userId: docData.clientEmail,
                  title: "Booking Confirmed",
                  message: `Your session with ${creatorData.displayName} is confirmed. Check your email for the link.`,
                  type: "success",
                  relatedBookingId: firstDocSnap.id
                });

                setMeetingLinkToShow(meetingLink);
                emailSent = true;
              }
            } else {
                setMeetingLinkToShow(targetDoc.meetingLink || docData.meetingLink || "");
            }
          }

          setPageStatus("success");
          toast.success("Your session is confirmed!");
        } else {
          setPageStatus("error");
        }
      } catch (err) {
        console.error(err);
        setPageStatus("error");
      }
    }

    verifyAndConfirm();
  }, [tx_ref, transaction_id, mockPayment, bookingId, creatorId, paymentStatus]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-[2rem] p-8 border-2 shadow-xl text-center space-y-6"
      >
        {pageStatus === "loading" ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <h2 className="text-xl font-bold text-slate-700">
              Verifying payment...
            </h2>
          </div>
        ) : pageStatus === "error" ? (
          <div className="flex flex-col items-center justify-center space-y-6">
            <AlertCircle className="w-16 h-16 text-red-500" />
            <h2 className="text-xl font-bold text-slate-700">
              Could not verify payment
            </h2>
            <p className="text-slate-500 text-sm">
              Please contact support if you were charged.
            </p>
            <Button
              className="w-full font-bold h-12 rounded-xl"
              onClick={() => navigate("/")}
            >
              Back to Home
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center text-green-600 mb-2">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h1 className="text-3xl font-black text-slate-900">
              Payment Successful
            </h1>
            <p className="text-slate-600">
              Your booking has been confirmed. The meeting details have been
              sent to your email.
            </p>
            {bookingDetails && (
              <div className="w-full bg-slate-50 border p-4 rounded-xl text-left space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-slate-500">Date</div>
                  <div className="font-semibold">{new Date(bookingDetails.startTime).toLocaleDateString()}</div>
                  <div className="text-slate-500">Time</div>
                  <div className="font-semibold">{new Date(bookingDetails.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  <div className="text-slate-500">Name</div>
                  <div className="font-semibold">{bookingDetails.clientName}</div>
                  {bookingDetails.clientDetails && (
                    <>
                      <div className="text-slate-500">Details</div>
                      <div className="font-semibold">{bookingDetails.clientDetails}</div>
                    </>
                  )}
                </div>
                {meetingLinkToShow && (
                  <div className="pt-3 border-t">
                    <div className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Meeting Link</div>
                    <a href={meetingLinkToShow} target="_blank" className="text-indigo-600 font-bold break-all text-sm hover:underline flex items-center gap-2 bg-indigo-50 p-3 rounded-lg">
                        <Globe className="w-4 h-4 flex-shrink-0" />
                        {meetingLinkToShow}
                    </a>
                  </div>
                )}
              </div>
            )}
            <div className="pt-6 border-t w-full flex flex-col gap-3">
              <Button
                className="w-full font-bold h-14 rounded-2xl text-lg hover:shadow-xl hover:shadow-orange-200 transition-all"
                onClick={() =>
                  navigate(creatorId ? `/booking/${creatorId}` : "/")
                }
              >
                Book Another Session
              </Button>
              <Button
                variant="outline"
                className="w-full font-bold h-14 rounded-2xl text-lg"
                onClick={() => navigate("/")}
              >
                Return to Home Page
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
