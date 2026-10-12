# ITV Academy — LMS & AI Course Generation Platform

**End-to-end specification · v0.1 (Demo) · 2026-10-12**

> Working name: **ITV Academy**. Inspired by iSpring Suite / iSpring Cloud, but web-native and AI-first: courses, slides, quizzes and certificates are generated per candidate from their **ADA score** and delivered in one learner dashboard, with SCORM interoperability.

---

## 0. TL;DR

| | |
|---|---|
| **What** | Web LMS with two sides: **Studio** (trainers create and AI-generate content) and **Learner Portal** (candidates watch, read, take quizzes and get certified). |
| **Demo goal** | One unbroken live flow: *pick a candidate → AI generates a personalized course (outline, slides, Gamma deck, quiz) → candidate studies, asks the AI tutor, passes the quiz → certificate issued → SCORM package exported.* |
| **Stack** | Next.js (App Router) on Vercel · Supabase (Postgres, Auth, Storage, pgvector) · Vercel AI SDK + AI Gateway (LLM) · Gamma Pro API (decks + PPTX/PDF export) · scorm-again (SCORM runtime) |
| **Out of scope for demo** | Payments, multi-tenant orgs, SSO, xAPI/LRS, mobile apps, video generation. |

---

## 1. Context & goals

### 1.1 Problem
Today, building courses in iSpring is a desktop, manual, PowerPoint-centered process. Every candidate gets the same content no matter what level they are at. Tracking is split between SCORM exports and whatever LMS hosts them.

### 1.2 Goals
1. **Personalization:** generate content (slides, reading material, quiz, difficulty) adapted to each candidate's **ADA score**.
2. **One place to learn:** the candidate logs in and finds everything assigned to them: slides, video, reading, quizzes, certificates and progress.
3. **Fast authoring:** a trainer goes from topic to complete course in under 5 minutes using "Crea con IA". Manual editing is always possible.
4. **Interoperability:** import SCORM packages (for example existing iSpring exports) and export our courses as SCORM 1.2 / 2004.
5. **Certification:** the system automatically issues verifiable certificates when a candidate passes.

### 1.3 Success criteria for the demo
- [ ] The full flow in §14 runs live in **< 10 minutes** with no manual DB edits.
- [ ] The AI generation of one course (outline, slides and quiz) completes in **< 90 s**. The Gamma deck may finish asynchronously, within 3 minutes.
- [ ] A generated SCORM zip uploads to SCORM Cloud (or our own player) and reports completion and score.
- [ ] Opening the certificate's QR/URL shows a public verification page.

---

## 2. Personas & roles

| Role | Who | Can |
|---|---|---|
| **Admin** (Amministratore) | ITV staff | Everything, plus team management, LLM/Gamma budgets and settings |
| **Author** (Autore) | Course authors / trainers | Create/edit/generate courses, quizzes and interactions; assign to candidates; see analytics |
| **Reviewer** (Revisore) | Subject experts, clients | Read-only on drafts, can comment and approve/reject before publish. Cannot edit |
| **Candidate** (Discente / Membro) | Learners | See assigned content, study, ask the AI tutor, take quizzes, download certificates, maintain a Portfolio |
| **Public** | Anyone | Verify a certificate by ID; view a Portfolio if the candidate made it public |

Mirrors the iSpring Cloud **Team** page (Autori / Revisori / Amministratori / Membri): the Admin → Team screen shows the same four counters with seat limits, search by name/email, and an *Invita un membro* button. Seat limits are config values (`MAX_AUTHORS`, `MAX_REVIEWERS`); the demo uses 3 / 5 / unlimited.

---

## 3. The ADA score → personalization model

> ⚠️ **Assumption to confirm:** "ADA score" is an existing per-candidate assessment score that we receive (manual entry or CSV/API import). Until the real definition arrives, we model it as an overall score of **0–100**, with optional per-skill sub-scores.

### 3.1 Data
```ts
type AdaProfile = {
  candidateId: string
  overall: number                     // 0–100
  dimensions?: Record<string, number> // e.g. { "excel": 42, "communication": 78 }
  assessedAt: string
  source: "manual" | "csv" | "api"
}
```

### 3.2 Banding (configurable in Admin → Settings)
| Band | Score | Content depth | Slides | Quiz difficulty | Quiz length | Pass mark |
|---|---|---|---|---|---|---|
| **Foundation** | 0–39 | Basics, many examples, simple language | 12–15 | 70% easy / 30% medium | 10 | 60% |
| **Intermediate** | 40–69 | Concepts + practice | 10–12 | 30 / 50 / 20 (easy/med/hard) | 12 | 70% |
| **Advanced** | 70–100 | Advanced topics, case studies, skips basics | 8–10 | 10 / 40 / 50 | 15 | 80% |

When per-skill **dimensions** exist, the generator puts extra modules on the weakest 2 dimensions. These are added to the prompt as `focusAreas`.

### 3.3 Where it is used
- The course generation prompt (§6.2) for depth, tone, examples and focus areas.
- The quiz generator for its difficulty mix and pass mark.
- The AI tutor system prompt, which explains at the candidate's level.
- The dashboard's "Recommended for you" section.

---

## 4. Information architecture (iSpring-inspired)

Left rail navigation, as in the iSpring "Inizio rapido" screen:

```
┌──────┬──────────────────────────────────────────────────────────┐
│ 👤   │  STUDIO (trainer)                                        │
│ Nuovo│  Creare corsi                                            │
│Recenti│  ┌─────────────────────────┐ ┌─────────────────────────┐│
│Libreria│ │ Corso a diapositive     │ │ Corso scorrevole        ││
│Candidati││ [Crea manualmente][✨IA] │ │ [Crea manualmente][✨IA] ││
│Analytics│└─────────────────────────┘ └─────────────────────────┘│
│ SCORM │  Creare contenuti formativi                              │
│ ⚙️    │  [Quiz/Sondaggio] [Interazione] [Simulazione dialogo]    │
└──────┴──────────────────────────────────────────────────────────┘
```

### 4.1 Studio (trainer/admin), `/studio/*`
| Section | Route | iSpring equivalent |
|---|---|---|
| New (Quick start) | `/studio` | Inizio rapido |
| Recent | `/studio/recent` | Recenti |
| Library (content table) | `/studio/library` | iSpring Cloud content list |
| Team | `/studio/team` | iSpring Cloud → Team |
| Slide course editor | `/studio/courses/[id]/slides` | iSpring Suite (PPT) |
| Scrolling course editor | `/studio/courses/[id]/scroll` | Corso scorrevole (Cloud) |
| Quiz / Survey builder | `/studio/quizzes/[id]` | QuizMaker |
| Interaction builder | `/studio/interactions/[id]` | Visuals |
| Dialogue simulation | `/studio/dialogues/[id]` | TalkMaster |
| Candidates (+ ADA) | `/studio/candidates` | — |
| Assignments | `/studio/assignments` | — |
| Analytics | `/studio/analytics` | iSpring Learn reports |
| SCORM import/export | `/studio/scorm` | Publish → SCORM |
| Settings / budgets | `/studio/settings` | — |

### 4.2 Learner portal (candidate), `/learn/*`
| Section | Route | Content |
|---|---|---|
| Dashboard | `/learn` | Progress ring, "Continue where you left off", assigned courses, upcoming deadlines, certificates, ADA band badge |
| My courses | `/learn/courses` | Grid with progress and status (not started / in progress / completed / certified) |
| Course player | `/learn/courses/[id]` | Slide viewer, scroll reader, video, and an AI tutor side panel |
| Quiz | `/learn/quizzes/[id]` | Timed attempt, then the results review |
| Certificates | `/learn/certificates` | List, PDF download, share link |
| Portfolio | `/learn/portfolio` | Candidate profile: experience, about me, skills, projects, earned certificates. Editable, shareable (§5.11) |
| Public verify | `/verify/[certId]` | Public, no auth |
| Public portfolio | `/p/[slug]` | Public, no auth, only if the candidate enabled sharing |

### 4.3 Library (content table)
Mirrors the iSpring Cloud content list: a folder/breadcrumb header (*Esempio di contenuto*), the **"+ Crea corso con IA"** (gradient outline) and **"+ Crea"** buttons, upload (SCORM / PPTX / PDF), and a table with checkbox, **Titolo ↑**, **Tipo**, **Creato da**, **Visualizzato / Modificato** and a column-settings gear. Row types and icons:

| Tipo | Icon | Maps to |
|---|---|---|
| Pagina | 📄 | Scrolling course |
| Presentazione con interazioni | ✳️ | Slide course (+ interactions) |
| Quiz | ✅ | Quiz / Survey |
| Simulazione di dialogo | 💬 | Dialogue simulation |
| Pacchetto SCORM | 📦 | Imported SCORM |

Bulk actions on selection: assign, move to folder, duplicate, export SCORM, archive. Sorting and a search box; folders are a simple `folders(id, parent_id, name)` tree.

---

## 5. Functional requirements

### 5.1 Authentication & users
- **FR-AUTH-1** Email magic link plus password via Supabase Auth. The role is stored in `profiles.role`.
- **FR-AUTH-2** An admin can invite candidates in bulk (CSV: `name,email,ada_overall,[dim_*]`). This creates the profile and the ADA record, and sends the invite.
- **FR-AUTH-3** Demo mode: a seeded "Login as demo candidate / demo trainer" button, enabled only when `DEMO_MODE=true`.

### 5.2 Course types
| Type | Structure | Rendering |
|---|---|---|
| **Slide course** | `course → modules → slides[]`. A slide holds layout, title, bullets, image, speaker notes, optional video/audio | Built-in slide player (16:9, keyboard nav, thumbnails, notes as transcript) **and** an optional embedded Gamma deck |
| **Scrolling course** | `course → sections → blocks[]` (text, image, callout, accordion, embedded quiz question, video) | Responsive single-page reader with a progress bar |
| **SCORM package** | Uploaded zip | iframe plus scorm-again runtime (§8) |

Every course has `status: draft | published | archived`, a version, a cover image, an estimated duration, tags and a language (`it` / `en`).

### 5.3 "Crea con IA": AI course generation
Input form:
- Topic / title (required)
- Target candidate(s) **or** target ADA band
- Source material (optional): paste text, upload PDF/DOCX/PPTX (≤ 10 MB), or a URL
- Course type: slide / scrolling
- Language, tone, duration target (15/30/60 min)
- Toggles: *Generate Gamma deck* · *Generate quiz* · *Issue certificate on pass*

Output: a **draft** course that the trainer reviews in the editor and then publishes. Every generated item can be regenerated or edited on its own: "↻ Regenerate slide" and "✨ Improve" with an instruction.

When a course is generated **per candidate**, a base course is generated once per ADA band and then cached. Only the personalization layer (focus areas, examples) is generated per candidate. This keeps LLM cost within limits (§10).

### 5.4 Content player
- **FR-PLAY-1** Slide viewer: prev/next, thumbnails, fullscreen, speaker-notes transcript, optional TTS narration (post-demo).
- **FR-PLAY-2** Video: MP4/HLS from Storage, or a YouTube/Vimeo embed. Progress counts at ≥ 90% watched.
- **FR-PLAY-3** Reading: markdown-rendered blocks; a section counts as read when scrolled through.
- **FR-PLAY-4** Gamma tab: an embedded Gamma deck URL, plus a "Download PPTX/PDF" button using the Gamma export.
- **FR-PLAY-5** Progress is saved every 10 s and on navigation, and resumes where the candidate left off.
- **FR-PLAY-6** Course completion = all required items completed, **and** the final quiz passed if there is one.

### 5.5 AI tutor ("Chiedi al tutor")
- A side panel in the player. The candidate asks questions about the course.
- **RAG**: course content is chunked → embeddings → `pgvector`. Answers cite the slide or section ("see Slide 7"), and clicking the citation jumps to it.
- The system prompt includes the ADA band, so explanations match the candidate's level.
- Guardrails: the tutor answers only about course scope. During an active quiz attempt it refuses to give answers (the tutor is disabled while a quiz is running).
- Rate limit: 30 messages per candidate per day (configurable).

### 5.6 Quiz / survey engine (QuizMaker-like)
Question types for the demo: **single choice, multiple choice, true/false, short text (exact/keywords), matching, ordering**. Survey mode (no scoring): Likert and free text.

| Setting | Default |
|---|---|
| Pass mark | from ADA band |
| Attempts | 3 |
| Time limit | none / N minutes |
| Shuffle questions & answers | on |
| Question pool | draw N from pool (per difficulty mix) |
| Feedback | per-question explanation shown after submission |
| Review | show correct answers after pass or after the last attempt |

**Quiz player look & feel** (reference: iSpring *"Come evitare i tranelli degli hacker"*):
- **Intro card:** full-bleed hero image (AI-generated via Gamma `generate_image` or uploaded), small accent-colored quiz name, big 2-line headline, one-sentence description, **INIZIA QUIZ ›** CTA bottom-right.
- **Question card:** same hero background; top-left *"Domanda 1 di 10"* in accent color; question stem in large white type; options in a 2-column grid with square checkboxes (multiple) or radios (single); optional right-side illustration per question (`questions.image_url`); **INVIA** CTA bottom-right.
- **Live score** top-right: *"Il tuo punteggio: 0 su 100"*, updated after each submitted question when `feedback_mode = immediate`, hidden when `feedback_mode = end`.
- **Per-question feedback** overlay after INVIA: correct/incorrect, explanation, "Continua".
- **Results card:** score ring, pass/fail, per-question review (if allowed), *Scarica certificato* when earned, *Riprova* when attempts remain.
- Theme: a per-quiz `theme` object (`accent`, `bg_image`, `dark: bool`). The default is dark-navy with magenta accent as in the reference; the Time Vision brand theme replaces it once branding arrives (§16 Q7).
- Full keyboard support: number keys select options, Enter submits.

- **FR-QUIZ-1** AI generation produces questions **with an explanation and a source slide reference** for each one. The trainer approves them.
- **FR-QUIZ-2** Scoring is **server-side only**. The client never receives the correct answers before submission.
- **FR-QUIZ-3** Every attempt is stored (answers, score, duration) and pushed to the SCORM CMI when running inside SCORM.
- **FR-QUIZ-4** Short-text answers may use LLM grading (rubric-based) behind a flag. The default is keyword match.

### 5.7 Interactions & dialogue simulation (Visuals / TalkMaster-like)
- **Interactions** (demo: 3 templates): tabs, accordion/timeline, hotspot image, all built as blocks inside scrolling courses.
- **Dialogue simulation:** a branching scenario graph (`node: {speaker, text, choices[{text, next, score}]}`). AI can generate a scenario from a brief, for example *"customer complaint, call center, ADA intermediate"*. It plays as a chat-style UI with a final score.
- Demo priority: interactions = **P2**, dialogue simulation = **P2** (nice to have; see §15).

### 5.8 Certificates
- Issued automatically when a course is completed and the quiz passed (if `issue_certificate=true`).
- A PDF is generated server-side (`@react-pdf/renderer`). It contains the candidate name, course, date, score, a unique ID (`ITV-2026-XXXXXX`) and a **QR code pointing to `/verify/[id]`**.
- Templates: 1 default for the demo (logo, colors and signature are configurable later).
- The public verify page shows valid / revoked, the name, the course and the date. It shows no other personal data.
- An admin can revoke a certificate.

### 5.9 Assignments
- A trainer assigns a course to candidates or groups, with an optional due date.
- The candidate sees it on the dashboard. Overdue items are flagged.
- Email notification on assignment (Resend, post-demo; the demo shows it in-app only).

### 5.10 Review workflow (Revisore)
- An author sends a draft *"In revisione"* to one or more reviewers.
- Reviewers open a read-only preview, leave comments anchored to a slide/block/question, and click **Approva** or **Richiedi modifiche**.
- `courses.status` gains `in_review`; publish is allowed only from `approved` when the org setting *"Richiedi revisione"* is on (off by default in the demo).

### 5.11 Portfolio (candidate profile)
Mirrors iSpring Cloud *Portafoglio*: a gradient cover banner, the candidate's name, **Modifica**, **Condividere** and **Aggiungi il progetto al portafoglio** buttons, a play/preview icon.
- Left card: **Esperienza lavorativa** (positions: title, company, from/to), **Informazioni su di me** (bio), **Competenze** (skill tags, pre-filled from ADA dimensions and completed courses).
- Right grid: **projects** — cards the candidate adds manually (title, description, link, image) **plus** auto-added cards for every earned certificate and every completed course (toggle per item).
- Sharing: private by default; *Condividere* creates `/p/[slug]` (public) or a signed link that expires in 30 days. The verify-QR on certificates also links back to the public portfolio when it is enabled.
- Visible to trainers/admins from `/studio/candidates/[id]` as the candidate's "CV di formazione".

### 5.12 Analytics (trainer)
- Per course: enrolled, started, completed, pass rate, average score, average time.
- Per candidate: progress across courses, quiz attempts, certificates, ADA band.
- Per question: % correct, which surfaces bad or ambiguous questions.
- CSV export.

---

## 6. AI generation pipeline

### 6.1 Overview
```
Trainer clicks "Crea con IA"
        │
        ▼
[1] Ingest sources ──► extract text (PDF/DOCX/PPTX/URL) ──► chunk + embed (pgvector)
        │
        ▼
[2] Outline (LLM, structured output) ──► course → modules → learning objectives
        │
        ▼
[3] Content (LLM, per module, parallel) ──► slides[] or blocks[] + speaker notes
        │
        ├──► [4a] Gamma deck (Gamma API, async) ──► gammaUrl + PPTX/PDF export
        ├──► [4b] Quiz (LLM, structured) ──► question pool with difficulty + explanation
        └──► [4c] Embeddings of generated content (for the AI tutor)
        │
        ▼
[5] Draft saved ──► Trainer review ──► Publish ──► Assign
```

The job is tracked in `generation_jobs` (status: `queued → outlining → writing → gamma → quiz → done | failed`). The UI shows a live progress stepper, polling every 2 s or via Supabase Realtime.

Implementation: **Vercel Workflow** (durable steps, retries, and survival of the long Gamma wait). Fallback for the first iteration: a route handler plus a step-per-request pattern driven by the client.

### 6.2 LLM usage
- Accessed through the **Vercel AI SDK + AI Gateway**, so the provider and model can be swapped without code changes, and spend is visible in one place.
- Default models (configurable in env):
  - `LLM_MODEL_MAIN` for outline, content and quiz (a strong model, e.g. `anthropic/claude-sonnet-5-5`)
  - `LLM_MODEL_FAST` for the tutor chat, short rewrites and grading (e.g. `anthropic/claude-haiku-5-5`)
  - `EMBEDDING_MODEL` for RAG
- **Structured output** (`generateObject` with Zod schemas) is used for outline, slides and quiz. Prose is never parsed.
- Prompt template variables: `topic, language, adaBand, focusAreas[], durationMin, courseType, sourceContext (top-k chunks), tone`.

Core schemas (abridged):
```ts
const Slide = z.object({
  layout: z.enum(["title","bullets","two-column","image-left","quote","summary"]),
  title: z.string().max(80),
  bullets: z.array(z.string().max(140)).max(6),
  speakerNotes: z.string(),
  imagePrompt: z.string().optional(),
})
const Question = z.object({
  type: z.enum(["single","multiple","truefalse","short","matching","ordering"]),
  stem: z.string(),
  options: z.array(z.object({ id: z.string(), text: z.string() })).optional(),
  correct: z.array(z.string()),          // option ids or accepted answers
  difficulty: z.enum(["easy","medium","hard"]),
  explanation: z.string(),
  sourceSlideIndex: z.number().optional(),
})
```

### 6.3 Gamma Pro integration
- Uses the **Gamma Generate API** (Pro plan, API key in `GAMMA_API_KEY`, server-side only).
- Call: `POST /generations` with `inputText` = our generated outline and slide content (markdown, one `---` per card), `format: "presentation"`, `numCards` = slide count, `textMode: "preserve"` (so Gamma keeps **our** content instead of rewriting it), `exportAs: "pptx"` (or `pdf`), theme and language.
- Poll `GET /generations/{id}` until done → store `gammaUrl` and `exportUrl`, and copy the export file into Supabase Storage (export links can expire).
- **Limits:** Gamma uses credits per generation and enforces rate limits. Mitigations:
  - Gamma is **optional per course** (toggle). The built-in slide player always works without it.
  - Cache: one Gamma deck per *(course version × ADA band)*, not one per candidate.
  - Queue with concurrency 1–2, with exponential backoff on 429.
  - Admin settings show monthly Gamma credits used and a hard cap.
- ⚠️ Verify the endpoints, parameters and credit costs against the current Gamma API docs before implementing.

### 6.4 PowerPoint without Gamma (fallback)
`pptxgenjs` builds a branded `.pptx` from the same `slides[]` JSON. This guarantees a PowerPoint download even when Gamma credits or rate limits run out.

### 6.5 Source ingestion
- PDF: `unpdf` · DOCX: `mammoth` · PPTX: unzip and parse slide XML text · URL: fetch → readability.
- Chunk ~800 tokens with 100 overlap → embed → `content_chunks`.

---

## 7. Architecture

```
               ┌──────────────────────── Vercel ───────────────────────────┐
 Browser ──►   │ Next.js App Router (RSC + Server Actions + Route Handlers)│
 (Studio/      │   ├─ /studio/*  /learn/*  /verify/*                       │
  Learner)     │   ├─ /api/ai/*  (AI SDK → AI Gateway → LLM)               │
               │   ├─ /api/gamma/* (Gamma API, server-side key)            │
               │   ├─ /api/scorm/* (export zip, import unzip)              │
               │   ├─ /api/certificates/* (PDF render)                     │
               │   └─ Workflow: generateCourse(jobId)                      │
               └───────────────┬───────────────────────────────────────────┘
                               │
            ┌──────────────────┼──────────────────┬───────────────────┐
            ▼                  ▼                  ▼                   ▼
     Supabase Postgres   Supabase Storage    AI Gateway          Gamma API
     (+pgvector, RLS,    (uploads, SCORM,    (LLM + embeddings)  (decks, PPTX/PDF)
      Auth, Realtime)     exports, certs)
```

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router, TypeScript) | Native to Vercel; RSC for dashboards |
| UI | Tailwind + shadcn/ui, lucide icons | Fast, accessible, iSpring-like clean cards |
| DB/Auth/Storage | Supabase (via Vercel Marketplace) | Postgres + RLS + Auth + Storage + pgvector in one place |
| LLM | AI SDK + Vercel AI Gateway | Provider-agnostic, budgets and observability, fallbacks |
| Long jobs | Vercel Workflow | Durable, retryable multi-step generation |
| SCORM runtime | `scorm-again` | Maintained SCORM 1.2 / 2004 API implementation |
| PDF | `@react-pdf/renderer` | Certificates |
| PPTX fallback | `pptxgenjs` | Offline-safe PowerPoint export |
| Zip | `jszip` / `fflate` | SCORM packaging |
| i18n | `next-intl` (it default, en) | Italian-first audience |

Note: Vercel function request/response bodies are limited to 4.5 MB. All uploads (PDF sources, SCORM zips, videos) go **directly from the browser to Supabase Storage** with signed upload URLs. They never pass through a function.

---

## 8. SCORM

### 8.1 Export (our course → SCORM)
- `POST /api/scorm/export/{courseId}?version=1.2|2004` → a zip containing:
  - `imsmanifest.xml` (one SCO per course for the demo)
  - `index.html` plus a static bundle of the slide/scroll player and quiz, with **content inlined as JSON** (works offline in any LMS)
  - a SCORM API wrapper that reports `cmi.core.lesson_status` (or `cmi.completion_status`/`success_status`), `cmi.core.score.raw/min/max`, `cmi.core.session_time`, `cmi.suspend_data` (resume position) and quiz `cmi.interactions.n.*`
- Validation target: uploads and passes in **SCORM Cloud** (free test account).

### 8.2 Import (third-party / iSpring SCORM → our LMS)
- Upload the zip (direct to Storage) → the server unzips it to `scorm/{packageId}/` → parse `imsmanifest.xml` (entry point, title, version).
- It plays in `/learn/courses/[id]` in an iframe. `scorm-again` provides `window.API` / `window.API_1484_11` in the parent frame and persists CMI to `scorm_runtime` through `/api/scorm/commit`.
- Completion and score from the package feed into the same progress, analytics and certificate pipeline as native courses.
- Files are served from a same-origin path (`/scorm-content/...` route proxying Storage) so the SCO can find the API in its parent window.

---

## 9. Data model (Postgres)

```sql
profiles(id uuid pk → auth.users, full_name, email, role text check in ('admin','trainer','candidate'),
         locale text default 'it', created_at)

ada_profiles(id, candidate_id → profiles, overall int check 0..100, dimensions jsonb,
             band text generated, source text, assessed_at)

courses(id, title, description, type text check in ('slides','scroll','scorm'),
        status text, language, cover_url, duration_min, tags text[],
        ada_band text null,               -- null = generic
        base_course_id uuid null,         -- personalized variant → its base
        personalized_for uuid null → profiles,
        issue_certificate bool, version int, created_by, created_at, updated_at)

modules(id, course_id, position, title, objectives text[])
slides(id, module_id, position, layout, title, bullets jsonb, speaker_notes,
       image_url, video_url, audio_url)
scroll_blocks(id, module_id, position, kind, payload jsonb)

gamma_decks(id, course_id, ada_band, gamma_generation_id, gamma_url,
            export_url, export_storage_path, status, credits_used, created_at)

quizzes(id, course_id null, title, mode text check in ('quiz','survey'),
        pass_mark int, attempts_allowed int, time_limit_s int, shuffle bool,
        draw_count int, difficulty_mix jsonb)
questions(id, quiz_id, type, stem, options jsonb, correct jsonb,  -- never sent to client
          difficulty, explanation, source_slide_id, position)
quiz_attempts(id, quiz_id, candidate_id, started_at, submitted_at,
              answers jsonb, score numeric, passed bool, question_ids uuid[])

assignments(id, course_id, candidate_id, assigned_by, due_at, created_at)
progress(id, course_id, candidate_id, status, percent int,
         last_position jsonb, time_spent_s int, completed_at)
item_progress(id, progress_id, item_type, item_id, completed bool, updated_at)

certificates(id text pk 'ITV-2026-XXXXXX', course_id, candidate_id, attempt_id,
             score, issued_at, revoked_at, pdf_path)

scorm_packages(id, course_id, version text, entry_point, storage_prefix, manifest jsonb)
scorm_runtime(id, package_id, candidate_id, cmi jsonb, updated_at)

content_chunks(id, course_id, source text, ref jsonb, content text,
               embedding vector(1536))
tutor_messages(id, course_id, candidate_id, role, content, citations jsonb, created_at)

folders(id, parent_id null, name, created_by)        -- courses.folder_id, quizzes.folder_id
review_requests(id, course_id, reviewer_id, status text ('pending','approved','changes_requested'), created_at)
review_comments(id, course_id, author_id, anchor jsonb {type,id}, body, resolved bool, created_at)

portfolios(candidate_id pk → profiles, bio, cover_url, slug unique null, is_public bool default false,
           share_token text null, share_expires_at)
portfolio_experiences(id, candidate_id, title, company, from_date, to_date null, position)
portfolio_skills(id, candidate_id, name, source text ('manual','ada','course'))
portfolio_projects(id, candidate_id, kind text ('manual','certificate','course'), ref_id null,
                   title, description, url, image_url, visible bool, position)

-- additions to tables above:
--   courses.status += 'in_review' | 'approved'
--   quizzes.theme jsonb {accent, bg_image, dark}, quizzes.feedback_mode text ('immediate','end')
--   quizzes.intro jsonb {headline, description, hero_url}
--   questions.image_url text null

generation_jobs(id, kind, input jsonb, status, step, error, output jsonb,
                course_id, created_by, created_at, updated_at)
usage_ledger(id, kind text ('llm','gamma','embedding'), ref_id, model,
             tokens_in, tokens_out, credits, cost_eur, created_at)
```

**RLS:** candidates see only their own rows (`assignments`, `progress`, `attempts`, `certificates`, `tutor_messages`) and only courses assigned to them. Trainers and admins see everything. `questions.correct` is reachable only through server code that uses the service role.

---

## 10. Working within LLM & Gamma limitations

| Risk | Mitigation |
|---|---|
| Rate limits (429) | Workflow step retries with backoff; a per-module concurrency cap (≤ 3 parallel LLM calls) |
| Token / cost budget | `usage_ledger` plus a monthly cap in Settings. Generation is blocked with a clear message when the cap is reached |
| Context limits | Source material goes through RAG (top-k chunks), never the full document; generation runs per module |
| Latency | Stream the outline to the UI; generate modules in parallel; Gamma runs async and does not block "draft ready" |
| Personalization cost | Cache base content per ADA band and personalize only a thin layer |
| Hallucination | Ground in uploaded sources when given; quiz questions carry `sourceSlideId`; a human must approve before publish |
| Gamma credits | Optional toggle, one deck per band, `pptxgenjs` fallback |
| Provider outage | AI Gateway model fallback list |

---

## 11. API surface (route handlers / server actions)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/ai/generate-course` | Start the generation job → `{ jobId }` |
| GET | `/api/jobs/{id}` | Job status and step |
| POST | `/api/ai/regenerate` | Regenerate a slide/block/question with an instruction |
| POST | `/api/ai/tutor` | Streaming tutor chat (RAG) |
| POST | `/api/gamma/generate/{courseId}` | Start a Gamma deck (or as part of the job) |
| POST | `/api/uploads/sign` | Signed Storage upload URL |
| POST | `/api/ingest` | Extract + chunk + embed an uploaded source |
| POST | `/api/quizzes/{id}/attempts` | Start an attempt → questions **without** answers |
| POST | `/api/attempts/{id}/submit` | Server-side scoring → result, plus certificate if earned |
| POST | `/api/progress` | Upsert progress/item progress |
| POST | `/api/scorm/export/{courseId}` | Build and return the SCORM zip |
| POST | `/api/scorm/import` | Register an uploaded package |
| POST | `/api/scorm/commit` | Persist CMI from the runtime |
| GET | `/api/certificates/{id}/pdf` | Certificate PDF |
| GET | `/verify/{id}` | Public verification page |
| POST | `/api/candidates/import` | CSV import of candidates + ADA |

---

## 12. Non-functional requirements

- **Security:** all keys stay server-side (LLM, Gamma, Supabase service role). RLS is on for every table. Uploads are type- and size-validated. SCORM content is sandboxed in an iframe on its own path.
- **Privacy / GDPR (EU, Italy):** ADA scores are personal data. They are visible only to admins/trainers and the candidate. A privacy notice appears at invite. Data stays in an EU Supabase region (Frankfurt). The LLM provider runs with zero data retention through AI Gateway. The certificate verify page shows minimal data.
- **Accessibility:** WCAG 2.1 AA: keyboard nav in the player and quiz, alt text (AI-generated, editable), captions for video, color contrast.
- **Performance:** dashboard LCP < 2.5 s; the player preloads the next slide.
- **i18n:** Italian default, English second; generated content follows the course language.
- **Observability:** Vercel logs + AI Gateway dashboard + `usage_ledger`; errors on `generation_jobs.error`.
- **Responsive:** the learner portal is fully usable on mobile. The Studio is desktop-first.

---

## 13. Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
AI_GATEWAY_API_KEY=            # or OIDC on Vercel
LLM_MODEL_MAIN=anthropic/claude-sonnet-5-5
LLM_MODEL_FAST=anthropic/claude-haiku-5-5
EMBEDDING_MODEL=openai/text-embedding-3-small
GAMMA_API_KEY=
GAMMA_MONTHLY_CREDIT_CAP=
LLM_MONTHLY_BUDGET_EUR=
NEXT_PUBLIC_APP_URL=https://tvlms.vercel.app
DEMO_MODE=true
```

---

## 14. Demo script (what we present)

| # | Who | Action | Shows |
|---|---|---|---|
| 1 | Trainer | Logs in → **Studio "Nuovo"** (iSpring-style quick start) | Familiar UX |
| 2 | Trainer | **Candidati** → imports a CSV of 3 candidates with ADA 30 / 55 / 85 | ADA bands |
| 3 | Trainer | **Corso a diapositive → ✨ Crea con IA**: "Sicurezza sul lavoro – rischio VDT", uploads a PDF, target = all 3, Gamma + Quiz + Certificate ON | Generation form |
| 4 | — | Live stepper: outline → slides → quiz → Gamma | AI pipeline |
| 5 | Trainer | Reviews the draft, regenerates one slide ("more practical example"), approves the quiz → **Publish & assign** | Human-in-the-loop |
| 6 | Trainer | Compares the Foundation and Advanced variants side by side | Personalization |
| 7 | Candidate (ADA 55) | Logs in → **Dashboard** → opens the course → slides, a video block, the Gamma tab, downloads the PPTX | Learner experience |
| 8 | Candidate | Asks the tutor "Ogni quanto devo fare una pausa?" → cited answer → jumps to the slide | AI tutor (RAG) |
| 9 | Candidate | Takes the quiz (cinematic intro card → 10 questions with live score) → passes → **certificate** PDF with QR | Assessment + certification |
| 10 | Anyone | Scans the QR → `/verify/ITV-2026-…` → opens the candidate's public **Portfolio** with the new certificate card | Verification + Portfolio |
| 11 | Trainer | **Analytics** → sees the candidate's score and question stats | Reporting |
| 12 | Trainer | **SCORM → Export 1.2** → opens it in SCORM Cloud → completion reported. Imports an existing iSpring SCORM and plays it in the portal | Interoperability |

Seed data: 1 admin, 1 trainer, 3 candidates, 2 pre-built courses (one slide, one scroll), 1 imported iSpring SCORM sample, so the demo never starts from empty.

---

## 15. Milestones & priorities

| Milestone | Scope | Priority |
|---|---|---|
| **M0 – Foundation** (2–3 days) | Repo, Next.js + Tailwind + shadcn, Supabase (schema, RLS, auth, seed), Vercel deploy, layouts (Studio rail + Learner dashboard), i18n | P0 |
| **M1 – Learn** (3–4 days) | Course models, slide player, scroll reader, video, progress tracking, learner dashboard, assignments | P0 |
| **M2 – Quiz & Certificates** (3 days) | Quiz builder (manual), attempt engine, server scoring, results review, certificate PDF + verify page | P0 |
| **M3 – AI Generation** (4–5 days) | Ingest + RAG, outline/slides/quiz generation with Zod, job stepper, regenerate/improve, ADA banding, usage ledger | P0 |
| **M4 – Gamma + PPTX** (2 days) | Gamma API job, embed + export to Storage, pptxgenjs fallback | P1 |
| **M5 – AI Tutor** (2 days) | Streaming RAG chat with citations, rate limit, quiz lock | P1 |
| **M6 – SCORM** (3–4 days) | Export 1.2 (then 2004), import + scorm-again runtime, SCORM Cloud validation | P1 |
| **M7 – Analytics & polish** (2–3 days) | Trainer analytics, CSV export, demo script rehearsal, empty/loading/error states | P1 |
| **M8 – Team & Portfolio** (2 days) | Team page with roles/seat counters and invites, Library folders + bulk actions, candidate Portfolio (edit + public page), auto-cards from certificates | P1 |
| **M9 – Extras** | Interactions, dialogue simulation, Reviewer workflow with anchored comments, TTS narration, email notifications | P2 |

Estimated demo-ready: **~4 weeks for one engineer**, ~2 weeks for two working in parallel (M1/M2 alongside M3/M4).

---

## 16. Open questions (need answers before M3)

1. **ADA score:** what exactly is it? What scale, which dimensions, and where does it come from (file, existing system, API)? Who computes it?
2. ~~**Repo & domain**~~ — received: repo `https://github.com/ESSI-innovazione/ITV`, Vercel project `espeditos-projects-07141c0e/tv_lms` (`prj_6oww6TE8NIZl6kQHqMNFuBbV2nBT`), production domain **`https://tvlms.vercel.app`**, Node 24. Still needed on the Vercel side:
   - Connect the project to the GitHub repo (Settings → Git) so pushes to `main` deploy automatically.
   - **Disable "Vercel Authentication" deployment protection for Production** (Settings → Deployment Protection). It is currently on for all non-custom domains, so `tvlms.vercel.app` would require a Vercel login — candidates and the public `/verify` page would be blocked. Keep it on for Preview if you like; the app has its own Supabase auth.
3. **LLM:** which provider/key do we have, and what are its limits (RPM, monthly budget)? Is routing through Vercel AI Gateway OK?
4. **Gamma Pro:** is the API key generated (Settings → API)? How many credits per month? Is there a brand theme in Gamma to use?
5. **Certificates:** is a legal/accredited template needed (e.g. for D.Lgs. 81/08 safety training), or are internal attestations enough for the demo?
6. **SCORM:** do we need 1.2, 2004, or both? Is there a target external LMS (Moodle, iSpring Learn, Docebo…) the export must work in?
7. **Branding:** logo, colors and font for the Academy (Time Vision brand?).
8. **Content language:** Italian only for the demo, or IT + EN?
