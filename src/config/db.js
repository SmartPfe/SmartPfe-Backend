const mongoose = require("mongoose");
const dns = require("dns");

const configureMongoSrvDns = () => {
  const mongoUri = process.env.MONGO_URI || "";
  if (!mongoUri.startsWith("mongodb+srv://")) return;

  const configuredServers = String(process.env.MONGO_DNS_SERVERS || "")
    .split(",")
    .map((server) => server.trim())
    .filter(Boolean);
  const currentServers = dns.getServers();
  const usesLoopbackOnly =
    currentServers.length > 0 &&
    currentServers.every((server) => server === "127.0.0.1" || server === "::1");
  const servers = configuredServers.length
    ? configuredServers
    : usesLoopbackOnly
      ? ["8.8.8.8", "1.1.1.1"]
      : [];

  if (!servers.length) return;

  dns.setServers(servers);
  console.log(`[db] Using DNS servers for MongoDB SRV lookup: ${servers.join(", ")}`);
};

const connectDB = async () => {
  try {
    configureMongoSrvDns();
    await mongoose.connect(process.env.MONGO_URI);

    console.log("✅ MongoDB Connected");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
