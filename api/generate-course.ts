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

type Difficulty = 'Auto' | 'Beginner' | 'Intermediate' | 'Advanced';
type CourseStyle = 'Exam prep' | 'Quick overview' | 'Deep learning' | 'Flashcard-heavy';
type LessonLength = 'Short' | 'Medium' | 'Long';

interface GenerateCourseRequestBody {
  sourceMaterial?: unknown;
  optionalTitle?: unknown;
  difficulty?: unknown;
  courseStyle?: unknown;
  lessonLength?: unknown;
  modelName?: unknown;
}

interface OpenAIContentPart {
  type?: string;
  text?: string;
}

interface OpenAIOutputItem {
  type?: string;
  content?: OpenAIContentPart[];
}

interface OpenAIResponsePayload {
  output_text?: string;
  output?: OpenAIOutputItem[];
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

const OPENAI_RESPONSES_API_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-5-nano';
const ALLOWED_MODELS = new Set(['gpt-5-nano', 'gpt-5-mini', 'gpt-5']);
const MAX_REQUEST_BYTES = 1_000_000;
const MAX_SOURCE_MATERIAL_CHARACTERS = 120_000;
const DEFAULT_DIFFICULTY: Difficulty = 'Auto';
const DEFAULT_COURSE_STYLE: CourseStyle = 'Quick overview';
const DEFAULT_LESSON_LENGTH: LessonLength = 'Medium';

const COURSE_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  required: [
    'title',
    'description',
    'difficulty',
    'style',
    'estimatedTotalMinutes',
    'sections',
    'keyConcepts'
  ],
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    sourceMaterialPreview: { type: 'string' },
    difficulty: { type: 'string' },
    style: { type: 'string' },
    estimatedTotalMinutes: { type: 'number' },
    keyConcepts: { type: 'array', items: { type: 'string' } },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        required: ['title', 'description', 'units'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          units: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: true,
              required: ['title', 'description', 'lessons'],
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                lessons: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: true,
                    required: [
                      'title',
                      'type',
                      'estimatedMinutes',
                      'learningObjectives',
                      'summary',
                      'exercises'
                    ],
                    properties: {
                      title: { type: 'string' },
                      type: { type: 'string', enum: ['standard', 'review', 'final_challenge'] },
                      estimatedMinutes: { type: 'number' },
                      learningObjectives: { type: 'array', items: { type: 'string' } },
                      summary: { type: 'string' },
                      exercises: {
                        type: 'array',
                        items: {
                          type: 'object',
                          additionalProperties: true,
                          required: ['type', 'prompt', 'explanation'],
                          properties: {
                            type: {
                              type: 'string',
                              enum: [
                                'multiple_choice',
                                'true_false',
                                'fill_blank',
                                'matching',
                                'ordering',
                                'short_answer',
                                'flashcard',
                                'scenario',
                                'explain_concept'
                              ]
                            },
                            prompt: { type: 'string' },
                            choices: {
                              type: 'array',
                              items: {
                                type: 'object',
                                additionalProperties: true,
                                properties: {
                                  id: { type: 'string' },
                                  text: { type: 'string' },
                                  isCorrect: { type: 'boolean' }
                                }
                              }
                            },
                            answer: { type: ['string', 'boolean', 'number'] },
                            acceptedAnswers: { type: 'array', items: { type: 'string' } },
                            explanation: { type: 'string' },
                            hint: { type: 'string' },
                            sourceReference: {
                              type: 'object',
                              additionalProperties: true,
                              properties: {
                                sourceId: { type: 'string' },
                                title: { type: 'string' },
                                excerpt: { type: 'string' },
                                location: { type: 'string' }
                              }
                            },
                            pairs: {
                              type: 'array',
                              items: {
                                type: 'object',
                                additionalProperties: true,
                                properties: {
                                  left: { type: 'string' },
                                  right: { type: 'string' }
                                }
                              }
                            },
                            items: {
                              type: 'array',
                              items: {
                                type: 'object',
                                additionalProperties: true,
                                required: ['id', 'text'],
                                properties: {
                                  id: { type: 'string' },
                                  text: { type: 'string' }
                                }
                              }
                            },
                            correctOrder: { type: 'array', items: { type: 'string' } },
                            concept: { type: 'string' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
} as const;

function sendJSON(response: ApiResponse, status: number, body: unknown): void {
  response.setHeader?.('Cache-Control', 'no-store');
  response.status(status).json(body);
}

function sendError(response: ApiResponse, status: number, code: string, message: string): void {
  sendJSON(response, status, {
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

function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

function getRequestByteSize(value: unknown): number {
  try {
    return byteLength(JSON.stringify(value));
  } catch {
    return MAX_REQUEST_BYTES + 1;
  }
}

async function readRequestBody(request: ApiRequest): Promise<unknown> {
  if (request.body !== undefined) {
    if (typeof request.body === 'string') {
      if (byteLength(request.body) > MAX_REQUEST_BYTES) {
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
    let totalBytes = 0;
    let rejected = false;

    request.on?.('data', (chunk) => {
      if (rejected) {
        return;
      }

      const textChunk = typeof chunk === 'string' ? chunk : Buffer.from(chunk as ArrayBuffer).toString('utf8');
      totalBytes += byteLength(textChunk);

      if (totalBytes > MAX_REQUEST_BYTES) {
        rejected = true;
        reject(new Error('request_too_large'));
        return;
      }

      rawBody += textChunk;
    });

    request.on?.('end', () => {
      if (rejected) {
        return;
      }

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

    request.on?.('error', () => {
      if (!rejected) {
        reject(new Error('read_error'));
      }
    });
  });
}

function buildCourseGenerationPrompt(
  sourceMaterial: string,
  options: {
    optionalTitle?: string;
    difficulty: Difficulty;
    courseStyle: CourseStyle;
    lessonLength: LessonLength;
  }
): string {
  const titleInstruction = options.optionalTitle
    ? `Use this course title unless it clearly conflicts with the material: ${options.optionalTitle}`
    : 'Create a concise course title based only on the provided material.';

  return `You are an expert instructional designer. Transform the provided source material into an AdoLearn course: a short, interactive, Duolingo-style learning path.

Critical rules:
- Use only the provided source material.
- Do not invent unsupported facts.
- Return valid JSON only. No markdown, comments, or extra prose.
- Keep lessons short, interactive, and focused.
- Include sections, units, lessons, exercises, explanations, hints, learning objectives, key concepts, review lessons, and final challenges.
- Prefer 2 sections, each with 2 units, each unit with 2 to 3 lessons.
- Include at least one review lesson and one final_challenge lesson.
- Include 5 exercises per lesson when possible.
- Exercise types may include multiple_choice, true_false, fill_blank, matching, ordering, short_answer, flashcard, scenario, and explain_concept.
- For ordering exercises, items must be objects like { "id": "step_1", "text": "First step" }, never plain strings. correctOrder must use those item IDs.
- For matching exercises, pairs must be objects with left and right text.

Course settings:
- ${titleInstruction}
- Difficulty: ${options.difficulty}
- Course style: ${options.courseStyle}
- Lesson length: ${options.lessonLength}

Return one JSON object matching this shape:
{
  "title": "string",
  "description": "string",
  "sourceMaterialPreview": "string",
  "difficulty": "Auto | Beginner | Intermediate | Advanced",
  "style": "Exam prep | Quick overview | Deep learning | Flashcard-heavy",
  "estimatedTotalMinutes": 60,
  "keyConcepts": ["string"],
  "sections": [
    {
      "title": "string",
      "description": "string",
      "units": [
        {
          "title": "string",
          "description": "string",
          "lessons": [
            {
              "title": "string",
              "type": "standard | review | final_challenge",
              "estimatedMinutes": 5,
              "learningObjectives": ["string"],
              "summary": "string",
              "exercises": [
                {
                  "type": "multiple_choice",
                  "prompt": "string",
                  "choices": [
                    { "id": "a", "text": "string", "isCorrect": true },
                    { "id": "b", "text": "string", "isCorrect": false }
                  ],
                  "answer": "string",
                  "acceptedAnswers": ["string"],
                  "explanation": "string",
                  "hint": "string",
                  "sourceReference": { "title": "string", "excerpt": "string", "location": "string" },
                  "items": [{ "id": "step_1", "text": "string" }],
                  "correctOrder": ["step_1"],
                  "pairs": [{ "id": "pair_1", "left": "string", "right": "string" }],
                  "concept": "string"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}

Source material:
"""
${sourceMaterial}
"""`;
}

function extractResponseText(payload: OpenAIResponsePayload): string {
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
  let openAIResponse: Response;

  try {
    openAIResponse = await fetch(OPENAI_RESPONSES_API_URL, {
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
            schema: COURSE_SCHEMA,
            strict: false
          }
        },
        store: false
      })
    });
  } catch {
    throw new Error('network_error');
  }

  let payload: OpenAIResponsePayload | null = null;

  try {
    payload = (await openAIResponse.json()) as OpenAIResponsePayload;
  } catch {
    payload = null;
  }

  if (!openAIResponse.ok) {
    const rateLimited = openAIResponse.status === 429 || payload?.error?.code === 'rate_limit_exceeded';
    const unavailable = openAIResponse.status >= 500;

    throw new Error(rateLimited ? 'rate_limit' : unavailable ? 'openai_unavailable' : 'openai_error');
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

async function handleGenerateCourse(request: ApiRequest, response: ApiResponse): Promise<void> {
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
      sendError(response, 422, 'request_too_large', 'The source material is too large. Try a shorter paste.');
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
    sendError(response, 422, 'request_too_large', 'The source material is too large. Try a shorter paste.');
    return;
  }

  const requestBody = body as GenerateCourseRequestBody;
  const sourceMaterial = getCleanString(requestBody.sourceMaterial);

  if (!sourceMaterial) {
    sendError(response, 400, 'missing_source_material', 'Generation failed. Please try again.');
    return;
  }

  if (sourceMaterial.length > MAX_SOURCE_MATERIAL_CHARACTERS) {
    sendError(response, 422, 'source_too_large', 'The source material is too large. Try a shorter paste.');
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
    sendJSON(response, 200, { ok: true, course });
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

    if (code === 'openai_unavailable' || code === 'network_error') {
      sendError(response, 503, 'ai_unavailable', 'AI generation is temporarily unavailable.');
      return;
    }

    sendError(response, 502, 'ai_generation_failed', 'Generation failed. Please try again.');
  }
}

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  try {
    await handleGenerateCourse(request, response);
  } catch {
    sendError(response, 503, 'ai_unavailable', 'AI generation is temporarily unavailable.');
  }
}
