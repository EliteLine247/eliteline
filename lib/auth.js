import jwt from "jsonwebtoken";

export function createAdminToken(email) {
  return jwt.sign(
    { email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export function verifyAdminFromRequest(req) {
  const cookieHeader = req.headers.cookie || "";
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map(c => {
      const [k, v] = c.trim().split("=");
      return [k, v];
    }).filter(([k]) => k)
  );

  const token = cookies.adminToken;
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch {
    return null;
  }
}
