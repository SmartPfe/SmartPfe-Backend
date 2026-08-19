/**
 * Backwards-compatibility bridge for openRouterService.
 * All AI traffic has migrated seamlessly to Google Gemini via geminiService.js.
 */
const geminiService = require("./geminiService");

module.exports = geminiService;
