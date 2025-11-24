import { createAdminToken } from "../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, password } = req.body;

  // Check login credentials
  if (
    email === process.env.ADMIN_EMAIL &&
    password === process.env.ADMIN_PASSWORD
  ) {
    const token = createAdminToken(email);

    // Set HttpOnly cookie for admin session
    res.setHeader("Set-Cookie", `adminToken=${token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax; Secure`);

    return res.status(200).json({ success: true });
  }

  return res.status(401).json({ success: false, error: "Invalid credentials" });
}
