import { getCourseSchemaForPrompt, getCourseJSONContractSummary } from './schemaService';

export interface CourseGenerationPromptOptions {
  optionalTitle?: string;
  targetSectionCount?: number;
  targetUnitsPerSection?: number;
  targetLessonsPerUnit?: number;
  targetExercisesPerLesson?: number;
}

function cleanPromptInput(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/[\t ]+/g, ' ').trim();
}

export function buildCourseGenerationPrompt(
  sourceMaterial: string,
  options: CourseGenerationPromptOptions
): string {
  const cleanedSourceMaterial = cleanPromptInput(sourceMaterial);
  const providedTitle = options.optionalTitle?.trim() || 'Create a concise, learner-friendly course title from the provided source material.';

  return `You are an expert instructional designer creating an interactive AdoLearn course.

Transform the provided source material into a short, structured, playful, bite-sized course.

Rules:

Use only the source material. Do not invent facts, examples, claims, dates, stats, citations, or definitions.
Leave out unsupported details or generalize only when source-grounded.
Return valid JSON only, with no markdown, code fences, or commentary.
Return one top-level Course object directly, not wrapped in a course property.
Match the AdoLearn Course type and schema contract below.

Course title: ${providedTitle}

Course structure:

About 2 sections
About 2 units per section
About 3 lessons per unit
About 5 exercises per lesson
Include course key concepts, lesson objectives, review lessons, final challenges, explanations, and hints.

Lesson exercises:

Use a mix of multiple_choice, true_false, matching, and ordering.
Do not use short_answer, fill_blank, scenario, explain_concept, or other typed/written-answer exercises.
Each exercise should include prompt, explanation, hint, and concept when possible.
multiple_choice: include choices and the correct answer.
matching: use term-to-definition pairs only. left must be a short term/concept/person/process/vocabulary phrase; right must be a concise, distinct source-based definition.
ordering: items must be objects like { "id": "step_1", "text": "..." }; correctOrder must list those same IDs.

JSON contract summary:
${getCourseJSONContractSummary()}

Schema-like object:
${getCourseSchemaForPrompt()}

Source material:
"""
${cleanedSourceMaterial}
"""`;
}
