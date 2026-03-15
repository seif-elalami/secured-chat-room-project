import mongoose from "mongoose";

const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/tapi";
mongoose.set("strictQuery", true);

export const connectDB = async () => {
  try {
    if (mongoose.connection.readyState === 1) return mongoose;
    await mongoose.connect(mongoUri);
    console.log("✅ MongoDB connected");
    return mongoose;
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }
};

// 👇 Export both connectDB and mongoose
export default mongoose;
