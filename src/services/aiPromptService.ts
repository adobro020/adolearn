import type { CourseStyle, Difficulty, LessonLength } from '../types/settings';
import { getCourseSchemaForPrompt, getCourseJSONContractSummary } from './schemaService';

export interface CourseGenerationPromptOptions {
  optionalTitle?: string;
  difficulty: Difficulty;
  courseStyle: CourseStyle;
  lessonLength: LessonLength;
  targetSectionCount?: number;
  targetUnitsPerSection?: number;
  targetLessonsPerUnit?: number;
  targetExercisesPerLesson?: number;
}

function cleanPromptInput(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/[\t ]+/g, ' ').trim();
}

function getLessonLengthGuidance(lessonLength: LessonLength): string {
  const guidance: Record<LessonLength, string> = {
    Short: 'Keep lessons very short: 4-6 minutes each with concise prompts.',
    Medium: 'Keep lessons moderate: 7-10 minutes each with balanced explanation and practice.',
    Long: 'Lessons can be deeper: 10-15 minutes each, but still interactive and focused.'
  };

  return guidance[lessonLength];
}

export function buildCourseGenerationPrompt(
  sourceMaterial: string,
  options: CourseGenerationPromptOptions
): string {
  const cleanedSourceMaterial = cleanPromptInput(sourceMaterial);
  const titleGuidance = options.optionalTitle?.trim()
    ? `Use this course title exactly unless it conflicts with the source material: ${options.optionalTitle.trim()}`
    : 'Create a concise, learner-friendly course title from the provided source material.';

  const sectionCount = options.targetSectionCount ?? 2;
  const unitsPerSection = options.targetUnitsPerSection ?? 2;
  const lessonsPerUnit = options.targetLessonsPerUnit ?? 3;
  const exercisesPerLesson = options.targetExercisesPerLesson ?? 5;

  return `You are an expert instructional designer creating a Duolingo-style interactive course for AdoLearn.

Your task:
Transform the provided source material into a short, structured, interactive learning course.

Hard rules:
- Use only the provided source material.
- Do not invent unsupported facts, examples, definitions, dates, claims, statistics, or citations.
- If the source material does not support a detail, leave it out or write a source-grounded generalization.
- Return valid JSON only. Do not include markdown, code fences, commentary, or explanations outside the JSON.
- Return one top-level Course object directly, not an object wrapped in a \`course\` property.
- The JSON must match the AdoLearn Course type and the schema-like contract below.
- Keep lessons short, interactive, and learner-friendly.
- Include explanations and hints for exercises.
- Include learning objectives for every lesson.
- Include key concepts for the course.
- Include review lessons.
- Include final challenges.
- Make the experience feel playful, clear, and bite-sized.

Course preferences:
- Difficulty: ${options.difficulty}
- Course style: ${options.courseStyle}
- Lesson length: ${options.lessonLength}
- Lesson length guidance: ${getLessonLengthGuidance(options.lessonLength)}
- ${titleGuidance}

Suggested course size:
- About ${sectionCount} sections
- About ${unitsPerSection} units per section
- About ${lessonsPerUnit} lessons per unit
- About ${exercisesPerLesson} exercises per lesson

Exercise requirements:
- Mix exercise types when possible: multiple_choice, true_false, fill_blank, matching, ordering, short_answer, flashcard, scenario, explain_concept.
- For multiple_choice, include choices and make sure the correct answer is represented.
- For matching, include pairs.
- For ordering, include items as an array of objects shaped like { "id": "step_1", "text": "..." }. Never use plain strings in items. Include correctOrder as an array of those same item IDs.
- For text-graded exercises, include acceptedAnswers with concise expected keywords or phrases.
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
