import Stripe from "stripe";
import { connectToDatabase } from "../lib/mongodb.js";

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end("Method Not Allowed");
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET);
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    const rawBody = await new Promise((resolve) => {
      let data = "";
      req.on("data", (chunk) => (data += chunk));
      req.on("end", () => resolve(data));
    });

    event = stripe.webhooks.constructEvent(
      rawBody,
      req.headers["stripe-signature"],
      endpointSecret
    );
  } catch (err) {
    console.error("Webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ---------- PAYMENT SUCCESS ----------
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    const metadata = session.metadata;

    const { db } = await connectToDatabase();

    await db.collection("bookings").insertOne({
      ...metadata,
      price: metadata.price,
      paid: true,
      createdAt: new Date()
    });
  }

  res.json({ received: true });
}
