import { STORAGE_KEYS } from '../data/storageKeys';
import type {
  Course,
  Exercise,
  ExerciseAnswer,
  ExerciseChoice,
  ExerciseType,
  Lesson,
  LessonType,
  MatchingPair,
  OrderingItem,
  Section,
  SourceReference,
  Unit
} from '../types/course';
import type { CourseStyle, Difficulty } from '../types/settings';
import { removeItem, safeGetJSON, safeSetJSON } from './storageService';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function isOneOf<T extends string>(value: unknown, allowedValues: readonly T[]): value is T {
  return typeof value === 'string' && allowedValues.includes(value as T);
}

function normalizeExerciseChoice(value: unknown): ExerciseChoice | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = asString(value.id);
  const text = asString(value.text);

  return id && text ? { id, text } : null;
}

function normalizeMatchingPair(value: unknown): MatchingPair | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = asString(value.id);
  const left = asString(value.left);
  const right = asString(value.right);

  return id && left && right ? { id, left, right } : null;
}

function normalizeOrderingItem(value: unknown): OrderingItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = asString(value.id);
  const text = asString(value.text);

  return id && text ? { id, text } : null;
}

function normalizeSourceReference(value: unknown): SourceReference | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const sourceReference: SourceReference = {
    sourceId: asOptionalString(value.sourceId),
    title: asOptionalString(value.title),
    excerpt: asOptionalString(value.excerpt),
    location: asOptionalString(value.location)
  };

  return Object.values(sourceReference).some(Boolean) ? sourceReference : undefined;
}

function normalizeExerciseAnswer(value: unknown): ExerciseAnswer | undefined {
  if (typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return asStringArray(value);
  }

  return undefined;
}

function normalizeExercise(value: unknown): Exercise | null {
  if (!isRecord(value)) {
    return null;
  }

  const exerciseTypes: readonly ExerciseType[] = [
    'multiple_choice',
    'true_false',
    'matching',
    'ordering',
    'flashcard'
  ];

  const id = asString(value.id);
  const prompt = asString(value.prompt);

  if (!id || !prompt || !isOneOf(value.type, exerciseTypes)) {
    return null;
  }

  return {
    id,
    type: value.type,
    prompt,
    choices: Array.isArray(value.choices)
      ? value.choices
          .map(normalizeExerciseChoice)
          .filter((choice): choice is ExerciseChoice => choice !== null)
      : undefined,
    answer: normalizeExerciseAnswer(value.answer),
    acceptedAnswers: asStringArray(value.acceptedAnswers),
    explanation: asOptionalString(value.explanation),
    hint: asOptionalString(value.hint),
    sourceReference: normalizeSourceReference(value.sourceReference),
    pairs: Array.isArray(value.pairs)
      ? value.pairs
          .map(normalizeMatchingPair)
          .filter((pair): pair is MatchingPair => pair !== null)
      : undefined,
    items: Array.isArray(value.items)
      ? value.items
          .map(normalizeOrderingItem)
          .filter((item): item is OrderingItem => item !== null)
      : undefined,
    correctOrder: asStringArray(value.correctOrder),
    concept: asOptionalString(value.concept)
  };
}

function normalizeLesson(value: unknown): Lesson | null {
  if (!isRecord(value)) {
    return null;
  }

  const lessonTypes: readonly LessonType[] = ['standard', 'review', 'final_challenge'];
  const id = asString(value.id);
  const title = asString(value.title);

  if (!id || !title || !isOneOf(value.type, lessonTypes)) {
    return null;
  }

  const exercises = Array.isArray(value.exercises)
    ? value.exercises
        .map(normalizeExercise)
        .filter((exercise): exercise is Exercise => exercise !== null)
    : [];

  return {
    id,
    title,
    type: value.type,
    estimatedMinutes: Math.max(0, asNumber(value.estimatedMinutes, 0)),
    learningObjectives: asStringArray(value.learningObjectives),
    summary: asString(value.summary),
    exercises
  };
}

function normalizeUnit(value: unknown): Unit | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = asString(value.id);
  const title = asString(value.title);

  if (!id || !title) {
    return null;
  }

  const lessons = Array.isArray(value.lessons)
    ? value.lessons.map(normalizeLesson).filter((lesson): lesson is Lesson => lesson !== null)
    : [];

  return {
    id,
    title,
    description: asString(value.description),
    lessons
  };
}

function normalizeSection(value: unknown): Section | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = asString(value.id);
  const title = asString(value.title);

  if (!id || !title) {
    return null;
  }

  const units = Array.isArray(value.units)
    ? value.units.map(normalizeUnit).filter((unit): unit is Unit => unit !== null)
    : [];

  return {
    id,
    title,
    description: asString(value.description),
    units
  };
}

export function normalizeCourse(value: unknown): Course | null {
  if (!isRecord(value)) {
    return null;
  }

  const difficultyValues: readonly Difficulty[] = [
    'Auto',
    'Beginner',
    'Intermediate',
    'Advanced'
  ];
  const courseStyleValues: readonly CourseStyle[] = [
    'Exam prep',
    'Quick overview',
    'Deep learning',
    'Flashcard-heavy'
  ];

  const id = asString(value.id);
  const title = asString(value.title);

  if (!id || !title) {
    return null;
  }

  const sections = Array.isArray(value.sections)
    ? value.sections.map(normalizeSection).filter((section): section is Section => section !== null)
    : [];

  return {
    id,
    title,
    description: asString(value.description),
    sourceMaterialPreview: asString(value.sourceMaterialPreview),
    createdAt: asString(value.createdAt, new Date().toISOString()),
    updatedAt: asString(value.updatedAt, new Date().toISOString()),
    difficulty: isOneOf(value.difficulty, difficultyValues) ? value.difficulty : 'Auto',
    style: isOneOf(value.style, courseStyleValues) ? value.style : 'Quick overview',
    estimatedTotalMinutes: Math.max(0, asNumber(value.estimatedTotalMinutes, 0)),
    sections,
    keyConcepts: asStringArray(value.keyConcepts)
  };
}

function normalizeCourses(value: unknown): Course[] {
  const possibleCourses = isRecord(value) && Array.isArray(value.courses) ? value.courses : value;

  if (!Array.isArray(possibleCourses)) {
    return [];
  }

  return possibleCourses
    .map(normalizeCourse)
    .filter((course): course is Course => course !== null);
}

function persistCourses(courses: Course[]): boolean {
  return safeSetJSON(STORAGE_KEYS.courses, courses);
}

export function getCourses(): Course[] {
  const storedCourses = safeGetJSON<unknown>(STORAGE_KEYS.courses, []);
  return normalizeCourses(storedCourses);
}

export function getCourseById(courseId: string): Course | undefined {
  return getCourses().find((course) => course.id === courseId);
}

export function saveCourse(course: Course): boolean {
  const normalizedCourse = normalizeCourse(course);

  if (!normalizedCourse) {
    return false;
  }

  const courses = getCourses();
  const existingIndex = courses.findIndex((storedCourse) => storedCourse.id === course.id);

  if (existingIndex >= 0) {
    courses[existingIndex] = normalizedCourse;
  } else {
    courses.unshift(normalizedCourse);
  }

  return persistCourses(courses);
}

export function deleteCourse(courseId: string): boolean {
  return persistCourses(getCourses().filter((course) => course.id !== courseId));
}

export function updateCourse(course: Course): boolean {
  const courses = getCourses();
  const existingIndex = courses.findIndex((storedCourse) => storedCourse.id === course.id);
  const normalizedCourse = normalizeCourse(course);

  if (existingIndex < 0 || !normalizedCourse) {
    return false;
  }

  courses[existingIndex] = {
    ...normalizedCourse,
    updatedAt: new Date().toISOString()
  };

  return persistCourses(courses);
}

export function deleteAllCourses(): boolean {
  return removeItem(STORAGE_KEYS.courses);
}
