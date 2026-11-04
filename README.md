# FAW-AI — Faculty AI Workload Assistant

FAW-AI is an intelligent academic productivity and administrative coordination workspace designed specifically for higher education faculty and institutional administrators.

---

## 1. System Architecture

FAW-AI is built with a modern, production-grade technology stack:

- **Frontend & App Framework:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide Icons.
- **Backend & Database:** Supabase (PostgreSQL with Row Level Security, SSR Cookie-based Session Handling, and Storage).
- **AI Processing:** Google Gemini API (`gemini-3.5-flash`), operating strictly on legitimate Google AI Studio free tiers with zero paid fallbacks.
- **Deployment Target:** Vercel (Next.js standalone runtime).

---

## 2. Portals & Capabilities

### Faculty Portal
1. **Faculty Dashboard (`/dashboard`):** Real-time overview of active courses, uploaded documents, enrolled students, and recent AI-generated curriculum assets.
2. **Course Management (`/courses`):** Create, update, search, and delete academic courses. Attach reference syllabi and lecture materials.
3. **Document Management:** Securely upload reference materials (PDF, Word DOCX, Plain Text) to private Supabase Storage (`academic-documents`), with signed download URLs and deletion controls.
4. **AI Lesson Planner (`/lesson-planner`):** Input subject, topic, teaching level, duration, and learning objectives to generate structured lesson timelines, activity phases, materials, and formative assessments. Save to database or export as Markdown.
5. **Question Studio (`/question-studio`):** Generate syllabus-aligned examination question banks (MCQ, Short-Answer, Long-Essay, True/False) with collapsible answer keys and grading rubrics. Export as formatted exam papers.
6. **Student Analytics (`/analytics`):** Organise course rosters, record assessment marks, and compute genuine class performance metrics (Average, Median, Score Range, Pass Rate, and Grade Distribution). Zero fake data.
7. **AI Faculty Assistant (`/assistant`):** Interactive conversational assistant with course context injection and conversation history persisted in Supabase.

### Administrator Portal (`/admin`)
1. **Institutional Overview:** Monitor total faculty accounts, active courses, system activity logs, and token consumption.
2. **Faculty Account Management:** Provision new faculty accounts, activate or deactivate existing accounts, and assign roles (`FACULTY` vs. `ADMIN`).
3. **Institutional Course Catalog:** Centralised visibility over all courses offered across faculty departments.
4. **AI & Activity Audit:** Inspect real-time execution logs, model details, token consumption, and administrative events.

---

## 3. Getting Started Locally

### Prerequisites
- Node.js 20.9 or newer
- npm

### Installation
1. Clone or navigate to the project directory:
   ```bash
   cd X:\FAW-AI
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Environment Variables:
   Create or edit `.env.local`:
   ```env
   # Supabase Project Configuration
   NEXT_PUBLIC_SUPABASE_URL=https://rltvgdcwmgwikoukdjxq.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key_here
   SUPABASE_SECRET_KEY=your_supabase_secret_key_here

   # Google AI Studio (Gemini Free Tier)
   GEMINI_API_KEY=your_primary_gemini_api_key
   GEMINI_API_KEY_SECONDARY=your_secondary_gemini_api_key
   GEMINI_MODEL=gemini-3.5-flash

   # Application URL
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 4. Supabase Database Configuration

The application schema is organized into versioned migrations located in `supabase/migrations/`:

1. **`001_initial_schema.sql`:** Creates baseline tables (`profiles`, `courses`, `academic_documents`, `agent_conversations`, `agent_messages`, `agent_tasks`, `generated_documents`, `ai_usage_logs`, `activity_logs`).
2. **`002_enhanced_schema.sql`:**
   - Adds the `handle_new_user` trigger on `auth.users` for automatic profile creation.
   - Enforces role validation (`faculty`, `professor`, `admin`).
   - Defines security definer functions `is_admin()` and `is_faculty()`.
   - Adds Administrator RLS policies for institutional oversight.
   - Creates the Student Analytics tables (`students`, `student_assessments`, `student_scores`).
   - Configures private bucket RLS policies for `academic-documents`.
3. **`003_admin_bootstrap.sql`:** Contains the one-time SQL query to assign the `admin` role to your administrator email address after signing up.

### Steps to Apply in Supabase Dashboard
1. Log in to [https://supabase.com/dashboard](https://supabase.com/dashboard) and select your project (`rltvgdcwmgwikoukdjxq`).
2. Navigate to **SQL Editor**.
3. If not already applied, run `001_initial_schema.sql`.
4. Run `002_enhanced_schema.sql`.
5. Under **Storage**, ensure the `academic-documents` bucket is created and marked as **Private**.

---

## 5. Bootstrapping Your First Administrator

1. Open the application at [http://localhost:3000/login](http://localhost:3000/login).
2. Switch to **Faculty Portal** tab and click **New faculty member? Register account**.
3. Sign up with your administrator email (e.g., `admin@institution.edu`) and password.
4. Go to your Supabase Dashboard → **SQL Editor** and execute:
   ```sql
   update public.profiles
   set role = 'admin', is_active = true
   where id in (
     select id from auth.users where lower(email) = lower('admin@institution.edu')
   );
   ```
5. Return to `/login`, select the **Administrator Portal** tab, and sign in. You will now have full access to `/admin`.

---

## 6. Verification & Quality Gates

Run the production build and linting to verify code integrity:

```bash
# Typecheck and ESLint
npm run lint

# Production Next.js Build
npm run build
```

---

## 7. Vercel Deployment Instructions

1. Push this repository to your GitHub account (or import via Vercel CLI).
2. In the Vercel Project Dashboard, add the following Environment Variables under **Project Settings → Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`: `https://rltvgdcwmgwikoukdjxq.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: *(Your Supabase publishable key)*
   - `SUPABASE_SECRET_KEY`: *(Your Supabase rotated secret key for server tasks)*
   - `GEMINI_API_KEY`: *(Your Google AI Studio Gemini API key)*
   - `GEMINI_API_KEY_SECONDARY`: *(Your secondary Google AI Studio key)*
   - `GEMINI_MODEL`: `gemini-3.5-flash`
   - `NEXT_PUBLIC_APP_URL`: `https://your-deployment-name.vercel.app`
3. Click **Deploy**.
