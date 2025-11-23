import nodemailer from "nodemailer";
import Stripe from "stripe";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method Not Allowed" });

  const data = req.body;

  // Stripe setup
  const stripe = new Stripe(process.env.STRIPE_SECRET);

  // PRICE LOGIC — customise later if needed
  const prices = {
    business: 80,
    first: 120,
    xl: 150
  };

  const vehiclePrice = prices[data.vehicle] || 80;

  // ---------- CREATE STRIPE PAYMENT ----------
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
    success_url: "https://YOURDOMAIN.vercel.app/success",
    cancel_url: "https://YOURDOMAIN.vercel.app/cancel"
  });

  // ---------- EMAIL SETUP ----------
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  // ---------- SEND EMAIL TO YOU ----------
  await transporter.sendMail({
    from: "no-reply@eliteline.co.uk",
    to: "elitelin247@gmail.com",
    subject: "New Chauffeur Booking",
    html: `
      <h2>New Booking</h2>
      <p><b>Name:</b> ${data.fullName}</p>
      <p><b>Email:</b> ${data.email}</p>
      <p><b>Phone:</b> ${data.phone}</p>
      <p><b>Trip Type:</b> ${data.tripType}</p>
      <p><b>Date:</b> ${data.date}</p>
      <p><b>Time:</b> ${data.time}</p>
      <p><b>Vehicle:</b> ${data.vehicle}</p>
      <p><b>Pickup:</b> ${data.pickup}</p>
      <p><b>Dropoff:</b> ${data.dropoff}</p>
      <p><b>PRICE:</b> £${vehiclePrice}</p>
      <br>
      <p>Payment Link:</p>
      <a href="${session.url}">${session.url}</a>
    `
  });

  // ---------- SEND EMAIL TO CUSTOMER ----------
  await transporter.sendMail({
    from: "EliteLine Chauffeurs <no-reply@eliteline.co.uk>",
    to: data.email,
    subject: "Your Booking Request",
    html: `
      <h2>Thank you for your booking</h2>
      <p>Dear ${data.fullName},</p>
      <p>We received your request and your payment link is below:</p>
      <a href="${session.url}">Pay Now</a>
      <p>We will confirm your booking once the payment is received.</p>
      <br>
      <p>EliteLine Chauffeurs</p>
    `
  });

  // ---------- RETURN PAYMENT URL ----------
  res.status(200).json({ paymentUrl: session.url });
}
