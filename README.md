# AdoLearn

AdoLearn is a React + TypeScript learning app that turns pasted or uploaded source material into a bite-sized interactive course.

It uses a server API route for AI course generation and stores courses, settings, and progress locally in the browser.

## Features

- Create courses from source material with `/api/generate-course`
- Default AI model: `gpt-5.4-mini`
- Course structure: units → sections → lessons → exercises
- Lesson types: standard and review
- Exercise types: multiple choice and true/false
- Up to 4 questions per lesson and up to 4 choices per multiple-choice question
- Source-grounded hints, explanations, learning objectives, and key concepts
- Per-choice feedback explaining why answers are right or wrong
- Dashboard with saved courses, progress, XP, streaks, and review items
- Study technique pages linked from the footer
- Local import/export and data reset tools
- Light, dark, and system theme support

AdoLearn does not include accounts, login, a database, payment system, cloud course storage, flashcards, matching exercises, ordering exercises, or final challenges.

## Tech stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Serverless API route
- Browser local storage

## Project structure

```txt
api/generate-course.ts       AI generation proxy
src/components/              Shared UI
src/pages/                   App pages
src/services/                AI, schema, storage, progress, and validation logic
src/types/                   TypeScript types
src/styles/index.css         Global styles
public/                      Static assets
```

## Local setup

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## AI generation

Real generation uses:

```txt
POST /api/generate-course
```

The frontend sends source material, an optional title, and the selected model name. The API route reads `OPENAI_API_KEY` from the server environment and never exposes it to the browser.

Supported model names:

- `gpt-5.4-mini`
- `gpt-5-mini`
- `gpt-5`

Unsupported model names fall back to `gpt-5.4-mini`.

## Environment variables

To enable real AI generation, add this variable in your hosting provider:

```txt
OPENAI_API_KEY=your_api_key_here
```

Do not commit `.env` or `.env.local` files.

## Local storage

AdoLearn stores app data in the browser with these keys:

- `adolearn_courses`
- `adolearn_progress`
- `adolearn_settings`

Courses and progress stay on the user's device unless the user exports or imports data manually.

## Course JSON shape

Generated courses must return one top-level course object using this structure:

```txt
Course
└── units
    └── sections
        └── lessons
            └── exercises
```

Lessons include learning objectives, summaries, hints, explanations, concepts, and source-grounded questions.

## Deployment

For a Vite deployment:

- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

The included `vercel.json` rewrites non-API routes to `index.html` so the single-page app works after refresh.

## Notes

AdoLearn is powered by AI and can make mistakes. Generated courses are validated and normalized before saving, but users should still review important material carefully.
