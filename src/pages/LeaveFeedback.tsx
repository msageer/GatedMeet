import { getDocWrapper as getDoc, getDocsWrapper as getDocs } from "@/lib/firestore-utils";
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export default function LeaveFeedback() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchBooking = async () => {
      if (!bookingId) return;
      try {
        const d = await getDoc(doc(db, 'bookings', bookingId));
        if (d.exists()) {
          setBooking({ id: d.id, ...d.data() });
        } else {
          toast.error('Booking not found');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchBooking();
  }, [bookingId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking) return;
    setSubmitting(true);
    try {
      await setDoc(doc(db, 'feedbacks', bookingId!), {
        bookingId: bookingId,
        creatorId: booking.creatorId,
        rating,
        comment,
        timestamp: serverTimestamp()
      });
      toast.success('Thank you for your feedback!');
      navigate('/');
    } catch (err) {
      toast.error('Failed to submit feedback');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-12 text-center animate-pulse">Loading...</div>;
  if (!booking) return <div className="p-12 text-center font-bold text-red-500">Booking not found</div>;

  return (
    <div className="max-w-lg mx-auto py-12">
      <Card className="rounded-[2.5rem] border-2 shadow-xl">
        <CardHeader className="bg-slate-50/50 border-b pb-6">
          <CardTitle>How was your session?</CardTitle>
          <CardDescription>Leave feedback for your meeting with {booking.creatorId}.</CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <label className="block text-sm font-semibold">Rating (1-5)</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className={`text-3xl ${rating >= star ? 'text-yellow-400' : 'text-slate-200'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold">Comment</label>
              <Textarea
                placeholder="What did you learn? How was the experience?"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="h-32 border-2 rounded-xl"
              />
            </div>

            <Button type="submit" disabled={submitting} className="w-full h-14 rounded-2xl text-lg font-bold">
              {submitting ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
