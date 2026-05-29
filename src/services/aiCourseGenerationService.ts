import type { Course } from '../types/course';
import type { CourseStyle, Difficulty, LessonLength } from '../types/settings';
import { normalizeCourseFromAIJSON } from './courseNormalizer';
import { validateCourse } from './courseValidator';

export type AICourseGenerationErrorCode =
  | 'network_error'
  | 'api_error'
  | 'rate_limit'
  | 'server_configuration_missing'
  | 'source_too_large'
  | 'empty_response'
  | 'invalid_json'
  | 'invalid_schema';

export class AICourseGenerationError extends Error {
  code: AICourseGenerationErrorCode;
  details?: string[];

  constructor(code: AICourseGenerationErrorCode, message: string, details?: string[]) {
    super(message);
    this.name = 'AICourseGenerationError';
    this.code = code;
    this.details = details;
  }
}

export interface GenerateCourseWithAIInput {
  sourceMaterial: string;
  optionalTitle?: string;
  difficulty: Difficulty;
  courseStyle: CourseStyle;
  lessonLength: LessonLength;
  modelName?: string;
}

export interface GenerateCourseWithAIResult {
  course: Course;
  validationWarnings: string[];
  rawResponseText: string;
}

interface GenerateCourseAPIErrorPayload {
  error?: string;
  code?: string;
  details?: string[];
}

interface GenerateCourseAPISuccessPayload {
  course?: unknown;
  rawCourse?: unknown;
  validationWarnings?: string[];
}

const GENERATE_COURSE_API_URL = '/api/generate-course';
const MAX_VALIDATION_ERRORS_IN_MESSAGE = 8;
const MAX_PROXY_SOURCE_MATERIAL_CHARS = 90_000;
const LONG_SOURCE_CONDENSED_WARNING =
  'Long source material was condensed before sending it to the course generator to keep the request reliable.';

function getSourcePreview(sourceMaterial: string): string {
  return sourceMaterial.replace(/\s+/g, ' ').trim().slice(0, 500);
}

function cleanModelName(modelName?: string): string | undefined {
  const cleaned = modelName?.trim();
  return cleaned || undefined;
}

function compactSourceMaterial(sourceMaterial: string): string {
  return sourceMaterial
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function prepareSourceMaterialForProxy(sourceMaterial: string): { sourceMaterial: string; wasCondensed: boolean } {
  const compacted = compactSourceMaterial(sourceMaterial);

  if (compacted.length <= MAX_PROXY_SOURCE_MATERIAL_CHARS) {
    return { sourceMaterial: compacted, wasCondensed: false };
  }

  const headLength = 50_000;
  const tailLength = 35_000;
  const omittedCharacters = compacted.length - headLength - tailLength;
  const separator = `\n\n[Middle content condensed for reliable generation. Approximately ${omittedCharacters.toLocaleString()} characters omitted. Use the beginning and ending context only when supported by the pasted material.]\n\n`;

  return {
    sourceMaterial: `${compacted.slice(0, headLength)}${separator}${compacted.slice(-tailLength)}`,
    wasCondensed: true
  };
}

function mapProxyError(status: number, payload: GenerateCourseAPIErrorPayload | null): AICourseGenerationError {
  const code = payload?.code ?? '';
  const details = payload?.details;

  if (status === 413 || status === 422 || code === 'source_too_large' || code === 'request_too_large') {
    return new AICourseGenerationError(
      'source_too_large',
      'The source material is too large. Try a shorter paste.',
      details
    );
  }

  if (code === 'server_configuration_missing') {
    return new AICourseGenerationError(
      'server_configuration_missing',
      'Server configuration is missing.',
      details
    );
  }

  if (status === 429 || code === 'rate_limit') {
    return new AICourseGenerationError(
      'rate_limit',
      'AI generation is temporarily unavailable.',
      details
    );
  }

  if (status >= 500) {
    return new AICourseGenerationError(
      'api_error',
      payload?.error || 'AI generation is temporarily unavailable.',
      details
    );
  }

  return new AICourseGenerationError(
    'api_error',
    payload?.error || 'Generation failed. Please try again.',
    details
  );
}

async function readResponseJSON(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new AICourseGenerationError(
      'invalid_json',
      'The generated course was not valid. Try again.'
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractCoursePayload(payload: unknown): unknown {
  if (isRecord(payload) && 'course' in payload) {
    return payload.course;
  }

  if (isRecord(payload) && 'rawCourse' in payload) {
    return payload.rawCourse;
  }

  return payload;
}

async function callServerProxy(
  input: GenerateCourseWithAIInput,
  preparedSourceMaterial: string
): Promise<GenerateCourseAPISuccessPayload> {
  let response: Response;

  try {
    response = await fetch(GENERATE_COURSE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sourceMaterial: preparedSourceMaterial,
        optionalTitle: input.optionalTitle,
        difficulty: input.difficulty,
        courseStyle: input.courseStyle,
        lessonLength: input.lessonLength,
        modelName: cleanModelName(input.modelName)
      })
    });
  } catch {
    throw new AICourseGenerationError(
      'network_error',
      'Generation failed. Please try again.'
    );
  }

  const payload = await readResponseJSON(response);

  if (!response.ok) {
    throw mapProxyError(
      response.status,
      isRecord(payload) ? (payload as GenerateCourseAPIErrorPayload) : null
    );
  }

  return isRecord(payload) ? (payload as GenerateCourseAPISuccessPayload) : { course: payload };
}

export async function generateCourseWithAI({
  sourceMaterial,
  optionalTitle,
  difficulty,
  courseStyle,
  lessonLength,
  modelName
}: GenerateCourseWithAIInput): Promise<GenerateCourseWithAIResult> {
  const preparedSource = prepareSourceMaterialForProxy(sourceMaterial);
  const payload = await callServerProxy(
    {
      sourceMaterial,
      optionalTitle,
      difficulty,
      courseStyle,
      lessonLength,
      modelName
    },
    preparedSource.sourceMaterial
  );

  const rawCourse = extractCoursePayload(payload);

  if (!rawCourse) {
    throw new AICourseGenerationError(
      'empty_response',
      'Generation failed. Please try again.'
    );
  }

  const draftValidation = validateCourse(rawCourse, { allowNormalizerRepair: true });

  const normalizedCourse = normalizeCourseFromAIJSON(rawCourse, {
    fallbackTitle: optionalTitle?.trim() || 'Generated Learning Path',
    fallbackDifficulty: difficulty,
    fallbackCourseStyle: courseStyle,
    sourceMaterialPreview: getSourcePreview(sourceMaterial)
  });
  const normalizedValidation = validateCourse(normalizedCourse);

  if (!normalizedValidation.isValid) {
    const validationDetails = [
      ...normalizedValidation.errors,
      ...draftValidation.errors.map((error) => `Original draft: ${error}`)
    ];

    throw new AICourseGenerationError(
      'invalid_schema',
      'The generated course was not valid. Try again.',
      validationDetails.slice(0, MAX_VALIDATION_ERRORS_IN_MESSAGE)
    );
  }

  return {
    course: normalizedCourse,
    validationWarnings: [
      ...(preparedSource.wasCondensed ? [LONG_SOURCE_CONDENSED_WARNING] : []),
      ...(payload.validationWarnings ?? []),
      ...(!draftValidation.isValid ? ['Some generated fields were repaired before saving.'] : []),
      ...draftValidation.warnings,
      ...normalizedValidation.warnings
    ],
    rawResponseText: JSON.stringify(rawCourse)
  };
}
