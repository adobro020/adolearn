import { useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from 'react';
import { PageCard } from '../components/PageCard';
import { NoticeBanner, ProgressBar } from '../components/Polish';
import { DEMO_SOURCE_MATERIAL } from '../data/mockCourse';
import { generateCourseWithAI, AICourseGenerationError } from '../services/aiCourseGenerationService';
import { saveCourse } from '../services/courseService';
import { playLessonCompleteSound } from '../services/soundService';
import { initializeCourseProgress } from '../services/progressService';
import { getSettings } from '../services/settingsService';
import { isStorageAvailable } from '../services/storageService';
import type { Course } from '../types/course';
import type { AppSettings } from '../types/settings';
import { ROBOT_GRAPHICS } from '../data/mascotGraphics';
import { classNames } from '../utils/classNames';

interface CreateCoursePageProps {
  onCourseCreated: (courseId: string) => void;
}

interface GenerationStep {
  label: string;
  detail: string;
}


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

function getGenerationModeLabel(settings: AppSettings): string {
  return settings.modelName || 'AI';
}

function getVisibleStepIndex(activeStepIndex: number): number {
  return Math.min(Math.max(activeStepIndex, 0), GENERATION_STEPS.length - 1);
}

function FullScreenGenerationOverlay({
  isSuccess
}: {
  isSuccess: boolean;
}) {
  const headline = isSuccess ? 'Course ready' : 'Building your course';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-busy={!isSuccess}
    >
      <div className="relative w-full max-w-3xl overflow-hidden rounded-[2.5rem] bg-white p-6 text-center shadow-2xl shadow-slate-950/25 ring-1 ring-white/70 dark:bg-slate-950 dark:ring-zinc-800 sm:p-10">
        <div className="absolute -left-14 top-10 h-40 w-40 rounded-full bg-emerald-200/60 blur-3xl" aria-hidden="true" />
        <div className="absolute -right-8 bottom-0 h-56 w-56 rounded-full bg-sky-200/60 blur-3xl" aria-hidden="true" />

        <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-6">
          <img
            src={isSuccess ? ROBOT_GRAPHICS.celebration : ROBOT_GRAPHICS.workflow}
            alt={isSuccess ? 'Robot celebrating a completed course' : 'Robot assembling a course workflow'}
            className="h-64 w-full object-contain sm:h-80"
          />

          <h2 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            {headline}
          </h2>

          {isSuccess ? (
            <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500 text-3xl font-black text-white shadow-lg shadow-emerald-200" aria-hidden="true">
              ✓
            </div>
          ) : (
            <div
              className="h-16 w-16 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-500"
              aria-label="Loading"
              role="progressbar"
            />
          )}
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
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(-1);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastWarning, setLastWarning] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [uploadedFileNames, setUploadedFileNames] = useState<string[]>([]);
  const [isDraggingSourceFile, setIsDraggingSourceFile] = useState(false);
  const [isReadingSourceFiles, setIsReadingSourceFiles] = useState(false);

  const trimmedSourceMaterial = sourceMaterial.trim();
  const isShortMaterial =
    trimmedSourceMaterial.length > 0 &&
    trimmedSourceMaterial.length < MINIMUM_RECOMMENDED_CHARACTERS;
  const hasUploadedFiles = uploadedFileNames.length > 0;
  const characterCount = sourceMaterial.length;

  useEffect(() => {
    if (!isGenerating || successMessage) {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      setGenerationProgress((currentProgress) => {
        const currentStepMinimum = GENERATION_PROGRESS_MILESTONES[getVisibleStepIndex(activeStepIndex)] ?? 8;
        const baselineProgress = Math.max(currentProgress, currentStepMinimum);

        if (baselineProgress >= 94) {
          return baselineProgress;
        }

        const increment = baselineProgress < 35 ? 2 : baselineProgress < 75 ? 1 : 0.5;
        return Math.min(94, baselineProgress + increment);
      });
    }, 650);

    return () => window.clearInterval(timerId);
  }, [activeStepIndex, isGenerating, successMessage]);

  function resetMessages() {
    setError(null);
    setSuccessMessage(null);
    setLastWarning(null);
    setUploadNotice(null);
  }

  function handleUseDemoMaterial() {
    setSourceMaterial(DEMO_SOURCE_MATERIAL);
    setCourseTitle('Biology Basics: Cells and Energy');
    setUploadedFileNames([]);
    resetMessages();
    setActiveStepIndex(-1);
    setGenerationProgress(0);
  }

  function handleClear() {
    setCourseTitle('');
    setSourceMaterial('');
    setUploadedFileNames([]);
    resetMessages();
    setActiveStepIndex(-1);
    setGenerationProgress(0);
  }

  async function handleSourceFiles(files: FileList | File[]) {
    const selectedFiles = Array.from(files).slice(0, MAX_UPLOAD_FILES_PER_BATCH);

    if (!selectedFiles.length) {
      return;
    }

    const acceptedBlocks: string[] = [];
    const acceptedNames: string[] = [];
    const skippedNames: string[] = [];
    setIsReadingSourceFiles(true);

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
      setSourceMaterial(acceptedBlocks.join('\n\n'));
      setUploadedFileNames(acceptedNames);
      setError(null);
      setSuccessMessage(null);
      setLastWarning(null);
    }

    if (acceptedBlocks.length === 0) {
      setUploadNotice(
        'No readable course material was added. Try a text-based file, or paste the material into the text box.'
      );
      setIsReadingSourceFiles(false);
      return;
    }

    if (skippedNames.length > 0) {
      setUploadNotice(
        `Uploaded ${acceptedNames.length} readable file${acceptedNames.length === 1 ? '' : 's'}. Skipped unsupported or oversized file${skippedNames.length === 1 ? '' : 's'}: ${skippedNames.join(', ')}.`
      );
      setIsReadingSourceFiles(false);
      return;
    }

    setUploadNotice(`Uploaded ${acceptedNames.length} file${acceptedNames.length === 1 ? '' : 's'} successfully. The paste box is locked until you remove the file upload.`);
    setIsReadingSourceFiles(false);
  }

  function handleRemoveUploadedFiles() {
    setUploadedFileNames([]);
    setSourceMaterial('');
    setUploadNotice('File upload removed. You can paste material or upload a different file.');
    setError(null);
    setSuccessMessage(null);
    setLastWarning(null);
    setIsReadingSourceFiles(false);
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
    setGenerationProgress((currentProgress) =>
      Math.max(currentProgress, GENERATION_PROGRESS_MILESTONES[getVisibleStepIndex(index)] ?? currentProgress)
    );
    await sleep(duration);
  }

  async function generateCourseForCurrentMode(currentSettings: AppSettings): Promise<Course> {
    const result = await generateCourseWithAI({
      sourceMaterial: trimmedSourceMaterial,
      optionalTitle: courseTitle,
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

  async function handleGenerateCourse() {
    if (!trimmedSourceMaterial) {
      setError('Add learning material first by pasting text or uploading a readable text-based file.');
      setSuccessMessage(null);
      setLastWarning(null);
      setActiveStepIndex(-1);
      return;
    }

    resetMessages();
    setActiveStepIndex(0);
    setGenerationProgress(5);
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
            : 'The generated course could not be saved locally. Try again with shorter source material or a smaller course.'
        );
      }

      initializeCourseProgress(generatedCourse);
      playLessonCompleteSound();
      setSuccessMessage('Course generated and saved locally! Opening the course map...');
      setActiveStepIndex(GENERATION_STEPS.length);
      setGenerationProgress(100);
      await sleep(650);
      onCourseCreated(generatedCourse.id);
    } catch (generationError) {
      const message = formatGenerationError(generationError);
      setError(message);
      setActiveStepIndex((currentStepIndex) => (currentStepIndex < 0 ? 0 : currentStepIndex));
      setGenerationProgress((currentProgress) => Math.max(currentProgress, 12));
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      {isGenerating || successMessage ? (
        <FullScreenGenerationOverlay isSuccess={Boolean(successMessage)} />
      ) : null}

      <PageCard
        eyebrow="Create"
        title="Build a learning path"
        description="Paste notes, a transcript, an article, or a study guide. AdoLearn uses the Server proxy and your selected GPT-5 model to generate a structured course."
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
                  Turn anything into a structured learning path
                </h3>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
                  More detail usually creates better lessons. Short sources still work, but richer material usually creates better sections, units, and practice.
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
                  disabled={isGenerating || isReadingSourceFiles}
                  className="sr-only"
                />
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-xl shadow-sm ring-1 ring-slate-200" aria-hidden="true">
                  {isReadingSourceFiles ? '…' : hasUploadedFiles ? '✓' : '⇧'}
                </div>
                <p className="mt-3 text-sm font-black text-slate-950">
                  {isReadingSourceFiles ? 'Reading uploaded file…' : hasUploadedFiles ? 'File material is uploaded' : 'Drop files here, or upload course material'}
                </p>
                <p className="mx-auto mt-2 max-w-md text-xs font-bold leading-5 text-slate-500">
                  {hasUploadedFiles
                    ? 'AdoLearn will generate from the uploaded file content. Remove it to re-enable manual pasting.'
                    : 'Supports text-like files such as TXT, Markdown, CSV, JSON, HTML, subtitles, and logs.'}
                </p>
                {hasUploadedFiles ? (
                  <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-left ring-1 ring-emerald-200">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-600">Uploaded</p>
                    <p className="mt-1 truncate text-sm font-black text-slate-800">
                      {uploadedFileNames.join(', ')}
                    </p>
                    <button
                      type="button"
                      onClick={handleRemoveUploadedFiles}
                      disabled={isGenerating || isReadingSourceFiles}
                      className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 ring-1 ring-rose-100 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Remove file
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="source-file-upload"
                    className="mt-4 inline-flex cursor-pointer rounded-2xl bg-white px-4 py-3 text-sm font-black text-emerald-700 ring-1 ring-emerald-200 transition hover:-translate-y-0.5 hover:bg-emerald-50"
                  >
                    Choose files
                  </label>
                )}
              </div>

              <label htmlFor="source-material" className="block">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <span className="text-sm font-black text-slate-700">Learning material</span>
                  <span className="text-xs font-bold text-slate-400">
                    {hasUploadedFiles ? 'Paste disabled while file is uploaded' : `${characterCount.toLocaleString()} characters`}
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
                  disabled={isGenerating || hasUploadedFiles}
                  className="mt-2 min-h-72 w-full resize-y rounded-[1.5rem] border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                  placeholder={hasUploadedFiles ? 'Remove the uploaded file to paste material manually.' : 'Paste course notes, an article, a podcast transcript, lecture notes, or a study guide here...'}
                />
              </label>
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
              disabled={isGenerating || isReadingSourceFiles}
              aria-label="Generate AdoLearn course"
              className="rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none disabled:hover:translate-y-0 sm:min-w-48"
            >
              {isGenerating ? 'Generating...' : isReadingSourceFiles ? 'Reading file...' : 'Generate Course'}
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
