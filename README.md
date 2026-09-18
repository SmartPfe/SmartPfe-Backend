# SmartPFE — Backend

Express + MongoDB + Gemini AI backend for the SmartPFE platform.

---

## Prerequisites

- **Node.js** ≥ 18 (v20+ recommended)
- **MongoDB** — local instance or Atlas cluster

---

## Quick Start

```bash
# 1. Clone & enter the project
git clone https://github.com/ahmedneffati/PFEGuidanceBack.git
cd PfeMentor-back/SmartPfe-Backend

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Then open .env and fill in your values (see below)

# 4. Restore the database (includes RAG dataset + sample data)
node database_dump/restore_db.js

# 5. Start the dev server
npm run dev
```

The server starts on **http://localhost:5000** by default.

---

## Environment Variables (`.env`)

Copy `.env.example` → `.env` and fill in your values:

```env
PORT=5000

# MongoDB — local or Atlas
MONGO_URI=mongodb://localhost:27017/pfe

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
TRUST_PROXY=1

# Email (Nodemailer via Gmail)
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_16_char_app_password
EMAIL_FROM=your_email@gmail.com

# Google OAuth
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com

# Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Optional credit-mode override; leave blank for admin-managed mode
CREDITS_ENFORCEMENT_MODE=
```

> **Gmail App Password**: Enable 2FA on your Google account, then generate one at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).

---

## Database Restore

A full database dump is included at `database_dump/smartpfe_dump.json.gz`.

```bash
# Restore to local MongoDB (default: mongodb://localhost:27017/pfe)
node database_dump/restore_db.js

# Restore to a custom URI
node database_dump/restore_db.js "mongodb+srv://user:pass@cluster.mongodb.net/pfe"
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with nodemon (auto-reload) |
| `npm start` | Start production server |
| `npm run evaluate:rag` | Run RAG evaluation pipeline |
| `npm run evaluate:sections` | Run section benchmark |

---

## API Routes

| Base Path | Description |
|-----------|-------------|
| `/api/auth` | Authentication (register, login, Google OAuth, password reset) |
| `/api/projects` | Project CRUD and all PFE module data |
| `/api/ai` | AI generation, refinement, translation for all modules |
| `/api/notifications` | Notifications + SSE stream |
| `/api/admin` | Admin dashboard and management |
| `/api/credits` | Student wallet, pricing catalog, and transaction history |

### Credit economy

Credit policies and wallet defaults are seeded automatically on startup, then managed from **Admin → Credit Economy**. AI routes reserve credits before calling Gemini, settle only on success, and refund failed or disconnected requests. Use `shadow` during a staged rollout to record usage without reducing balances.

---

## Related

- **Frontend**: [SmartPfe-Front](https://github.com/your-username/PfeMentor-front)
