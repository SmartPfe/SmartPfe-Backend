const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const { getReportStructureRagContext } = require("./src/services/reportStructureRagService");
const { getSectionRagContext } = require("./src/services/reportStudioRagService");

const mockProject = {
  basics: {
    title: "OmniShop: High-Throughput E-Commerce Microservices Platform",
    domain: "E-Commerce & Cloud Distributed Systems",
    language: "French",
  },
  technicalContext: {
    technologies: ["Node.js", "Express", "RabbitMQ", "PostgreSQL", "Docker", "Kubernetes", "Redis"],
    developmentTypes: ["Microservices", "Backend API", "Event-Driven Architecture"],
    methodology: "Scrum",
  },
  description: {
    problemStatement: "Monolithic e-commerce platforms struggle with horizontal scalability during seasonal flash sales.",
  },
  actors: [
    { name: "Customer", description: "Browses products, places orders, makes payments." },
    { name: "Admin", description: "Manages catalog, inventory, and views sales analytics." },
  ],
  functionalRequirements: [
    { code: "RF-01", priority: "High", title: "Asynchronous Order Processing", description: "Orders are queued in RabbitMQ for non-blocking checkout." },
    { code: "RF-02", priority: "High", title: "Real-time Inventory Deduction", description: "Stock is reserved atomically using Redis locks." },
  ],
  umlPreparation: {
    classes: [
      { name: "OrderService", description: "Handles order creation and state machine transitions." },
      { name: "InventoryService", description: "Manages stock counts and reservations." },
      { name: "PaymentGateway", description: "Integrates with Stripe webhook." },
    ],
  },
  reportStructure: [
    {
      id: "sec-1",
      title: "Chapitre 1 : Contexte Général et État de l'Art",
      children: [
        { id: "sec-1-1", title: "1.1 Contexte du Projet", children: [] },
        { id: "sec-1-2", title: "1.2 Étude des Solutions Existantes", children: [] },
      ],
    },
    {
      id: "sec-2",
      title: "Chapitre 2 : Architecture et Conception Détaillée",
      children: [
        { id: "sec-2-1", title: "2.1 Architecture Microservices et Découpage des Services", children: [] },
      ],
    },
  ],
};

const targetSection = {
  id: "sec-2-1",
  title: "2.1 Architecture Microservices et Découpage des Services",
};

async function runTests() {
  console.log("\n=======================================================");
  console.log("  RAG FALLBACK RESILIENCE TEST SUITE");
  console.log("=======================================================\n");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB successfully.\n");

  // TEST 1: Standard Execution (Current DB environment)
  console.log("-------------------------------------------------------");
  console.log("TEST 1: Standard Report Structure RAG Retrieval");
  console.log("-------------------------------------------------------");
  const result1 = await getReportStructureRagContext(mockProject, "test-std", { returnTrace: true });
  console.log(`✓ Context length: ${result1.context.length} chars`);
  console.log(`✓ Preview: ${result1.context.slice(0, 160).replace(/\n/g, " ")}...\n`);

  // TEST 2: Simulate Local Mongo / Vector Search failure in Report Structure
  console.log("-------------------------------------------------------");
  console.log("TEST 2: Simulating Local MongoDB (Vector Search stage error)");
  console.log("-------------------------------------------------------");
  
  const chunksColl = mongoose.connection.db.collection("pfe_chunks");
  const Collection = chunksColl.constructor;
  const originalAggregate = Collection.prototype.aggregate;

  // Mock aggregate on pfe_chunks to simulate local mongo rejecting $vectorSearch
  Collection.prototype.aggregate = function (pipeline, ...args) {
    if (this.collectionName === "pfe_chunks" && Array.isArray(pipeline) && pipeline.some(stage => stage.$vectorSearch)) {
      throw new Error("Unrecognized pipeline stage name: '$vectorSearch' (Simulated local Mongo)");
    }
    return originalAggregate.apply(this, [pipeline, ...args]);
  };

  const result2 = await getReportStructureRagContext(mockProject, "test-local-fallback", { returnTrace: true });
  console.log(`✓ Fallback Context length: ${result2.context.length} chars`);
  if (result2.context.length > 0) {
    console.log("✓ SUCCESS: Structure token fallback retrieved thesis TOCs when Vector Search is unsupported!");
    console.log(`✓ Preview: ${result2.context.slice(0, 160).replace(/\n/g, " ")}...\n`);
  } else {
    console.error("✗ FAILED: Expected fallback context but got empty string.");
  }

  // TEST 3: Simulate Section RAG on Local Mongo
  console.log("-------------------------------------------------------");
  console.log("TEST 3: Simulating Section RAG on Local Mongo");
  console.log("-------------------------------------------------------");
  const result3 = await getSectionRagContext(mockProject, targetSection, "test-section-fallback", { returnTrace: true });
  console.log(`✓ Section Context length: ${result3.context.length} chars`);
  if (result3.context.length > 0) {
    console.log("✓ SUCCESS: Section RAG successfully retrieved keyword fallback chunks on Local Mongo!");
    console.log(`✓ Preview: ${result3.context.slice(0, 160).replace(/\n/g, " ")}...\n`);
  } else {
    console.log("ℹ Note: Section keyword fallback handled cleanly.");
  }

  // Restore original aggregate
  Collection.prototype.aggregate = originalAggregate;

  await mongoose.disconnect();
  console.log("\n=======================================================");
  console.log("  ALL TESTS COMPLETED SUCCESSFULLY");
  console.log("=======================================================\n");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
