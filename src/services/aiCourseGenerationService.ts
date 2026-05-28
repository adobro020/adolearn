import type { Course } from '../types/course';
import type { CourseStyle, Difficulty, LessonLength } from '../types/settings';
import { buildCourseGenerationPrompt } from './aiPromptService';
import { normalizeCourseFromAIJSON } from './courseNormalizer';
import { validateCourse } from './courseValidator';
import { getAdoLearnCourseResponseJSONSchema } from './schemaService';

export type AICourseGenerationErrorCode =
  | 'missing_api_key'
  | 'missing_model'
  | 'network_error'
  | 'api_error'
  | 'rate_limit'
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
  apiKey: string;
  modelName: string;
}

export interface GenerateCourseWithAIResult {
  course: Course;
  validationWarnings: string[];
  rawResponseText: string;
}

interface OpenAIResponsesAPIContentPart {
  type?: string;
  text?: string;
}

interface OpenAIResponsesAPIOutputItem {
  type?: string;
  content?: OpenAIResponsesAPIContentPart[];
}

interface OpenAIResponsesAPIResponse {
  output_text?: string;
  output?: OpenAIResponsesAPIOutputItem[];
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

const OPENAI_RESPONSES_API_URL = 'https://api.openai.com/v1/responses';
const MAX_VALIDATION_ERRORS_IN_MESSAGE = 8;

function getSourcePreview(sourceMaterial: string): string {
  return sourceMaterial.replace(/\s+/g, ' ').trim().slice(0, 500);
}

function cleanModelName(modelName: string): string {
  return modelName.trim() || 'gpt-5-nano';
}

function extractResponseText(payload: OpenAIResponsesAPIResponse): string {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const outputText = payload.output
    ?.flatMap((item) => item.content ?? [])
    .filter((content) => content.type === 'output_text' || content.type === 'text' || !content.type)
    .map((content) => content.text ?? '')
    .join('\n')
    .trim();

  return outputText ?? '';
}

function stripMarkdownCodeFence(value: string): string {
  const trimmed = value.trim();
  const codeFenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return codeFenceMatch ? codeFenceMatch[1].trim() : trimmed;
}

function extractJSONObjectText(value: string): string {
  const withoutFence = stripMarkdownCodeFence(value);

  if (withoutFence.startsWith('{') && withoutFence.endsWith('}')) {
    return withoutFence;
  }

  const firstBrace = withoutFence.indexOf('{');
  const lastBrace = withoutFence.lastIndexOf('}');

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return withoutFence.slice(firstBrace, lastBrace + 1);
  }

  return withoutFence;
}

function parseCourseJSON(rawResponseText: string): unknown {
  try {
    const parsed = JSON.parse(extractJSONObjectText(rawResponseText)) as unknown;

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      'course' in parsed &&
      typeof (parsed as { course?: unknown }).course === 'object'
    ) {
      return (parsed as { course: unknown }).course;
    }

    return parsed;
  } catch {
    throw new AICourseGenerationError(
      'invalid_json',
      'The AI response was not valid JSON. Try again or use a shorter source.'
    );
  }
}

function mapOpenAIError(status: number, payload: unknown): AICourseGenerationError {
  const message =
    typeof payload === 'object' &&
    payload !== null &&
    'error' in payload &&
    typeof (payload as { error?: { message?: unknown } }).error?.message === 'string'
      ? (payload as { error: { message: string } }).error.message
      : '';

  if (status === 429) {
    return new AICourseGenerationError(
      'rate_limit',
      'The AI API rate limit was reached. Wait a moment, then retry or switch to mock mode.',
      message ? [message] : undefined
    );
  }

  if (status === 401 || status === 403) {
    return new AICourseGenerationError(
      'api_error',
      'The AI API rejected your API key. Check it in Settings, then try again.',
      message ? [message] : undefined
    );
  }

  return new AICourseGenerationError(
    'api_error',
    'Generation failed. You can retry or switch to mock mode.',
    message ? [message] : undefined
  );
}

async function readAPIErrorPayload(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    try {
      return { error: { message: await response.text() } };
    } catch {
      return null;
    }
  }
}

async function callOpenAIResponsesAPI(prompt: string, apiKey: string, modelName: string): Promise<string> {
  let response: Response;

  try {
    response = await fetch(OPENAI_RESPONSES_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelName,
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text:
                  'You generate AdoLearn course JSON. Return exactly one valid JSON object and no markdown.'
              }
            ]
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: prompt
              }
            ]
          }
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'adolearn_course',
            description: 'A complete AdoLearn Course object.',
            schema: getAdoLearnCourseResponseJSONSchema(),
            strict: false
          }
        },
        store: false
      })
    });
  } catch {
    throw new AICourseGenerationError(
      'network_error',
      'Network error. Check your connection, then retry or switch to mock mode.'
    );
  }

  if (!response.ok) {
    throw mapOpenAIError(response.status, await readAPIErrorPayload(response));
  }

  let payload: OpenAIResponsesAPIResponse;

  try {
    payload = (await response.json()) as OpenAIResponsesAPIResponse;
  } catch {
    throw new AICourseGenerationError(
      'invalid_json',
      'The AI response was not valid JSON. Try again or use a shorter source.'
    );
  }

  if (payload.error) {
    throw new AICourseGenerationError(
      payload.error.code === 'rate_limit_exceeded' ? 'rate_limit' : 'api_error',
      'Generation failed. You can retry or switch to mock mode.',
      payload.error.message ? [payload.error.message] : undefined
    );
  }

  const outputText = extractResponseText(payload);

  if (!outputText) {
    throw new AICourseGenerationError(
      'empty_response',
      'The model returned an empty response. Try again or use a shorter source.'
    );
  }

  return outputText;
}

export async function generateCourseWithAI({
  sourceMaterial,
  optionalTitle,
  difficulty,
  courseStyle,
  lessonLength,
  apiKey,
  modelName
}: GenerateCourseWithAIInput): Promise<GenerateCourseWithAIResult> {
  const cleanedApiKey = apiKey.trim();
  const cleanedModelName = cleanModelName(modelName);

  if (!cleanedApiKey) {
    throw new AICourseGenerationError('missing_api_key', 'Your API key is missing. Add it in Settings.');
  }

  if (!cleanedModelName) {
    throw new AICourseGenerationError(
      'missing_model',
      'The model name is missing. Add a model name in Settings or reset settings to defaults.'
    );
  }

  const prompt = buildCourseGenerationPrompt(sourceMaterial, {
    optionalTitle,
    difficulty,
    courseStyle,
    lessonLength
  });
  const rawResponseText = await callOpenAIResponsesAPI(prompt, cleanedApiKey, cleanedModelName);
  const parsedCourse = parseCourseJSON(rawResponseText);
  const draftValidation = validateCourse(parsedCourse, { allowNormalizerRepair: true });

  if (!draftValidation.isValid) {
    throw new AICourseGenerationError(
      'invalid_schema',
      'The AI returned JSON, but it did not match the AdoLearn course schema. Try again or use mock mode.',
      draftValidation.errors.slice(0, MAX_VALIDATION_ERRORS_IN_MESSAGE)
    );
  }

  const normalizedCourse = normalizeCourseFromAIJSON(parsedCourse, {
    fallbackTitle: optionalTitle?.trim() || 'Generated Learning Path',
    fallbackDifficulty: difficulty,
    fallbackCourseStyle: courseStyle,
    sourceMaterialPreview: getSourcePreview(sourceMaterial)
  });
  const normalizedValidation = validateCourse(normalizedCourse);

  if (!normalizedValidation.isValid) {
    throw new AICourseGenerationError(
      'invalid_schema',
      'The generated course could not be cleaned into a valid AdoLearn course. Try again or use mock mode.',
      normalizedValidation.errors.slice(0, MAX_VALIDATION_ERRORS_IN_MESSAGE)
    );
  }

  return {
    course: normalizedCourse,
    validationWarnings: [...draftValidation.warnings, ...normalizedValidation.warnings],
    rawResponseText
  };
}
