## Vyro Employee Dashboard (Next.js)

Single Next.js 14 application that renders the React dashboard and serves secure API routes that talk to Google BigQuery. Run one command (`npm run dev`) and you get:

- `/` — Employee list + detail panel (live from `EmployeeData_v2`)
- `/api/employees` — Filterable list endpoint
- `/api/employees/[id]` — Employee detail endpoint
- `/api/employees/[id]/status` — PATCH endpoint for status changes (records audit trail)

### 1. Prerequisites

- Node.js 20+
- Google service-account JSON with access to BigQuery dataset `Vyro_Business_Paradox`

### 2. Environment Variables

Copy `.env.local.example` → `.env.local` and update paths or IDs if needed:

```
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
GCP_PROJECT_ID=test-imagine-web
BQ_DATASET=Vyro_Business_Paradox
BQ_TABLE=Employees
BQ_AUDIT_TABLE=EmployeeChangeLog
```

> The default `.env.local` already points to `Credentials/test-imagine-web-18d4f9a43aef.json`.

### 3. Install & Run

```bash
npm install
npm run dev
```

Open http://localhost:3000 — you’ll see the dashboard with search, filters, and status updates. All timestamps are displayed in Pakistan Time (GMT+5).

### 4. Deployment

- **Vercel / Next.js**: add the env vars above and upload the service-account JSON as an encrypted env var or secret file.
- **Google Cloud Run**: build with `npm run build && npm run start`, mount the credential file, and ensure outbound access to BigQuery.

### 5. Tech Stack

- Next.js 16 (App Router, TypeScript, Tailwind v4)
- React Query for client caching
- BigQuery SDK for server-side data access
- Axios for client → API communication

### 6. Useful Scripts

| Script          | Description                       |
| --------------- | --------------------------------- |
| `npm run dev`   | Start Next.js dev server (UI+API) |
| `npm run lint`  | Run ESLint (Next.js rules)        |
| `npm run build` | Production build                  |
| `npm run start` | Run built app                     |
