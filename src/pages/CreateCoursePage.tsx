import { useMemo, useState } from 'react';
import { PageCard } from '../components/PageCard';
import { NoticeBanner, ProgressBar } from '../components/Polish';
import { DEMO_SOURCE_MATERIAL } from '../data/mockCourse';
import { generateCourseWithAI, AICourseGenerationError } from '../services/aiCourseGenerationService';
import { saveCourse } from '../services/courseService';
import { generateMockCourse } from '../services/mockCourseGenerator';
import { playLessonCompleteSound } from '../services/soundService';
import { initializeCourseProgress } from '../services/progressService';
import { getSettings } from '../services/settingsService';
import { isStorageAvailable } from '../services/storageService';
import type { Course } from '../types/course';
import type { AppSettings, CourseStyle, Difficulty, LessonLength } from '../types/settings';
import { ROBOT_GRAPHICS } from '../data/mascotGraphics';

interface CreateCoursePageProps {
  onCourseCreated: (courseId: string) => void;
}

interface GenerationStep {
  label: string;
  detail: string;
}

const DIFFICULTY_OPTIONS: Difficulty[] = ['Auto', 'Beginner', 'Intermediate', 'Advanced'];
const COURSE_STYLE_OPTIONS: CourseStyle[] = [
  'Exam prep',
  'Quick overview',
  'Deep learning',
  'Flashcard-heavy'
];
const LESSON_LENGTH_OPTIONS: LessonLength[] = ['Short', 'Medium', 'Long'];

const MINIMUM_RECOMMENDED_CHARACTERS = 180;
const BROWSER_STORAGE_COURSE_WARNING_BYTES = 4_500_000;
const GENERATION_STEPS: GenerationStep[] = [
  {
    label: 'Reading your material',
    detail: 'Scanning the pasted notes and preparing a study-friendly preview.'
  },
  {
    label: 'Finding key concepts',
    detail: 'Pulling out repeated terms, themes, and ideas for the course map.'
  },
  {
    label: 'Designing your learning path',
    detail: 'Arranging sections, units, lessons, reviews, and challenges.'
  },
  {
    label: 'Writing bite-sized lessons',
    detail: 'Turning source material into short objectives and lesson summaries.'
  },
  {
    label: 'Creating practice questions',
    detail: 'Adding interactive exercises with answers, hints, and explanations.'
  },
  {
    label: 'Checking course structure',
    detail: 'Validating and normalizing the course so it works in AdoLearn.'
  },
  {
    label: 'Saving your course',
    detail: 'Saving everything locally and unlocking the first lesson.'
  }
];

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function SelectField<T extends string>({
  id,
  label,
  value,
  options,
  onChange
}: {
  id: string;
  label: string;
  value: T;
  options: T[];
  onChange: (value: T) => void;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-sm font-black text-slate-700">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}


function getGenerationModeLabel(settings: AppSettings): string {
  if (settings.generationMode === 'server_proxy') {
    return 'Server proxy';
  }

  return 'Mock';
}


function CompactGenerationStatus({
  activeStepIndex,
  isSuccess,
  generationModeLabel
}: {
  activeStepIndex: number;
  isSuccess: boolean;
  generationModeLabel: string;
}) {
  const visibleStepIndex = Math.min(Math.max(activeStepIndex, 0), GENERATION_STEPS.length - 1);
  const progressValue = isSuccess
    ? 100
    : Math.max(10, Math.round(((visibleStepIndex + 1) / GENERATION_STEPS.length) * 100));
  const activeStep = GENERATION_STEPS[visibleStepIndex];

  return (
    <div
      className="rounded-[1.75rem] bg-emerald-50 p-4 ring-1 ring-emerald-200 shadow-sm dark:bg-black dark:ring-emerald-400/60"
      role="status"
      aria-live="polite"
      aria-busy={!isSuccess}
    >
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-500 text-2xl text-white shadow-lg shadow-emerald-900/20 motion-safe:animate-bounce-soft dark:bg-emerald-400 dark:text-black">
          {isSuccess ? '✓' : '✦'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-300">
            {generationModeLabel} generation
          </p>
          <h2 className="mt-1 text-lg font-black text-slate-950 dark:text-white">
            {isSuccess ? 'Course ready — opening your map…' : activeStep.label}
          </h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-600 dark:text-zinc-300">
            {isSuccess ? 'Saved successfully. Redirecting now.' : activeStep.detail}
          </p>
          <div className="mt-4">
            <ProgressBar
              value={progressValue}
              label="Course generation progress"
              tone={isSuccess ? 'emerald' : 'sky'}
              size="lg"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function getCourseByteSize(course: Course): number {
  return new Blob([JSON.stringify(course)]).size;
}

function isLikelyTooLargeForBrowserStorage(course: Course): boolean {
  return getCourseByteSize(course) > BROWSER_STORAGE_COURSE_WARNING_BYTES;
}

function formatGenerationError(error: unknown): string {
  if (error instanceof AICourseGenerationError) {
    if (error.details?.length) {
      return `${error.message}\n\nDetails:\n${error.details.map((detail) => `• ${detail}`).join('\n')}`;
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Generation failed. Please try again.';
}

export function CreateCoursePage({ onCourseCreated }: CreateCoursePageProps) {
  const settings = useMemo(() => getSettings(), []);
  const [courseTitle, setCourseTitle] = useState('');
  const [sourceMaterial, setSourceMaterial] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>(settings.preferredDifficulty);
  const [courseStyle, setCourseStyle] = useState<CourseStyle>(settings.preferredCourseStyle);
  const [lessonLength, setLessonLength] = useState<LessonLength>(settings.preferredLessonLength);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(-1);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastWarning, setLastWarning] = useState<string | null>(null);

  const trimmedSourceMaterial = sourceMaterial.trim();
  const isShortMaterial =
    trimmedSourceMaterial.length > 0 &&
    trimmedSourceMaterial.length < MINIMUM_RECOMMENDED_CHARACTERS;
  const characterCount = sourceMaterial.length;
  const generationModeLabel = getGenerationModeLabel(settings);

  function resetMessages() {
    setError(null);
    setSuccessMessage(null);
    setLastWarning(null);
  }

  function handleUseDemoMaterial() {
    setSourceMaterial(DEMO_SOURCE_MATERIAL);
    setCourseTitle('Biology Basics: Cells and Energy');
    resetMessages();
    setActiveStepIndex(-1);
  }

  function handleClear() {
    setCourseTitle('');
    setSourceMaterial('');
    setDifficulty(settings.preferredDifficulty);
    setCourseStyle(settings.preferredCourseStyle);
    setLessonLength(settings.preferredLessonLength);
    resetMessages();
    setActiveStepIndex(-1);
  }

  async function advanceToStep(index: number, duration = 450) {
    setActiveStepIndex(index);
    await sleep(duration);
  }

  async function generateCourseForCurrentMode(currentSettings: AppSettings): Promise<Course> {
    if (currentSettings.generationMode === 'mock') {
      return generateMockCourse({
        sourceMaterial: trimmedSourceMaterial,
        optionalTitle: courseTitle,
        difficulty,
        courseStyle,
        lessonLength
      });
    }

    if (currentSettings.generationMode === 'server_proxy') {
      const result = await generateCourseWithAI({
        sourceMaterial: trimmedSourceMaterial,
        optionalTitle: courseTitle,
        difficulty,
        courseStyle,
        lessonLength,
        modelName: currentSettings.modelName
      });

      if (result.validationWarnings.length > 0) {
        setLastWarning(
          `The course was generated, but AdoLearn cleaned up a few details: ${result.validationWarnings
            .slice(0, 3)
            .join(' ')}${result.validationWarnings.length > 3 ? ' …' : ''}`
        );
      }

      return result.course;
    }

    throw new Error('Generation failed. Please try again.');
  }

  async function handleGenerateCourse() {
    if (!trimmedSourceMaterial) {
      setError('Paste some learning material first so AdoLearn has something to turn into a course.');
      setSuccessMessage(null);
      setLastWarning(null);
      setActiveStepIndex(-1);
        return;
    }

    resetMessages();
    setActiveStepIndex(0);
    setIsGenerating(true);

    try {
      const currentSettings = getSettings();
      let generatedCourse: Course | null = null;

      await sleep(120);
      await advanceToStep(1, 350);
      await advanceToStep(2, 350);
      await advanceToStep(3, 350);
      setActiveStepIndex(4);
      generatedCourse = await generateCourseForCurrentMode(currentSettings);
      await advanceToStep(5, 350);
      await advanceToStep(6, 250);

      if (!isStorageAvailable()) {
        throw new Error('This browser is blocking browser storage, so AdoLearn cannot save the generated course locally.');
      }

      const didSaveCourse = saveCourse(generatedCourse);

      if (!didSaveCourse) {
        throw new Error(
          isLikelyTooLargeForBrowserStorage(generatedCourse)
            ? 'The generated course was too large to save locally. Try a shorter source or shorter course settings.'
            : 'The generated course could not be saved locally. Try again or switch to mock mode.'
        );
      }

      initializeCourseProgress(generatedCourse);
      playLessonCompleteSound();
      setSuccessMessage('Course generated and saved locally! Opening the course map...');
      setActiveStepIndex(GENERATION_STEPS.length);
      await sleep(650);
      onCourseCreated(generatedCourse.id);
    } catch (generationError) {
      const message = formatGenerationError(generationError);
      setError(message);
      setActiveStepIndex((currentStepIndex) => (currentStepIndex < 0 ? 0 : currentStepIndex));
    } finally {
      setIsGenerating(false);
    }
  }


  return (
    <div className="space-y-6">
      <PageCard
        eyebrow="Create"
        title="Build a learning path"
        description="Paste notes, a transcript, an article, or a study guide. AdoLearn can use the local mock generator or, if enabled in Settings, real AI through the Server proxy."
      >
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            void handleGenerateCourse();
          }}
        >
          <div className="rounded-[1.75rem] bg-gradient-to-br from-emerald-50 to-sky-50 p-4 ring-1 ring-emerald-100 sm:flex sm:items-center sm:justify-between sm:gap-5">
            <div className="flex items-center gap-4">
              <img src={ROBOT_GRAPHICS.workflow} alt="Robot turning material into lesson cards" className="hidden h-24 w-24 shrink-0 object-contain sm:block" />
              <div>
              <p className="text-sm font-black text-slate-950">Source readiness</p>
              <p className="mt-1 text-xs font-bold leading-5 text-slate-600">
                More detail usually creates better lessons. Short sources still work, especially in mock mode.
              </p>
              </div>
            </div>
            <div className="mt-3 min-w-48 sm:mt-0">
              <ProgressBar
                value={Math.min(100, Math.round((trimmedSourceMaterial.length / 900) * 100))}
                label="Source material readiness"
                tone={isShortMaterial ? 'amber' : 'emerald'}
              />
              <p className="mt-2 text-right text-xs font-black text-slate-500">
                {characterCount.toLocaleString()} chars
              </p>
            </div>
          </div>
          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-5">
              <label htmlFor="course-title" className="block">
                <span className="text-sm font-black text-slate-700">Course title</span>
                <input
                  id="course-title"
                  type="text"
                  value={courseTitle}
                  onChange={(event) => setCourseTitle(event.target.value)}
                  disabled={isGenerating}
                  placeholder="Optional, e.g. Biology Exam Review"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                />
              </label>

              <label htmlFor="source-material" className="block">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <span className="text-sm font-black text-slate-700">Learning material</span>
                  <span className="text-xs font-bold text-slate-400">
                    {characterCount.toLocaleString()} characters
                  </span>
                </div>
                <textarea
                  id="source-material"
                  value={sourceMaterial}
                  onChange={(event) => {
                    setSourceMaterial(event.target.value);
                    if (error || successMessage || lastWarning) {
                      resetMessages();
                    }
                  }}
                  disabled={isGenerating}
                  className="mt-2 min-h-72 w-full resize-y rounded-[1.5rem] border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                  placeholder="Paste course notes, an article, a podcast transcript, lecture notes, or a study guide here..."
                />
              </label>
            </div>

            <aside className="space-y-4 rounded-[1.75rem] bg-slate-50 p-4 ring-1 ring-slate-200 sm:p-5">
              <img src={ROBOT_GRAPHICS.teacher} alt="Robot teaching at a whiteboard" className="mx-auto h-44 w-full object-contain" />
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-600">
                  Course settings
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Current generation mode: <span className="font-black text-slate-800">{generationModeLabel}</span>.
                  Change this in Settings.
                </p>
              </div>

              <div className="grid gap-4">
                <SelectField
                  id="difficulty"
                  label="Difficulty"
                  value={difficulty}
                  options={DIFFICULTY_OPTIONS}
                  onChange={setDifficulty}
                />
                <SelectField
                  id="course-style"
                  label="Course style"
                  value={courseStyle}
                  options={COURSE_STYLE_OPTIONS}
                  onChange={setCourseStyle}
                />
                <SelectField
                  id="lesson-length"
                  label="Lesson length"
                  value={lessonLength}
                  options={LESSON_LENGTH_OPTIONS}
                  onChange={setLessonLength}
                />
              </div>
            </aside>
          </div>

          {isGenerating || successMessage ? (
            <CompactGenerationStatus
              activeStepIndex={activeStepIndex}
              isSuccess={Boolean(successMessage)}
              generationModeLabel={generationModeLabel}
            />
          ) : null}

          {error ? (
            <NoticeBanner tone="error" title="Course generation needs attention">
              {error}
            </NoticeBanner>
          ) : null}

          {isShortMaterial ? (
            <NoticeBanner tone="warning" title="Short source">
              This material is pretty short, so the course may feel generic. You can still generate it.
            </NoticeBanner>
          ) : null}

          {lastWarning ? (
            <NoticeBanner tone="info" title="Course cleaned up">
              {lastWarning}
            </NoticeBanner>
          ) : null}

          {successMessage ? (
            <NoticeBanner tone="success" title="Saved locally">
              {successMessage}
            </NoticeBanner>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="submit"
              disabled={isGenerating}
              aria-label="Generate AdoLearn course"
              className="rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none disabled:hover:translate-y-0 sm:min-w-48"
            >
              {isGenerating ? 'Generating...' : 'Generate Course'}
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={isGenerating}
              aria-label="Clear course creator form"
              className="rounded-2xl bg-white px-5 py-4 text-sm font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleUseDemoMaterial}
              disabled={isGenerating}
              aria-label="Fill form with demo material"
              className="rounded-2xl bg-emerald-50 px-5 py-4 text-sm font-black text-emerald-700 ring-1 ring-emerald-100 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:text-emerald-300"
            >
              Use Demo Material
            </button>
          </div>
        </form>
      </PageCard>
    </div>
  );
}