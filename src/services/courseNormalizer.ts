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
import { VALID_EXERCISE_TYPES, VALID_LESSON_TYPES } from './schemaService';

export interface CourseNormalizationOptions {
  fallbackTitle?: string;
  sourceMaterialPreview?: string;
}

const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 900;
const MAX_SUMMARY_LENGTH = 900;
const MAX_PROMPT_LENGTH = 1000;
const MAX_EXPLANATION_LENGTH = 1200;
const MAX_HINT_LENGTH = 500;
const MAX_SOURCE_PREVIEW_LENGTH = 500;
const DEFAULT_LESSON_MINUTES = 8;

function createId(prefix: string): string {
  const randomId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  return `${prefix}-${randomId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function trimText(value: unknown, fallback: string, maxLength: number): string {
  const normalized = asString(value, fallback).replace(/\s+/g, ' ').trim() || fallback;
  return normalized.slice(0, maxLength).trim();
}

function normalizeStringArray(value: unknown, fallback: string[] = []): string[] {
  const input = Array.isArray(value) ? value : fallback;
  const values = input
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  return Array.from(new Set(values));
}

function ensureUniqueId(value: unknown, prefix: string, seenIds: Set<string>): string {
  const candidate = asString(value).trim();

  if (candidate && !seenIds.has(candidate)) {
    seenIds.add(candidate);
    return candidate;
  }

  let generatedId = createId(prefix);
  while (seenIds.has(generatedId)) {
    generatedId = createId(prefix);
  }

  seenIds.add(generatedId);
  return generatedId;
}


function normalizeLessonType(value: unknown): LessonType {
  return VALID_LESSON_TYPES.includes(value as LessonType) ? (value as LessonType) : 'standard';
}

function normalizeExerciseType(value: unknown): ExerciseType {
  return VALID_EXERCISE_TYPES.includes(value as ExerciseType) ? (value as ExerciseType) : 'multiple_choice';
}

function normalizeAnswer(value: unknown): ExerciseAnswer | undefined {
  if (typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
  }

  return undefined;
}

function answerToAcceptedAnswers(answer: ExerciseAnswer | undefined): string[] {
  if (answer === undefined) {
    return [];
  }

  if (typeof answer === 'boolean') {
    return [String(answer)];
  }

  if (Array.isArray(answer)) {
    return answer.map((item) => item.trim()).filter(Boolean);
  }

  return [answer.trim()].filter(Boolean);
}

function normalizeChoices(value: unknown, seenIds: Set<string>): ExerciseChoice[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const choices = value.reduce<ExerciseChoice[]>((result, choice, index) => {
    if (!isRecord(choice)) {
      if (typeof choice === 'string' && choice.trim()) {
        result.push({ id: ensureUniqueId(undefined, 'choice', seenIds), text: trimText(choice, `Choice ${index + 1}`, 300) });
      }
      return result;
    }

    const text = trimText(choice.text, `Choice ${index + 1}`, 300);
    result.push({
      id: ensureUniqueId(choice.id, 'choice', seenIds),
      text
    });
    return result;
  }, []);

  return choices.length > 0 ? choices : undefined;
}

function normalizePairs(value: unknown, seenIds: Set<string>): MatchingPair[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const pairs = value.reduce<MatchingPair[]>((result, pair, index) => {
    if (!isRecord(pair)) {
      return result;
    }

    const left = trimText(pair.left, `Term ${index + 1}`, 300);
    const right = trimText(pair.right, `Definition ${index + 1}`, 500);

    result.push({
      id: ensureUniqueId(pair.id, 'pair', seenIds),
      left,
      right
    });

    return result;
  }, []);

  return pairs.length > 0 ? pairs : undefined;
}

function normalizeItems(value: unknown, seenIds: Set<string>): OrderingItem[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value.reduce<OrderingItem[]>((result, item, index) => {
    if (!isRecord(item)) {
      if (typeof item === 'string' && item.trim()) {
        result.push({ id: ensureUniqueId(undefined, 'order', seenIds), text: trimText(item, `Step ${index + 1}`, 400) });
      }
      return result;
    }

    result.push({
      id: ensureUniqueId(item.id, 'order', seenIds),
      text: trimText(item.text, `Step ${index + 1}`, 400)
    });

    return result;
  }, []);

  return items.length > 0 ? items : undefined;
}

function normalizeCorrectOrder(value: unknown, items: OrderingItem[] | undefined): string[] | undefined {
  const itemIds = new Set((items ?? []).map((item) => item.id));
  const incomingOrder = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && itemIds.has(item))
    : [];

  if (incomingOrder.length > 0) {
    return incomingOrder;
  }

  return items && items.length > 0 ? items.map((item) => item.id) : undefined;
}

function normalizeSourceReference(value: unknown): SourceReference | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    sourceId: typeof value.sourceId === 'string' ? trimText(value.sourceId, '', 120) : undefined,
    title: typeof value.title === 'string' ? trimText(value.title, '', 180) : undefined,
    excerpt: typeof value.excerpt === 'string' ? trimText(value.excerpt, '', 500) : undefined,
    location: typeof value.location === 'string' ? trimText(value.location, '', 180) : undefined
  };
}

function getDefaultExplanation(exerciseType: ExerciseType): string {
  const explanations: Record<ExerciseType, string> = {
    multiple_choice: 'The correct answer is grounded in the source material and reinforces the lesson concept.',
    true_false: 'The answer checks whether the statement is supported by the lesson material.',
    fill_blank: 'The blank should be filled with a key idea from the lesson.',
    matching: 'The correct matches connect terms to their meanings.',
    ordering: 'The correct order follows the logical sequence taught in the lesson.',
    scenario: 'The scenario applies the lesson concept to a realistic situation.',
    explain_concept: 'A good explanation defines the concept and says why it matters.'
  };

  return explanations[exerciseType];
}

function normalizeExercise(value: unknown, index: number, seenIds: Set<string>): Exercise {
  const record = isRecord(value) ? value : {};
  const type = normalizeExerciseType(record.type);
  const answer = normalizeAnswer(record.answer);
  const choices = normalizeChoices(record.choices, seenIds);
  const pairs = normalizePairs(record.pairs, seenIds);
  const items = normalizeItems(record.items, seenIds);
  const acceptedAnswers = normalizeStringArray(record.acceptedAnswers, answerToAcceptedAnswers(answer));

  return {
    id: ensureUniqueId(record.id, 'exercise', seenIds),
    type,
    prompt: trimText(record.prompt, `Practice question ${index + 1}`, MAX_PROMPT_LENGTH),
    choices,
    answer,
    acceptedAnswers,
    explanation: trimText(record.explanation, getDefaultExplanation(type), MAX_EXPLANATION_LENGTH),
    hint: trimText(record.hint, '', MAX_HINT_LENGTH),
    sourceReference: normalizeSourceReference(record.sourceReference),
    pairs,
    items,
    correctOrder: normalizeCorrectOrder(record.correctOrder, items),
    concept: typeof record.concept === 'string' ? trimText(record.concept, '', 160) : undefined
  };
}

function normalizeLesson(value: unknown, index: number, seenIds: Set<string>): Lesson {
  const record = isRecord(value) ? value : {};
  const type = normalizeLessonType(record.type);
  const exercisesSource = Array.isArray(record.exercises) ? record.exercises : [];
  const exercises = exercisesSource.map((exercise, exerciseIndex) => normalizeExercise(exercise, exerciseIndex, seenIds));
  const estimatedMinutes = Math.max(
    1,
    Math.round(asNumber(record.estimatedMinutes, type === 'final_challenge' ? 12 : type === 'review' ? 10 : DEFAULT_LESSON_MINUTES))
  );

  return {
    id: ensureUniqueId(record.id, 'lesson', seenIds),
    title: trimText(record.title, `Lesson ${index + 1}`, MAX_TITLE_LENGTH),
    type,
    estimatedMinutes,
    learningObjectives: normalizeStringArray(record.learningObjectives, [
      'Identify the main idea from the source material.',
      'Practice the lesson concept with interactive questions.'
    ]),
    summary: trimText(record.summary, 'A short interactive lesson based on the provided source material.', MAX_SUMMARY_LENGTH),
    exercises
  };
}

function normalizeUnit(value: unknown, index: number, seenIds: Set<string>): Unit {
  const record = isRecord(value) ? value : {};
  const lessonsSource = Array.isArray(record.lessons) ? record.lessons : [];

  return {
    id: ensureUniqueId(record.id, 'unit', seenIds),
    title: trimText(record.title, `Unit ${index + 1}`, MAX_TITLE_LENGTH),
    description: trimText(record.description, 'A focused set of bite-sized lessons.', MAX_DESCRIPTION_LENGTH),
    lessons: lessonsSource.map((lesson, lessonIndex) => normalizeLesson(lesson, lessonIndex, seenIds))
  };
}

function normalizeSection(value: unknown, index: number, seenIds: Set<string>): Section {
  const record = isRecord(value) ? value : {};
  const unitsSource = Array.isArray(record.units) ? record.units : [];

  return {
    id: ensureUniqueId(record.id, 'section', seenIds),
    title: trimText(record.title, `Section ${index + 1}`, MAX_TITLE_LENGTH),
    description: trimText(record.description, 'A course section built from the provided source material.', MAX_DESCRIPTION_LENGTH),
    units: unitsSource.map((unit, unitIndex) => normalizeUnit(unit, unitIndex, seenIds))
  };
}


function calculateEstimatedTotalMinutes(sections: Section[]): number {
  return sections.reduce(
    (sectionTotal, section) =>
      sectionTotal +
      section.units.reduce(
        (unitTotal, unit) =>
          unitTotal + unit.lessons.reduce((lessonTotal, lesson) => lessonTotal + lesson.estimatedMinutes, 0),
        0
      ),
    0
  );
}

function makeBrowserStorageSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function normalizeCourseFromAIJSON(candidate: unknown, options: CourseNormalizationOptions = {}): Course {
  const now = new Date().toISOString();
  const record = isRecord(candidate) ? candidate : {};
  const seenIds = new Set<string>();
  const sectionsSource = Array.isArray(record.sections) ? record.sections : [];
  const sections = sectionsSource.map((section, sectionIndex) => normalizeSection(section, sectionIndex, seenIds));
  const keyConcepts = normalizeStringArray(record.keyConcepts, ['Main idea', 'Key evidence', 'Review concept']);
  const estimatedTotalMinutes = Math.max(1, calculateEstimatedTotalMinutes(sections));

  const normalizedCourse: Course = {
    id: ensureUniqueId(record.id, 'course', seenIds),
    title: trimText(record.title, options.fallbackTitle ?? 'Generated Learning Path', MAX_TITLE_LENGTH),
    description: trimText(
      record.description,
      'A bite-sized learning path generated from the provided source material.',
      MAX_DESCRIPTION_LENGTH
    ),
    sourceMaterialPreview: trimText(
      record.sourceMaterialPreview,
      options.sourceMaterialPreview ?? 'Source material preview unavailable.',
      MAX_SOURCE_PREVIEW_LENGTH
    ),
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : now,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : now,
    estimatedTotalMinutes,
    sections,
    keyConcepts
  };

  return makeBrowserStorageSafe(normalizedCourse);
}

export function getFirstUnlockableLessonId(course: Course): string | undefined {
  return course.sections[0]?.units[0]?.lessons[0]?.id;
}

export function getCourseLessonCount(course: Course): number {
  return course.sections.reduce(
    (sectionTotal, section) =>
      sectionTotal + section.units.reduce((unitTotal, unit) => unitTotal + unit.lessons.length, 0),
    0
  );
}
