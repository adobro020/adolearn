import { buildCourseGenerationPrompt } from '../src/services/aiPromptService';
import { getAdoLearnCourseResponseJSONSchema } from '../src/services/schemaService';
import type { CourseStyle, Difficulty, LessonLength } from '../src/types/settings';

type ApiRequest = {
  method?: string;
  body?: unknown;
  on?: (event: 'data' | 'end' | 'error', callback: (chunk?: unknown) => void) => void;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader?: (name: string, value: string) => void;
};

interface GenerateCourseRequestBody {
  sourceMaterial?: unknown;
  optionalTitle?: unknown;
  difficulty?: unknown;
  courseStyle?: unknown;
  lessonLength?: unknown;
  modelName?: unknown;
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
const DEFAULT_MODEL = 'gpt-5-nano';
const ALLOWED_MODELS = new Set(['gpt-5-nano', 'gpt-5-mini', 'gpt-5']);
const MAX_REQUEST_BYTES = 160_000;
const MAX_SOURCE_MATERIAL_CHARACTERS = 50_000;
const DEFAULT_DIFFICULTY: Difficulty = 'Auto';
const DEFAULT_COURSE_STYLE: CourseStyle = 'Quick overview';
const DEFAULT_LESSON_LENGTH: LessonLength = 'Medium';

function sendError(response: ApiResponse, status: number, code: string, message: string): void {
  response.status(status).json({
    ok: false,
    code,
    error: message
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getCleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getOptionalCleanString(value: unknown): string | undefined {
  const cleaned = getCleanString(value);
  return cleaned || undefined;
}

function getAllowedModel(value: unknown): string {
  const requestedModel = getCleanString(value);
  return ALLOWED_MODELS.has(requestedModel) ? requestedModel : DEFAULT_MODEL;
}

function getDifficulty(value: unknown): Difficulty {
  return value === 'Beginner' || value === 'Intermediate' || value === 'Advanced' || value === 'Auto'
    ? value
    : DEFAULT_DIFFICULTY;
}

function getCourseStyle(value: unknown): CourseStyle {
  return value === 'Exam prep' ||
    value === 'Quick overview' ||
    value === 'Deep learning' ||
    value === 'Flashcard-heavy'
    ? value
    : DEFAULT_COURSE_STYLE;
}

function getLessonLength(value: unknown): LessonLength {
  return value === 'Short' || value === 'Medium' || value === 'Long'
    ? value
    : DEFAULT_LESSON_LENGTH;
}

function getRequestByteSize(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return MAX_REQUEST_BYTES + 1;
  }
}

async function readRequestBody(request: ApiRequest): Promise<unknown> {
  if (request.body !== undefined) {
    if (typeof request.body === 'string') {
      if (new TextEncoder().encode(request.body).byteLength > MAX_REQUEST_BYTES) {
        throw new Error('request_too_large');
      }

      try {
        return JSON.parse(request.body) as unknown;
      } catch {
        throw new Error('invalid_json');
      }
    }

    return request.body;
  }

  if (!request.on) {
    return null;
  }

  return new Promise((resolve, reject) => {
    let rawBody = '';
    let byteLength = 0;

    request.on?.('data', (chunk) => {
      const textChunk = typeof chunk === 'string' ? chunk : Buffer.from(chunk as ArrayBuffer).toString('utf8');
      byteLength += Buffer.byteLength(textChunk);

      if (byteLength > MAX_REQUEST_BYTES) {
        reject(new Error('request_too_large'));
        return;
      }

      rawBody += textChunk;
    });

    request.on?.('end', () => {
      if (!rawBody.trim()) {
        resolve(null);
        return;
      }

      try {
        resolve(JSON.parse(rawBody) as unknown);
      } catch {
        reject(new Error('invalid_json'));
      }
    });

    request.on?.('error', () => reject(new Error('read_error')));
  });
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

function parseGeneratedCourse(rawResponseText: string): unknown {
  const parsed = JSON.parse(extractJSONObjectText(rawResponseText)) as unknown;

  if (isRecord(parsed) && isRecord(parsed.course)) {
    return parsed.course;
  }

  return parsed;
}

async function callOpenAI(prompt: string, modelName: string, apiKey: string): Promise<unknown> {
  const openAIResponse = await fetch(OPENAI_RESPONSES_API_URL, {
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
              text: 'You generate AdoLearn course JSON. Return exactly one valid JSON object and no markdown.'
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

  let payload: OpenAIResponsesAPIResponse | null = null;

  try {
    payload = (await openAIResponse.json()) as OpenAIResponsesAPIResponse;
  } catch {
    payload = null;
  }

  if (!openAIResponse.ok) {
    const rateLimited = openAIResponse.status === 429 || payload?.error?.code === 'rate_limit_exceeded';
    const unavailable = openAIResponse.status >= 500;

    const error = new Error(rateLimited ? 'rate_limit' : unavailable ? 'openai_unavailable' : 'openai_error');
    throw error;
  }

  if (payload?.error) {
    throw new Error(payload.error.code === 'rate_limit_exceeded' ? 'rate_limit' : 'openai_error');
  }

  const rawResponseText = payload ? extractResponseText(payload) : '';

  if (!rawResponseText) {
    throw new Error('empty_model_response');
  }

  try {
    return parseGeneratedCourse(rawResponseText);
  } catch {
    throw new Error('invalid_model_json');
  }
}

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  response.setHeader?.('Cache-Control', 'no-store');

  if (request.method !== 'POST') {
    sendError(response, 405, 'method_not_allowed', 'This endpoint only accepts POST requests.');
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    sendError(response, 503, 'server_configuration_missing', 'Server configuration is missing.');
    return;
  }

  let body: unknown;

  try {
    body = await readRequestBody(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';

    if (message === 'request_too_large') {
      sendError(response, 413, 'request_too_large', 'The source material is too large. Try a shorter paste.');
      return;
    }

    sendError(response, 400, 'invalid_request', 'Generation failed. Please try again.');
    return;
  }

  if (!isRecord(body)) {
    sendError(response, 400, 'invalid_request', 'Generation failed. Please try again.');
    return;
  }

  if (getRequestByteSize(body) > MAX_REQUEST_BYTES) {
    sendError(response, 413, 'request_too_large', 'The source material is too large. Try a shorter paste.');
    return;
  }

  const requestBody = body as GenerateCourseRequestBody;
  const sourceMaterial = getCleanString(requestBody.sourceMaterial);

  if (!sourceMaterial) {
    sendError(response, 400, 'missing_source_material', 'Generation failed. Please try again.');
    return;
  }

  if (sourceMaterial.length > MAX_SOURCE_MATERIAL_CHARACTERS) {
    sendError(response, 413, 'source_too_large', 'The source material is too large. Try a shorter paste.');
    return;
  }

  const prompt = buildCourseGenerationPrompt(sourceMaterial, {
    optionalTitle: getOptionalCleanString(requestBody.optionalTitle),
    difficulty: getDifficulty(requestBody.difficulty),
    courseStyle: getCourseStyle(requestBody.courseStyle),
    lessonLength: getLessonLength(requestBody.lessonLength)
  });

  try {
    const course = await callOpenAI(prompt, getAllowedModel(requestBody.modelName), apiKey);
    response.status(200).json({ ok: true, course });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'unknown_error';

    if (code === 'rate_limit') {
      sendError(response, 429, 'rate_limit', 'AI generation is temporarily unavailable.');
      return;
    }

    if (code === 'invalid_model_json' || code === 'empty_model_response') {
      sendError(response, 502, 'invalid_model_response', 'The generated course was not valid. Try again.');
      return;
    }

    if (code === 'openai_unavailable') {
      sendError(response, 503, 'ai_unavailable', 'AI generation is temporarily unavailable.');
      return;
    }

    sendError(response, 502, 'ai_generation_failed', 'Generation failed. Please try again.');
  }
}
