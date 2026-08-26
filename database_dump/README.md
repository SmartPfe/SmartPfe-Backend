# SmartPFE — Database Restore Guide

This folder contains the complete, compressed database dump for **SmartPFE** (`smartpfe_dump.json.gz`), including all collections:
- `users`
- `projects`
- `pfe_chunks` (RAG vector dataset)
- `pfe_structures` & `pfe_documents` (thesis structure datasets)
- `notifications`

---

## 🚀 How to Restore the Database

You can restore everything into your MongoDB instance with **a single command**.

### Option 1: Restore to Local MongoDB (Default)

If you are running MongoDB locally on `mongodb://localhost:27017/pfe` (or standard Docker MongoDB):

```bash
# Inside the SmartPfe-Backend directory:
node database_dump/restore_db.js
```

---

### Option 2: Restore to a Custom MongoDB URI / Server

Pass your connection string directly as an argument:

```bash
# Example for a custom local/remote URI:
node database_dump/restore_db.js "mongodb://localhost:27017/my_database"

# Example for your own MongoDB Atlas cluster:
node database_dump/restore_db.js "mongodb+srv://<user>:<password>@<cluster>.mongodb.net/smartpfe"
```

---

## ⚙️ Backend Configuration

After restoring, update the `MONGO_URI` in your backend `.env` file to point to your new database:

```env
MONGO_URI=mongodb://localhost:27017/pfe
```

Then start the backend:
```bash
npm install
npm run dev
```

Everything will work immediately (including RAG, project modules, AI prompts, and user sessions).
