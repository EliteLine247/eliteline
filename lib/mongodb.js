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
    global._mongoClientPromise = client._
