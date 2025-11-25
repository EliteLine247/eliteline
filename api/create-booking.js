import nodemailer from "nodemailer";
import Stripe from "stripe";
import { connectToDatabase } from "../lib/mongodb.js";  // ADD THIS

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method Not Allowed" });

  const data = req.body;
  const stripe = new Stripe(process.env.STRIPE_SECRET);

  // Fixed prices for now
  const prices = {
    business: 80,
    first: 120,
    xl: 150
  };

  const vehiclePrice = prices[data.vehicle] || 80;

  // CREATE STRIPE SESSION
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "gbp",
          product_data: {
            name: `Chauffeur Booking (${data.vehicle})`,
          },
          unit_amount: vehiclePrice * 100
        },
        quantity: 1
      }
    ],
    success_url: "https://www.eliteline.co.uk/success.html",
    cancel_url: "https://www.eliteline.co.uk/cancel.html",
  });

  // ------------------------------------------------------
  // SAVE BOOKING TO MONGODB
  // ------------------------------------------------------
  const { db } = await connectToDatabase();

  const saved = await db.collection("bookings").insertOne({
    ...data,
    price: vehiclePrice,
    paid: false,
    stripeSessionId: session.id,
    createdAt: new Date()
  });

  // ------------------------------------------------------
  // EMAILS
  // ------------------------------------------------------
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // Email to you
  await transporter.sendMail({
    from: "no-reply@eliteline.co.uk",
    to: "eliteline247@gmail.com",
    subject: "New Chauffeur Booking",
    html: `
      <h2>New Booking Received</h2>
      <p><b>Name:</b> ${data.fullName}</p>
      <p><b>Email:</b> ${data.email}</p>
      <p><b>Phone:</b> ${data.phone}</p>
      <p><b>Trip:</b> ${data.tripType}</p>
      <p><b>Vehicle:</b> ${data.vehicle}</p>
      <p><b>Pickup:</b> ${data.pickup}</p>
      <p><b>Dropoff:</b> ${data.dropoff}</p>
      <p><b>PRICE:</b> £${vehiclePrice}</p>
      <br>
      <p><b>Payment Link:</b> ${session.url}</p>
    `,
  });

  // Email to customer
  await transporter.sendMail({
    from: "Eliteline <no-reply@eliteline.co.uk>",
    to: data.email,
    subject: "Your Booking Request",
    html: `
      <h2>Thank You For Your Booking</h2>
      <p>Dear ${data.fullName},</p>
      <p>Please complete your booking by paying:</p>
      <a href="${session.url}">Pay Now</a>
    `,
  });

  return res.status(200).json({ paymentUrl: session.url });
}
