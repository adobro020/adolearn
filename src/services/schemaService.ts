import type { CourseStyle, Difficulty, LessonLength } from '../types/settings';
import type { ExerciseType, LessonType } from '../types/course';

export const COURSE_SCHEMA_VERSION = 'adolearn-course-v1';

export const VALID_DIFFICULTIES: Difficulty[] = ['Auto', 'Beginner', 'Intermediate', 'Advanced'];

export const VALID_COURSE_STYLES: CourseStyle[] = [
  'Exam prep',
  'Quick overview',
  'Deep learning',
  'Flashcard-heavy'
];

export const VALID_LESSON_LENGTHS: LessonLength[] = ['Short', 'Medium', 'Long'];

export const VALID_LESSON_TYPES: LessonType[] = ['standard', 'review', 'final_challenge'];

export const VALID_EXERCISE_TYPES: ExerciseType[] = [
  'multiple_choice',
  'true_false',
  'fill_blank',
  'matching',
  'ordering',
  'short_answer',
  'flashcard',
  'scenario',
  'explain_concept'
];

export const COURSE_REQUIRED_FIELDS = [
  'id',
  'title',
  'description',
  'sourceMaterialPreview',
  'createdAt',
  'updatedAt',
  'difficulty',
  'style',
  'estimatedTotalMinutes',
  'sections',
  'keyConcepts'
] as const;

export const SECTION_REQUIRED_FIELDS = ['id', 'title', 'description', 'units'] as const;
export const UNIT_REQUIRED_FIELDS = ['id', 'title', 'description', 'lessons'] as const;
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
  schemaVersion: COURSE_SCHEMA_VERSION,
  description:
    'AdoLearn browser-local course JSON. The object must be serializable and compatible with the Course TypeScript type.',
  course: {
    id: 'string; stable unique ID, or omit only when a normalizer will add it',
    title: 'string',
    description: 'string',
    sourceMaterialPreview: 'string; short excerpt or summary of the provided source material only',
    createdAt: 'ISO date string, or omit only when a normalizer will add it',
    updatedAt: 'ISO date string, or omit only when a normalizer will add it',
    difficulty: VALID_DIFFICULTIES,
    style: VALID_COURSE_STYLES,
    estimatedTotalMinutes: 'number; sum of lesson estimates, or omit only when a normalizer will add it',
    keyConcepts: 'string[]; source-grounded concepts only',
    sections: [
      {
        id: 'string',
        title: 'string',
        description: 'string',
        units: [
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
                    choices: 'optional array of { id: string, text: string }; required for multiple_choice and choice-based scenario',
                    answer: 'optional string | boolean | string[]',
                    acceptedAnswers: 'string[]; recommended for text-graded exercises',
                    explanation: 'string; required for every exercise',
                    hint: 'string; can be empty',
                    sourceReference: 'optional source citation object with excerpt/location',
                    pairs: 'optional array of { id: string, left: string, right: string }; required for matching',
                    items: 'optional array of { id: string, text: string }; required for ordering',
                    correctOrder: 'optional string[] of ordering item IDs; required for ordering',
                    concept: 'optional string used for weak-concept tracking'
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
} as const;

export function getCourseSchemaForPrompt(): string {
  return JSON.stringify(ADOLEARN_COURSE_SCHEMA, null, 2);
}

export function getCourseJSONContractSummary(): string {
  return [
    `Schema version: ${COURSE_SCHEMA_VERSION}`,
    `Valid lesson types: ${VALID_LESSON_TYPES.join(', ')}`,
    `Valid exercise types: ${VALID_EXERCISE_TYPES.join(', ')}`,
    'Every course must contain sections, every section must contain units, every unit must contain lessons, and every lesson must contain exercises.',
    'Every exercise must include a prompt and an explanation.',
    'multiple_choice exercises require choices.',
    'matching exercises require pairs.',
    'ordering exercises require items and correctOrder.'
  ].join('\n');
}


export const ADOLEARN_COURSE_RESPONSE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  required: ['title', 'description', 'difficulty', 'style', 'sections', 'keyConcepts'],
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string' },
    sourceMaterialPreview: { type: 'string' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
    difficulty: { type: 'string', enum: VALID_DIFFICULTIES },
    style: { type: 'string', enum: VALID_COURSE_STYLES },
    estimatedTotalMinutes: { type: 'number' },
    keyConcepts: {
      type: 'array',
      items: { type: 'string' }
    },
    sections: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: true,
        required: ['title', 'description', 'units'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          units: {
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
                                { type: 'boolean' },
                                { type: 'array', items: { type: 'string' } }
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
                            pairs: {
                              type: 'array',
                              items: {
                                type: 'object',
                                additionalProperties: true,
                                required: ['left', 'right'],
                                properties: {
                                  id: { type: 'string' },
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
                            correctOrder: {
                              type: 'array',
                              items: { type: 'string' }
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
