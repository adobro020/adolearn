import { useEffect, useMemo, useState } from 'react';
import { PageCard } from '../components/PageCard';
import { NoticeBanner, ProgressBar, ProgressRing } from '../components/Polish';
import { getCourseById } from '../services/courseService';
import { getCourseProgress, initializeCourseProgress, unlockLesson } from '../services/progressService';
import { getReviewSummary } from '../services/reviewService';
import type { Course, Lesson } from '../types/course';
import type { CourseProgress } from '../types/progress';
import { classNames } from '../utils/classNames';
import { ROBOT_GRAPHICS } from '../data/mascotGraphics';

interface CourseMapPageProps {
  courseId: string | null;
  onBackToDashboard: () => void;
  onCreateCourse: () => void;
  onOpenLesson: (courseId: string, lessonId: string) => void;
  onOpenReview: (courseId: string) => void;
}

interface NumberedLesson {
  lesson: Lesson;
  globalLessonNumber: number;
}

function getAllLessons(course: Course): Lesson[] {
  return course.sections.flatMap((section) =>
    section.units.flatMap((unit) => unit.lessons)
  );
}

function getLessonCount(course: Course): number {
  return getAllLessons(course).length;
}

function calculateCourseProgress(course: Course, progress: CourseProgress | null): number {
  const totalLessons = getLessonCount(course);

  if (!progress || totalLessons === 0) {
    return 0;
  }

  return Math.round((progress.completedLessons.length / totalLessons) * 100);
}

function calculateLessonGroupProgress(lessons: Lesson[], progress: CourseProgress | null): number {
  if (!progress || lessons.length === 0) {
    return 0;
  }

  const completedCount = lessons.filter((lesson) => progress.completedLessons.includes(lesson.id)).length;
  return Math.round((completedCount / lessons.length) * 100);
}

function getUnitLessons(unit: Course['sections'][number]['units'][number]): Lesson[] {
  return unit.lessons;
}

function getSectionLessons(section: Course['sections'][number]): Lesson[] {
  return section.units.flatMap((unit) => unit.lessons);
}

function calculateCourseXP(progress: CourseProgress | null): number {
  if (!progress) {
    return 0;
  }

  if (typeof progress.xpEarned === 'number') {
    return progress.xpEarned;
  }

  return progress.completedLessons.reduce((total, lessonId) => {
    const score = progress.lessonScores[lessonId] ?? 70;
    return total + Math.max(5, Math.round(score / 10));
  }, 0);
}

function getCurrentLessonId(course: Course, progress: CourseProgress | null): string | null {
  const lessons = getAllLessons(course);

  if (!progress) {
    return lessons[0]?.id ?? null;
  }

  const currentUnlockedLesson = lessons.find(
    (lesson) =>
      progress.unlockedLessons.includes(lesson.id) &&
      !progress.completedLessons.includes(lesson.id)
  );

  return currentUnlockedLesson?.id ?? lessons[0]?.id ?? null;
}

function getLessonKindLabel(lesson: Lesson): string {
  if (lesson.type === 'review') {
    return 'Review';
  }

  if (lesson.type === 'final_challenge') {
    return 'Final challenge';
  }

  return 'Lesson';
}

function getLessonBadge(lesson: Lesson, lessonNumber: number, completed: boolean, unlocked: boolean) {
  if (completed) {
    return '✓';
  }

  if (!unlocked) {
    return '🔒';
  }

  if (lesson.type === 'review') {
    return '↻';
  }

  if (lesson.type === 'final_challenge') {
    return '★';
  }

  return lessonNumber.toString();
}

function LessonNode({
  lesson,
  lessonNumber,
  completed,
  unlocked,
  current,
  onClick
}: {
  lesson: Lesson;
  lessonNumber: number;
  completed: boolean;
  unlocked: boolean;
  current: boolean;
  onClick: () => void;
}) {
  const isReview = lesson.type === 'review';
  const isFinalChallenge = lesson.type === 'final_challenge';
  const canOpen = unlocked || completed;

  return (
    <li className="relative flex gap-4 py-4 first:pt-1 last:pb-1 sm:gap-5">
      <div className="relative z-10 flex flex-col items-center">
        <button
          type="button"
          onClick={onClick}
          className={classNames(
            'flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-black shadow-sm ring-4 transition duration-200 active:scale-95 sm:h-20 sm:w-20 sm:text-2xl',
            completed && 'bg-emerald-500 text-white ring-emerald-100 hover:-translate-y-1',
            !completed && current && 'animate-[pulse_2.4s_ease-in-out_infinite] bg-white text-emerald-700 shadow-xl shadow-emerald-200/70 ring-emerald-200 hover:-translate-y-1',
            !completed && !current && canOpen && !isReview && !isFinalChallenge &&
              'bg-white text-slate-900 ring-slate-200 hover:-translate-y-1 hover:ring-emerald-200',
            !completed && canOpen && isReview &&
              'bg-sky-500 text-white ring-sky-100 hover:-translate-y-1',
            !completed && canOpen && isFinalChallenge &&
              'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white ring-violet-100 hover:-translate-y-1',
            !canOpen && 'bg-slate-100 text-slate-400 ring-slate-200 hover:bg-slate-200'
          )}
          aria-label={`${canOpen ? 'Open' : 'Locked'} ${getLessonKindLabel(lesson)} ${lessonNumber}: ${lesson.title}`}
        >
          <span aria-hidden="true">{getLessonBadge(lesson, lessonNumber, completed, unlocked)}</span>
        </button>
      </div>

      <button
        type="button"
        onClick={onClick}
        className={classNames(
          'min-w-0 flex-1 rounded-3xl p-4 text-left ring-1 transition duration-200 active:scale-[0.99] sm:p-5',
          completed && 'bg-emerald-50 ring-emerald-100 hover:-translate-y-0.5 hover:bg-emerald-100/70',
          !completed && current && 'bg-white shadow-lg shadow-emerald-100 ring-emerald-200 hover:-translate-y-0.5',
          !completed && canOpen && !current && 'bg-white ring-slate-200 hover:-translate-y-0.5 hover:ring-emerald-200',
          !canOpen && 'bg-slate-50 ring-slate-200 hover:bg-slate-100'
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={classNames(
              'rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em]',
              isFinalChallenge && 'bg-violet-100 text-violet-700',
              isReview && 'bg-sky-100 text-sky-700',
              !isFinalChallenge && !isReview && completed && 'bg-emerald-100 text-emerald-700',
              !isFinalChallenge && !isReview && !completed && canOpen && 'bg-slate-100 text-slate-600',
              !canOpen && 'bg-slate-200 text-slate-500'
            )}
          >
            {getLessonKindLabel(lesson)} {lessonNumber}
          </span>
          {current ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700">
              Current
            </span>
          ) : null}
          {completed ? (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
              Complete
            </span>
          ) : null}
          {!canOpen ? (
            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-black text-slate-500">
              Locked
            </span>
          ) : null}
        </div>

        <h4 className="mt-3 text-base font-black tracking-tight text-slate-950 sm:text-lg">
          {lesson.title}
        </h4>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {lesson.summary || 'A bite-sized lesson with quick practice exercises.'}
        </p>
        <p className="mt-3 text-sm font-black text-slate-500">
          {lesson.estimatedMinutes} min · {lesson.exercises.length} exercises
        </p>
      </button>
    </li>
  );
}

export function CourseMapPage({
  courseId,
  onBackToDashboard,
  onCreateCourse,
  onOpenLesson,
  onOpenReview
}: CourseMapPageProps) {
  const [course, setCourse] = useState<Course | null>(null);
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [lockedMessage, setLockedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) {
      setCourse(null);
      setProgress(null);
      return;
    }

    const savedCourse = getCourseById(courseId) ?? null;
    setCourse(savedCourse);

    if (!savedCourse) {
      setProgress(null);
      return;
    }

    const savedProgress = getCourseProgress(savedCourse.id) ?? initializeCourseProgress(savedCourse);
    const firstLessonId = getAllLessons(savedCourse)[0]?.id;
    const progressWithFirstLesson =
      firstLessonId && savedProgress.unlockedLessons.length === 0
        ? unlockLesson(savedCourse.id, firstLessonId)
        : savedProgress;

    setProgress(progressWithFirstLesson);
  }, [courseId]);

  const totalLessons = useMemo(() => (course ? getLessonCount(course) : 0), [course]);
  const percentComplete = useMemo(
    () => (course ? calculateCourseProgress(course, progress) : 0),
    [course, progress]
  );
  const xpEarned = useMemo(() => calculateCourseXP(progress), [progress]);
  const currentLessonId = useMemo(
    () => (course ? getCurrentLessonId(course, progress) : null),
    [course, progress]
  );
  const reviewSummary = useMemo(() => (course ? getReviewSummary(course.id) : null), [course, progress]);

  if (!course) {
    return (
      <PageCard
        eyebrow="Course map"
        title="Course not found"
        description="This course may have been deleted, or the saved data may no longer be available."
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-900/15"
          >
            Back to dashboard
          </button>
          <button
            type="button"
            onClick={onCreateCourse}
            className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200"
          >
            Create a course
          </button>
        </div>
      </PageCard>
    );
  }

  let lessonCounter = 0;

  function handleLessonClick(lesson: Lesson, unlocked: boolean, completed: boolean) {
    if (!course) {
      return;
    }

    if (unlocked || completed) {
      setLockedMessage(null);
      onOpenLesson(course.id, lesson.id);
      return;
    }

    setLockedMessage(
      `“${lesson.title}” is locked. Complete the current unlocked lesson first to keep moving along the path.`
    );
  }

  return (
    <div className="space-y-6">
      <PageCard
        eyebrow="Course map"
        title={course.title}
        description={course.description || 'Follow the path section by section. Tap an unlocked lesson to practice.'}
      >
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl bg-emerald-50 p-5 ring-1 ring-emerald-100">
              <ProgressRing
                value={percentComplete}
                label="Course progress"
                caption={`${progress?.completedLessons.length ?? 0}/${totalLessons} lessons complete`}
              />
            </div>
            <div className="rounded-3xl bg-amber-50 p-5 ring-1 ring-amber-100">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-amber-600">
                Course XP
              </p>
              <p className="mt-3 text-4xl font-black text-slate-950 motion-safe:animate-pop-in">{xpEarned}</p>
            </div>
            <div className="rounded-3xl bg-sky-50 p-5 ring-1 ring-sky-100">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-sky-600">
                Lessons
              </p>
              <p className="mt-3 text-4xl font-black text-slate-950">{totalLessons}</p>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              <span>Path progress</span>
              <span>
                {progress?.completedLessons.length ?? 0}/{totalLessons} lessons
              </span>
            </div>
            <ProgressBar value={percentComplete} label="Course path progress" size="lg" tone="violet" />
          </div>

          <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-amber-50 to-orange-50 p-5 ring-1 ring-amber-100 sm:p-6">
            <div className="absolute -right-6 bottom-0 hidden md:block" aria-hidden="true">
              <img src={ROBOT_GRAPHICS.audio} alt="" className="h-36 w-auto object-contain" />
            </div>
            <div className="relative flex flex-col gap-4 md:pr-36 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
              <div className="flex items-center gap-4">
                <img src={ROBOT_GRAPHICS.audio} alt="Robot reviewing audio notes" className="h-20 w-20 shrink-0 object-contain md:hidden" />
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-amber-700">
                    Review this course
                  </p>
                  <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
                    {reviewSummary?.totalItems ?? 0} review items available from missed questions, weak concepts, and completed lessons.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenReview(course.id)}
                className="w-full rounded-2xl bg-amber-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-amber-200 transition hover:-translate-y-0.5 hover:bg-amber-600 sm:w-auto"
              >
                Start Review
              </button>
            </div>
          </div>

          {lockedMessage ? (
            <NoticeBanner tone="warning" title="Lesson locked">
              {lockedMessage} Look for the highlighted current lesson to continue.
            </NoticeBanner>
          ) : null}

          <button
            type="button"
            onClick={onBackToDashboard}
            className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:bg-slate-50"
          >
            ← Back to dashboard
          </button>
        </div>
      </PageCard>

      <section className="space-y-6" aria-label="Learning path">
        {course.sections.map((section, sectionIndex) => {
          const sectionLessons = getSectionLessons(section);
          const sectionProgress = calculateLessonGroupProgress(sectionLessons, progress);

          return (
          <article
            key={section.id}
            className="rounded-[2rem] bg-white p-5 shadow-sm shadow-slate-200 ring-1 ring-slate-200 transition duration-200 hover:shadow-lg hover:shadow-slate-200/70 sm:p-6"
          >
            <div className="mb-5 rounded-3xl bg-gradient-to-br from-emerald-50 to-sky-50 p-5 ring-1 ring-emerald-100">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-600">
                    Section {sectionIndex + 1}
                  </p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                    {section.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{section.description}</p>
                </div>
                <ProgressRing
                  value={sectionProgress}
                  label="Section progress"
                  caption={`${sectionLessons.filter((lesson) => progress?.completedLessons.includes(lesson.id)).length}/${sectionLessons.length} done`}
                  size={78}
                />
              </div>
            </div>

            <div className="space-y-5">
              {section.units.map((unit, unitIndex) => {
                const numberedLessons: NumberedLesson[] = unit.lessons.map((lesson) => {
                  lessonCounter += 1;
                  return {
                    lesson,
                    globalLessonNumber: lessonCounter
                  };
                });
                const unitLessons = getUnitLessons(unit);
                const unitProgress = calculateLessonGroupProgress(unitLessons, progress);

                return (
                  <div
                    key={unit.id}
                    className="overflow-hidden rounded-[1.75rem] bg-slate-50 p-4 ring-1 ring-slate-200 sm:p-5"
                  >
                    <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-200">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                        Unit {unitIndex + 1}
                      </p>
                      <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                        {unit.title}
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{unit.description}</p>
                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                          <span>Unit progress</span>
                          <span>{unitProgress}%</span>
                        </div>
                        <ProgressBar value={unitProgress} label={`${unit.title} progress`} tone="sky" />
                      </div>
                    </div>

                    <div className="relative mt-5 pl-2 sm:pl-4">
                      <div
                        aria-hidden="true"
                        className="absolute bottom-8 left-10 top-8 w-1 rounded-full bg-gradient-to-b from-emerald-200 via-sky-200 to-violet-200 sm:left-14"
                      />
                      <ol>
                        {numberedLessons.map(({ lesson, globalLessonNumber }) => {
                          const completed = progress?.completedLessons.includes(lesson.id) ?? false;
                          const unlocked = progress?.unlockedLessons.includes(lesson.id) ?? false;
                          const current = lesson.id === currentLessonId && !completed && unlocked;

                          return (
                            <LessonNode
                              key={lesson.id}
                              lesson={lesson}
                              lessonNumber={globalLessonNumber}
                              completed={completed}
                              unlocked={unlocked}
                              current={current}
                              onClick={() => handleLessonClick(lesson, unlocked, completed)}
                            />
                          );
                        })}
                      </ol>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
          );
        })}
      </section>
    </div>
  );
}
