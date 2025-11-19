// In your send-email.js file

import nodemailer from "nodemailer";

export default async function handler(req, res) {
  // Set CORS Headers (Keep these for proper browser function)
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle the OPTIONS Preflight Request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Handle Method Not Allowed
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const data = req.body;
   
    // <<< 🛑 NODEMAILER LOGIC IS RESTORED HERE 🛑 >>>
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: "elitelin247@gmail.com", // <-- Check this email address carefully!
      subject: "New Enquiry",
      html: `
        <h3>New enquiry received</h3>
        <p><strong>Name:</strong> ${data.fullName}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Phone:</strong> ${data.phone}</p>
        <p><strong>Pickup:</strong> ${data.pickup}</p>
        <p><strong>Dropoff:</strong> ${data.dropoff}</p>
        <p><strong>Message:</strong> ${data.message}</p>
      `,
    });
    // <<< 🛑 END OF RESTORED LOGIC 🛑 >>>

    res.status(200).json({ message: "Email sent successfully!" });

  } catch (err) {
    console.error(err);
    // IMPORTANT: Check Vercel Logs for the specific error shown here!
    res.status(500).json({ error: "Server error sending email" });
  }
}
