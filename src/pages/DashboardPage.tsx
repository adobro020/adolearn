import { useEffect, useMemo, useState } from 'react';
import { PageCard } from '../components/PageCard';
import { AnimatedNumber, EmptyState, ProgressBar, ProgressRing, SkeletonBlock } from '../components/Polish';
import type { Course } from '../types/course';
import type { CourseProgress, UserStats } from '../types/progress';
import { getCourses, deleteCourse } from '../services/courseService';
import {
  DEFAULT_USER_STATS,
  getCourseProgress,
  getUserStats,
  resetCourseProgress
} from '../services/progressService';
import { getReviewSummary } from '../services/reviewService';
import { ROBOT_GRAPHICS } from '../data/mascotGraphics';

interface DashboardPageProps {
  onCreateCourse: () => void;
  onOpenCourse: (courseId: string) => void;
  onOpenSettings: () => void;
  onOpenReview: (courseId?: string | null) => void;
}

interface CourseWithProgress {
  course: Course;
  progress: CourseProgress | null;
}

function getLessonCount(course: Course): number {
  return course.sections.reduce(
    (sectionTotal, section) =>
      sectionTotal +
      section.units.reduce((unitTotal, unit) => unitTotal + unit.lessons.length, 0),
    0
  );
}

function getProgressPercentage(course: Course, progress: CourseProgress | null): number {
  const totalLessons = getLessonCount(course);

  if (!progress || totalLessons === 0) {
    return 0;
  }

  return Math.round((progress.completedLessons.length / totalLessons) * 100);
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}

function getMostRecentCourse(coursesWithProgress: CourseWithProgress[]): CourseWithProgress | null {
  if (coursesWithProgress.length === 0) {
    return null;
  }

  return [...coursesWithProgress].sort((a, b) => {
    const aTime = new Date(a.progress?.lastStudiedAt ?? a.course.updatedAt).getTime();
    const bTime = new Date(b.progress?.lastStudiedAt ?? b.course.updatedAt).getTime();
    return bTime - aTime;
  })[0];
}

function StatTile({ label, value, suffix, icon }: { label: string; value: number; suffix?: string; icon: string }) {
  return (
    <article className="group relative overflow-hidden rounded-[1.75rem] bg-white p-5 shadow-sm shadow-slate-200 ring-1 ring-slate-200 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/80">
      <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-emerald-100/70 blur-xl transition group-hover:scale-125" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
          <p className="mt-3 text-4xl font-black text-slate-950">
            <AnimatedNumber value={value} />
          </p>
          {suffix ? <p className="mt-1 text-sm font-semibold text-slate-500">{suffix}</p> : null}
        </div>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-50 text-xl ring-1 ring-slate-100" aria-hidden="true">
          {icon}
        </span>
      </div>
    </article>
  );
}

function CourseCard({
  course,
  progress,
  onContinue,
  onReview,
  onDelete,
  reviewItemCount
}: CourseWithProgress & {
  onContinue: () => void;
  onReview: () => void;
  onDelete: () => void;
  reviewItemCount: number;
}) {
  const lessonCount = getLessonCount(course);
  const progressPercentage = getProgressPercentage(course, progress);
  const lastStudiedDate = formatDate(progress?.lastStudiedAt);

  return (
    <article className="group overflow-hidden rounded-[2rem] bg-white shadow-sm shadow-slate-200 ring-1 ring-slate-200 transition duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/80">
      <div className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-xl font-black tracking-tight text-slate-950">{course.title}</h3>
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
              {course.description || 'A bite-sized learning path generated from your material.'}
            </p>
          </div>
          <ProgressRing
            value={progressPercentage}
            label="Course progress"
            caption={`${progress?.completedLessons.length ?? 0}/${lessonCount} lessons`}
            size={74}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
            <p className="font-bold text-slate-500">Difficulty</p>
            <p className="mt-1 font-black text-slate-900">{course.difficulty}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
            <p className="font-bold text-slate-500">Style</p>
            <p className="mt-1 font-black text-slate-900">{course.style}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
            <p className="font-bold text-slate-500">Time</p>
            <p className="mt-1 font-black text-slate-900">{course.estimatedTotalMinutes} min</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
            <p className="font-bold text-slate-500">Sections</p>
            <p className="mt-1 font-black text-slate-900">{course.sections.length}</p>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-[0.16em] text-slate-400">
            <span>Progress</span>
            <span>
              {progress?.completedLessons.length ?? 0}/{lessonCount} lessons
            </span>
          </div>
          <ProgressBar value={progressPercentage} label={`${course.title} progress`} />
          {lastStudiedDate ? (
            <p className="mt-3 text-sm font-semibold text-slate-500">
              Last studied {lastStudiedDate}
            </p>
          ) : (
            <p className="mt-3 text-sm font-semibold text-slate-500">
              Not studied yet — start with the first unlocked lesson.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onContinue}
            aria-label={`Continue ${course.title}`}
            className="flex-1 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-slate-800"
          >
            Continue
          </button>
          <button
            type="button"
            onClick={onReview}
            aria-label={`Review ${course.title}`}
            className="rounded-2xl bg-amber-50 px-5 py-3 text-sm font-black text-amber-700 ring-1 ring-amber-100 transition hover:bg-amber-100"
          >
            Review {reviewItemCount > 0 ? `(${reviewItemCount})` : ''}
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${course.title}`}
            className="rounded-2xl bg-rose-50 px-5 py-3 text-sm font-black text-rose-700 ring-1 ring-rose-100 transition hover:bg-rose-100"
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}

function NewUserFeatureCard({
  title,
  description,
  imageSrc,
  imageAlt
}: {
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
}) {
  return (
    <article className="group overflow-hidden rounded-[2rem] bg-white/90 p-5 shadow-sm shadow-slate-200/80 ring-1 ring-slate-200/80 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/90 dark:bg-slate-950/90 dark:ring-slate-800">
      <div className="rounded-[1.5rem] bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-4 ring-1 ring-emerald-100 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 dark:ring-slate-800">
        <img src={imageSrc} alt={imageAlt} className="mx-auto h-56 w-full object-contain transition duration-300 group-hover:scale-[1.02]" />
      </div>
      <h3 className="mt-5 text-xl font-black tracking-tight text-slate-950 dark:text-white">{title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">{description}</p>
    </article>
  );
}

function NewUserDashboard({ onCreateCourse, onOpenSettings }: Pick<DashboardPageProps, 'onCreateCourse' | 'onOpenSettings'>) {
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2.5rem] bg-white/95 p-6 shadow-sm shadow-slate-200/80 ring-1 ring-slate-200/80 sm:p-8 lg:p-10 dark:bg-slate-950/95 dark:ring-slate-800">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-200/50 blur-3xl dark:bg-emerald-400/10" aria-hidden="true" />
        <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-sky-200/50 blur-3xl dark:bg-sky-400/10" aria-hidden="true" />

        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">Welcome to AdoStudy</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-[-0.055em] text-slate-950 sm:text-6xl dark:text-white">
              Turn your material into a polished learning experience.
            </h1>
            <p className="mt-5 max-w-2xl text-base font-semibold leading-8 text-slate-600 sm:text-lg dark:text-slate-300">
              AdoStudy helps new learners convert notes, uploads, transcripts, articles, and study guides into organized sections, focused lessons, and interactive practice.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onCreateCourse}
                className="rounded-2xl bg-slate-950 px-6 py-4 text-sm font-black text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-slate-800 dark:bg-emerald-400 dark:text-slate-950"
              >
                Create your first course
              </button>
              <button
                type="button"
                onClick={onOpenSettings}
                className="rounded-2xl bg-white px-6 py-4 text-sm font-black text-slate-700 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700"
              >
                Configure AI settings
              </button>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
                <p className="text-2xl font-black text-slate-950 dark:text-white">01</p>
                <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Upload or paste</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
                <p className="text-2xl font-black text-slate-950 dark:text-white">02</p>
                <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Generate a path</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
                <p className="text-2xl font-black text-slate-950 dark:text-white">03</p>
                <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Practice daily</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-5 rounded-[3rem] bg-gradient-to-br from-emerald-200/40 to-sky-200/40 blur-2xl dark:from-emerald-400/10 dark:to-sky-400/10" aria-hidden="true" />
            <div className="relative rounded-[2.25rem] bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-5 ring-1 ring-emerald-100 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 dark:ring-slate-800">
              <img src={ROBOT_GRAPHICS.workflow} alt="AdoStudy robot organizing learning cards" className="mx-auto h-[28rem] w-full object-contain" />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <NewUserFeatureCard
          title="Organized from the start"
          description="Your source material becomes clear sections, units, and bite-sized lessons so learners know exactly where to begin."
          imageSrc={ROBOT_GRAPHICS.teacher}
          imageAlt="Robot teaching at a whiteboard"
        />
        <NewUserFeatureCard
          title="Practice that sticks"
          description="AdoStudy adds recall, matching, ordering, flashcards, and review prompts to help ideas become long-term knowledge."
          imageSrc={ROBOT_GRAPHICS.audio}
          imageAlt="Robot reviewing study notes"
        />
        <NewUserFeatureCard
          title="Progress saved locally"
          description="Courses, progress, review items, streaks, and XP are saved in this browser so the dashboard changes as you learn."
          imageSrc={ROBOT_GRAPHICS.celebration}
          imageAlt="Robot celebrating learning progress"
        />
      </section>

      <section className="overflow-hidden rounded-[2rem] bg-slate-950 p-6 text-white shadow-xl shadow-slate-900/20 sm:p-8 dark:bg-slate-900">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-300">Zero courses detected</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Create a course to unlock your dashboard.</h2>
            <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-slate-300">
              This homepage appears only while local storage has no saved courses. Once you generate your first course, AdoLearn automatically switches to your normal dashboard with stats, reviews, and saved paths.
            </p>
          </div>
          <button
            type="button"
            onClick={onCreateCourse}
            className="rounded-2xl bg-emerald-400 px-6 py-4 text-sm font-black text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:-translate-y-0.5 hover:bg-emerald-300"
          >
            Start building
          </button>
        </div>
      </section>
    </div>
  );
}

export function DashboardPage({
  onCreateCourse,
  onOpenCourse,
  onOpenSettings,
  onOpenReview
}: DashboardPageProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState<UserStats>(DEFAULT_USER_STATS);
  const [hasLoaded, setHasLoaded] = useState(false);

  function loadDashboardData() {
    setCourses(getCourses());
    setStats(getUserStats());
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadDashboardData();
      setHasLoaded(true);
    }, 120);

    return () => window.clearTimeout(timer);
  }, []);

  const coursesWithProgress = useMemo<CourseWithProgress[]>(
    () =>
      courses.map((course) => ({
        course,
        progress: getCourseProgress(course.id)
      })),
    [courses]
  );

  const continueCourse = getMostRecentCourse(coursesWithProgress);
  const reviewSummary = useMemo(() => getReviewSummary(), [courses, stats]);
  const weakConceptPreview = reviewSummary.weakConcepts.slice(0, 3);
  const hasSavedCourses = courses.length > 0;

  useEffect(() => {
    try {
      window.localStorage.setItem(
        'adolearn_dashboard_variant',
        hasSavedCourses ? 'existing_user' : 'new_user'
      );
    } catch {
      // Dashboard mode still derives from saved courses if localStorage metadata cannot be written.
    }
  }, [hasSavedCourses]);

  function handleDeleteCourse(course: Course) {
    const confirmed = window.confirm(
      `Delete “${course.title}”? This will also remove its saved progress.`
    );

    if (!confirmed) {
      return;
    }

    deleteCourse(course.id);
    resetCourseProgress(course.id);
    loadDashboardData();
  }

  if (!hasLoaded) {
    return (
      <div className="space-y-6" aria-busy="true" aria-live="polite">
        <SkeletonBlock lines={4} className="min-h-56" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SkeletonBlock lines={2} />
          <SkeletonBlock lines={2} />
          <SkeletonBlock lines={2} />
          <SkeletonBlock lines={2} />
        </div>
        <SkeletonBlock lines={5} />
      </div>
    );
  }

  if (!hasSavedCourses) {
    return <NewUserDashboard onCreateCourse={onCreateCourse} onOpenSettings={onOpenSettings} />;
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-white/90 p-5 shadow-sm shadow-slate-200/80 ring-1 ring-slate-200/80 transition-colors sm:p-6">
        <div className="absolute -right-12 -top-16 h-56 w-56 rounded-full bg-emerald-100/70 blur-3xl" aria-hidden="true" />
        <div className="absolute -left-10 bottom-0 h-44 w-44 rounded-full bg-sky-100/60 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-4 right-2 hidden lg:block" aria-hidden="true">
          <img src={ROBOT_GRAPHICS.welcome} alt="" className="h-48 w-auto object-contain" />
        </div>
        <div className="relative flex flex-col gap-5 lg:pr-56">
          <div className="flex min-w-0 items-center gap-4">
            <img src={ROBOT_GRAPHICS.welcome} alt="AdoLearn robot waving" className="h-28 w-28 shrink-0 object-contain lg:hidden" />
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-600">Dashboard</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Ready for your next lesson?</h2>
              <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-600">
                Continue a saved path, create something new, or review the ideas that need another pass.
              </p>
            </div>
          </div>
          <div className="relative flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onCreateCourse}
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-slate-800"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => onOpenReview(null)}
              className="rounded-2xl bg-amber-300 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-amber-500/10 transition hover:-translate-y-0.5 hover:bg-amber-200"
            >
              Review
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
            >
              Settings
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Learning stats">
        <StatTile label="Total XP" value={stats.totalXP} icon="⚡" />
        <StatTile label="Current streak" value={stats.currentStreak} suffix="days" icon="🔥" />
        <StatTile label="Saved courses" value={courses.length} icon="📚" />
        <StatTile label="Review items" value={reviewSummary.totalItems} icon="🎯" />
      </section>

      <PageCard
        eyebrow="Review Mode"
        title="Practice weak spots"
        description="Review Mode pulls from missed questions, weak concepts, and older completed lessons saved in browser storage."
      >
        <div className="space-y-5">
          <div className="rounded-[1.75rem] bg-gradient-to-br from-amber-50 to-orange-50 p-5 ring-1 ring-amber-100 sm:flex sm:items-center sm:justify-between sm:gap-6">
            <div className="flex items-center gap-4">
              <img src={ROBOT_GRAPHICS.audio} alt="Robot listening to study notes" className="hidden h-24 w-24 shrink-0 object-contain sm:block" />
              <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-amber-700">
                {reviewSummary.totalItems} review items available
              </p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                Strengthen what needs another pass
              </h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                {weakConceptPreview.length
                  ? `Top weak areas: ${weakConceptPreview.map((concept) => concept.concept).join(', ')}`
                  : 'Complete lessons and missed questions will appear here.'}
              </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenReview(null)}
              className="mt-4 w-full rounded-2xl bg-amber-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-amber-200 transition hover:-translate-y-0.5 hover:bg-amber-600 sm:mt-0 sm:w-auto"
            >
              Start Review
            </button>
          </div>
        </div>
      </PageCard>

      <PageCard
        eyebrow="Continue learning"
        title="Pick up where you left off"
        description="Jump back into the most recent course, or choose any saved course below."
      >
        {continueCourse ? (
          <div className="rounded-[1.75rem] bg-gradient-to-br from-emerald-50 to-sky-50 p-5 ring-1 ring-emerald-100 sm:flex sm:items-center sm:justify-between sm:gap-6">
            <div className="flex items-center gap-4">
              <img src={ROBOT_GRAPHICS.workflow} alt="Robot organizing course cards" className="hidden h-24 w-24 shrink-0 object-contain sm:block" />
              <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">
                Recommended next
              </p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                {continueCourse.course.title}
              </h3>
              <p className="mt-2 text-sm font-semibold text-slate-600">
                {getProgressPercentage(continueCourse.course, continueCourse.progress)}% complete
                {formatDate(continueCourse.progress?.lastStudiedAt)
                  ? ` · Last studied ${formatDate(continueCourse.progress?.lastStudiedAt)}`
                  : ' · Ready to start'}
              </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenCourse(continueCourse.course.id)}
              className="mt-4 w-full rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-200 transition hover:-translate-y-0.5 hover:bg-emerald-700 sm:mt-0 sm:w-auto"
            >
              Continue
            </button>
          </div>
        ) : (
          <EmptyState
            icon="📚"
            title="No courses yet"
            message="You have not created any courses yet. Paste your notes and turn them into a learning path."
          >
            <button
              type="button"
              onClick={onCreateCourse}
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5"
            >
              Create a new course
            </button>
          </EmptyState>
        )}
      </PageCard>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4 px-1">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-600">
              Saved courses
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
              Your learning paths
            </h2>
          </div>
          {courses.length > 0 ? (
            <button
              type="button"
              onClick={onCreateCourse}
              className="hidden rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 sm:inline-flex"
            >
              New course
            </button>
          ) : null}
        </div>

        {coursesWithProgress.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {coursesWithProgress.map(({ course, progress }) => (
              <CourseCard
                key={course.id}
                course={course}
                progress={progress}
                onContinue={() => onOpenCourse(course.id)}
                onReview={() => onOpenReview(course.id)}
                onDelete={() => handleDeleteCourse(course)}
                reviewItemCount={getReviewSummary(course.id).totalItems}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="✨"
            title="Start your first path"
            message="You have not created any courses yet. Paste your notes and turn them into a learning path."
          >
            <button
              type="button"
              onClick={onCreateCourse}
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5"
            >
              Create a new course
            </button>
            <button
              type="button"
              onClick={() => onOpenReview(null)}
              className="rounded-2xl bg-amber-300 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-amber-500/10 transition hover:-translate-y-0.5 hover:bg-amber-200"
            >
              Review Mode
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
            >
              Go to settings
            </button>
          </EmptyState>
        )}
      </section>
    </div>
  );
}
