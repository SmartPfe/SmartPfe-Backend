const mongoose = require("mongoose");

const actorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["primary", "external"],
      default: "primary",
    },
    icon: { type: String, default: "person", trim: true },
  },
  { _id: true }
);

const existingSolutionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, default: "Existing Solution", trim: true },
    icon: { type: String, default: "search", trim: true },
    description: { type: String, required: true, trim: true },
    solvedProblem: { type: String, required: true, trim: true },
    strengths: { type: [String], default: [] },
    weaknesses: { type: [String], default: [] },
    differentiation: { type: String, required: true, trim: true },
  },
  { _id: true }
);

const functionalRequirementSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true },
    module: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    priority: {
      type: String,
      enum: ["Must Have", "Should Have", "Could Have", "Won't Have"],
      default: "Should Have",
    },
    status: {
      type: String,
      enum: ["Draft", "In Review", "Approved"],
      default: "Draft",
    },
  },
  { _id: true }
);

const nonFunctionalRequirementSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    priority: {
      type: String,
      enum: ["Must Have", "Should Have", "Could Have", "Won't Have"],
      default: "Should Have",
    },
    status: {
      type: String,
      enum: ["Draft", "In Review", "Approved"],
      default: "Draft",
    },
  },
  { _id: true }
);

const productBacklogItemSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true },
    epic: { type: String, required: true, trim: true },
    actors: { type: [String], default: [] },
    task: { type: String, required: true, trim: true },
    priority: {
      type: String,
      enum: ["High", "Medium", "Low"],
      default: "Medium",
    },
    durationDays: { type: Number, default: 1, min: 1 },
    sprint: { type: String, default: "Sprint 1", trim: true },
    notes: { type: String, default: "", trim: true },
  },
  { _id: true }
);

const umlClassSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, default: "Class", trim: true },
    description: { type: String, default: "", trim: true },
    attributes: { type: [String], default: [] },
    methods: { type: [String], default: [] },
  },
  { _id: true }
);

const umlRelationshipSchema = new mongoose.Schema(
  {
    source: { type: String, required: true, trim: true },
    target: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["association", "inheritance", "composition", "aggregation", "dependency"],
      default: "association",
    },
    label: { type: String, default: "", trim: true },
    sourceMultiplicity: { type: String, default: "", trim: true },
    targetMultiplicity: { type: String, default: "", trim: true },
  },
  { _id: true }
);

const umlUseCaseSchema = new mongoose.Schema(
  {
    systemName: { type: String, default: "System", trim: true },
    primaryActors: { type: [String], default: [] },
    secondaryActors: { type: [String], default: [] },
    actors: { type: [String], default: [] },
    useCases: { type: [String], default: [] },
    links: {
      type: [
        {
          actor: { type: String, trim: true },
          useCase: { type: String, trim: true },
        },
      ],
      default: [],
    },
    useCaseRelations: {
      type: [
        {
          source: { type: String, trim: true },
          target: { type: String, trim: true },
          type: {
            type: String,
            enum: ["include", "extend"],
            default: "include",
          },
        },
      ],
      default: [],
    },
  },
  { _id: false }
);

const umlSequenceSchema = new mongoose.Schema(
  {
    scenario: { type: String, default: "", trim: true },
    participants: { type: mongoose.Schema.Types.Mixed, default: [] },
    messages: {
      type: [
        {
          source: { type: String, trim: true },
          target: { type: String, trim: true },
          message: { type: String, trim: true },
          response: { type: Boolean, default: false },
          type: { type: String, default: "sync" },
        },
      ],
      default: [],
    },
    altFlow: {
      condition: { type: String, default: "", trim: true },
      messages: {
        type: [
          {
            source: { type: String, trim: true },
            target: { type: String, trim: true },
            message: { type: String, trim: true },
            response: { type: Boolean, default: false },
          },
        ],
        default: [],
      },
    },
  },
  { _id: false }
);

const umlActivitySchema = new mongoose.Schema(
  {
    workflowTitle: { type: String, default: "", trim: true },
    steps: {
      type: [
        {
          type: {
            type: String,
            enum: ["action", "decision"],
            default: "action",
          },
          label: { type: String, default: "", trim: true },
          condition: { type: String, default: "", trim: true },
          thenBranch: { type: String, default: "", trim: true },
          elseBranch: { type: String, default: "", trim: true },
        },
      ],
      default: [],
    },
    transitions: {
      type: [
        {
          from: { type: String, trim: true },
          to: { type: String, trim: true },
          label: { type: String, default: "", trim: true },
        },
      ],
      default: [],
    },
  },
  { _id: false }
);

const umlPreparationSchema = new mongoose.Schema(
  {
    classes: { type: [umlClassSchema], default: [] },
    relationships: { type: [umlRelationshipSchema], default: [] },
    useCase: { type: umlUseCaseSchema, default: () => ({}) },
    sequence: { type: umlSequenceSchema, default: () => ({}) },
    activity: { type: umlActivitySchema, default: () => ({}) },
  },
  { _id: false }
);

const reportSectionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    collapsed: { type: Boolean, default: false },
  },
  { _id: false }
);

reportSectionSchema.add({
  children: { type: [reportSectionSchema], default: [] },
});

const reportChapterSchema = new mongoose.Schema(
  {
    sectionId: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    contentHtml: { type: String, default: "" },
    contentMarkdown: { type: String, default: "" },
    contentLatex: { type: String, default: "" },
    status: {
      type: String,
      enum: ["not-started", "in-progress", "completed"],
      default: "not-started",
    },
    generatedFrom: { type: [String], default: [] },
    sourceFingerprint: { type: String, default: "" },
    language: { type: String },
    lastModified: { type: Date, default: Date.now },
  },
  { _id: true }
);

const presentationSlideSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    bullets: { type: [String], default: [] },
    notes: { type: String, default: "" },
    language: { type: String },
  },
  { _id: false }
);

const pitchSlideSchema = new mongoose.Schema(
  {
    slideId: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    estimatedSeconds: { type: Number, default: 60, min: 0 },
    speech: { type: String, default: "" },
    tips: { type: [String], default: [] },
    language: { type: String },
  },
  { _id: false }
);

const jurySimulationSectionFeedbackSchema = new mongoose.Schema(
  {
    slideNumber: { type: Number, default: 0 },
    slideTitle: { type: String, default: "", trim: true },
    strengths: { type: [String], default: [] },
    improvements: { type: [String], default: [] },
    observations: { type: [String], default: [] },
  },
  { _id: false }
);

const jurySimulationAttemptSchema = new mongoose.Schema(
  {
    attemptNumber: { type: Number, required: true, min: 1 },
    presentationVersion: { type: Number, required: true, min: 0 },
    pitchVersion: { type: Number, required: true, min: 0 },
    targetSeconds: { type: Number, required: true, min: 0 },
    actualSeconds: { type: Number, required: true, min: 0 },
    audio: {
      mimeType: { type: String, default: "", trim: true },
      sizeBytes: { type: Number, default: 0, min: 0 },
    },
    objectiveMetrics: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    analysis: {
      overallScore: { type: Number, default: 0, min: 0, max: 100 },
      overallLabel: { type: String, default: "", trim: true },
      categoryScores: {
        delivery: { type: Number, default: 0, min: 0, max: 100 },
        clarity: { type: Number, default: 0, min: 0, max: 100 },
        content: { type: Number, default: 0, min: 0, max: 100 },
        timing: { type: Number, default: 0, min: 0, max: 100 },
        structure: { type: Number, default: 0, min: 0, max: 100 },
      },
      timing: {
        targetSeconds: { type: Number, default: 0, min: 0 },
        actualSeconds: { type: Number, default: 0, min: 0 },
        differenceSeconds: { type: Number, default: 0 },
        assessment: { type: String, default: "", trim: true },
      },
      fillerWords: {
        total: { type: Number, default: 0, min: 0 },
        mostFrequent: { type: [String], default: [] },
        examples: { type: [String], default: [] },
      },
      strengths: { type: [String], default: [] },
      improvements: { type: [String], default: [] },
      sectionFeedback: { type: [jurySimulationSectionFeedbackSchema], default: [] },
      actionPlan: { type: [String], default: [] },
    },
    status: {
      type: String,
      enum: ["completed", "failed"],
      default: "completed",
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const projectSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    basics: {
      title: { type: String, required: true },
      type: { type: String },
      domain: { type: String, required: true },
      language: { type: String },
      academicYear: { type: String },
      university: { type: String },
    },
    description: {
      problemStatement: { type: String, required: true },
      problemStatementLanguage: { type: String },
      objective: { type: String, required: true },
      detailedDescription: { type: String },
      deliverables: { type: [String] },
      company: { type: String },
      industry: { type: String },
      stakeholders: { type: [String] },
    },
    technicalContext: {
      developmentTypes: { type: [String] },
      otherDevelopmentType: { type: String },
      methodology: { type: String },
      technologies: { type: [String] },
      otherTechnologies: { type: String },
      targetUsers: { type: [String] },
      complexity: { type: String },
      teamSize: { type: Number },
      duration: { type: Number },
    },
    actors: {
      type: [actorSchema],
      default: [],
    },
    actorsLanguage: { type: String },
    existingSolutions: {
      type: [existingSolutionSchema],
      default: [],
    },
    existingSolutionsLanguage: { type: String },
    functionalRequirements: {
      type: [functionalRequirementSchema],
      default: [],
    },
    functionalRequirementsLanguage: { type: String },
    nonFunctionalRequirements: {
      type: [nonFunctionalRequirementSchema],
      default: [],
    },
    nonFunctionalRequirementsLanguage: { type: String },
    productBacklog: {
      type: [productBacklogItemSchema],
      default: [],
    },
    productBacklogLanguage: { type: String },
    umlPreparation: {
      type: umlPreparationSchema,
      default: () => ({}),
    },
    umlPreparationLanguage: { type: String },
    reportStructure: {
      type: [reportSectionSchema],
      default: [],
    },
    reportStructureLanguage: { type: String },
    reportChapters: {
      type: [reportChapterSchema],
      default: [],
    },
    finalReport: {
      contentHtml: { type: String, default: "" },
      contentMarkdown: { type: String, default: "" },
      contentLatex: { type: String, default: "" },
      generatedAt: { type: Date },
      sourceFingerprint: { type: String, default: "" },
    },
    presentation: {
      durationMinutes: { type: Number, enum: [5, 10, 15, 20], default: 10 },
      slides: { type: [presentationSlideSchema], default: [] },
      sourceFingerprint: { type: String, default: "" },
      version: { type: Number, default: 0, min: 0 },
      updatedAt: { type: Date },
    },
    pitch: {
      durationMinutes: { type: Number, enum: [5, 10, 15, 20], default: 10 },
      slides: { type: [pitchSlideSchema], default: [] },
      sourceFingerprint: { type: String, default: "" },
      version: { type: Number, default: 0, min: 0 },
      updatedAt: { type: Date },
    },
    jurySimulation: {
      attempts: { type: [jurySimulationAttemptSchema], default: [] },
    },
  },
  { timestamps: true }
);

const Project = mongoose.model("Project", projectSchema);

module.exports = Project;
