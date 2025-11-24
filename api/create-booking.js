import Stripe from "stripe";
import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method Not Allowed" });

  const data = req.body;

  const stripe = new Stripe(process.env.STRIPE_SECRET);

  const prices = {
    business: 80,
    first: 120,
    xl: 150
  };

  const vehiclePrice = prices[data.vehicle] || 80;

  // ---------- STRIPE CHECKOUT WITH METADATA ----------
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "gbp",
          product_data: {
            name: `Chauffeur Booking (${data.vehicle})`
          },
          unit_amount: vehiclePrice * 100
        },
        quantity: 1
      }
    ],
    success_url: "https://eliteline.vercel.app/success",
    cancel_url: "https://eliteline.vercel.app/cancel",

    // 🔥 THIS IS IMPORTANT — data sent back on webhook
    metadata: {
      ...data,
      price: vehiclePrice
    }
  });

  // ---------- EMAIL ----------
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  // Email to you
  await transporter.sendMail({
    from: "no-reply@eliteline.co.uk",
    to: "elitelin247@gmail.com",
    subject: "New Chauffeur Booking (Awaiting Payment)",
    html: `
      <h2>New Booking Received</h2>
      <p><b>Name:</b> ${data.fullName}</p>
      <p><b>Email:</b> ${data.email}</p>
      <p><b>Phone:</b> ${data.phone}</p>
      <p><b>Trip Type:</b> ${data.tripType}</p>
      <p><b>Date:</b> ${data.date}</p>
      <p><b>Time:</b> ${data.time}</p>
      <p><b>Vehicle:</b> ${data.vehicle}</p>
      <p><b>Pickup:</b> ${data.pickup}</p>
      <p><b>Dropoff:</b> ${data.dropoff}</p>
      <p><b>Price:</b> £${vehiclePrice}</p>
      <br>
      <a href="${session.url}">Payment Link</a>
    `
  });

  // Email to customer
  await transporter.sendMail({
    from: "EliteLine Chauffeurs <no-reply@eliteline.co.uk>",
    to: data.email,
    subject: "Your Chauffeur Booking Request",
    html: `
      <h2>Thank you for your booking</h2>
      <p>Hi ${data.fullName},</p>
      <p>Your booking has been received.</p>
      <p>Please complete your payment using the link below:</p>
      <a href="${session.url}">Pay Now</a>
    `
  });

  res.status(200).json({ paymentUrl: session.url });
}
