import { getCourseSchemaForPrompt, getCourseJSONContractSummary } from './schemaService';

export interface CourseGenerationPromptOptions {
  optionalTitle?: string;
  targetUnitCount?: number;
  targetSectionsPerUnit?: number;
  targetLessonsPerSection?: number;
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

Course title: ${providedTitle}

The source material is ${cleanedSourceMaterial.length.toLocaleString()} characters long.
Use the source material character count to decide how many units, sections, and lessons to create. Shorter sources should create fewer units, sections, and lessons; longer sources can create more coverage, but every unit, section, and lesson must remain source-grounded and bite-sized.
Make the exercises per lesson based off how long the source material is.

Exercise requirements:
- Mix lesson exercise types when possible: multiple_choice, true_false. Do not generate short_answer, fill_blank, scenario, explain_concept, or any typed/written-answer exercises inside lessons.
- Each lesson may contain up to 4 exercises/questions.
- For multiple_choice, include no more than 4 choices and make sure the correct answer is represented.
- For each multiple_choice choice, include an explanation field that explains why that specific choice is right or wrong using only the source material.
- For true_false, the exercise explanation must explain why the correct true/false answer is supported by the source material.
- Every exercise must include prompt, explanation, hint, and concept when possible.

JSON contract summary:
${getCourseJSONContractSummary()}

Schema-like object:
${getCourseSchemaForPrompt()}

Source material:
"""
${cleanedSourceMaterial}
"""`;
}
