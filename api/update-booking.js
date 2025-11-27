// /api/update-booking.js

import nodemailer from "nodemailer";
import { connectToDatabase } from "../lib/mongodb.js";
import { ObjectId } from "mongodb";

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body;

    const { id, updates } = body; // id = Mongo _id as string
    if (!id || !updates) {
      return res.status(400).json({ error: "Missing id or updates" });
    }

    const { db } = await connectToDatabase();
    const _id = new ObjectId(id);

    const existing = await db.collection("bookings").findOne({ _id });
    if (!existing) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // Never allow createdAt to be overridden
    if ("createdAt" in updates) delete updates.createdAt;

    const result = await db.collection("bookings").findOneAndUpdate(
      { _id },
      {
        $set: {
          ...updates,
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );

    const updated = result.value;

    // -----------------------------
    // EMAIL BOTH CUSTOMER + COMPANY
    // -----------------------------
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const bookingRef = updated.bookingRef || existing.bookingRef || "(no ref)";
    const fullName   = updated.fullName || existing.fullName || "";
    const customerEmail = updated.email || existing.email || "";

    const summaryHtml = `
      <p><b>Booking Ref:</b> ${bookingRef}</p>
      <p><b>Name:</b> ${fullName}</p>
      <p><b>Email:</b> ${customerEmail}</p>
      <p><b>Phone:</b> ${updated.phone || existing.phone || ""}</p>

      <p><b>Trip type:</b> ${updated.tripType || existing.tripType || ""}</p>
      <p><b>Car class:</b> ${updated.vehicle || existing.vehicle || ""}</p>

      <p><b>Pickup:</b> ${updated.pickup || existing.pickup || ""}</p>
      <p><b>Dropoff:</b> ${updated.dropoff || existing.dropoff || ""}</p>

      <p><b>Job date / time:</b> ${(updated.date || existing.date || "")} ${(updated.time || existing.time || "")}</p>

      <p><b>Dispatcher:</b> ${updated.dispatcher || ""}</p>
      <p><b>Driver (name & badge):</b> ${updated.driverInfo || ""}</p>
      <p><b>Vehicle reg & badge:</b> ${updated.vehicleRegBadge || ""}</p>

      <p><b>Price:</b> £${updated.price ?? existing.price ?? ""}</p>
      <p><b>Paid:</b> ${updated.paid ?? existing.paid ? "Yes" : "No"}</p>
    `;

    // Email to company
    await transporter.sendMail({
      from: "no-reply@eliteline.co.uk",
      to: "eliteline247@gmail.com",
      subject: `Booking update – ${bookingRef}`,
      html: `
        <h2>Booking Updated (Admin)</h2>
        ${summaryHtml}
      `,
    });

    // Email to customer, if we have their email
    if (customerEmail) {
      await transporter.sendMail({
        from: "Eliteline <no-reply@eliteline.co.uk>",
        to: customerEmail,
        subject: `Your Eliteline booking has been updated – ${bookingRef}`,
        html: `
          <h2>Your booking has been updated</h2>
          <p>Dear ${fullName || "Customer"},</p>
          <p>Your booking details have been updated. Here is the latest summary:</p>
          ${summaryHtml}
        `,
      });
    }

    return res.status(200).json({ success: true, booking: updated });
  } catch (err) {
    console.error("update-booking error:", err);
    return res.status(500).json({ error: "Failed to update booking" });
  }
}
