import Stripe from "stripe";
import { connectToDatabase } from "../lib/mongodb.js";

export const config = {
  api: {
    bodyParser: false, // Stripe requires the raw body
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET);

  const buf = await buffer(req);
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ----- HANDLE PAYMENT SUCCESS -----
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    const metadata = session.metadata;

    const { db } = await connectToDatabase();

    await db.collection("bookings").insertOne({
      ...metadata,
      price: metadata.price,
      paid: true,
      paymentIntent: session.payment_intent,
      createdAt: new Date()
    });

    console.log("✅ Booking saved to DB after payment:", metadata.fullName);
  }

  res.status(200).send("OK");
}

// Helper: get raw request body
import { Readable } from "stream";
function buffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
