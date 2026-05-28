# AdoLearn

AdoLearn is a browser-only learning app built with React, TypeScript, Vite, and Tailwind CSS.

Users can paste learning material, generate a Duolingo-style course with either mock mode or browser-only real AI mode, work through a course map, complete lesson exercises, review weak areas, and persist progress in the browser. Backend storage is intentionally not included yet.

## What is included

- React + TypeScript + Vite
- Tailwind CSS through the Vite plugin
- Mobile-first responsive UI with polished cards, progress indicators, motion, and accessible focus states
- Dashboard with saved courses, XP, streaks, review items, and progress
- Mock course creator
- Browser-only real AI course generation with a user-provided API key
- Duolingo-style course map
- Lesson player for all current exercise types
- Browser-only Review Mode from missed questions, weak concepts, and completed lessons
- Settings page for AI preferences, appearance preference, import/export, and data controls
- UI polish for game feel: confetti on passed lessons, XP/streak animation, loading skeletons, improved empty states, and better feedback states
- Local progress, XP, streaks, weak concepts, review attempts, and incorrect-answer tracking
- Browser-only persistence through `localStorage`
- AI prompt building, course validation, and normalization before generated courses are saved
- Vercel-ready static frontend deployment configuration

## What is intentionally not included yet

- Vercel API routes or other backend services
- Accounts or authentication
- Database storage
- Hardcoded API keys
- Environment variables for AI credentials

## Project structure

```txt
AdoLearn/
├── index.html
├── package.json
├── README.md
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
├── vercel.json
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

Vite writes the production build to `dist`, which is the directory Vercel should serve.


## UI polish and accessibility

Phase 15 focuses on product feel without adding backend features. The app now includes lightweight motion, improved card hover states, progress bars/rings, lesson-completion celebration, confetti after passing, animated stat changes, loading skeletons, clearer empty/error/success states, better locked-lesson guidance, and larger mobile tap targets.

Accessibility improvements include visible focus states, ARIA labels on important action buttons, progressbar semantics for progress indicators, keyboard-friendly controls, reduced-motion support, and feedback that uses text/icons instead of color alone.

## Local data storage

AdoLearn stores user data locally in the browser using these `localStorage` keys:

- `adolearn_courses`
- `adolearn_progress`
- `adolearn_settings`

Mock mode sends no course data, progress, review history, API keys, imports, exports, or settings to a server. Real AI mode sends the pasted source material and generation prompt directly from the browser to the AI API using the user-provided key; AdoLearn still stores saved courses and progress only in localStorage.

> API key warning: browser-only apps cannot fully protect API keys. Your key is stored locally in this browser. For production, use a Vercel API route or another backend proxy. Vercel proxy mode is listed in Settings as a disabled future option and is planned for Phase 16.

## Settings and data controls

The Settings page currently supports:

- Model name setting, defaulting to `gpt-5-nano`
- Browser-local API key storage
- Generation mode selection:
  - Mock
  - Real AI with user API key
  - Vercel proxy, coming soon and disabled for now
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

## AI prompt and schema preparation

Phase 12 added the browser-only preparation layer for AI course generation. Phase 13 connects direct browser AI generation when the user selects Real AI mode and provides an API key.

Included services:

- `src/services/aiPromptService.ts` builds an instructional-design prompt for AI generation.
- `src/services/schemaService.ts` describes the expected AdoLearn course JSON shape.
- `src/services/courseValidator.ts` checks generated course JSON and returns useful errors and warnings.
- `src/services/courseNormalizer.ts` repairs safe missing fields such as IDs, timestamps, hints, accepted answers, and estimated minutes.
- `src/services/courseSchemaDebug.ts` provides a temporary developer helper for validating and normalizing mock AI JSON locally.

The prompt instructs AI generation to use only provided source material, avoid unsupported facts, return JSON only, and include sections, units, lessons, exercises, objectives, explanations, hints, review lessons, and final challenges.

This layer is used by direct browser generation now and is designed to be reused by a safer Vercel API route/proxy in Phase 16.

## Vercel deployment

AdoLearn is configured for Vercel static deployment as a Vite single-page app.

### Deploy from GitHub

1. Push this project to a GitHub repository.
2. In Vercel, choose **Add New → Project**.
3. Import the GitHub repository.
4. Use these project settings:
   - Framework Preset: `Vite`
   - Install Command: `npm install`
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Deploy.

The project includes `vercel.json` with a rewrite rule that sends non-API routes to `index.html`. This supports SPA refresh behavior for app routes or future React routes.

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

## Custom domains on Vercel

Configure custom domains through **Vercel Project Settings → Domains**.

Recommended setup:

- Add the root domain, such as `yourdomain.com`, in Vercel Domains.
- Add the `www` domain, such as `www.yourdomain.com`, if you want it to work too.
- Choose your preferred canonical domain in Vercel if prompted.
- For Namecheap, follow the DNS records Vercel shows for your project and domain.
- DNS should point to Vercel, not GitHub Pages.
- The final app should load from `https://yourdomain.com/` or your chosen canonical domain.
- Do not use `/adolearn/` unless you intentionally deploy under a subpath.

## Browser-only AI generation

AdoLearn can run in two generation modes today:

- Mock: uses local mock course generation and makes no network requests.
- Real AI with user API key: calls the AI API directly from the browser using the locally stored API key and selected model name. The default model is `gpt-5-nano`.

The real AI flow builds the AdoLearn prompt, requests JSON output, parses the response, validates the course schema, normalizes repairable fields, saves the final course to `localStorage`, initializes progress, and opens the Course Map.

No API keys should be committed to the repository. No environmentt variables are required for the current browser-only mode. Phase 16 is reserved for a safer Vercel API route/proxy option.

> Security warning: browser-only apps cannot fully protect API keys. Your key is stored locally in this browser. For a public app, use a Vercel API route or another backend proxy.

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
- Confirm `localStorage` persists after refresh
- Export data
- Import data
- Use mock generation
- Use real AI generation if an API key is configured

