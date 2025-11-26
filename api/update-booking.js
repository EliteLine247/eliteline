// /api/update-booking.js
import { connectToDatabase } from "../lib/mongodb.js";
import { ObjectId } from "mongodb";
import nodemailer from "nodemailer";

// re-use same helper from create-booking
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

function buildJobTiming(body) {
  if (!body.date || !body.time) return {};
  const iso = `${body.date}T${body.time}:00`;
  const jobDateObj = new Date(iso);
  const dayOfWeek = jobDateObj.toLocaleDateString("en-GB", {
    weekday: "long",
  });
  return { jobDateTime: jobDateObj, jobDayOfWeek: dayOfWeek };
}

async function sendUpdateEmail(booking, subjectPrefix = "Booking Update") {
  if (!booking.email) return;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const jobWhen =
    booking.date && booking.time
      ? `${booking.date} ${booking.time} (${booking.jobDayOfWeek || ""})`
      : "Not provided";

  const returnWhen =
    booking.returnDate && booking.returnTime
      ? `${booking.returnDate} ${booking.returnTime}`
      : "N/A";

  const extras = [];
  if (booking.childSeat === "yes") extras.push("Child seat");
  if (booking.extraStops === "yes") extras.push("Extra stop(s)");
  const extrasText = extras.length ? extras.join(", ") : "None";

  const paidText = booking.paid ? "Paid" : "Unpaid";

  const title = `${subjectPrefix} – ${booking.bookingId || ""}`;

  const html = `
    <h2>${subjectPrefix}</h2>
    <p><b>Booking ID:</b> ${booking.bookingId || ""}</p>
    <p><b>Customer:</b> ${booking.fullName || ""}</p>

    <h3>Journey</h3>
    <p><b>Trip Type:</b> ${booking.tripType || ""}</p>
    <p><b>Vehicle:</b> ${booking.vehicle || ""}</p>
    <p><b>Pickup:</b> ${booking.pickup || "—"}</p>
    <p><b>Dropoff:</b> ${booking.dropoff || "—"}</p>
    <p><b>Date & Time:</b> ${jobWhen}</p>
    <p><b>Return Date & Time:</b> ${returnWhen}</p>

    <h3>Admin Details</h3>
    <p><b>Dispatcher:</b> ${booking.dispatcher || "—"}</p>
    <p><b>Driver:</b> ${booking.driverNameBadge || "—"}</p>
    <p><b>Vehicle Reg / Badge:</b> ${booking.vehicleRegBadge || "—"}</p>

    <h3>Payment</h3>
    <p><b>Price:</b> ${
      booking.price ? "£" + booking.price : "Not set"
    }</p>
    <p><b>Status:</b> ${paidText}</p>
  `;

  await transporter.sendMail({
    from: "Eliteline <no-reply@eliteline.co.uk>",
    to: booking.email,
    subject: title,
    html,
  });

  // copy to admin
  await transporter.sendMail({
    from: "no-reply@eliteline.co.uk",
    to: "eliteline247@gmail.com",
    subject: title,
    html,
  });
}

export default async function handler(req, res) {
  const { db } = await connectToDatabase();
  const collection = db.collection("bookings");

  // 🔐 simple admin auth using same ADMIN_TOKEN as get-booking.js
  const authHeader = (req.headers.authorization || "").trim();
  const requiredToken = (`Bearer ${process.env.ADMIN_TOKEN}`).trim();
  if (!authHeader || authHeader !== requiredToken) {
    return res.status(401).json({ error: "Not authorized" });
  }

  // -----------------------
  // CREATE FROM ADMIN (POST)
  // -----------------------
  if (req.method === "POST") {
    try {
      const body = req.body || {};
      const bookingId = await generateBookingId(db);
      const jobTiming = buildJobTiming(body);

      const booking = {
        bookingId,
        ...body,
        ...jobTiming,
        createdAt: new Date(),
        paid: body.paid ?? false,

        dispatcher: body.dispatcher || "",
        driverNameBadge: body.driverNameBadge || "",
        vehicleRegBadge: body.vehicleRegBadge || "",
      };

      const result = await collection.insertOne(booking);
      booking._id = result.insertedId;

      await sendUpdateEmail(booking, "New Booking (Admin)");

      return res.status(201).json(booking);
    } catch (err) {
      console.error("Admin create booking error:", err);
      return res
        .status(500)
        .json({ error: "Failed to create booking from admin" });
    }
  }

  // -----------------------
  // UPDATE EXISTING (PUT)
  // -----------------------
  if (req.method === "PUT") {
    try {
      const body = req.body || {};
      const { id, ...updateFields } = body;

      if (!id) {
        return res.status(400).json({ error: "Missing booking id" });
      }

      const _id = new ObjectId(id);

      const jobTiming = buildJobTiming(updateFields);

      const updateDoc = {
        ...updateFields,
        ...jobTiming,
      };

      // Never allow editing `createdAt` from here
      delete updateDoc.createdAt;

      await collection.updateOne(
        { _id },
        {
          $set: updateDoc,
        }
      );

      const updated = await collection.findOne({ _id });

      if (!updated) {
        return res.status(404).json({ error: "Booking not found after update" });
      }

      await sendUpdateEmail(updated, "Booking Update");

      return res.status(200).json(updated);
    } catch (err) {
      console.error("Update booking error:", err);
      return res.status(500).json({ error: "Failed to update booking" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
