import type { ExerciseType, LessonType } from '../types/course';

export const COURSE_SCHEMA_VERSION = 'adolearn-course-v2';

export const VALID_LESSON_TYPES: LessonType[] = ['standard', 'review', 'final_challenge'];

export const VALID_EXERCISE_TYPES: ExerciseType[] = ['multiple_choice', 'true_false'];

export const COURSE_REQUIRED_FIELDS = [
  'id',
  'title',
  'description',
  'sourceMaterialPreview',
  'createdAt',
  'updatedAt',
  'estimatedTotalMinutes',
  'units',
  'keyConcepts'
] as const;

export const UNIT_REQUIRED_FIELDS = ['id', 'title', 'description', 'sections'] as const;
export const SECTION_REQUIRED_FIELDS = ['id', 'title', 'description', 'lessons'] as const;
export const LESSON_REQUIRED_FIELDS = [
  'id',
  'title',
  'type',
  'estimatedMinutes',
  'learningObjectives',
  'summary',
  'exercises'
] as const;
export const EXERCISE_REQUIRED_FIELDS = ['id', 'type', 'prompt', 'explanation'] as const;

export const ADOLEARN_COURSE_SCHEMA = {
  id: 'string; stable unique ID, or omit only when a normalizer will add it',
  title: 'string',
  description: 'string',
  sourceMaterialPreview: 'string; short excerpt or summary of the provided source material only',
  createdAt: 'ISO date string, or omit only when a normalizer will add it',
  updatedAt: 'ISO date string, or omit only when a normalizer will add it',
  estimatedTotalMinutes: 'number; sum of lesson estimates, or omit only when a normalizer will add it',
  keyConcepts: 'string[]; source-grounded concepts only',
  units: [
    {
      id: 'string',
      title: 'string',
      description: 'string',
      sections: [
        {
          id: 'string',
          title: 'string',
          description: 'string',
          lessons: [
            {
              id: 'string',
              title: 'string',
              type: VALID_LESSON_TYPES,
              estimatedMinutes: 'number',
              learningObjectives: 'string[]',
              summary: 'string',
              exercises: [
                {
                  id: 'string',
                  type: VALID_EXERCISE_TYPES,
                  prompt: 'string',
                  choices: 'optional array of { id: string, text: string }; required for multiple_choice',
                  answer: 'string | boolean; required for scoring',
                  acceptedAnswers: 'optional string[] for answer metadata',
                  explanation: 'string; required for every exercise',
                  hint: 'string; can be empty',
                  sourceReference: 'optional source citation object with excerpt/location',
                  concept: 'optional string used for weak-concept tracking'
                }
              ]
            }
          ]
        }
      ]
    }
  ]
} as const;

export function getCourseSchemaForPrompt(): string {
  return JSON.stringify(ADOLEARN_COURSE_SCHEMA, null, 2);
}

export function getCourseJSONContractSummary(): string {
  return [
    `Schema version: ${COURSE_SCHEMA_VERSION}`,
    `Valid lesson types: ${VALID_LESSON_TYPES.join(', ')}`,
    `Valid exercise types: ${VALID_EXERCISE_TYPES.join(', ')}`,
    'Every course must contain units, every unit must contain sections, every section must contain lessons, and every lesson must contain exercises.',
    'Every lesson must include learning objectives.',
    'Every exercise must include a prompt, an explanation, and a hint when possible.',
    'multiple_choice exercises require choices and a correct answer represented by answer or acceptedAnswers.',
    'true_false exercises require a boolean answer.'
  ].join('\n');
}

export const ADOLEARN_COURSE_RESPONSE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  required: ['title', 'description', 'units', 'keyConcepts'],
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string' },
    sourceMaterialPreview: { type: 'string' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
    estimatedTotalMinutes: { type: 'number' },
    keyConcepts: {
      type: 'array',
      items: { type: 'string' }
    },
    units: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: true,
        required: ['title', 'description', 'sections'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          sections: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              additionalProperties: true,
              required: ['title', 'description', 'lessons'],
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                description: { type: 'string' },
                lessons: {
                  type: 'array',
                  minItems: 1,
                  items: {
                    type: 'object',
                    additionalProperties: true,
                    required: ['title', 'type', 'summary', 'exercises'],
                    properties: {
                      id: { type: 'string' },
                      title: { type: 'string' },
                      type: { type: 'string', enum: VALID_LESSON_TYPES },
                      estimatedMinutes: { type: 'number' },
                      learningObjectives: {
                        type: 'array',
                        items: { type: 'string' }
                      },
                      summary: { type: 'string' },
                      exercises: {
                        type: 'array',
                        minItems: 1,
                        items: {
                          type: 'object',
                          additionalProperties: true,
                          required: ['type', 'prompt', 'explanation'],
                          properties: {
                            id: { type: 'string' },
                            type: { type: 'string', enum: VALID_EXERCISE_TYPES },
                            prompt: { type: 'string' },
                            choices: {
                              type: 'array',
                              items: {
                                type: 'object',
                                additionalProperties: true,
                                required: ['text'],
                                properties: {
                                  id: { type: 'string' },
                                  text: { type: 'string' }
                                }
                              }
                            },
                            answer: {
                              anyOf: [
                                { type: 'string' },
                                { type: 'boolean' }
                              ]
                            },
                            acceptedAnswers: {
                              type: 'array',
                              items: { type: 'string' }
                            },
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

export function getAdoLearnCourseResponseJSONSchema(): Record<string, unknown> {
  return ADOLEARN_COURSE_RESPONSE_JSON_SCHEMA as unknown as Record<string, unknown>;
}
