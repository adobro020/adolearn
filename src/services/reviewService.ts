import { getCourseById, getCourses } from './courseService';
import { getCourseProgress } from './progressService';
import type { Course, Exercise, Lesson } from '../types/course';
import type { WeakConcept } from '../types/progress';

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

function getAllLessons(course: Course): Lesson[] {
  return course.units.flatMap((unit) => unit.sections.flatMap((section) => section.lessons));
}

function cloneExerciseForReview(item: ReviewSourceItem): Exercise {
  return {
    ...item.exercise,
    id: item.id,
    choices: item.exercise.choices ? [...item.exercise.choices] : undefined,
    acceptedAnswers: item.exercise.acceptedAnswers ? [...item.exercise.acceptedAnswers] : undefined,
    sourceReference: {
      ...item.exercise.sourceReference,
      sourceId: item.courseId,
      title: `${item.courseTitle} | ${item.lessonTitle}`,
      location: 'Comprehensive course review'
    }
  };
}

function getCourseWeakConcepts(courseId: string): WeakConcept[] {
  const progress = getCourseProgress(courseId);
  return (progress?.weakConcepts ?? []).sort(
    (a, b) => b.misses - a.misses || a.concept.localeCompare(b.concept)
  );
}

export function getReviewCandidates(scopeCourseId?: string | null): ReviewSourceItem[] {
  if (!scopeCourseId) {
    return [];
  }

  const course = getCourseById(scopeCourseId);

  if (!course) {
    return [];
  }

  const weakConcepts = getCourseWeakConcepts(course.id);

  return getAllLessons(course).flatMap((lesson, lessonIndex) =>
    lesson.exercises.map((exercise, exerciseIndex) => {
      const weakMisses = exercise.concept
        ? weakConcepts.find((weakConcept) => weakConcept.concept === exercise.concept)?.misses ?? 0
        : 0;

      return {
        id: `review-${normalizeForId(course.id)}-${normalizeForId(lesson.id)}-${normalizeForId(exercise.id)}`,
        courseId: course.id,
        courseTitle: course.title,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        exerciseId: exercise.id,
        exercise,
        priority: lessonIndex * 100 + exerciseIndex,
        reasons: ['Included in the comprehensive course review'],
        weakMisses
      } satisfies ReviewSourceItem;
    })
  );
}

export function getReviewSummary(scopeCourseId?: string | null): ReviewSummary {
  if (!scopeCourseId) {
    return {
      totalItems: 0,
      incorrectAnswerCount: 0,
      weakConcepts: [],
      courseCount: getCourses().length
    };
  }

  const progress = getCourseProgress(scopeCourseId);

  return {
    totalItems: getReviewCandidates(scopeCourseId).length,
    incorrectAnswerCount: progress?.incorrectAnswers.length ?? 0,
    weakConcepts: getCourseWeakConcepts(scopeCourseId),
    courseCount: getCourseById(scopeCourseId) ? 1 : 0
  };
}

export function createReviewSession(scopeCourseId?: string | null): ReviewSession | null {
  if (!scopeCourseId) {
    return null;
  }

  const course = getCourseById(scopeCourseId);
  const selectedItems = getReviewCandidates(scopeCourseId);

  if (!course || selectedItems.length === 0) {
    return null;
  }

  const sessionId = createId('review-session');
  const lesson: Lesson = {
    id: sessionId,
    title: `${course.title} Comprehensive Review`,
    type: 'review',
    estimatedMinutes: Math.max(5, selectedItems.length * 2),
    learningObjectives: [
      'Review every question from every lesson in this course.',
      'Check overall understanding across the full learning path.',
      'Practice the complete course as one test.'
    ],
    summary: 'A comprehensive test containing every exercise from every lesson in this course.',
    exercises: selectedItems.map(cloneExerciseForReview)
  };

  return {
    id: sessionId,
    scopeCourseId,
    lesson,
    sourceItems: selectedItems,
    reasonSummary: ['Every lesson question in this course is included'],
    totalAvailableItems: selectedItems.length,
    weakConcepts: getCourseWeakConcepts(scopeCourseId)
  };
}
