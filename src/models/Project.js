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
  },
  { timestamps: true }
);

const Project = mongoose.model("Project", projectSchema);

module.exports = Project;
