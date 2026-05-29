import { useMemo, useState, type ChangeEvent, type DragEvent } from 'react';
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
import { classNames } from '../utils/classNames';

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
const GENERATION_PROGRESS_MILESTONES = [8, 19, 33, 51, 73, 89, 97] as const;

const MAX_UPLOAD_FILE_BYTES = 2_500_000;
const MAX_UPLOAD_FILES_PER_BATCH = 8;
const ACCEPTED_SOURCE_FILE_TYPES = '.txt,.md,.markdown,.csv,.json,.html,.htm,.xml,.log,.srt,.vtt,.yaml,.yml';
const TEXT_LIKE_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'csv',
  'json',
  'html',
  'htm',
  'xml',
  'log',
  'srt',
  'vtt',
  'yaml',
  'yml'
]);

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

function getVisibleStepIndex(activeStepIndex: number): number {
  return Math.min(Math.max(activeStepIndex, 0), GENERATION_STEPS.length - 1);
}

function getProgressValue(activeStepIndex: number, isSuccess: boolean): number {
  if (isSuccess) {
    return 100;
  }

  return GENERATION_PROGRESS_MILESTONES[getVisibleStepIndex(activeStepIndex)] ?? 8;
}

function FullScreenGenerationOverlay({
  activeStepIndex,
  isSuccess,
  generationModeLabel
}: {
  activeStepIndex: number;
  isSuccess: boolean;
  generationModeLabel: string;
}) {
  const visibleStepIndex = getVisibleStepIndex(activeStepIndex);
  const progressValue = getProgressValue(activeStepIndex, isSuccess);
  const activeStep = GENERATION_STEPS[visibleStepIndex];
  const headline = isSuccess ? 'Course ready' : 'Building your course';
  const detail = isSuccess ? 'Saved successfully. Opening your course map now.' : activeStep.detail;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-busy={!isSuccess}
    >
      <div className="relative w-full max-w-5xl overflow-hidden rounded-[2.5rem] bg-white p-6 shadow-2xl shadow-slate-950/25 ring-1 ring-white/70 dark:bg-black dark:ring-zinc-800 sm:p-8">
        <div className="absolute -left-14 top-10 h-40 w-40 rounded-full bg-emerald-200/60 blur-3xl" aria-hidden="true" />
        <div className="absolute -right-8 bottom-0 h-56 w-56 rounded-full bg-sky-200/60 blur-3xl" aria-hidden="true" />

        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-700 ring-1 ring-emerald-100 dark:bg-black dark:text-emerald-300 dark:ring-emerald-500/40">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" aria-hidden="true" />
              {generationModeLabel} generation
            </div>

            <div className="mt-5 flex flex-wrap items-end gap-4">
              <div>
                <p className="text-6xl font-black tracking-tight text-slate-950 dark:text-white sm:text-7xl">
                  {progressValue}%
                </p>
                <p className="mt-2 text-base font-black text-slate-500 dark:text-zinc-300">
                  {headline}
                </p>
              </div>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-emerald-400 motion-safe:animate-bounce-soft" aria-hidden="true" />
                <span className="h-3 w-3 rounded-full bg-sky-400 motion-safe:animate-pulse" aria-hidden="true" />
                <span className="h-3 w-3 rounded-full bg-violet-400 motion-safe:animate-bounce-soft" aria-hidden="true" />
              </div>
            </div>

            <div className="mt-6 max-w-2xl rounded-[1.75rem] bg-slate-50/90 p-5 ring-1 ring-slate-200 dark:bg-zinc-950 dark:ring-zinc-800">
              <p className="text-lg font-black tracking-tight text-slate-950 dark:text-white">
                {isSuccess ? 'Everything is saved and ready.' : activeStep.label}
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 dark:text-zinc-300">
                {detail}
              </p>
              <div className="mt-5">
                <ProgressBar
                  value={progressValue}
                  label="Course generation progress"
                  tone={isSuccess ? 'emerald' : 'sky'}
                  size="lg"
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs font-black uppercase tracking-[0.16em] text-slate-400 dark:text-zinc-500">
                <span>Creating sections, units, and lessons</span>
                <span>{progressValue}% complete</span>
              </div>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute left-4 top-10 hidden h-16 w-16 rounded-3xl bg-amber-100/90 ring-1 ring-amber-200 lg:block" aria-hidden="true" />
            <div className="absolute right-3 top-3 hidden h-12 w-12 rounded-full bg-emerald-200/80 lg:block motion-safe:animate-pulse" aria-hidden="true" />
            <div className="absolute -left-1 bottom-12 hidden h-14 w-14 rounded-2xl bg-violet-100/90 ring-1 ring-violet-200 lg:block" aria-hidden="true" />
            <div className="rounded-[2rem] bg-gradient-to-br from-emerald-50 to-sky-50 p-4 ring-1 ring-emerald-100 shadow-lg shadow-emerald-100/60 dark:bg-zinc-950 dark:ring-zinc-800">
              <img
                src={isSuccess ? ROBOT_GRAPHICS.celebration : ROBOT_GRAPHICS.workflow}
                alt={isSuccess ? 'Robot celebrating a completed course' : 'Robot assembling a course workflow'}
                className="mx-auto h-80 w-full object-contain"
              />
            </div>
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


function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

function isTextLikeFile(file: File): boolean {
  if (file.type.startsWith('text/')) {
    return true;
  }

  return TEXT_LIKE_EXTENSIONS.has(getFileExtension(file.name));
}

function formatFileUploadBlock(fileName: string, contents: string): string {
  return [`Uploaded file: ${fileName}`, '```', contents.trim(), '```'].join('\n');
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
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [uploadedFileNames, setUploadedFileNames] = useState<string[]>([]);
  const [isDraggingSourceFile, setIsDraggingSourceFile] = useState(false);

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
    setUploadNotice(null);
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
    setUploadedFileNames([]);
    resetMessages();
    setActiveStepIndex(-1);
  }

  async function handleSourceFiles(files: FileList | File[]) {
    const selectedFiles = Array.from(files).slice(0, MAX_UPLOAD_FILES_PER_BATCH);

    if (!selectedFiles.length) {
      return;
    }

    const acceptedBlocks: string[] = [];
    const acceptedNames: string[] = [];
    const skippedNames: string[] = [];

    for (const file of selectedFiles) {
      if (file.size > MAX_UPLOAD_FILE_BYTES || !isTextLikeFile(file)) {
        skippedNames.push(file.name);
        continue;
      }

      try {
        const fileText = await file.text();
        const cleanedFileText = fileText.trim();

        if (!cleanedFileText) {
          skippedNames.push(file.name);
          continue;
        }

        acceptedBlocks.push(formatFileUploadBlock(file.name, cleanedFileText));
        acceptedNames.push(file.name);
      } catch {
        skippedNames.push(file.name);
      }
    }

    if (acceptedBlocks.length > 0) {
      setSourceMaterial((currentMaterial) =>
        [currentMaterial.trim(), ...acceptedBlocks].filter(Boolean).join('\n\n')
      );
      setUploadedFileNames((currentNames) => [...currentNames, ...acceptedNames]);
      setError(null);
      setSuccessMessage(null);
      setLastWarning(null);
    }

    if (skippedNames.length > 0) {
      setUploadNotice(
        `Added ${acceptedNames.length} file${acceptedNames.length === 1 ? '' : 's'}. Skipped unsupported or oversized file${skippedNames.length === 1 ? '' : 's'}: ${skippedNames.join(', ')}.`
      );
      return;
    }

    setUploadNotice(`Added ${acceptedNames.length} file${acceptedNames.length === 1 ? '' : 's'} to the learning material.`);
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = event.target.files;
    event.target.value = '';

    if (selectedFiles) {
      void handleSourceFiles(selectedFiles);
    }
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsDraggingSourceFile(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDraggingSourceFile(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingSourceFile(false);

    if (event.dataTransfer.files.length > 0) {
      void handleSourceFiles(event.dataTransfer.files);
    }
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
      await advanceToStep(1, 320);
      await advanceToStep(2, 320);
      await advanceToStep(3, 320);
      setActiveStepIndex(4);
      generatedCourse = await generateCourseForCurrentMode(currentSettings);
      await advanceToStep(5, 320);
      await advanceToStep(6, 240);

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
      {isGenerating || successMessage ? (
        <FullScreenGenerationOverlay
          activeStepIndex={activeStepIndex}
          isSuccess={Boolean(successMessage)}
          generationModeLabel={generationModeLabel}
        />
      ) : null}

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
          <div className="relative overflow-hidden rounded-[1.9rem] bg-gradient-to-br from-emerald-50 to-sky-50 p-5 ring-1 ring-emerald-100 sm:p-6">
            <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/60 blur-3xl" aria-hidden="true" />
            <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-center">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">
                  Source readiness
                </p>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                  Turn anything into a Duolingo-style learning path
                </h3>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
                  More detail usually creates better lessons. Short sources still work, especially in mock mode.
                </p>
                <div className="mt-5 max-w-lg">
                  <ProgressBar
                    value={Math.min(100, Math.round((trimmedSourceMaterial.length / 900) * 100))}
                    label="Source material readiness"
                    tone={isShortMaterial ? 'amber' : 'emerald'}
                  />
                  <p className="mt-2 text-right text-xs font-black uppercase tracking-[0.15em] text-slate-500">
                    {characterCount.toLocaleString()} chars
                  </p>
                </div>
              </div>

              <div className="pointer-events-none mx-auto w-full max-w-56">
                <img
                  src={ROBOT_GRAPHICS.workflow}
                  alt="Robot turning material into lesson cards"
                  className="mx-auto h-52 w-full object-contain"
                />
              </div>
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

              <div
                className={classNames(
                  'rounded-[1.5rem] border-2 border-dashed p-5 text-center transition',
                  isDraggingSourceFile
                    ? 'border-emerald-400 bg-emerald-50 ring-4 ring-emerald-100'
                    : 'border-slate-200 bg-slate-50 hover:border-emerald-300 hover:bg-emerald-50/60'
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  id="source-file-upload"
                  type="file"
                  multiple
                  accept={ACCEPTED_SOURCE_FILE_TYPES}
                  onChange={handleFileInputChange}
                  disabled={isGenerating}
                  className="sr-only"
                />
                <p className="text-sm font-black text-slate-950">Drop files here, or upload course material</p>
                <p className="mx-auto mt-2 max-w-md text-xs font-bold leading-5 text-slate-500">
                  Supports text-like files such as TXT, Markdown, CSV, JSON, HTML, subtitles, and logs.
                </p>
                <label
                  htmlFor="source-file-upload"
                  className="mt-4 inline-flex cursor-pointer rounded-2xl bg-white px-4 py-3 text-sm font-black text-emerald-700 ring-1 ring-emerald-200 transition hover:-translate-y-0.5 hover:bg-emerald-50"
                >
                  Choose files
                </label>
                {uploadedFileNames.length > 0 ? (
                  <p className="mt-3 text-xs font-black text-slate-500">
                    Added: {uploadedFileNames.slice(-3).join(', ')}{uploadedFileNames.length > 3 ? ' …' : ''}
                  </p>
                ) : null}
              </div>

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

            <aside className="relative overflow-hidden rounded-[1.75rem] bg-slate-50 p-4 ring-1 ring-slate-200 sm:p-5">
              <div className="absolute -right-8 top-1 h-28 w-28 rounded-full bg-emerald-100/70 blur-2xl" aria-hidden="true" />
              <div className="relative">
                <div className="mx-auto max-w-sm">
                  <img src={ROBOT_GRAPHICS.teacher} alt="Robot teaching at a whiteboard" className="mx-auto h-52 w-full object-contain" />
                </div>
                <div className="mt-2">
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-600">
                    Course settings
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Current generation mode: <span className="font-black text-slate-800">{generationModeLabel}</span>.
                    Adjust defaults any time in Settings.
                  </p>
                </div>

                <div className="mt-5 space-y-4">
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
              </div>
            </aside>
          </div>

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

          {uploadNotice ? (
            <NoticeBanner tone="info" title="Files added">
              {uploadNotice}
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
