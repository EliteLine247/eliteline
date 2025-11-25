import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("❌ Missing MONGODB_URI in environment variables");
}

let client;
let clientPromise;

if (process.env.NODE_ENV === "development") {
  // Use global variable in development to prevent multiple connections
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production, always create a new client but cache the promise
  client = new MongoClient(uri);
  clientPromise = client.connect();
}

export async function connectToDatabase() {
  const client = await clientPromise;
  const db = client.db("eliteline"); // your DB name

  return { client, db };
}
