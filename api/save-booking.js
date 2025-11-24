import { connectToDatabase } from "../lib/mongodb.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const booking = req.body;

    const { db } = await connectToDatabase();

    const result = await db.collection("bookings").insertOne({
      ...booking,
      createdAt: new Date(),
      paid: false
    });

    return res.status(200).json({
      success: true,
      bookingId: result.insertedId
    });

  } catch (error) {
    console.error("Save booking error:", error);
    return res.status(500).json({ error: "Failed to save booking" });
  }
}
