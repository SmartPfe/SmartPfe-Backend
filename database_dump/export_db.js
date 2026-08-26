const path = require("path");
const fs = require("fs");
const zlib = require("zlib");
const mongoose = require("mongoose");
const { EJSON } = require("bson");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const OUTPUT_FILE = path.join(__dirname, "smartpfe_dump.json.gz");

async function exportDatabase() {
  console.log("=========================================");
  console.log("   SmartPFE Database Exporter");
  console.log("=========================================\n");

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI is missing in .env");
  }

  console.log("Connecting to MongoDB Atlas...");
  await mongoose.connect(mongoUri);
  console.log("Connected successfully.\n");

  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  const dumpData = {
    metadata: {
      exportedAt: new Date().toISOString(),
      databaseName: db.databaseName,
    },
    collections: {},
  };

  for (const colInfo of collections) {
    const colName = colInfo.name;
    // Skip system collections
    if (colName.startsWith("system.")) continue;

    console.log(`Exporting collection: "${colName}"...`);
    const docs = await db.collection(colName).find({}).toArray();
    console.log(`  -> Found ${docs.length} documents in "${colName}".`);
    dumpData.collections[colName] = docs;
  }

  console.log("\nSerializing and compressing data (BSON / Extended JSON)...");
  const serialized = EJSON.stringify(dumpData, { relaxed: false });
  const compressed = zlib.gzipSync(Buffer.from(serialized, "utf-8"), { level: 9 });

  fs.writeFileSync(OUTPUT_FILE, compressed);
  const sizeMb = (compressed.length / (1024 * 1024)).toFixed(2);
  console.log(`\n✓ Database dump saved successfully:`);
  console.log(`  File: ${OUTPUT_FILE}`);
  console.log(`  Size: ${sizeMb} MB (${compressed.length} bytes)\n`);

  await mongoose.disconnect();
}

exportDatabase().catch((err) => {
  console.error("Export failed:", err);
  process.exit(1);
});
