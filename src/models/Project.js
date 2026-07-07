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
  },
  { _id: false }
);

const umlSequenceSchema = new mongoose.Schema(
  {
    participants: { type: [String], default: [] },
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
  { _id: false }
);

const umlActivitySchema = new mongoose.Schema(
  {
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
    existingSolutions: {
      type: [existingSolutionSchema],
      default: [],
    },
    functionalRequirements: {
      type: [functionalRequirementSchema],
      default: [],
    },
    nonFunctionalRequirements: {
      type: [nonFunctionalRequirementSchema],
      default: [],
    },
    umlPreparation: {
      type: umlPreparationSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

const Project = mongoose.model("Project", projectSchema);

module.exports = Project;
