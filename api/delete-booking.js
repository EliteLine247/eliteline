// /api/delete-booking.js
import { connectToDatabase } from "../lib/mongodb.js";
import { ObjectId } from "mongodb";

export default async function handler(req, res) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = (req.headers.authorization || "").trim();
  const requiredToken = (`Bearer ${process.env.ADMIN_TOKEN}`).trim();
  if (!authHeader || authHeader !== requiredToken) {
    return res.status(401).json({ error: "Not authorized" });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: "Missing id in query" });
  }

  try {
    const { db } = await connectToDatabase();
    const result = await db
      .collection("bookings")
      .deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Delete booking error:", err);
    return res.status(500).json({ error: "Failed to delete booking" });
  }
}
