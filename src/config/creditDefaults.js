const DEFAULT_CREDIT_SETTINGS = Object.freeze({
  key: "default",
  welcomeCredits: 105,
  dailyPromotionalRefill: 20,
  timezone: "Africa/Tunis",
  enforcementMode: "enforce",
});

const DEFAULT_CREDIT_POLICIES = Object.freeze([
  { key: "problem_statement", label: "Problem Statement", group: "Foundation", cost: 5 },
  { key: "actors", label: "Actors & Stakeholders", group: "Foundation", cost: 5 },
  { key: "existing_solutions", label: "Existing Solutions", group: "Foundation", cost: 5 },
  { key: "functional_requirements", label: "Functional Requirements", group: "Foundation", cost: 5 },
  { key: "nonfunctional_requirements", label: "Non-Functional Requirements", group: "Foundation", cost: 5 },
  { key: "product_backlog", label: "Product Backlog", group: "Foundation", cost: 5 },
  { key: "uml_preparation", label: "UML Architecture", group: "Foundation", cost: 5 },
  { key: "report_structure", label: "Report Structure", group: "Academic Delivery", cost: 12 },
  { key: "report_section", label: "Report Section", group: "Report Builder", cost: 10 },
  {
    key: "report_polish_light",
    label: "Quick Polish",
    group: "Report Builder",
    cost: 0,
    perMinuteLimit: 5,
    dailyLimit: 20,
  },
  {
    key: "report_polish_contextual",
    label: "Contextual Report Polish",
    group: "Report Builder",
    cost: 2,
    freeUsesPerDay: 2,
    perMinuteLimit: 4,
    dailyLimit: 20,
  },
  {
    key: "final_report_compile",
    label: "Complete Report Compilation",
    group: "Report Builder",
    cost: 0,
    perMinuteLimit: 1,
    dailyLimit: 2,
  },
  { key: "presentation_full", label: "Presentation Deck", group: "Defense", cost: 8 },
  { key: "presentation_slide", label: "Presentation Slide", group: "Defense", cost: 2 },
  { key: "pitch_full", label: "Pitch Speech", group: "Defense", cost: 6 },
  { key: "pitch_slide", label: "Pitch Slide", group: "Defense", cost: 2 },
  { key: "jury_simulation", label: "Jury Simulation", group: "Defense", cost: 20, perMinuteLimit: 2 },
  { key: "jury_qa_session", label: "Jury Q&A Session", group: "Defense", cost: 10, perMinuteLimit: 2 },
  {
    key: "jury_qa_included",
    label: "Included Jury Q&A Steps",
    group: "Defense",
    cost: 0,
    perMinuteLimit: 3,
    dailyLimit: 20,
    editable: false,
  },
  {
    key: "translation",
    label: "Translation",
    group: "Free Tools",
    cost: 0,
    perMinuteLimit: 5,
    dailyLimit: 30,
  },
]);

const POLICY_BY_KEY = Object.freeze(
  Object.fromEntries(DEFAULT_CREDIT_POLICIES.map((policy, index) => [
    policy.key,
    {
      enabled: true,
      editable: true,
      freeUsesPerDay: 0,
      perMinuteLimit: 10,
      dailyLimit: 0,
      sortOrder: index,
      ...policy,
    },
  ]))
);

module.exports = {
  DEFAULT_CREDIT_SETTINGS,
  DEFAULT_CREDIT_POLICIES,
  POLICY_BY_KEY,
};
