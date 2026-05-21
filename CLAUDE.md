# CLAUDE.md — Rules for Claude Code

Read this file before every session. These rules are non-negotiable.
When in doubt, ask. Never assume.

---

## 1. Work Discipline

- **One task at a time.** Build one page or one component per session unless explicitly told otherwise.
- **Ask before starting** if the task is ambiguous. A 10-second clarification beats 10 minutes of wrong work.
- **No scope creep.** If you notice something adjacent that "could be improved," flag it — don't touch it.
- **Always confirm your plan** before writing code on any non-trivial task. Say what you're about to do, wait for a go-ahead.
- **Mock data only** until explicitly told to wire up real APIs. Never invent API calls or fetch from URLs that don't exist yet.

---

## 2. No Lazy Work — Fix at the Source

- **Never patch over a problem.** If something is broken or wrong, fix the root cause — not the symptom.
- **No workarounds, no `// TODO: fix later`, no `any` types as a shortcut.**
- **No commented-out code** left behind. If it's not needed, delete it.
- **No duplicate logic.** If something exists already, reuse it. Don't copy-paste and modify.
- **No hardcoded magic numbers or strings** outside of the mock data files. Use constants.
- If a fix requires changing a shared component, change the component — not every call site individually.

---

## 3. Code Quality

- **TypeScript strictly.** No `any`. Define proper types and interfaces for everything, especially API response shapes and props.
- **Component size:** If a component exceeds ~150 lines, it's doing too much. Split it.
- **Naming:** Be explicit. `SensorCard` not `Card2`. `useAlertThresholds` not `useData`.
- **File structure:** Follow Next.js App Router conventions.
  - Pages → `/app/`
  - Reusable components → `/components/`
  - Types → `/types/`
  - Constants and mock data → `/lib/`
  - Hooks → `/hooks/`
- **No inline styles.** Use Tailwind classes only.
- **Prefer shadcn/ui components** over building custom ones from scratch. Check if a shadcn component exists before writing one.

---

## 4. Dependencies

- **Do not install new packages without asking first.** State the package name and why it's needed.
- **Prefer what's already installed.** Solve problems with Next.js, Tailwind, and shadcn/ui before reaching for a new library.
- **No alpha or unmaintained packages.**

---

## 5. Authentication & Authorization (Read Carefully)

Authentication and authorization must be considered from day one — not bolted on later.

### General Rules
- **Every route is protected by default.** No page should be accessible without a valid session unless it is explicitly a public page (e.g. login).
- **Never trust the client.** Authorization checks happen server-side. Client-side UI hiding is cosmetic only, not security.
- **Never expose sensitive data in client components** — keep secrets, tokens, and credentials server-side only.
- **No hardcoded credentials** anywhere — not even in mock/dev mode.

### senso.com (Customer Site)
- Customers are scoped to their own account only. A logged-in customer must **never** be able to see or access another customer's sensors, readings, alerts, or reports.
- All data queries must be scoped by the authenticated user's `customerId`.
- When building UI with mock data, structure the mock to simulate this scoping (e.g. mock data belongs to `customer_001` — don't mix customers in a single mock).

### senso.admin.com (Admin Site)
- Admin routes are completely separate from customer routes. No shared session or auth context between the two sites.
- Admin access must require an explicit admin role check — not just "is logged in."
- Admins can view and edit all customer data, but this must be intentional and logged (design for auditability).

### When Building Auth Flows (When We Get There)
- Use httpOnly cookies for session tokens — never localStorage.
- Short-lived access tokens + refresh token pattern.
- Log out must fully invalidate the session server-side, not just clear the cookie client-side.
- Implement CSRF protection on all mutating routes.

---

## 6. Full-Stack Security Checklist

Keep these in mind for every layer as the project grows:

### Frontend
- Sanitize all user input before display — never render raw HTML from user data.
- No sensitive data (tokens, keys, customer IDs) in URL query params.
- Environment variables that must stay server-side use `SERVER_` prefix (or never prefix with `NEXT_PUBLIC_`).

### APIs & Backend Logic
- Validate and sanitize all inputs server-side — never trust the frontend.
- Return generic error messages to the client; log detailed errors server-side only.
- Use allowlists, not blocklists, for input validation.
- All API routes check authentication and authorization before doing anything else.

### Database & Storage
- Never expose raw database errors to the client.
- Use parameterized queries / ORM — never string-concatenated SQL.
- Apply Row-Level Security (RLS) if using Supabase or similar.
- Principle of least privilege: the app's DB user should only have the permissions it needs.

### Auth & Permissions
- Covered in Section 5 above.
- Revisit this every time a new role, route, or data relationship is added.

### Hosting & Deployment
- Never commit `.env` files. Use `.env.example` with placeholder values only.
- Production environment variables are set in the hosting platform — not in the repo.
- All traffic over HTTPS. No HTTP fallback.

### CI/CD & Version Control
- No secrets in git history — ever. If one leaks, treat it as compromised immediately.
- Use `.gitignore` properly from day one.

### Security & Rate Limiting
- Sensitive endpoints (login, password reset, report generation) must have rate limiting when implemented.
- Admin endpoints must have stricter limits than customer endpoints.

### Error Tracking & Logs
- Design components and API routes with logging in mind from the start.
- Errors should always be caught and handled — no unhandled promise rejections.
- Don't log personally identifiable information (PII) in plaintext.

### Caching
- Don't cache authenticated or user-specific responses at the CDN level without careful cache-key scoping.
- When in doubt, don't cache sensitive data.

---

## 7. UI & Design Rules

- Keep it **clean and utilitarian.** This is a monitoring tool used by operations staff — not a consumer app.
- **Clarity over decoration.** Temperature readings, sensor status, and alerts must be immediately readable.
- **Sensor status** (online/offline) and **out-of-range temperatures** must be visually obvious at a glance — use color and iconography, not just text.
- **Print-friendly styles** are required for the Monitoring Report page. Use `@media print` rules.
- Responsive design is required, but **desktop is the primary target.**
- Use consistent spacing, sizing, and color tokens via Tailwind config — don't invent one-off values.

---

## 8. Communication Rules

- If you are unsure about anything, **stop and ask** before proceeding.
- After completing a task, give a brief summary: what you built, what decisions you made, and what should be reviewed.
- If you see a potential problem outside your current task, **flag it in a comment** — don't fix it without being asked.
- Never say "this is fine for now" and move on. If something isn't right, say so.

---

## 9. What's Out of Scope (Do Not Build)

Do not build any of the following unless explicitly instructed:

- Payment processing or automated billing
- SMS or push notifications
- Mobile app or native code
- Multi-location support per customer
- Additional sensor types beyond temperature
- Customer self-signup flows
- A separate technician login or role
- Any AI/ML features

---

## Project Reference

See `SENSO.md` for full project context: business model, site architecture, data model, page list, and vocabulary.
