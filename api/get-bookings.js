import { connectToDatabase } from "../lib/mongodb.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 🔥 FIX: Trim everything to avoid hidden whitespace
  const authHeader = (req.headers.authorization || "").trim();
  const requiredToken = (`Bearer ${process.env.ADMIN_TOKEN}`).trim();

  if (!authHeader || authHeader !== requiredToken) {
    return res.status(401).json({ error: "Not authorized" });
  }

  try {
    const { db } = await connectToDatabase();

    const bookings = await db
      .collection("bookings")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json(bookings);

  } catch (error) {
    console.error("Get bookings error:", error);
    return res.status(500).json({
      error: "Failed to fetch bookings",
      details: error.message
    });
  }
}
