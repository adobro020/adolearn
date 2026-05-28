import { getCourses } from './courseService';
import { getCourseProgress } from './progressService';
import type { Course, Exercise, Lesson } from '../types/course';
import type { CourseProgress, WeakConcept } from '../types/progress';

export interface ReviewSourceItem {
  id: string;
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
  exerciseId: string;
  exercise: Exercise;
  priority: number;
  reasons: string[];
  weakMisses: number;
  lastMissedAt?: string;
  completedAt?: string | null;
}

export interface ReviewSession {
  id: string;
  scopeCourseId: string | null;
  lesson: Lesson;
  sourceItems: ReviewSourceItem[];
  reasonSummary: string[];
  totalAvailableItems: number;
  weakConcepts: WeakConcept[];
}

export interface ReviewSummary {
  totalItems: number;
  incorrectAnswerCount: number;
  weakConcepts: WeakConcept[];
  courseCount: number;
}

interface LessonLookupItem {
  course: Course;
  lesson: Lesson;
}

interface CandidateRecord {
  item: ReviewSourceItem;
}

const MAX_REVIEW_EXERCISES = 10;
const MIN_TARGET_REVIEW_EXERCISES = 5;

function createId(prefix: string): string {
  const randomId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  return `${prefix}-${randomId}`;
}

function normalizeForId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

function getCourseLessonCount(course: Course): number {
  return course.sections.reduce(
    (sectionTotal, section) =>
      sectionTotal + section.units.reduce((unitTotal, unit) => unitTotal + unit.lessons.length, 0),
    0
  );
}

function getAllLessons(course: Course): Lesson[] {
  return course.sections.flatMap((section) => section.units.flatMap((unit) => unit.lessons));
}

function getCompletedLessonLookup(course: Course, progress: CourseProgress | null): LessonLookupItem[] {
  if (!progress) {
    return [];
  }

  const completedLessonIds = new Set(progress.completedLessons);

  return getAllLessons(course)
    .filter((lesson) => completedLessonIds.has(lesson.id))
    .map((lesson) => ({ course, lesson }));
}

function findLesson(course: Course, lessonId: string): Lesson | null {
  return getAllLessons(course).find((lesson) => lesson.id === lessonId) ?? null;
}

function findExercise(course: Course, lessonId: string, exerciseId: string): Exercise | null {
  const lesson = findLesson(course, lessonId);
  return lesson?.exercises.find((exercise) => exercise.id === exerciseId) ?? null;
}

function getWeakConceptMisses(progress: CourseProgress | null, concept?: string): number {
  if (!progress || !concept) {
    return 0;
  }

  return progress.weakConcepts.find((weakConcept) => weakConcept.concept === concept)?.misses ?? 0;
}

function getCompletedAt(progress: CourseProgress | null, lessonId: string): string | null {
  return progress?.lessonProgress[lessonId]?.completedAt ?? null;
}

function getDaysSince(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return 0;
  }

  const elapsedMs = Date.now() - timestamp;
  return Math.max(0, Math.floor(elapsedMs / (24 * 60 * 60 * 1000)));
}

function addCandidate(
  candidates: Map<string, CandidateRecord>,
  item: Omit<ReviewSourceItem, 'id' | 'priority' | 'reasons' | 'weakMisses'> & {
    priority: number;
    reason: string;
    weakMisses?: number;
  }
) {
  const reviewExerciseId = `review-${normalizeForId(item.courseId)}-${normalizeForId(item.lessonId)}-${normalizeForId(
    item.exerciseId
  )}`;
  const existing = candidates.get(reviewExerciseId);

  if (existing) {
    existing.item.priority += item.priority;
    existing.item.weakMisses = Math.max(existing.item.weakMisses, item.weakMisses ?? 0);
    if (!existing.item.reasons.includes(item.reason)) {
      existing.item.reasons.push(item.reason);
    }
    if (item.lastMissedAt && !existing.item.lastMissedAt) {
      existing.item.lastMissedAt = item.lastMissedAt;
    }
    if (item.completedAt && !existing.item.completedAt) {
      existing.item.completedAt = item.completedAt;
    }
    return;
  }

  candidates.set(reviewExerciseId, {
    item: {
      id: reviewExerciseId,
      courseId: item.courseId,
      courseTitle: item.courseTitle,
      lessonId: item.lessonId,
      lessonTitle: item.lessonTitle,
      exerciseId: item.exerciseId,
      exercise: item.exercise,
      priority: item.priority,
      reasons: [item.reason],
      weakMisses: item.weakMisses ?? 0,
      lastMissedAt: item.lastMissedAt,
      completedAt: item.completedAt
    }
  });
}

function collectCourseCandidates(course: Course, progress: CourseProgress | null, candidates: Map<string, CandidateRecord>) {
  if (!progress) {
    return;
  }

  const courseLessonCount = getCourseLessonCount(course);
  const courseCompleted = courseLessonCount > 0 && progress.completedLessons.length >= courseLessonCount;

  progress.incorrectAnswers.forEach((incorrectAnswer) => {
    const exercise = findExercise(course, incorrectAnswer.lessonId, incorrectAnswer.exerciseId);
    const lesson = findLesson(course, incorrectAnswer.lessonId);

    if (!exercise || !lesson) {
      return;
    }

    const weakMisses = getWeakConceptMisses(progress, exercise.concept);

    addCandidate(candidates, {
      courseId: course.id,
      courseTitle: course.title,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      exerciseId: exercise.id,
      exercise,
      priority: 100 + weakMisses * 12 + Math.max(0, 14 - getDaysSince(incorrectAnswer.missedAt)),
      reason: 'You missed this question before',
      weakMisses,
      lastMissedAt: incorrectAnswer.missedAt,
      completedAt: getCompletedAt(progress, lesson.id)
    });
  });

  progress.weakConcepts.forEach((weakConcept) => {
    const matchingLessons = getCompletedLessonLookup(course, progress);

    matchingLessons.forEach(({ lesson }) => {
      lesson.exercises
        .filter((exercise) => exercise.concept === weakConcept.concept)
        .forEach((exercise) => {
          addCandidate(candidates, {
            courseId: course.id,
            courseTitle: course.title,
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            exerciseId: exercise.id,
            exercise,
            priority: 60 + weakConcept.misses * 15,
            reason: `Weak concept: ${weakConcept.concept}`,
            weakMisses: weakConcept.misses,
            lastMissedAt: weakConcept.lastMissedAt,
            completedAt: getCompletedAt(progress, lesson.id)
          });
        });
    });
  });

  getCompletedLessonLookup(course, progress).forEach(({ lesson }) => {
    const completedAt = getCompletedAt(progress, lesson.id);
    const ageBonus = Math.min(30, getDaysSince(completedAt));

    lesson.exercises.forEach((exercise) => {
      addCandidate(candidates, {
        courseId: course.id,
        courseTitle: course.title,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        exerciseId: exercise.id,
        exercise,
        priority: 20 + ageBonus + getWeakConceptMisses(progress, exercise.concept) * 5,
        reason: ageBonus > 0 ? 'Older completed lesson review' : 'Completed lesson review',
        weakMisses: getWeakConceptMisses(progress, exercise.concept),
        completedAt
      });
    });
  });

  if (courseCompleted) {
    getCompletedLessonLookup(course, progress).forEach(({ lesson }) => {
      lesson.exercises.forEach((exercise) => {
        addCandidate(candidates, {
          courseId: course.id,
          courseTitle: course.title,
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          exerciseId: exercise.id,
          exercise,
          priority: 10,
          reason: 'Completed course review',
          weakMisses: getWeakConceptMisses(progress, exercise.concept),
          completedAt: getCompletedAt(progress, lesson.id)
        });
      });
    });
  }
}

function selectReviewItems(items: ReviewSourceItem[]): ReviewSourceItem[] {
  const sortedItems = [...items].sort(
    (a, b) =>
      b.priority - a.priority ||
      b.weakMisses - a.weakMisses ||
      a.courseTitle.localeCompare(b.courseTitle) ||
      a.lessonTitle.localeCompare(b.lessonTitle)
  );
  const selected: ReviewSourceItem[] = [];
  const selectedIds = new Set<string>();
  const selectedTypes = new Set<string>();
  const maxCount = Math.min(MAX_REVIEW_EXERCISES, sortedItems.length);

  sortedItems.forEach((item) => {
    if (selected.length >= maxCount) {
      return;
    }

    if (!selectedTypes.has(item.exercise.type)) {
      selected.push(item);
      selectedIds.add(item.id);
      selectedTypes.add(item.exercise.type);
    }
  });

  sortedItems.forEach((item) => {
    if (selected.length >= maxCount || selectedIds.has(item.id)) {
      return;
    }

    selected.push(item);
    selectedIds.add(item.id);
  });

  return selected.slice(0, Math.max(Math.min(MIN_TARGET_REVIEW_EXERCISES, sortedItems.length), selected.length));
}

function cloneExerciseForReview(item: ReviewSourceItem): Exercise {
  return {
    ...item.exercise,
    id: item.id,
    choices: item.exercise.choices ? [...item.exercise.choices] : undefined,
    acceptedAnswers: item.exercise.acceptedAnswers ? [...item.exercise.acceptedAnswers] : undefined,
    pairs: item.exercise.pairs ? [...item.exercise.pairs] : undefined,
    items: item.exercise.items ? [...item.exercise.items] : undefined,
    correctOrder: item.exercise.correctOrder ? [...item.exercise.correctOrder] : undefined,
    sourceReference: {
      ...item.exercise.sourceReference,
      sourceId: item.courseId,
      title: `${item.courseTitle} · ${item.lessonTitle}`,
      location: 'Review Mode'
    }
  };
}

function createReasonSummary(items: ReviewSourceItem[]): string[] {
  const reasonCounts = new Map<string, number>();

  items.forEach((item) => {
    item.reasons.forEach((reason) => {
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    });
  });

  return Array.from(reasonCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([reason, count]) => `${reason} (${count})`);
}

function getScopedCourses(scopeCourseId?: string | null): Course[] {
  const courses = getCourses();
  return scopeCourseId ? courses.filter((course) => course.id === scopeCourseId) : courses;
}

export function getReviewCandidates(scopeCourseId?: string | null): ReviewSourceItem[] {
  const candidates = new Map<string, CandidateRecord>();

  getScopedCourses(scopeCourseId).forEach((course) => {
    collectCourseCandidates(course, getCourseProgress(course.id), candidates);
  });

  return Array.from(candidates.values()).map(({ item }) => item);
}

export function getReviewSummary(scopeCourseId?: string | null): ReviewSummary {
  const courses = getScopedCourses(scopeCourseId);
  const weakConceptMap = new Map<string, WeakConcept>();
  let incorrectAnswerCount = 0;

  courses.forEach((course) => {
    const progress = getCourseProgress(course.id);

    if (!progress) {
      return;
    }

    incorrectAnswerCount += progress.incorrectAnswers.length;

    progress.weakConcepts.forEach((weakConcept) => {
      const existingConcept = weakConceptMap.get(weakConcept.concept);
      if (!existingConcept || weakConcept.misses > existingConcept.misses) {
        weakConceptMap.set(weakConcept.concept, weakConcept);
      }
    });
  });

  return {
    totalItems: getReviewCandidates(scopeCourseId).length,
    incorrectAnswerCount,
    weakConcepts: Array.from(weakConceptMap.values()).sort(
      (a, b) => b.misses - a.misses || a.concept.localeCompare(b.concept)
    ),
    courseCount: courses.length
  };
}

export function createReviewSession(scopeCourseId?: string | null): ReviewSession | null {
  const candidates = getReviewCandidates(scopeCourseId);

  if (candidates.length === 0) {
    return null;
  }

  const selectedItems = selectReviewItems(candidates);
  const sessionId = createId('review-session');
  const lesson: Lesson = {
    id: sessionId,
    title: 'Review Session',
    type: 'review',
    estimatedMinutes: Math.max(3, selectedItems.length * 2),
    learningObjectives: [
      'Practice questions from weak concepts and missed answers.',
      'Reinforce older completed lessons without unlocking new course content.',
      'Build recall with a mixed set of review exercises.'
    ],
    summary: 'A focused review session built from your saved local progress.',
    exercises: selectedItems.map(cloneExerciseForReview)
  };

  return {
    id: sessionId,
    scopeCourseId: scopeCourseId ?? null,
    lesson,
    sourceItems: selectedItems,
    reasonSummary: createReasonSummary(selectedItems),
    totalAvailableItems: candidates.length,
    weakConcepts: getReviewSummary(scopeCourseId).weakConcepts
  };
}
