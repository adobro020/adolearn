# AdoLearn

AdoLearn is a Production-ready learning app built with React, TypeScript, Vite, Tailwind CSS, and a server API proxy for real AI course generation.

Users can paste learning material, generate a Duolingo-style course with either mock mode or Server proxy mode, work through a course map, complete lesson exercises, review weak areas, and persist courses/progress in the browser. AdoLearn does not include accounts, login, a database, or cloud course storage yet.

## What is included

- React + TypeScript + Vite
- Tailwind CSS through the Vite plugin
- Mobile-first responsive UI with clean cards, progress indicators, motion, and accessible focus states
- Dashboard with saved courses, XP, streaks, review items, and progress
- Mock course creator for local testing
- Real AI course generation through `/api/generate-course`
- Server-side API proxy using `OPENAI_API_KEY`
- Duolingo-style course map
- Lesson player for all current exercise types
- Browser-local Review Mode from missed questions, weak concepts, and completed lessons
- Settings page for model preference, generation mode, appearance, import/export, and data controls
- UI polish for game feel: confetti on passed lessons, XP/streak animation, loading skeletons, improved empty states, and better feedback states
- Local progress, XP, streaks, weak concepts, review attempts, and incorrect-answer tracking
- Browser persistence through `browser storage`
- AI prompt building, course validation, and normalization before generated courses are saved
- SPA routing configuration

## What is intentionally not included

- User accounts or authentication
- Database storage
- Cloud course storage
- Payment system
- User-managed API key mode
- Browser-side OpenAI API calls
- Hardcoded API keys
- Committed `.env` or `.env.local` files

## Project structure

```txt
AdoLearn/
├── api/
│   └── generate-course.ts
├── index.html
├── package.json
├── README.md
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
└── src/
    ├── components/
    ├── data/
    ├── pages/
    ├── services/
    ├── styles/
    ├── types/
    ├── utils/
    ├── App.tsx
    ├── main.tsx
    └── vite-env.d.ts
```

## Local setup

Install dependencies:

```bash
npm install
```

Start the local development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

Vite writes the production build to `dist`, which is the directory the host should serve.

## Local data storage

AdoLearn stores user-owned app data locally in the browser using these `browser storage` keys:

- `adolearn_courses`
- `adolearn_progress`
- `adolearn_settings`

Courses, lesson progress, XP, streaks, weak concepts, review attempts, imports, and exports remain local to the browser. The server API proxy is used only for generating a course from pasted source material; generated courses are still saved in browser `browser storage` after validation and normalization.

## Settings and data controls

The Settings page supports:

- Model name setting, defaulting to `gpt-5-nano`
- Generation mode selection:
  - Mock mode
  - Server proxy mode
- Theme preference:
  - System
  - Light
  - Dark
- Export all AdoLearn data as JSON
- Import all AdoLearn data from JSON
- Export courses only
- Import a course JSON
- Clear all local data
- Reset all progress
- Reset settings
- Reset or delete one selected course

Imports are validated before saving. Full-data imports replace the current local browser data after confirmation. Course imports are added to the local course list, and imported course IDs are regenerated when needed to avoid conflicts.

Legacy settings from earlier phases are normalized automatically. Browser-stored direct API mode and stored key fields are removed when settings are read or reset.

## AI prompt, schema, and validation layer

AdoLearn uses reusable services for AI course generation:

- `src/services/aiPromptService.ts` builds an instructional-design prompt for AI generation.
- `src/services/schemaService.ts` describes the expected AdoLearn course JSON shape.
- `src/services/courseValidator.ts` checks generated course JSON and returns useful errors and warnings.
- `src/services/courseNormalizer.ts` repairs safe missing fields such as IDs, timestamps, hints, accepted answers, and estimated minutes.
- `src/services/aiCourseGenerationService.ts` calls the server proxy from the frontend, then validates and normalizes the returned course.
- `api/generate-course.ts` calls OpenAI from the serverless function using `OPENAI_API_KEY`.

The prompt instructs AI generation to use only provided source material, avoid unsupported facts, return JSON only, and include sections, units, lessons, exercises, objectives, explanations, hints, review lessons, and final challenges.

## server API proxy mode

Real AI generation uses the server API route:

```txt
POST /api/generate-course
```

The frontend sends only:

- `sourceMaterial`
- `optionalTitle`
- `difficulty`
- `courseStyle`
- `lessonLength`
- `modelName`

The frontend never sends API secrets, environment variable values, or secret tokens. The serverless function reads the OpenAI key from `process.env.OPENAI_API_KEY`.

Supported model names:

- `gpt-5-nano`
- `gpt-5-mini`
- `gpt-5`

Unsupported model names fall back to `gpt-5-nano`.

The API route includes:

- POST-only method handling
- Missing-source validation
- Request body size limit
- Source material character limit
- Approved-model fallback
- Friendly API errors
- No stack traces in responses
- No committed secrets
- No logging of full source material
- No API key returned to the frontend

## Server environment variable setup

To enable Server proxy mode:

1. Go to the hosting dashboard.
2. Open the AdoLearn project.
3. Go to **Project Settings**.
4. Open **Environment Variables**.
5. Add:
   - Name: `OPENAI_API_KEY`
   - Value: your OpenAI API key
6. Apply it to Production, Preview, and Development if needed.
7. Redeploy the project after adding the variable.
8. Use Mock mode for testing without AI usage.
9. Use Server proxy mode for real AI generation.

Do not commit `.env` or `.env.local`.

> Cost note: Server proxy mode uses the site owner’s OpenAI API key. Public users can create API usage costs. Use request size limits, usage monitoring, and rate limiting before promoting the app widely.

## Production deployment

AdoLearn is configured for Production deployment as a Vite single-page app with an API route.

### Deploy from GitHub

1. Push this project to a GitHub repository.
2. In your hosting provider, choose **Add New → Project**.
3. Import the GitHub repository.
4. Use these project settings:
   - Framework Preset: `Vite`
   - Install Command: `npm install`
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Add `OPENAI_API_KEY` in environment variables if you want Server proxy mode to work.
6. Deploy or redeploy.

The project includes a rewrite rule that sends non-API routes to `index.html`. This supports SPA refresh behavior while preserving `/api/*` routes.

```json
{
  "rewrites": [
    {
      "source": "/((?!api/.*).*)",
      "destination": "/index.html"
    }
  ]
}
```

The Vite config uses `base: '/'`, so the app is served from the root path. Do not use `/adolearn/` unless you intentionally deploy under a subpath.

## Custom domains

Configure custom domains through **project settings → Domains**.

Recommended setup:

- Add the root domain, such as `yourdomain.com`, in project domains.
- Add the `www` domain, such as `www.yourdomain.com`, if you want it to work too.
- Choose your preferred canonical domain in the hosting platform if prompted.
- For Namecheap, follow the DNS records your host shows for your project and domain.
- DNS should point to the hosting platform, not GitHub Pages.
- The final app should load from `https://yourdomain.com/` or your chosen canonical domain.
- Do not use `/adolearn/` unless you intentionally deploy under a subpath.

## Troubleshooting

### Missing `OPENAI_API_KEY`

If Server proxy mode returns a server configuration error, confirm `OPENAI_API_KEY` exists in project settings → Environment Variables and redeploy after adding it.

### Failed Production deployment

Run locally first:

```bash
npm install
npm run build
```

Confirm the host is using Framework Preset `Vite`, Build Command `npm run build`, and Output Directory `dist`.

### API route returning 500

Check that `OPENAI_API_KEY` is available to the deployment environment you are testing. Confirm the route is deployed at `/api/generate-course` and that requests are `POST` requests.

### Course JSON validation failure

Try a shorter, clearer source paste or use Mock mode. AdoLearn validates and normalizes generated JSON before saving so malformed courses are rejected.

### Source material too large

Paste a shorter excerpt or split the material into multiple smaller courses. The API route has request size limits to protect cost and reliability.

### OpenAI rate limits

Wait and retry later, or use Mock mode while testing. Before wider public launch, add stronger rate limiting and monitoring.

## Pre-deployment test checklist

Before deploying or continuing development, test:

- Fresh install: `npm install`
- Local dev: `npm run dev`
- Production build: `npm run build`
- Production preview: `npm run preview`
- Refresh Dashboard
- Refresh Course Map
- Refresh Lesson Player
- Create course
- Complete lesson
- Confirm `browser storage` persists after refresh
- Export data
- Import data
- Use mock generation
- Use Server proxy mode with `OPENAI_API_KEY` configured
- Confirm `/api/generate-course` rejects non-POST requests
- Confirm oversized source material is rejected cleanly

## Phase notes

Phase 16 adds the server API proxy for safer real AI generation. Future phases can add stronger production safeguards such as server-side rate limiting, monitoring, accounts, or cloud sync if needed.
