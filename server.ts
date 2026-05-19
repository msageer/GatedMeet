import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import Stripe from "stripe";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.ethereal.email",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_PORT === "465",
  auth: {
    user: process.env.SMTP_USER || "mockUser",
    pass: process.env.SMTP_PASS || "mockPass",
  },
});

let flutterwaveSecret: string | null = null;
function getFlutterwaveSecret(): string {
  if (!flutterwaveSecret) {
    const key = process.env.FLW_SECRET_KEY;
    if (!key) {
      throw new Error("FLW_SECRET_KEY environment variable is required");
    }
    flutterwaveSecret = key;
  }
  return flutterwaveSecret;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  const withEmailSignature = (htmlContent: string) => {
    return `
      ${htmlContent}
      <br/><br/>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
      <div style="font-family: sans-serif; font-size: 14px; color: #555;">
        <div style="font-size: 20px; font-weight: 900; color: #4338ca; letter-spacing: -1px; margin-bottom: 4px;">Gated<span style="color: #f97316;">Meet</span></div>
        <span style="font-size: 12px; color: #888;">Empowering creators & seamless bookings.</span><br/><br/>
        support@gatedmeet.com | <a href="https://gatedmeet.com" style="color: #4338ca;">gatedmeet.com</a>
      </div>
    `;
  };

  app.post("/api/send-email", async (req, res) => {
    const { to, subject, html } = req.body;

    if (!to || !subject || !html) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    const finalHtml = withEmailSignature(html);

    try {
      if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        const fromAddress = process.env.SMTP_FROM || '"GatedMeet" <no-reply@gatedmeet.com>';
        await transporter.sendMail({
          from: fromAddress,
          to,
          subject,
          html: finalHtml,
        });
        console.log(`Email sent to ${to}: ${subject} from ${fromAddress}`);
      } else {
        console.log(`[MOCK EMAIL] You need to set SMTP_USER and SMTP_PASS to send real emails. To: ${to} | Subject: ${subject}`);
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error('Email send error:', err);
      res.status(500).json({ error: "Failed to send email: " + (err?.message || "Unknown error") });
    }
  });

  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const {
        amountUsd,
        creatorName,
        successUrl,
        cancelUrl,
        bookingIds,
        customerEmail,
        customerName,
      } = req.body;

      if (!amountUsd || !creatorName || !successUrl || !cancelUrl) {
        return res
          .status(400)
          .json({ error: "Missing required checkout parameters" });
      }

      let flwKey;
      try {
        flwKey = getFlutterwaveSecret();
      } catch (e: any) {
        // Fallback to testing mock if user hasn't configured flutterwave
        console.warn(
          "Flutterwave missing:",
          e.message,
          "- generating mock checkout url",
        );
        const mockUrl = new URL(successUrl);
        mockUrl.searchParams.set("mockPayment", "true");
        return res.json({ url: mockUrl.toString() });
      }

      const tx_ref = `${bookingIds?.join(",")}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      const response = await fetch("https://api.flutterwave.com/v3/payments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${flwKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tx_ref: tx_ref,
          amount: amountUsd,
          currency: "USD",
          redirect_url: successUrl,
          customer: {
            email: customerEmail || "customer@example.com",
            name: customerName || "Customer",
          },
          customizations: {
            title: `Session with ${creatorName}`,
            description: `Booking IDs: ${bookingIds?.join(",")}`,
          },
        }),
      });

      const data = await response.json();

      if (data.status === "success" && data.data && data.data.link) {
        res.json({ url: data.data.link });
      } else {
        throw new Error(data.message || "Failed to create Flutterwave session");
      }
    } catch (err: any) {
      console.error("Flutterwave Checkout Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/create-nowpayments-invoice", async (req, res) => {
    try {
      const { amountUsd, orderId, orderDescription, successUrl, cancelUrl } = req.body;

      if (!amountUsd || !orderId) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY || "B0W8AFT-4J14KYJ-PVZWS72-RTWESXF";

      const response = await fetch("https://api.nowpayments.io/v1/invoice", {
        method: "POST",
        headers: {
          "x-api-key": NOWPAYMENTS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          price_amount: amountUsd,
          price_currency: "usd",
          order_id: orderId,
          order_description: orderDescription || "Booking payment",
          success_url: successUrl,
          cancel_url: cancelUrl,
        }),
      });

      const data = await response.json();

      if (data.invoice_url) {
        res.json({ url: data.invoice_url });
      } else {
        throw new Error(data.message || "Failed to create NOWPayments invoice");
      }
    } catch (err: any) {
      console.error("NOWPayments Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Flutterwave Webhook
  app.post("/api/webhooks/flutterwave", async (req, res) => {
      // Disabled. Relying on frontend PaymentSuccess.tsx to hit DB instead
      // to avoid PERMISSION_DENIED on the server trying to use firebase-admin.
      res.status(200).send("Webhook received");
  });

  // Mock Payment Webhook (e.g., Paystack/Stripe)
  app.post("/api/webhooks/payment", async (req, res) => {
    res.json({ received: true });
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
