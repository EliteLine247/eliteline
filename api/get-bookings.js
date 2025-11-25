import { connectToDatabase } from "../lib/mongodb.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ✅ ADMIN AUTH CHECK
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${process.env.ADMIN_TOKEN}`) {
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
    console.error("🔥 Get bookings error:", JSON.stringify(error, null, 2));

    return res.status(500).json({
      error: "Failed to fetch bookings",
      details: error?.message || "Unknown error"
    });
  }
}
