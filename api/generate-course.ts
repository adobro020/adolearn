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
  status?: string;
  incomplete_details?: {
    reason?: string;
  };
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

const OPENAI_RESPONSES_API_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-5.4-mini';
const ALLOWED_MODELS = new Set(['gpt-5.4-mini', 'gpt-5-mini', 'gpt-5']);
const MAX_REQUEST_BYTES = 700_000;
const MAX_SOURCE_MATERIAL_CHARACTERS = 50_000;
const OPENAI_REQUEST_TIMEOUT_MS = 52_000;
const OPENAI_MAX_OUTPUT_TOKENS = 10_000;
const MODEL_OUTPUT_PREVIEW_CHARACTERS = 1_200;

function createGenerationRequestId(): string {
  return `adolearn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function logGenerationStep(requestId: string, step: string, details?: Record<string, unknown>): void {
  const safeDetails = details ? ` ${JSON.stringify(details)}` : '';
  console.log(`[AdoLearn generation][${requestId}] ${step}${safeDetails}`);
}

function logGenerationError(requestId: string, step: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[AdoLearn generation][${requestId}] ${step} failed`, { message });
}
const COURSE_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  required: ['title', 'description', 'estimatedTotalMinutes', 'units', 'keyConcepts'],
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    sourceMaterialPreview: { type: 'string' },
    estimatedTotalMinutes: { type: 'number' },
    keyConcepts: { type: 'array', items: { type: 'string' } },
    units: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        required: ['title', 'description', 'sections'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          sections: {
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
                    required: ['title', 'type', 'estimatedMinutes', 'learningObjectives', 'summary', 'exercises'],
                    properties: {
                      title: { type: 'string' },
                      type: { type: 'string', enum: ['standard', 'review'] },
                      estimatedMinutes: { type: 'number' },
                      learningObjectives: { type: 'array', items: { type: 'string' } },
                      summary: { type: 'string' },
                      exercises: {
                        type: 'array',
                        maxItems: 4,
                        items: {
                          type: 'object',
                          additionalProperties: true,
                          required: ['type', 'prompt', 'explanation'],
                          properties: {
                            type: { type: 'string', enum: ['multiple_choice', 'true_false'] },
                            prompt: { type: 'string' },
                            choices: {
                              type: 'array',
                              maxItems: 4,
                              items: {
                                type: 'object',
                                additionalProperties: true,
                                properties: {
                                  id: { type: 'string' },
                                  text: { type: 'string' },
                                  explanation: { type: 'string' }
                                }
                              }
                            },
                            answer: { type: ['string', 'boolean'] },
                            acceptedAnswers: { type: 'array', items: { type: 'string' } },
                            explanation: { type: 'string' },
                            hint: { type: 'string' },
                            sourceReference: { type: 'string' },
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

function sendError(
  response: ApiResponse,
  status: number,
  code: string,
  message: string,
  details?: string[],
  requestId?: string
): void {
  sendJSON(response, status, {
    ok: false,
    code,
    error: message,
    ...(details?.length ? { details } : {}),
    ...(requestId ? { requestId } : {})
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

function getCourseJSONContractSummary(): string {
  return [
    'Valid lesson types: standard, review',
    'Valid exercise types: multiple_choice, true_false',
    'Every course must contain units, every unit must contain sections, every section must contain lessons, and every lesson must contain exercises.',
    'Every lesson must include learning objectives.',
    'Every exercise must include a prompt, an explanation, and a hint when possible.',
    'multiple_choice exercises require no more than four choices and the correct answer.',
    'For multiple_choice exercises, every choice should include an explanation field that explains why that choice is right or wrong using source-grounded reasoning.',
    'true_false exercises require a boolean answer.',
    'Each lesson may contain up to four exercises/questions.'
  ].join('\n');
}

function getCourseSchemaForPrompt(): string {
  return JSON.stringify(COURSE_SCHEMA, null, 2);
}

function getCourseScaleGuidance(characterCount: number): string {
  if (characterCount < 1_500) {
    return 'Create 1 unit, 1 section, and 1 to 2 short lessons total. Use 2 exercises per lesson.';
  }

  if (characterCount < 8_000) {
    return 'Create 1 unit with 1 section and 2 to 3 lessons total. Use 2 to 3 exercises per lesson.';
  }

  if (characterCount < 20_000) {
    return 'Create 1 unit with 1 to 2 sections and 2 to 3 lessons per section. Use 2 to 3 exercises per lesson.';
  }

  return 'Create 2 units with 1 to 2 sections per unit and 2 lessons per section. Use 2 to 3 exercises per lesson. Do not create more structure than the source material can support.';
}

function buildCourseGenerationPrompt(
  sourceMaterial: string,
  options: {
    optionalTitle?: string;
  }
): string {
  const providedTitle = options.optionalTitle?.trim() || 'Create a concise, learner-friendly course title from the provided source material.';
  const scaleGuidance = getCourseScaleGuidance(sourceMaterial.length);

  return `You are an expert instructional designer creating an interactive course for AdoLearn.

Your task:
Transform the provided source material into a structured and interactive learning course.

Hard rules:
- Use only the provided source material.
- If the source material does not support a detail, leave it out or write a source-grounded generalization.
- Return valid JSON only. Do not include markdown, code fences, commentary, or explanations outside the JSON.
- Return one top-level Course object directly, not an object wrapped in a \`course\` property.
- The JSON must match the AdoLearn Course type and the schema-like contract below.
- Keep lessons interactive and learner-friendly.
- Include explanations and hints for exercises.
- Include learning objectives for every lesson.
- Include key concepts for the course.
- Include review lessons.
- Make the experience feel playful, clear, and bite-sized.
- Make sure the questions and answers actually make sense.
- Keep all text concise so the JSON stays complete and parseable.

Course title: ${providedTitle}

The source material is ${sourceMaterial.length.toLocaleString()} characters long.
Use the source material character count to decide how many units, sections, and lessons to create. ${scaleGuidance}
Do not create empty units, empty sections, or placeholder lessons. Every unit must contain at least one complete section, every section must contain at least one complete lesson, and every lesson must contain at least one complete exercise.
Make the exercises per lesson based off how long the source material is.

Exercise requirements:
- Mix lesson exercise types when possible: multiple_choice, true_false. Do not generate short_answer, fill_blank, scenario, explain_concept, or any typed/written-answer exercises inside lessons.
- Each lesson should contain 2 to 3 exercises/questions. Never exceed 4.
- For multiple_choice, include exactly 4 choices when the source supports them; otherwise include at least 2 choices. Make sure the correct answer is represented.
- For each multiple_choice choice, include a concise explanation field explaining why that specific choice is right or wrong using only the source material.
- Keep exercise explanations, hints, and choice explanations short.
- For true_false, the exercise explanation must explain why the correct true/false answer is supported by the source material.
- Every exercise must include prompt, explanation, hint, and concept when possible.

JSON contract summary:
${getCourseJSONContractSummary()}

Schema-like object:
${getCourseSchemaForPrompt()}

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


function getTextPreview(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, MODEL_OUTPUT_PREVIEW_CHARACTERS);
}

function removeTrailingJSONCommas(value: string): string {
  return value.replace(/,\s*([}\]])/g, '$1');
}

function appendBalancedJSONClosers(value: string): string {
  const expectedClosers: string[] = [];
  let inString = false;
  let escaped = false;

  for (const character of value) {
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (character === '\\') {
        escaped = true;
        continue;
      }

      if (character === '"') {
        inString = false;
      }

      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === '{') {
      expectedClosers.push('}');
      continue;
    }

    if (character === '[') {
      expectedClosers.push(']');
      continue;
    }

    if (character === '}' || character === ']') {
      if (expectedClosers[expectedClosers.length - 1] === character) {
        expectedClosers.pop();
      }
    }
  }

  if (inString || expectedClosers.length === 0) {
    return value;
  }

  return `${value}${expectedClosers.reverse().join('')}`;
}

function getJSONCandidateTexts(value: string): string[] {
  const withoutFence = stripMarkdownCodeFence(value);
  const candidates = new Set<string>();

  const addCandidate = (candidate: string) => {
    const trimmed = candidate.trim();
    if (!trimmed) {
      return;
    }

    candidates.add(trimmed);
    candidates.add(removeTrailingJSONCommas(trimmed));
    candidates.add(appendBalancedJSONClosers(removeTrailingJSONCommas(trimmed)));
  };

  addCandidate(withoutFence);

  const firstBrace = withoutFence.indexOf('{');
  const lastBrace = withoutFence.lastIndexOf('}');

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    addCandidate(withoutFence.slice(firstBrace, lastBrace + 1));
  } else if (firstBrace >= 0) {
    addCandidate(withoutFence.slice(firstBrace));
  }

  const firstBracket = withoutFence.indexOf('[');
  const lastBracket = withoutFence.lastIndexOf(']');

  if (firstBracket >= 0 && lastBracket > firstBracket) {
    addCandidate(withoutFence.slice(firstBracket, lastBracket + 1));
  }

  return Array.from(candidates);
}

function unwrapGeneratedCourse(value: unknown): unknown {
  if (isRecord(value) && isRecord(value.course)) {
    return value.course;
  }

  return value;
}

function looksLikeCourse(value: unknown): boolean {
  return isRecord(value) && Array.isArray(value.units) && (typeof value.title === 'string' || typeof value.description === 'string');
}

function findCourseLikeObject(value: unknown, depth = 0): unknown | undefined {
  if (depth > 8) {
    return undefined;
  }

  const unwrapped = unwrapGeneratedCourse(value);

  if (looksLikeCourse(unwrapped)) {
    return unwrapped;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findCourseLikeObject(item, depth + 1);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  if (isRecord(value)) {
    for (const childValue of Object.values(value)) {
      const found = findCourseLikeObject(childValue, depth + 1);
      if (found) {
        return found;
      }
    }
  }

  return undefined;
}

function collectModelTextCandidates(value: unknown, candidates = new Set<string>(), depth = 0): string[] {
  if (depth > 8) {
    return Array.from(candidates);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.includes('"units"') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
      candidates.add(trimmed);
    }
    return Array.from(candidates);
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectModelTextCandidates(item, candidates, depth + 1));
    return Array.from(candidates);
  }

  if (isRecord(value)) {
    Object.values(value).forEach((childValue) => collectModelTextCandidates(childValue, candidates, depth + 1));
  }

  return Array.from(candidates);
}

function parseGeneratedCourseFromText(rawResponseText: string, requestId: string): unknown {
  const candidates = getJSONCandidateTexts(rawResponseText);
  let lastError: unknown;

  logGenerationStep(requestId, 'openai.output.json_candidates', {
    candidates: candidates.length,
    preview: getTextPreview(rawResponseText)
  });

  for (const [candidateIndex, candidate] of candidates.entries()) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      const unwrapped = unwrapGeneratedCourse(parsed);
      logGenerationStep(requestId, 'openai.output.json_candidate_parsed', {
        candidateIndex,
        repaired: candidate !== rawResponseText.trim()
      });
      return unwrapped;
    } catch (error) {
      lastError = error;
    }
  }

  logGenerationError(requestId, 'openai.output.all_json_candidates_parse', lastError ?? new Error('no_json_candidates'));
  throw new Error('invalid_model_json');
}

function parseGeneratedCourse(rawResponseText: string, payload: OpenAIResponsePayload | null, requestId: string): unknown {
  const structuredCourse = findCourseLikeObject(payload);

  if (structuredCourse) {
    logGenerationStep(requestId, 'openai.output.structured_course_found');
    return structuredCourse;
  }

  const textCandidates = [rawResponseText, ...collectModelTextCandidates(payload)].filter((candidate, index, array) => {
    return candidate.trim() && array.findIndex((item) => item.trim() === candidate.trim()) === index;
  });

  if (textCandidates.length === 0) {
    throw new Error('empty_model_response');
  }

  for (const [candidateIndex, textCandidate] of textCandidates.entries()) {
    try {
      const parsedCourse = parseGeneratedCourseFromText(textCandidate, requestId);
      logGenerationStep(requestId, 'openai.output.course_json_parsed', { candidateIndex });
      return parsedCourse;
    } catch (error) {
      logGenerationError(requestId, `openai.output.text_candidate_${candidateIndex}`, error);
    }
  }

  throw new Error('invalid_model_json');
}

async function callOpenAI(prompt: string, modelName: string, apiKey: string, requestId: string): Promise<unknown> {
  let openAIResponse: Response;
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENAI_REQUEST_TIMEOUT_MS);

  logGenerationStep(requestId, 'openai.request.start', {
    model: modelName,
    promptCharacters: prompt.length
  });

  try {
    openAIResponse = await fetch(OPENAI_RESPONSES_API_URL, {
      method: 'POST',
      signal: controller.signal,
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
        max_output_tokens: OPENAI_MAX_OUTPUT_TOKENS,
        store: false
      })
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      logGenerationError(requestId, 'openai.request.timeout', error);
      throw new Error('openai_timeout');
    }

    logGenerationError(requestId, 'openai.request.network', error);
    throw new Error('network_error');
  } finally {
    clearTimeout(timeoutId);
  }

  logGenerationStep(requestId, 'openai.response.received', {
    status: openAIResponse.status,
    ok: openAIResponse.ok,
    durationMs: Date.now() - startedAt
  });

  const responseText = await openAIResponse.text();
  logGenerationStep(requestId, 'openai.response.body_read', {
    bodyCharacters: responseText.length
  });

  let payload: OpenAIResponsePayload | null = null;

  try {
    payload = responseText ? (JSON.parse(responseText) as OpenAIResponsePayload) : null;
    logGenerationStep(requestId, 'openai.response.json_parsed');
  } catch (error) {
    logGenerationError(requestId, 'openai.response.json_parse', error);
    payload = null;
  }

  if (!openAIResponse.ok) {
    const rateLimited = openAIResponse.status === 429 || payload?.error?.code === 'rate_limit_exceeded';
    const unavailable = openAIResponse.status >= 500;

    logGenerationStep(requestId, 'openai.response.not_ok', {
      status: openAIResponse.status,
      code: payload?.error?.code,
      type: payload?.error?.type
    });

    throw new Error(rateLimited ? 'rate_limit' : unavailable ? 'openai_unavailable' : 'openai_error');
  }

  if (payload?.error) {
    logGenerationStep(requestId, 'openai.response.error_payload', {
      code: payload.error.code,
      type: payload.error.type
    });
    throw new Error(payload.error.code === 'rate_limit_exceeded' ? 'rate_limit' : 'openai_error');
  }

  logGenerationStep(requestId, 'openai.response.status_payload', {
    status: payload?.status ?? null,
    incompleteReason: payload?.incomplete_details?.reason ?? null
  });

  if (payload?.status === 'incomplete') {
    throw new Error('model_output_incomplete');
  }

  const rawResponseText = payload ? extractResponseText(payload) : '';
  logGenerationStep(requestId, 'openai.output.extracted', {
    outputCharacters: rawResponseText.length,
    preview: getTextPreview(rawResponseText)
  });

  try {
    const parsedCourse = parseGeneratedCourse(rawResponseText, payload, requestId);
    logGenerationStep(requestId, 'openai.output.course_json_parsed');
    return parsedCourse;
  } catch (error) {
    logGenerationError(requestId, 'openai.output.course_json_parse', error);
    throw error instanceof Error ? error : new Error('invalid_model_json');
  }
}

async function handleGenerateCourse(request: ApiRequest, response: ApiResponse): Promise<void> {
  const requestId = createGenerationRequestId();
  logGenerationStep(requestId, 'request.received', { method: request.method ?? 'unknown' });

  if (request.method !== 'POST') {
    logGenerationStep(requestId, 'request.rejected.method');
    sendError(response, 405, 'method_not_allowed', 'This endpoint only accepts POST requests.');
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    logGenerationStep(requestId, 'request.rejected.missing_api_key');
    sendError(response, 503, 'server_configuration_missing', 'Server configuration is missing.');
    return;
  }

  let body: unknown;

  try {
    logGenerationStep(requestId, 'request.body.read.start');
    body = await readRequestBody(request);
    logGenerationStep(requestId, 'request.body.read.done', { bytes: getRequestByteSize(body) });
  } catch (error) {
    logGenerationError(requestId, 'request.body.read', error);
    const message = error instanceof Error ? error.message : '';

    if (message === 'request_too_large') {
      sendError(response, 422, 'request_too_large', 'The source material must be 50,000 characters or fewer.');
      return;
    }

    sendError(response, 400, 'invalid_request', 'Generation failed. Please try again.');
    return;
  }

  if (!isRecord(body)) {
    logGenerationStep(requestId, 'request.rejected.invalid_body');
    sendError(response, 400, 'invalid_request', 'Generation failed. Please try again.');
    return;
  }

  if (getRequestByteSize(body) > MAX_REQUEST_BYTES) {
    logGenerationStep(requestId, 'request.rejected.too_large', { bytes: getRequestByteSize(body) });
    sendError(response, 422, 'request_too_large', 'The source material must be 50,000 characters or fewer.');
    return;
  }

  const requestBody = body as GenerateCourseRequestBody;
  const sourceMaterial = getCleanString(requestBody.sourceMaterial);
  const modelName = getAllowedModel(requestBody.modelName);

  logGenerationStep(requestId, 'request.body.normalized', {
    sourceCharacters: sourceMaterial.length,
    requestedModel: getCleanString(requestBody.modelName) || null,
    modelName
  });

  if (!sourceMaterial) {
    logGenerationStep(requestId, 'request.rejected.missing_source');
    sendError(response, 400, 'missing_source_material', 'Generation failed. Please try again.');
    return;
  }

  if (sourceMaterial.length > MAX_SOURCE_MATERIAL_CHARACTERS) {
    logGenerationStep(requestId, 'request.rejected.source_too_large', { sourceCharacters: sourceMaterial.length });
    sendError(response, 422, 'source_too_large', 'The source material must be 50,000 characters or fewer.');
    return;
  }

  logGenerationStep(requestId, 'prompt.build.start');
  const prompt = buildCourseGenerationPrompt(sourceMaterial, {
    optionalTitle: getOptionalCleanString(requestBody.optionalTitle)
  });
  logGenerationStep(requestId, 'prompt.build.done', { promptCharacters: prompt.length });

  try {
    const course = await callOpenAI(prompt, modelName, apiKey, requestId);
    logGenerationStep(requestId, 'response.success.send');
    sendJSON(response, 200, { ok: true, course, requestId });
  } catch (error) {
    logGenerationError(requestId, 'generation', error);
    const code = error instanceof Error ? error.message : 'unknown_error';

    if (code === 'rate_limit') {
      sendError(response, 429, 'rate_limit', 'AI generation is temporarily unavailable.');
      return;
    }

    if (code === 'model_output_incomplete') {
      sendError(
        response,
        502,
        'model_output_incomplete',
        'The AI response was cut off before it finished. Try again with shorter source material.',
        [`Request ID: ${requestId}`, 'Check the server/API console for the exact generation step.'],
        requestId
      );
      return;
    }

    if (code === 'invalid_model_json' || code === 'empty_model_response') {
      sendError(
        response,
        502,
        'invalid_model_response',
        'The AI returned malformed course JSON. Try again, or use shorter source material.',
        [`Request ID: ${requestId}`, 'Check the server/API console for the model output preview and JSON parse step.'],
        requestId
      );
      return;
    }

    if (code === 'openai_timeout') {
      sendError(response, 504, 'ai_timeout', 'AI generation took too long. Try again with shorter source material.', [`Request ID: ${requestId}`], requestId);
      return;
    }

    if (code === 'openai_unavailable' || code === 'network_error') {
      sendError(response, 503, 'ai_unavailable', 'AI generation is temporarily unavailable.', [`Request ID: ${requestId}`], requestId);
      return;
    }

    sendError(response, 502, 'ai_generation_failed', 'Generation failed. Please try again.', [`Request ID: ${requestId}`], requestId);
  }
}

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  try {
    await handleGenerateCourse(request, response);
  } catch {
    sendError(response, 503, 'ai_unavailable', 'AI generation is temporarily unavailable.');
  }
}
