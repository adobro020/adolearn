import type { Course, Exercise } from '../types/course';
import {
  COURSE_REQUIRED_FIELDS,
  EXERCISE_REQUIRED_FIELDS,
  LESSON_REQUIRED_FIELDS,
  SECTION_REQUIRED_FIELDS,
  UNIT_REQUIRED_FIELDS,
  VALID_EXERCISE_TYPES,
  VALID_LESSON_TYPES
} from './schemaService';

export interface CourseValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface CourseValidationOptions {
  /**
   * AI draft JSON can omit fields that courseNormalizer will safely add.
   * Use strict mode for persisted Course objects.
   */
  allowNormalizerRepair?: boolean;
}

type Path = string;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasRequiredField(
  record: Record<string, unknown>,
  key: string,
  path: Path,
  errors: string[],
  options: CourseValidationOptions,
  repairableFields: Set<string> = new Set()
): boolean {
  if (key in record && record[key] !== undefined && record[key] !== null) {
    return true;
  }

  if (options.allowNormalizerRepair && repairableFields.has(key)) {
    return false;
  }

  errors.push(`${path}.${key} is required.`);
  return false;
}

function validateStringField(
  record: Record<string, unknown>,
  key: string,
  path: Path,
  errors: string[],
  options: CourseValidationOptions,
  repairable = false
): void {
  if (!(key in record) || record[key] === undefined || record[key] === null) {
    if (!options.allowNormalizerRepair || !repairable) {
      errors.push(`${path}.${key} must be a non-empty string.`);
    }
    return;
  }

  if (!isNonEmptyString(record[key])) {
    errors.push(`${path}.${key} must be a non-empty string.`);
  }
}

function validateStringArray(
  value: unknown,
  path: Path,
  errors: string[],
  options: CourseValidationOptions,
  repairable = false
): void {
  if (!Array.isArray(value)) {
    if (!options.allowNormalizerRepair || !repairable) {
      errors.push(`${path} must be an array of strings.`);
    }
    return;
  }

  value.forEach((item, index) => {
    if (!isNonEmptyString(item)) {
      errors.push(`${path}[${index}] must be a non-empty string.`);
    }
  });
}

function validateChoices(exercise: Record<string, unknown>, path: Path, errors: string[]): void {
  if (!Array.isArray(exercise.choices) || exercise.choices.length < 2) {
    errors.push(`${path}.choices must contain at least two choices for a multiple_choice exercise.`);
    return;
  }

  exercise.choices.forEach((choice, choiceIndex) => {
    if (!isRecord(choice)) {
      errors.push(`${path}.choices[${choiceIndex}] must be an object.`);
      return;
    }

    if (!isNonEmptyString(choice.text)) {
      errors.push(`${path}.choices[${choiceIndex}].text must be a non-empty string.`);
    }

    if ('explanation' in choice && choice.explanation !== undefined && !isNonEmptyString(choice.explanation)) {
      errors.push(`${path}.choices[${choiceIndex}].explanation must be a non-empty string when provided.`);
    }
  });
}

function validateExercise(
  candidate: unknown,
  path: Path,
  errors: string[],
  _warnings: string[],
  options: CourseValidationOptions
): void {
  if (!isRecord(candidate)) {
    errors.push(`${path} must be an exercise object.`);
    return;
  }

  const repairableExerciseFields = new Set(['id', 'acceptedAnswers', 'hint']);
  EXERCISE_REQUIRED_FIELDS.forEach((field) =>
    hasRequiredField(candidate, field, path, errors, options, repairableExerciseFields)
  );

  validateStringField(candidate, 'id', path, errors, options, true);
  validateStringField(candidate, 'prompt', path, errors, options);
  validateStringField(candidate, 'explanation', path, errors, options);

  if (!isNonEmptyString(candidate.type)) {
    errors.push(`${path}.type must be one of: ${VALID_EXERCISE_TYPES.join(', ')}.`);
    return;
  }

  if (!VALID_EXERCISE_TYPES.includes(candidate.type as Exercise['type'])) {
    errors.push(`${path}.type "${candidate.type}" is not supported.`);
    return;
  }

  if (candidate.type === 'multiple_choice') {
    validateChoices(candidate, path, errors);
  }

  if (candidate.type === 'true_false' && typeof candidate.answer !== 'boolean') {
    errors.push(`${path}.answer must be a boolean for a true_false exercise.`);
  }
}

function validateLesson(
  candidate: unknown,
  path: Path,
  errors: string[],
  warnings: string[],
  options: CourseValidationOptions
): void {
  if (!isRecord(candidate)) {
    errors.push(`${path} must be a lesson object.`);
    return;
  }

  const repairableLessonFields = new Set(['id', 'estimatedMinutes', 'learningObjectives']);
  LESSON_REQUIRED_FIELDS.forEach((field) =>
    hasRequiredField(candidate, field, path, errors, options, repairableLessonFields)
  );

  validateStringField(candidate, 'id', path, errors, options, true);
  validateStringField(candidate, 'title', path, errors, options);
  validateStringField(candidate, 'summary', path, errors, options);
  validateStringArray(candidate.learningObjectives, `${path}.learningObjectives`, errors, options, true);

  if (!isNonEmptyString(candidate.type) || !VALID_LESSON_TYPES.includes(candidate.type as Course['units'][number]['sections'][number]['lessons'][number]['type'])) {
    errors.push(`${path}.type must be one of: ${VALID_LESSON_TYPES.join(', ')}.`);
  }

  if ('estimatedMinutes' in candidate && !isNumber(candidate.estimatedMinutes)) {
    errors.push(`${path}.estimatedMinutes must be a number.`);
  }

  if (!Array.isArray(candidate.exercises) || candidate.exercises.length === 0) {
    errors.push(`${path}.exercises must contain at least one exercise.`);
    return;
  }

  candidate.exercises.forEach((exercise, exerciseIndex) => {
    validateExercise(exercise, `${path}.exercises[${exerciseIndex}]`, errors, warnings, options);
  });
}

function validateSection(
  candidate: unknown,
  path: Path,
  errors: string[],
  warnings: string[],
  options: CourseValidationOptions
): void {
  if (!isRecord(candidate)) {
    errors.push(`${path} must be a section object.`);
    return;
  }

  const repairableSectionFields = new Set(['id']);
  SECTION_REQUIRED_FIELDS.forEach((field) =>
    hasRequiredField(candidate, field, path, errors, options, repairableSectionFields)
  );

  validateStringField(candidate, 'id', path, errors, options, true);
  validateStringField(candidate, 'title', path, errors, options);
  validateStringField(candidate, 'description', path, errors, options);

  if (!Array.isArray(candidate.lessons) || candidate.lessons.length === 0) {
    errors.push(`${path}.lessons must contain at least one lesson.`);
    return;
  }

  candidate.lessons.forEach((lesson, lessonIndex) => {
    validateLesson(lesson, `${path}.lessons[${lessonIndex}]`, errors, warnings, options);
  });
}

function validateUnit(
  candidate: unknown,
  path: Path,
  errors: string[],
  warnings: string[],
  options: CourseValidationOptions
): void {
  if (!isRecord(candidate)) {
    errors.push(`${path} must be a unit object.`);
    return;
  }

  const repairableUnitFields = new Set(['id']);
  UNIT_REQUIRED_FIELDS.forEach((field) =>
    hasRequiredField(candidate, field, path, errors, options, repairableUnitFields)
  );

  validateStringField(candidate, 'id', path, errors, options, true);
  validateStringField(candidate, 'title', path, errors, options);
  validateStringField(candidate, 'description', path, errors, options);

  if (!Array.isArray(candidate.sections) || candidate.sections.length === 0) {
    errors.push(`${path}.sections must contain at least one section.`);
    return;
  }

  candidate.sections.forEach((section, sectionIndex) => {
    validateSection(section, `${path}.sections[${sectionIndex}]`, errors, warnings, options);
  });
}

export function validateCourse(candidate: unknown, options: CourseValidationOptions = {}): CourseValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(candidate)) {
    return {
      isValid: false,
      errors: ['Course JSON must be an object.'],
      warnings
    };
  }

  const repairableTopLevelFields = new Set(['id', 'createdAt', 'updatedAt', 'estimatedTotalMinutes', 'sourceMaterialPreview']);
  COURSE_REQUIRED_FIELDS.forEach((field) =>
    hasRequiredField(candidate, field, 'course', errors, options, repairableTopLevelFields)
  );

  validateStringField(candidate, 'id', 'course', errors, options, true);
  validateStringField(candidate, 'title', 'course', errors, options);
  validateStringField(candidate, 'description', 'course', errors, options);
  validateStringField(candidate, 'sourceMaterialPreview', 'course', errors, options, true);
  validateStringArray(candidate.keyConcepts, 'course.keyConcepts', errors, options, true);

  if ('estimatedTotalMinutes' in candidate && !isNumber(candidate.estimatedTotalMinutes)) {
    errors.push('course.estimatedTotalMinutes must be a number.');
  }

  if (!Array.isArray(candidate.units) || candidate.units.length === 0) {
    errors.push('course.units must contain at least one unit.');
  } else {
    candidate.units.forEach((unit, unitIndex) => {
      validateUnit(unit, `course.units[${unitIndex}]`, errors, warnings, options);
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function assertValidCourse(candidate: unknown, options: CourseValidationOptions = {}): asserts candidate is Course {
  const result = validateCourse(candidate, options);

  if (!result.isValid) {
    throw new Error(`Invalid AdoLearn course JSON:\n${result.errors.join('\n')}`);
  }
}
