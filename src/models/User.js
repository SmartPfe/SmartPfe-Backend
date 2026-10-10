const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { passwordPolicyError } = require("../lib/passwordPolicy");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email address",
      ],
    },
    password: {
      type: String,
      required: function() {
        return !this.googleId;
      },
      validate: { validator: function(value) { return !value || !this.isModified("password") || !passwordPolicyError(value); }, message: "Password must contain at least 15 characters and at most 72 UTF-8 bytes." },
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    googleProfile: {
      fullName: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
    },
    avatar: {
      type: String,
    },
    resetToken: {
      type: String,
    },

    resetTokenExpiry: {
      type: Date,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationCodeHash: {
      type: String,
    },
    emailVerificationCodeExpiry: {
      type: Date,
    },
    hasCompletedOnboarding: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ["admin", "etudiant"],
      default: "etudiant",
    },
    sessionVersion: { type: String, default: "0" },
    uiLanguage: {
      type: String,
      enum: ["en", "fr"],
      default: "fr",
    },
  },
  { timestamps: true }
);

// Encrypt password using bcrypt before saving
userSchema.pre("save", async function () {
  // Only hash the password if it has been modified (or is new)
  if (!this.password || !this.isModified("password")) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare entered password with hashed password in DB
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);

module.exports = User;
