// /api/create-booking.js
import nodemailer from "nodemailer";
import Stripe from "stripe";
import { connectToDatabase } from "../lib/mongodb.js";
import { ObjectId } from "mongodb";

// Helper: generate ELITE-000123 style IDs
async function generateBookingId(db) {
  const last = await db
    .collection("bookings")
    .find({ bookingId: { $regex: /^ELITE-\d{6}$/ } })
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray();

  let nextNumber = 1;

  if (last[0]?.bookingId) {
    const match = last[0].bookingId.match(/^ELITE-(\d{6})$/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `ELITE-${String(nextNumber).padStart(6, "0")}`;
}

// Helper: compute job datetime + day of week
function buildJobTiming(data) {
  if (!data.date || !data.time) return {};

  // assuming `date` = "2025-11-27", `time` = "13:30"
  const iso = `${data.date}T${data.time}:00`;
  const jobDateObj = new Date(iso);

  const dayOfWeek = jobDateObj.toLocaleDateString("en-GB", {
    weekday: "long",
  });

  return {
    jobDateTime: jobDateObj,  // for sorting/searching in Mongo
    jobDayOfWeek: dayOfWeek,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const data = req.body; // Next.js parses JSON for you
    const stripe = new Stripe(process.env.STRIPE_SECRET);

    const prices = {
      business: 80,
      first: 120,
      xl: 150,
    };

    const vehiclePrice = prices[data.vehicle] || 80;

    // ----------------------------------------------------
    // STRIPE CHECKOUT SESSION
    // ----------------------------------------------------
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
            unit_amount: vehiclePrice * 100,
          },
          quantity: 1,
        },
      ],
      success_url: "https://www.eliteline.co.uk/success.html",
      cancel_url: "https://www.eliteline.co.uk/cancel.html",
    });

    // ----------------------------------------------------
    // SAVE BOOKING TO MONGODB
    // ----------------------------------------------------
    const { db } = await connectToDatabase();
    const bookingId = await generateBookingId(db);
    const jobTiming = buildJobTiming(data);

    const bookingDoc = {
      bookingId,             // ELITE-000123
      ...data,               // everything from the form
      ...jobTiming,          // jobDateTime + jobDayOfWeek
      price: vehiclePrice,
      paid: false,
      stripeSessionId: session.id,
      createdAt: new Date(),

      // Admin-only fields (initially empty)
      dispatcher: "",
      driverNameBadge: "",
      vehicleRegBadge: "",
    };

    const saved = await db.collection("bookings").insertOne(bookingDoc);

    // ----------------------------------------------------
    // EMAILS
    // ----------------------------------------------------
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Helper: format extras
    const extras = [];
    if (data.childSeat === "yes") extras.push("Child seat");
    if (data.extraStops === "yes") extras.push("Extra stop(s)");
    const extrasText = extras.length ? extras.join(", ") : "None";

    const airportOrCity =
      data.standardLocationType === "airport"
        ? data.airportCode || "—"
        : data.standardLocationType === "city"
        ? data.cityCode || "—"
        : "Other / custom";

    const jobWhen =
      data.date && data.time
        ? `${data.date} ${data.time} (${bookingDoc.jobDayOfWeek || ""})`
        : "Not provided";

    const returnWhen =
      data.returnDate && data.returnTime
        ? `${data.returnDate} ${data.returnTime}`
        : "N/A";

    // ========= ADMIN EMAIL =========
    await transporter.sendMail({
      from: "no-reply@eliteline.co.uk",
      to: "eliteline247@gmail.com",
      subject: `New Chauffeur Booking – ${bookingId}`,
      html: `
        <h2>New Booking Received</h2>
        <p><b>Booking ID:</b> ${bookingId}</p>
        <p><b>Created At:</b> ${bookingDoc.createdAt.toLocaleString("en-GB")}</p>

        <h3>Customer</h3>
        <p><b>Name:</b> ${data.fullName}</p>
        <p><b>Email:</b> ${data.email}</p>
        <p><b>Phone:</b> ${data.phone}</p>

        <h3>Journey</h3>
        <p><b>Trip Type:</b> ${data.tripType}</p>
        <p><b>Vehicle:</b> ${data.vehicle}</p>
        <p><b>Journey Type:</b> ${data.standardLocationType}</p>
        <p><b>Airport/City Code:</b> ${airportOrCity}</p>
        <p><b>Pickup:</b> ${data.pickup || "—"}</p>
        <p><b>Dropoff:</b> ${data.dropoff || "—"}</p>
        <p><b>Job Date & Time:</b> ${jobWhen}</p>
        <p><b>Return Date & Time:</b> ${returnWhen}</p>
        <p><b>Wait & Return Hours:</b> ${data.waitHours || "N/A"}</p>
        <p><b>By The Hour (hours):</b> ${data.hours || "N/A"}</p>

        <h3>Flight / Airport Details</h3>
        <p><b>Terminal:</b> ${data.terminal || "—"}</p>
        <p><b>Flight Number:</b> ${data.flightNumber || "—"}</p>

        <h3>Location Logic</h3>
        <p><b>Direction:</b> ${data.direction || "—"}</p>
        <p><b>Pickup Postcode:</b> ${data.pickupPostcode || "—"}</p>
        <p><b>Pickup Surcharge:</b> ${
          data.pickupSurcharge ? "£" + data.pickupSurcharge : "£0"
        }</p>

        <h3>Extras</h3>
        <p><b>Extras Selected:</b> ${extrasText}</p>
        <p><b>Extra Stop Address:</b> ${data.extraStopAddress || "—"}</p>

        <h3>Payment</h3>
        <p><b>Price:</b> £${vehiclePrice}</p>
        <p><b>Paid:</b> No (Stripe session created)</p>
        <p><b>Stripe Session ID:</b> ${session.id}</p>
        <p><b>Payment Link:</b> <a href="${session.url}">${session.url}</a></p>
      `,
    });

    // ========= CUSTOMER EMAIL =========
    await transporter.sendMail({
      from: "Eliteline <no-reply@eliteline.co.uk>",
      to: data.email,
      subject: `Your Eliteline Booking – ${bookingId}`,
      html: `
        <h2>Thank you for your booking</h2>
        <p>Dear ${data.fullName},</p>
        <p>Here are your booking details:</p>

        <p><b>Booking ID:</b> ${bookingId}</p>
        <p><b>Trip Type:</b> ${data.tripType}</p>
        <p><b>Vehicle:</b> ${data.vehicle}</p>
        <p><b>Pickup:</b> ${data.pickup || "—"}</p>
        <p><b>Dropoff:</b> ${data.dropoff || "—"}</p>
        <p><b>Date & Time:</b> ${jobWhen}</p>
        <p><b>Extras:</b> ${extrasText}</p>

        <p><b>Amount to pay:</b> £${vehiclePrice}</p>
        <p>Please complete your booking by paying using the link below:</p>
        <p><a href="${session.url}">Pay Now</a></p>

        <p>If any of these details are incorrect, please reply to this email quoting your Booking ID.</p>
      `,
    });

    return res.status(200).json({ paymentUrl: session.url, bookingId });
  } catch (err) {
    console.error("create-booking error:", err);
    return res.status(500).json({ error: "Server error creating booking" });
  }
}
