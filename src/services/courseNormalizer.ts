import type {
  Course,
  Exercise,
  ExerciseAnswer,
  ExerciseChoice,
  ExerciseType,
  Lesson,
  LessonType,
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
const MAX_CHOICE_EXPLANATION_LENGTH = 500;
const MAX_SOURCE_PREVIEW_LENGTH = 500;
const DEFAULT_LESSON_MINUTES = 8;
const MAX_EXERCISES_PER_LESSON = 4;
const MAX_MULTIPLE_CHOICE_CHOICES = 4;

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

function normalizeAnswer(value: unknown, type: ExerciseType): ExerciseAnswer | undefined {
  if (type === 'true_false') {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', 'yes', 'correct'].includes(normalized)) {
        return true;
      }
      if (['false', 'no', 'incorrect'].includes(normalized)) {
        return false;
      }
    }

    return true;
  }

  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return undefined;
}

function answerToAcceptedAnswers(answer: ExerciseAnswer | undefined): string[] {
  if (answer === undefined) {
    return [];
  }

  if (typeof answer === 'boolean') {
    return [answer ? 'true' : 'false'];
  }

  return [answer.trim()].filter(Boolean);
}

function isStandaloneChoiceLabel(value: string): boolean {
  return /^[A-D]$/i.test(value.trim());
}

function normalizeChoiceText(value: string): string {
  return value.replace(/^[A-D][).:-]\s+/i, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function dedupeChoices(choices: ExerciseChoice[]): ExerciseChoice[] {
  const seenChoiceText = new Set<string>();

  return choices.filter((choice) => {
    const key = normalizeChoiceText(choice.text);

    if (!key || seenChoiceText.has(key)) {
      return false;
    }

    seenChoiceText.add(key);
    return true;
  });
}

function normalizeChoices(value: unknown, seenIds: Set<string>): ExerciseChoice[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const choices = value.reduce<ExerciseChoice[]>((result, choice, index) => {
    if (!isRecord(choice)) {
      if (typeof choice === 'string' && choice.trim()) {
        result.push({ id: ensureUniqueId(undefined, 'choice', seenIds), text: trimText(choice, `Choice ${index + 1}`, 300), explanation: 'This option should be checked against the source-supported answer.' });
      }
      return result;
    }

    const text = trimText(choice.text, `Choice ${index + 1}`, 300);
    const explanation = trimText(
      choice.explanation,
      'This option should be checked against the source-supported answer.',
      MAX_CHOICE_EXPLANATION_LENGTH
    );
    result.push({
      id: ensureUniqueId(choice.id, 'choice', seenIds),
      text,
      explanation
    });
    return result;
  }, []);

  const dedupedChoices = dedupeChoices(choices);
  const withoutStandaloneLabels = dedupedChoices.filter((choice) => !isStandaloneChoiceLabel(choice.text));
  const cleanedChoices = withoutStandaloneLabels.length >= 2 ? withoutStandaloneLabels : dedupedChoices;

  return cleanedChoices.length > 0 ? cleanedChoices : undefined;
}

function resolveMultipleChoiceAnswer(answer: ExerciseAnswer | undefined, choices: ExerciseChoice[] | undefined): ExerciseAnswer | undefined {
  if (typeof answer !== 'string' || !choices?.length) {
    return answer;
  }

  const answerKey = normalizeChoiceText(answer);
  const matchingChoice = choices.find((choice) => normalizeChoiceText(choice.text) === answerKey);

  if (matchingChoice) {
    return matchingChoice.text;
  }

  if (/^[A-D]$/i.test(answer.trim())) {
    const choiceIndex = answer.trim().toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
    return choices[choiceIndex]?.text ?? answer;
  }

  return answer;
}

function resolveMultipleChoiceAcceptedAnswers(answers: string[], choices: ExerciseChoice[] | undefined): string[] {
  return Array.from(
    new Set(
      answers
        .map((answer) => resolveMultipleChoiceAnswer(answer, choices))
        .filter((answer): answer is string => typeof answer === 'string' && answer.trim().length > 0)
    )
  );
}

function ensureMultipleChoiceChoices(choices: ExerciseChoice[] | undefined, answer: ExerciseAnswer | undefined, seenIds: Set<string>): ExerciseChoice[] {
  let normalizedChoices = choices && choices.length >= 2 ? dedupeChoices(choices) : [];
  const answerText = typeof answer === 'string' && answer.trim() ? answer.trim() : 'The source-supported answer';
  const answerKey = normalizeChoiceText(answerText);

  const withoutStandaloneLabels = normalizedChoices.filter(
    (choice) => normalizeChoiceText(choice.text) === answerKey || !isStandaloneChoiceLabel(choice.text)
  );

  if (withoutStandaloneLabels.length >= 2) {
    normalizedChoices = withoutStandaloneLabels;
  }

  const existingAnswer = normalizedChoices.find((choice) => normalizeChoiceText(choice.text) === answerKey);

  if (existingAnswer) {
    normalizedChoices = [existingAnswer, ...normalizedChoices.filter((choice) => choice.id !== existingAnswer.id)];
  } else {
    normalizedChoices.unshift({ id: ensureUniqueId(undefined, 'choice', seenIds), text: answerText, explanation: 'This is the source-supported answer for the question.' });
  }

  const fallbackDistractors = ['Another option', 'A less supported option', 'Not supported by the source'];
  for (const distractor of fallbackDistractors) {
    if (normalizedChoices.length >= 2) {
      break;
    }
    normalizedChoices.push({ id: ensureUniqueId(undefined, 'choice', seenIds), text: distractor, explanation: 'This fallback option is not the source-supported answer.' });
  }

  return normalizedChoices.slice(0, MAX_MULTIPLE_CHOICE_CHOICES);
}

function normalizeSourceReference(value: unknown): SourceReference | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const sourceReference: SourceReference = {
    sourceId: typeof value.sourceId === 'string' ? trimText(value.sourceId, '', 120) : undefined,
    title: typeof value.title === 'string' ? trimText(value.title, '', 180) : undefined,
    excerpt: typeof value.excerpt === 'string' ? trimText(value.excerpt, '', 500) : undefined,
    location: typeof value.location === 'string' ? trimText(value.location, '', 180) : undefined
  };

  return Object.values(sourceReference).some(Boolean) ? sourceReference : undefined;
}

function getDefaultExplanation(exerciseType: ExerciseType): string {
  const explanations: Record<ExerciseType, string> = {
    multiple_choice: 'The correct answer is grounded in the source material and reinforces the lesson concept.',
    true_false: 'The answer checks whether the statement is supported by the lesson material.'
  };

  return explanations[exerciseType];
}

function normalizeExercise(value: unknown, index: number, seenIds: Set<string>): Exercise {
  const record = isRecord(value) ? value : {};
  const type = normalizeExerciseType(record.type);
  const initialChoices = type === 'multiple_choice' ? normalizeChoices(record.choices, seenIds) : undefined;
  const incomingAnswer = type === 'multiple_choice'
    ? resolveMultipleChoiceAnswer(normalizeAnswer(record.answer, type), initialChoices)
    : normalizeAnswer(record.answer, type);
  const incomingAcceptedAnswers = type === 'multiple_choice'
    ? resolveMultipleChoiceAcceptedAnswers(normalizeStringArray(record.acceptedAnswers, answerToAcceptedAnswers(incomingAnswer)), initialChoices)
    : normalizeStringArray(record.acceptedAnswers, answerToAcceptedAnswers(incomingAnswer));
  const fallbackAnswer = incomingAcceptedAnswers[0] ?? (type === 'true_false' ? true : 'The source-supported answer');
  const answer = incomingAnswer ?? fallbackAnswer;
  const normalizedChoices = type === 'multiple_choice'
    ? ensureMultipleChoiceChoices(initialChoices, answer, seenIds)
    : undefined;
  const acceptedAnswers = incomingAcceptedAnswers.length > 0 ? incomingAcceptedAnswers : answerToAcceptedAnswers(answer);

  return {
    id: ensureUniqueId(record.id, 'exercise', seenIds),
    type,
    prompt: trimText(record.prompt, `Practice question ${index + 1}`, MAX_PROMPT_LENGTH),
    choices: normalizedChoices,
    answer,
    acceptedAnswers,
    explanation: trimText(record.explanation, getDefaultExplanation(type), MAX_EXPLANATION_LENGTH),
    hint: trimText(record.hint, '', MAX_HINT_LENGTH),
    sourceReference: normalizeSourceReference(record.sourceReference),
    concept: typeof record.concept === 'string' ? trimText(record.concept, '', 160) : undefined
  };
}

function normalizeLesson(value: unknown, index: number, seenIds: Set<string>): Lesson {
  const record = isRecord(value) ? value : {};
  const type = normalizeLessonType(record.type);
  const exercisesSource = Array.isArray(record.exercises) ? record.exercises : [];
  const exercises = exercisesSource
    .map((exercise, exerciseIndex) => normalizeExercise(exercise, exerciseIndex, seenIds))
    .filter((exercise) => VALID_EXERCISE_TYPES.includes(exercise.type))
    .slice(0, MAX_EXERCISES_PER_LESSON);
  const estimatedMinutes = Math.max(
    1,
    Math.round(asNumber(record.estimatedMinutes, type === 'review' ? 10 : DEFAULT_LESSON_MINUTES))
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
    exercises: exercises.length > 0 ? exercises : [normalizeExercise({ type: 'true_false', prompt: 'True or false: this lesson is based on the provided source material.', answer: true, explanation: 'The course is generated from the provided source material.' }, 0, seenIds)]
  };
}

function getSectionLessonSource(record: Record<string, unknown>): unknown[] {
  if (Array.isArray(record.lessons)) {
    return record.lessons;
  }

  return [];
}

function normalizeSection(value: unknown, index: number, seenIds: Set<string>): Section {
  const record = isRecord(value) ? value : {};
  const lessonsSource = getSectionLessonSource(record);

  return {
    id: ensureUniqueId(record.id, 'section', seenIds),
    title: trimText(record.title, `Section ${index + 1}`, MAX_TITLE_LENGTH),
    description: trimText(record.description, 'A focused set of bite-sized lessons.', MAX_DESCRIPTION_LENGTH),
    lessons: lessonsSource.map((lesson, lessonIndex) => normalizeLesson(lesson, lessonIndex, seenIds))
  };
}

function normalizeUnit(value: unknown, index: number, seenIds: Set<string>): Unit {
  const record = isRecord(value) ? value : {};
  const sectionsSource = Array.isArray(record.sections) ? record.sections : [];

  return {
    id: ensureUniqueId(record.id, 'unit', seenIds),
    title: trimText(record.title, `Unit ${index + 1}`, MAX_TITLE_LENGTH),
    description: trimText(record.description, 'A course unit built from the provided source material.', MAX_DESCRIPTION_LENGTH),
    sections: sectionsSource.map((section, sectionIndex) => normalizeSection(section, sectionIndex, seenIds))
  };
}

function getCourseUnitsSource(record: Record<string, unknown>, seenIds: Set<string>): Unit[] {
  if (Array.isArray(record.units)) {
    return record.units.map((unit, unitIndex) => normalizeUnit(unit, unitIndex, seenIds));
  }

  return [];
}

function calculateEstimatedTotalMinutes(units: Unit[]): number {
  return units.reduce(
    (unitTotal, unit) =>
      unitTotal +
      unit.sections.reduce(
        (sectionTotal, section) =>
          sectionTotal + section.lessons.reduce((lessonTotal, lesson) => lessonTotal + lesson.estimatedMinutes, 0),
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
  const units = getCourseUnitsSource(record, seenIds);
  const keyConcepts = normalizeStringArray(record.keyConcepts, ['Main idea', 'Key evidence', 'Review concept']);
  const estimatedTotalMinutes = Math.max(1, calculateEstimatedTotalMinutes(units));

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
    units,
    keyConcepts
  };

  return makeBrowserStorageSafe(normalizedCourse);
}

export function getFirstUnlockableLessonId(course: Course): string | undefined {
  return course.units[0]?.sections[0]?.lessons[0]?.id;
}

export function getCourseLessonCount(course: Course): number {
  return course.units.reduce(
    (unitTotal, unit) => unitTotal + unit.sections.reduce((sectionTotal, section) => sectionTotal + section.lessons.length, 0),
    0
  );
}
