const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const connectDB = require("./config/db");
dotenv.config();

connectDB();

const app = express();
const maskedMongoUri = process.env.MONGO_URI
  ? process.env.MONGO_URI.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@")
  : "not configured";
console.log("MONGO_URI =", maskedMongoUri);

const authRoutes = require("./routes/authRoutes");
const projectRoutes = require("./routes/projectRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const aiRoutes = require("./routes/aiRoutes");
const adminRoutes = require("./routes/adminRoutes");
const contactRoutes = require("./routes/contactRoutes");
const { observabilityContextMiddleware } = require("./services/observabilityService");

const configuredOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((origin) => origin.trim()).filter(Boolean)
  : [];

const allowedOrigins = Array.from(
  new Set([
    ...configuredOrigins,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://198.244.151.244",
    "http://staget.tn",
    "https://staget.tn",
    "https://pfeguide.tn",
    "http://pfeguide.tn"
  ])
);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(observabilityContextMiddleware);

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/contact", contactRoutes);

// Global Error Handler (ensure errors always return JSON, not HTML)
app.use((err, req, res, next) => {
  if (err.type === "entity.too.large") {
    console.error("[server] PayloadTooLargeError:", err.message);
    return res.status(413).json({ message: "Request payload too large. Please shorten or optimize your content." });
  }
  console.error("[server] Unhandled Error:", err.message);
  res.status(err.status || 500).json({ message: err.message || "Internal server error" });
});

app.get("/", (req, res) => {
  res.send("🚀 SmartPFE Backend Running");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
