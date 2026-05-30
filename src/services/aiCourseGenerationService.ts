import type { Course } from '../types/course';
import { normalizeCourseFromAIJSON } from './courseNormalizer';
import { validateCourse } from './courseValidator';

export type AICourseGenerationErrorCode =
  | 'network_error'
  | 'api_error'
  | 'api_timeout'
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

function logClientGenerationStep(step: string, details?: Record<string, unknown>): void {
  const safeDetails = details ? ` ${JSON.stringify(details)}` : '';
  console.log(`[AdoLearn generation][client] ${step}${safeDetails}`);
}

function logClientGenerationError(step: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[AdoLearn generation][client] ${step} failed`, { message });
}
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

  if (status === 504 || code === 'ai_timeout') {
    return new AICourseGenerationError(
      'api_timeout',
      payload?.error || 'AI generation took too long. Try again with shorter source material.',
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

async function readResponsePayload(response: Response): Promise<{ payload: unknown; rawText: string }> {
  const rawText = await response.text();
  logClientGenerationStep('api.response.body_read', {
    status: response.status,
    ok: response.ok,
    bodyCharacters: rawText.length
  });

  if (!rawText.trim()) {
    return { payload: null, rawText };
  }

  try {
    return { payload: JSON.parse(rawText) as unknown, rawText };
  } catch (error) {
    logClientGenerationError('api.response.json_parse', error);

    if (!response.ok) {
      return { payload: null, rawText };
    }

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
  const startedAt = Date.now();

  logClientGenerationStep('api.request.start', {
    url: GENERATE_COURSE_API_URL,
    sourceCharacters: preparedSourceMaterial.length,
    modelName: cleanModelName(input.modelName) ?? null
  });

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
  } catch (error) {
    logClientGenerationError('api.request.network', error);
    throw new AICourseGenerationError(
      'network_error',
      'Generation failed. Please try again.'
    );
  }

  logClientGenerationStep('api.response.received', {
    status: response.status,
    ok: response.ok,
    durationMs: Date.now() - startedAt
  });

  const { payload } = await readResponsePayload(response);

  if (!response.ok) {
    logClientGenerationStep('api.response.not_ok', {
      status: response.status,
      code: isRecord(payload) ? payload.code ?? null : null
    });
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
  logClientGenerationStep('start', {
    sourceCharacters: sourceMaterial.length,
    hasOptionalTitle: Boolean(optionalTitle?.trim()),
    modelName: cleanModelName(modelName) ?? null
  });

  const preparedSource = prepareSourceMaterialForProxy(sourceMaterial);
  logClientGenerationStep('source.prepared', {
    sourceCharacters: preparedSource.sourceMaterial.length,
    wasCondensed: preparedSource.wasCondensed
  });

  const payload = await callServerProxy(
    {
      sourceMaterial,
      optionalTitle,
      modelName
    },
    preparedSource.sourceMaterial
  );

  logClientGenerationStep('api.payload.received', {
    hasCourse: Boolean(payload.course),
    hasRawCourse: Boolean(payload.rawCourse),
    warnings: payload.validationWarnings?.length ?? 0
  });

  const rawCourse = extractCoursePayload(payload);

  if (!rawCourse) {
    throw new AICourseGenerationError(
      'empty_response',
      'Generation failed. Please try again.'
    );
  }

  logClientGenerationStep('validation.draft.start');
  const draftValidation = validateCourse(rawCourse, { allowNormalizerRepair: true });
  logClientGenerationStep('validation.draft.done', {
    isValid: draftValidation.isValid,
    errors: draftValidation.errors.length,
    warnings: draftValidation.warnings.length
  });

  logClientGenerationStep('normalize.start');
  const normalizedCourse = normalizeCourseFromAIJSON(rawCourse, {
    fallbackTitle: optionalTitle?.trim() || 'Generated Learning Path',
    sourceMaterialPreview: getSourcePreview(sourceMaterial)
  });
  logClientGenerationStep('normalize.done', {
    courseId: normalizedCourse.id,
    units: normalizedCourse.units.length
  });

  logClientGenerationStep('validation.normalized.start');
  const normalizedValidation = validateCourse(normalizedCourse);
  logClientGenerationStep('validation.normalized.done', {
    isValid: normalizedValidation.isValid,
    errors: normalizedValidation.errors.length,
    warnings: normalizedValidation.warnings.length
  });

  if (!normalizedValidation.isValid) {
    throw new AICourseGenerationError(
      'invalid_schema',
      'The generated course was not valid. Try again.',
      normalizedValidation.errors.slice(0, MAX_VALIDATION_ERRORS_IN_MESSAGE)
    );
  }

  logClientGenerationStep('done', {
    courseId: normalizedCourse.id,
    title: normalizedCourse.title
  });

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
