// netlify/functions/send-email.js
const nodemailer = require("nodemailer");

exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let data;
  try {
    data = JSON.parse(event.body);
  } catch (err) {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const { fullName, phone, email, pickup, dropoff, message } = data;

  // create transporter using environment variables
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `Eliteline Website <${process.env.EMAIL_USER}>`,
    to: "elitelin247@gmail.com",
    subject: "New Website Enquiry",
    text: `
New enquiry received:

Full Name: ${fullName}
Phone: ${phone}
Email: ${email}
Pickup: ${pickup}
Dropoff: ${dropoff}

Message:
${message}
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error("Mail error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
