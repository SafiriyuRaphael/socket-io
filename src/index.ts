import { createServer } from "http";
import mongoose from "mongoose";
import setupSocket from "./lib/socket";
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.DATABASE_URI;

async function startServer() {
  try {
    await mongoose.connect(MONGO_URI!);
    console.log("✅ MongoDB connected");

    const httpServer = createServer();
    setupSocket(httpServer); 
    httpServer.listen(PORT, () => {
      console.log(`🚀 Socket server running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
