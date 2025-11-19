// In your send-email.js file

import nodemailer from "nodemailer";

export default async function handler(req, res) {
  
  // 1. Set CORS Headers (required for all successful responses)
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 2. Handle the OPTIONS Preflight Request
  if (req.method === "OPTIONS") {
    // Respond OK to the browser preflight check and exit
    return res.status(200).end();
  }

  // 3. Handle Method Not Allowed for any other method besides POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ... rest of your existing POST logic remains here ...
  try {
    const data = req.body;
    
    // ... Nodemailer setup ...
    // ... await transporter.sendMail ...

    res.status(200).json({ message: "Email sent successfully!" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error sending email" });
  }
}
