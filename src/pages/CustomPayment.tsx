import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Copy, CreditCard } from "lucide-react";

export default function CustomPayment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [linkData, setLinkData] = useState<any>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    const fetchLink = async () => {
      try {
        if (!id) return;
        const d = await getDoc(doc(db, "paymentLinks", id));
        if (d.exists()) {
          setLinkData({ id: d.id, ...d.data() });
        } else {
          toast.error("Payment link not found");
        }
      } catch (err) {
         console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchLink();
  }, [id]);

  const handlePay = async () => {
     if (!linkData) return;
     setPaying(true);
     try {
       const userDoc = await getDoc(doc(db, 'users', linkData.creatorId));
       const creatorName = userDoc.exists() ? userDoc.data()?.displayName : 'Creator';
  
       const res = await fetch("/api/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amountUsd: linkData.amount,
            creatorName: linkData.title,
            successUrl: `${window.location.origin}/success`,
            cancelUrl: `${window.location.origin}/pay/${linkData.id}`,
            bookingIds: [`CUSTOM_${linkData.id}`],
            customerEmail: "customer@example.com", // typically we'd ask input, but kept simple
            customerName: "Customer"
          }),
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          toast.error("Failed to init payment");
        }
     } catch (e) {
        console.error(e);
        toast.error("Failed to start payment");
     } finally {
        setPaying(false);
     }
  };

  if (loading) return <div className="p-20 text-center">Loading payment link...</div>;
  if (!linkData) return <div className="p-20 text-center">Link not found</div>;

  return (
    <div className="max-w-md mx-auto mt-20 p-4">
       <Card className="rounded-3xl border-2 shadow-xl shadow-indigo-100">
         <CardHeader>
            <div className="bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center mb-4">
               <CreditCard className="w-8 h-8 text-indigo-500" />
            </div>
            <CardTitle>{linkData.title}</CardTitle>
            <CardDescription>{linkData.description || "One-off custom payment"}</CardDescription>
         </CardHeader>
         <CardContent>
            <div className="flex items-end justify-between mb-8">
               <div className="text-slate-500 font-medium">Amount Due</div>
               <div className="text-3xl font-bold">${Number(linkData.amount).toFixed(2)}</div>
            </div>

            <Button size="lg" className="w-full rounded-2xl h-14 text-lg font-bold" onClick={handlePay} disabled={paying}>
               {paying ? "Processing..." : "Pay Now"}
            </Button>
         </CardContent>
       </Card>
    </div>
  );
}
