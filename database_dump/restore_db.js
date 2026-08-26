const path = require("path");
const fs = require("fs");
const zlib = require("zlib");
const mongoose = require("mongoose");
const { EJSON } = require("bson");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const DUMP_FILE = path.join(__dirname, "smartpfe_dump.json.gz");

async function restoreDatabase() {
  console.log("=========================================");
  console.log("   SmartPFE Database Restorer");
  console.log("=========================================\n");

  if (!fs.existsSync(DUMP_FILE)) {
    throw new Error(`Dump file not found at: ${DUMP_FILE}`);
  }

  // Target URI can be passed as CLI arg: node restore_db.js "mongodb://localhost:27017/pfe"
  const targetUri = process.argv[2] || process.env.MONGO_URI || "mongodb://localhost:27017/pfe";
  console.log(`Target MongoDB URI: ${targetUri.replace(/:([^:@]{3,})@/, ":***@")}`);

  console.log("Connecting to target MongoDB...");
  await mongoose.connect(targetUri);
  console.log("Connected successfully.\n");

  console.log("Decompressing and parsing dump archive...");
  const compressedBuffer = fs.readFileSync(DUMP_FILE);
  const decompressedString = zlib.gunzipSync(compressedBuffer).toString("utf-8");
  const dumpData = EJSON.parse(decompressedString, { relaxed: false });

  console.log(`Source DB: ${dumpData.metadata?.databaseName || "unknown"}`);
  console.log(`Export Date: ${dumpData.metadata?.exportedAt || "unknown"}\n`);

  const db = mongoose.connection.db;
  const collectionNames = Object.keys(dumpData.collections || {});

  for (const colName of collectionNames) {
    const docs = dumpData.collections[colName] || [];
    console.log(`Restoring collection: "${colName}" (${docs.length} documents)...`);

    const col = db.collection(colName);
    // Clear existing docs in collection
    await col.deleteMany({});

    if (docs.length > 0) {
      // Insert in chunks of 500
      const CHUNK_SIZE = 500;
      for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
        const chunk = docs.slice(i, i + CHUNK_SIZE);
        await col.insertMany(chunk, { ordered: false });
      }
    }
    console.log(`  ✓ Restored ${docs.length} documents into "${colName}".`);
  }

  console.log("\n=========================================");
  console.log("✓ ALL COLLECTIONS RESTORED SUCCESSFULLY!");
  console.log("=========================================\n");

  await mongoose.disconnect();
}

restoreDatabase().catch((err) => {
  console.error("Restore failed:", err);
  process.exit(1);
});
