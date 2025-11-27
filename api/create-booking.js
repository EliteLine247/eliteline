// /api/create-booking.js

import nodemailer from "nodemailer";
import Stripe from "stripe";
import { connectToDatabase } from "../lib/mongodb.js";
import { ObjectId } from "mongodb";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const data = req.body; // we POST JSON from the frontend
    const stripe = new Stripe(process.env.STRIPE_SECRET);

    // -------------------------------
    // 1) PRICING – simple for now
    // -------------------------------
    const basePrices = {
      business: 80,
      first: 120,
      xl: 150,
    };

    // For now, just pick base price by car class
    const vehiclePrice = basePrices[data.vehicle] || basePrices.business;

    // -------------------------------
    // 2) CONNECT TO DB
    // -------------------------------
    const { db } = await connectToDatabase();

    // Sequential booking number via a "counters" collection
    const counterResult = await db.collection("counters").findOneAndUpdate(
      { _id: "bookingCounter" },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" }
    );

    const seq = counterResult.value?.seq || 1;
    const bookingRef = `ELITE-${String(seq).padStart(6, "0")}`;

    // -------------------------------
    // 3) NORMALISE PICKUP / DROPOFF
    // -------------------------------
    const airportNames = {
      LHR: "London Heathrow Airport (LHR)",
      LGW: "London Gatwick Airport (LGW)",
      STN: "London Stanstead Airport (STN)",
      SOU: "Southampton Airport (SOU)",
      SOU_CRUISE: "Southampton Cruise",
      LTN: "London Luton Airport (LTN)",
      BOH: "Bournemouth Airport (BOH)",
      LCY: "London City Airport (LCY)",
      BQH: "London Biggin Hill Airport (BQH)",
      FAB: "Farnborough Airport (FAB)",
    };

    const cityNames = {
      LONDON_CENTRAL: "Central London",
      BRIGHTON_HOVE: "Brighton & Hove",
    };

    let pickup = data.pickup || "";
    let dropoff = data.dropoff || "";

    // If pickup/dropoff are empty (airport or city fixed routes), build them
    if (!pickup || !dropoff) {
      if (data.standardLocationType === "airport" && data.airportCode) {
        const airportName = airportNames[data.airportCode] || data.airportCode;

        // Default assumption: from Chichester to airport
        pickup = pickup || "Chichester";
        dropoff = dropoff || airportName;
      } else if (data.standardLocationType === "city" && data.cityCode) {
        const cityName = cityNames[data.cityCode] || data.cityCode;

        // Default assumption: from Chichester to city
        pickup = pickup || "Chichester";
        dropoff = dropoff || cityName;
      }
    }

    // -------------------------------
    // 4) CREATE STRIPE SESSION
    // -------------------------------
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: `Chauffeur Booking ${bookingRef} (${data.vehicle})`,
            },
            unit_amount: vehiclePrice * 100,
          },
          quantity: 1,
        },
      ],
      metadata: {
        bookingRef,
        fullName: data.fullName || "",
        email: data.email || "",
        phone: data.phone || "",
      },
      success_url: "https://www.eliteline.co.uk/success.html",
      cancel_url: "https://www.eliteline.co.uk/cancel.html",
    });

    // -------------------------------
    // 5) SAVE BOOKING TO MONGODB
    // -------------------------------
    const bookingDoc = {
      bookingRef,
      tripType: data.tripType || "one_way",
      vehicle: data.vehicle || "business",

      // Fixed vs other
      standardLocationType: data.standardLocationType || "airport",
      airportCode: data.airportCode || "",
      cityCode: data.cityCode || "",

      // Normalised pickup/dropoff
      pickup,
      dropoff,

      // Dates / times
      date: data.date || "",
      time: data.time || "",
      returnDate: data.returnDate || "",
      returnTime: data.returnTime || "",

      // Hourly / wait info
      waitHours: data.waitHours || "",
      hours: data.hours || "",

      // Flight details
      terminal: data.terminal || "",
      flightNumber: data.flightNumber || "",

      // Extras
      childSeat: data.childSeat === "yes",
      extraStops: data.extraStops === "yes",
      extraStopAddress: data.extraStopAddress || "",

      // Hidden logic
      direction: data.direction || "",
      pickupPostcode: data.pickupPostcode || "",
      pickupSurcharge: data.pickupSurcharge || "",

      // Passenger
      fullName: data.fullName || "",
      phone: data.phone || "",
      email: data.email || "",

      price: vehiclePrice,
      paid: false,
      stripeSessionId: session.id,
      createdAt: new Date(),
    };

    const saved = await db.collection("bookings").insertOne(bookingDoc);

    // -------------------------------
    // 6) EMAILS
    // -------------------------------
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const bookingSummaryHtml = `
      <p><b>Booking Ref:</b> ${bookingRef}</p>
      <p><b>Name:</b> ${bookingDoc.fullName}</p>
      <p><b>Email:</b> ${bookingDoc.email}</p>
      <p><b>Phone:</b> ${bookingDoc.phone}</p>

      <p><b>Trip type:</b> ${bookingDoc.tripType}</p>
      <p><b>Car class:</b> ${bookingDoc.vehicle}</p>
      <p><b>Journey type:</b> ${bookingDoc.standardLocationType}</p>
      <p><b>Pickup:</b> ${bookingDoc.pickup}</p>
      <p><b>Dropoff:</b> ${bookingDoc.dropoff}</p>

      <p><b>Date / time (outbound):</b> ${bookingDoc.date} ${bookingDoc.time}</p>
      <p><b>Return date / time:</b> ${bookingDoc.returnDate || "-"} ${bookingDoc.returnTime || ""}</p>
      <p><b>Hourly hours:</b> ${bookingDoc.hours || "-"}</p>
      <p><b>Wait & return hours:</b> ${bookingDoc.waitHours || "-"}</p>

      <p><b>Flight number:</b> ${bookingDoc.flightNumber || "-"}</p>
      <p><b>Terminal:</b> ${bookingDoc.terminal || "-"}</p>

      <p><b>Child seat:</b> ${bookingDoc.childSeat ? "Yes" : "No"}</p>
      <p><b>Extra stops:</b> ${bookingDoc.extraStops ? "Yes" : "No"}</p>
      <p><b>Extra stop address:</b> ${bookingDoc.extraStopAddress || "-"}</p>

      <p><b>Pickup postcode:</b> ${bookingDoc.pickupPostcode || "-"}</p>
      <p><b>Pickup surcharge:</b> £${bookingDoc.pickupSurcharge || "0"}</p>

      <p><b>PRICE:</b> £${bookingDoc.price}</p>
    `;

    // Email to company
    await transporter.sendMail({
      from: "no-reply@eliteline.co.uk",
      to: "eliteline247@gmail.com",
      subject: `New Chauffeur Booking – ${bookingRef}`,
      html: `
        <h2>New Booking Received</h2>
        ${bookingSummaryHtml}
        <br>
        <p><b>Stripe Payment Link:</b> <a href="${session.url}">${session.url}</a></p>
      `,
    });

    // Email to customer
    if (bookingDoc.email) {
      await transporter.sendMail({
        from: "Eliteline <no-reply@eliteline.co.uk>",
        to: bookingDoc.email,
        subject: `Your Eliteline Booking – ${bookingRef}`,
        html: `
          <h2>Thank you for your booking, ${bookingDoc.fullName}</h2>
          ${bookingSummaryHtml}
          <p>Please complete your booking by paying securely online:</p>
          <p><a href="${session.url}">Click here to pay now</a></p>
        `,
      });
    }

    return res.status(200).json({ paymentUrl: session.url, bookingRef });
  } catch (err) {
    console.error("create-booking error:", err);
    return res.status(500).json({ error: "Failed to create booking" });
  }
}
