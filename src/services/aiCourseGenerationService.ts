import type { Course } from '../types/course';
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
const MAX_PROXY_SOURCE_MATERIAL_CHARS = 50_000;
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

  if (compacted.length > MAX_PROXY_SOURCE_MATERIAL_CHARS) {
    throw new AICourseGenerationError(
      'source_too_large',
      'The source material must be 50,000 characters or fewer.'
    );
  }

  return { sourceMaterial: compacted, wasCondensed: false };
}

function mapProxyError(status: number, payload: GenerateCourseAPIErrorPayload | null): AICourseGenerationError {
  const code = payload?.code ?? '';
  const details = payload?.details;

  if (status === 413 || status === 422 || code === 'source_too_large' || code === 'request_too_large') {
    return new AICourseGenerationError(
      'source_too_large',
      'The source material must be 50,000 characters or fewer.',
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
  modelName
}: GenerateCourseWithAIInput): Promise<GenerateCourseWithAIResult> {
  const preparedSource = prepareSourceMaterialForProxy(sourceMaterial);
  const payload = await callServerProxy(
    {
      sourceMaterial,
      optionalTitle,
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

  if (!draftValidation.isValid) {
    throw new AICourseGenerationError(
      'invalid_schema',
      'The generated course was not valid. Try again.',
      draftValidation.errors.slice(0, MAX_VALIDATION_ERRORS_IN_MESSAGE)
    );
  }

  const normalizedCourse = normalizeCourseFromAIJSON(rawCourse, {
    fallbackTitle: optionalTitle?.trim() || 'Generated Learning Path',
    sourceMaterialPreview: getSourcePreview(sourceMaterial)
  });
  const normalizedValidation = validateCourse(normalizedCourse);

  if (!normalizedValidation.isValid) {
    throw new AICourseGenerationError(
      'invalid_schema',
      'The generated course was not valid. Try again.',
      normalizedValidation.errors.slice(0, MAX_VALIDATION_ERRORS_IN_MESSAGE)
    );
  }

  return {
    course: normalizedCourse,
    validationWarnings: [
      ...(payload.validationWarnings ?? []),
      ...draftValidation.warnings,
      ...normalizedValidation.warnings
    ],
    rawResponseText: JSON.stringify(rawCourse)
  };
}
