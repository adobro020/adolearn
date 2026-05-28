import type { Course } from '../types/course';
import { normalizeCourseFromAIJSON } from './courseNormalizer';
import { validateCourse, type CourseValidationResult } from './courseValidator';

export interface CourseSchemaDebugResult {
  rawValidation: CourseValidationResult;
  normalizedValidation: CourseValidationResult;
  normalizedCourse: Course | null;
  messages: string[];
}

export const MOCK_AI_COURSE_JSON = {
  title: 'Sample Source Learning Path',
  description: 'A short course generated from a tiny mock source excerpt.',
  sourceMaterialPreview: 'Photosynthesis converts light energy into chemical energy stored in glucose.',
  difficulty: 'Beginner',
  style: 'Quick overview',
  keyConcepts: ['Photosynthesis', 'Chlorophyll', 'Glucose'],
  sections: [
    {
      title: 'Understand the Process',
      description: 'Learn the main ideas in a short path.',
      units: [
        {
          title: 'Photosynthesis Basics',
          description: 'Practice core vocabulary and relationships.',
          lessons: [
            {
              title: 'What Photosynthesis Does',
              type: 'standard',
              summary: 'Photosynthesis turns light energy into stored chemical energy.',
              learningObjectives: ['Describe what photosynthesis does.', 'Connect chlorophyll to light absorption.'],
              exercises: [
                {
                  type: 'multiple_choice',
                  prompt: 'What does photosynthesis convert light energy into?',
                  choices: [
                    { text: 'Chemical energy stored in glucose' },
                    { text: 'Sound energy' },
                    { text: 'Heat only' }
                  ],
                  answer: 'Chemical energy stored in glucose',
                  acceptedAnswers: ['Chemical energy stored in glucose'],
                  explanation: 'The source says photosynthesis converts light energy into chemical energy stored in glucose.',
                  hint: 'Look for the phrase about energy being stored.',
                  concept: 'Photosynthesis'
                },
                {
                  type: 'true_false',
                  prompt: 'True or false: Chlorophyll helps plants absorb light.',
                  answer: true,
                  acceptedAnswers: ['true'],
                  explanation: 'Chlorophyll is the light-absorbing pigment connected to photosynthesis.',
                  hint: 'Think about what captures light.',
                  concept: 'Chlorophyll'
                }
              ]
            }
          ]
        }
      ]
    }
  ]
};

export function runCourseSchemaDebugCheck(mockAIJSON: unknown = MOCK_AI_COURSE_JSON): CourseSchemaDebugResult {
  const rawValidation = validateCourse(mockAIJSON, { allowNormalizerRepair: true });

  if (!rawValidation.isValid) {
    return {
      rawValidation,
      normalizedValidation: { isValid: false, errors: [], warnings: [] },
      normalizedCourse: null,
      messages: [
        'Raw mock AI JSON failed validation before normalization.',
        ...rawValidation.errors.map((error) => `Error: ${error}`),
        ...rawValidation.warnings.map((warning) => `Warning: ${warning}`)
      ]
    };
  }

  const normalizedCourse = normalizeCourseFromAIJSON(mockAIJSON, {
    fallbackDifficulty: 'Beginner',
    fallbackCourseStyle: 'Quick overview',
    sourceMaterialPreview: 'Photosynthesis converts light energy into chemical energy stored in glucose.'
  });
  const normalizedValidation = validateCourse(normalizedCourse);

  return {
    rawValidation,
    normalizedValidation,
    normalizedCourse,
    messages: normalizedValidation.isValid
      ? [
          'Mock AI JSON validated successfully.',
          'Course normalization completed successfully.',
          `Normalized course ID: ${normalizedCourse.id}`,
          `Sections: ${normalizedCourse.sections.length}`,
          `First unlockable lesson ID: ${normalizedCourse.sections[0]?.units[0]?.lessons[0]?.id ?? 'none'}`
        ]
      : [
          'Mock AI JSON passed repairable validation, but the normalized course is invalid.',
          ...normalizedValidation.errors.map((error) => `Error: ${error}`),
          ...normalizedValidation.warnings.map((warning) => `Warning: ${warning}`)
        ]
  };
}

/**
 * Temporary developer helper. Call from a browser console or a local dev-only component if needed:
 *
 *   import { logCourseSchemaDebugCheck } from './services/courseSchemaDebug';
 *   logCourseSchemaDebugCheck();
 *
 * This intentionally has no side effects unless called manually.
 */
export function logCourseSchemaDebugCheck(mockAIJSON?: unknown): CourseSchemaDebugResult {
  const result = runCourseSchemaDebugCheck(mockAIJSON);
  console.info('[AdoLearn course schema debug]', result.messages.join('\n'));
  return result;
}
