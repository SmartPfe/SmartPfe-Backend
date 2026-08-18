const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const { getSectionRagContext, buildSectionRetrievalQuery, evaluateSectionContext } = require("./src/services/reportStudioRagService");
const { buildChapterGenerationPrompt } = require("./src/services/reportStudioPromptBuilder");
const { generateChapter } = require("./src/services/reportStudioService");

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
        { id: "sec-2-2", title: "2.2 Conception UML et Diagramme de Classes", children: [] },
      ],
    },
  ],
  reportChapters: [
    {
      sectionId: "sec-1-1",
      title: "1.1 Contexte du Projet",
      contentMarkdown: "Le commerce électronique moderne exige des architectures robustes capables de traiter des milliers de requêtes par seconde sans interruption de service. Ce projet vise à concevoir une plateforme e-commerce scalable.",
    },
  ],
};

async function test() {
  console.info("=================================================");
  console.info("  TESTING SECTION-LEVEL SELF-CORRECTING RAG (CRAG)");
  console.info("=================================================");

  await mongoose.connect(process.env.MONGO_URI);
  console.info("Connected to MongoDB.");

  const targetSection = {
    id: "sec-2-1",
    title: "2.1 Architecture Microservices et Découpage des Services",
  };

  console.info(`\nTarget Section: "${targetSection.title}"`);

  // 1. Test Query Builder
  const query = buildSectionRetrievalQuery(mockProject, targetSection);
  console.info("\n[1] Generated Section Retrieval Query:\n", query);

  // 2. Test Section CRAG Retrieval
  console.info("\n[2] Executing Section CRAG Retrieval...");
  const { context: ragContext, trace } = await getSectionRagContext(
    mockProject,
    targetSection,
    "test-generate",
    { returnTrace: true }
  );

  console.info("\n[3] CRAG Trace Output:");
  console.info("  Pass 1 Score:", trace.pass1?.score, `(${trace.pass1?.status})`, "Top Vector Score:", trace.pass1?.topVectorScore);
  console.info("  CRAG Rewriter Triggered:", trace.cragTriggered ? "YES" : "NO");
  if (trace.cragTriggered) {
    console.info("  Pass 2 Score:", trace.pass2?.score, `(${trace.pass2?.status})`, "Adopted Pass:", trace.adoptedPass);
  }
  console.info("  Retrieved Context Length:", ragContext.length, "chars");
  console.info("\n[4] Retrieved Literature Preview:\n", ragContext.slice(0, 500), "...\n");

  // 3. Test Prompt Builder
  const prompt = buildChapterGenerationPrompt(mockProject, targetSection, "standard", mockProject.reportChapters, ragContext);
  console.info(`[5] Prompt Constructed cleanly. Prompt size: ${prompt.length} chars.`);

  // 4. Test Live LLM Chapter Draft Generation
  console.info("\n[6] Calling LLM to generate section draft with RAG context...");
  const genStart = Date.now();
  const generatedChapter = await generateChapter(mockProject, targetSection.id, "standard", mockProject.reportChapters);
  console.info(`\n[7] Generated Chapter in ${Date.now() - genStart}ms:`);
  console.info("  Title:", generatedChapter.title);
  console.info("  Generated From:", generatedChapter.generatedFrom);
  console.info("  Status:", generatedChapter.status);
  console.info("  Markdown Preview (first 400 chars):\n", generatedChapter.contentMarkdown.slice(0, 400), "...\n");

  await mongoose.disconnect();
  console.info("MongoDB disconnected. Test completed successfully!");
}

test().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
