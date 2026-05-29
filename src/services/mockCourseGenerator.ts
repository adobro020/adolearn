import {
  FALLBACK_KEY_CONCEPTS,
  MOCK_COURSE_TITLE,
  MOCK_SECTION_BLUEPRINTS,
  MOCK_SOURCE_FALLBACK,
  STOP_WORDS,
  type MockCourseGeneratorOptions
} from '../data/mockCourse';
import type {
  Course,
  Exercise,
  ExerciseChoice,
  ExerciseType,
  Lesson,
  LessonType,
  Section,
  Unit
} from '../types/course';

const SOURCE_PREVIEW_LENGTH = 500;
const PASSING_CONTEXT_EXCERPT_LENGTH = 180;

function createId(prefix: string): string {
  const randomId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  return `${prefix}-${randomId}`;
}

function cleanSourceMaterial(sourceMaterial: string): string {
  return sourceMaterial.replace(/\s+/g, ' ').trim();
}

function getSourcePreview(sourceMaterial: string): string {
  const cleanedSource = cleanSourceMaterial(sourceMaterial);
  return (cleanedSource || MOCK_SOURCE_FALLBACK).slice(0, SOURCE_PREVIEW_LENGTH);
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(' ');
}

function extractKeyConcepts(sourceMaterial: string): string[] {
  const words = cleanSourceMaterial(sourceMaterial)
    .toLowerCase()
    .match(/[a-z][a-z'-]{3,}/g);

  if (!words) {
    return [...FALLBACK_KEY_CONCEPTS];
  }

  const frequencies = words.reduce<Map<string, number>>((result, word) => {
    const normalizedWord = word.replace(/^'+|'+$/g, '');

    if (!normalizedWord || STOP_WORDS.has(normalizedWord)) {
      return result;
    }

    result.set(normalizedWord, (result.get(normalizedWord) ?? 0) + 1);
    return result;
  }, new Map<string, number>());

  const extractedConcepts = Array.from(frequencies.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([word]) => toTitleCase(word));

  return Array.from(new Set([...extractedConcepts, ...FALLBACK_KEY_CONCEPTS])).slice(0, 8);
}

function getMinutesForLesson(lessonType: LessonType): number {
  const baseMinutes = 8;
  const reviewBonus = lessonType === 'review' ? 2 : 0;

  return baseMinutes + reviewBonus;
}

function getCourseDescription(sourcePreview: string): string {
  return `A course that turns the pasted material into short lessons, practice questions, and review checkpoints. Preview: ${sourcePreview}`;
}

function getLessonType(globalLessonIndex: number): LessonType {
  if (globalLessonIndex === 6 || globalLessonIndex === 12) {
    return 'review';
  }

  return 'standard';
}

function getConceptForLesson(keyConcepts: string[], globalLessonIndex: number): string {
  return keyConcepts[(globalLessonIndex - 1) % keyConcepts.length] ?? FALLBACK_KEY_CONCEPTS[0];
}

function createChoices(correctAnswer: string, distractors: string[]): ExerciseChoice[] {
  return [correctAnswer, ...distractors].map((text) => ({
    id: createId('choice'),
    text
  }));
}

function createSourceReference(sourcePreview: string, concept: string) {
  return {
    sourceId: 'pasted-source',
    title: 'Pasted source material',
    excerpt: sourcePreview.slice(0, PASSING_CONTEXT_EXCERPT_LENGTH),
    location: `Concept focus: ${concept}`
  };
}

function createExerciseSet(
  concept: string,
  lessonTitle: string,
  sourcePreview: string,
  lessonType: LessonType,
  globalLessonIndex: number
): Exercise[] {
  const sourceReference = createSourceReference(sourcePreview, concept);
  const reviewLanguage =
    lessonType === 'review'
      ? 'This review question checks whether the concept still feels familiar after several lessons.'
      : 'This question builds confidence with the lesson focus before moving on.';

  const multipleChoiceAnswer = `Identify how ${concept.toLowerCase()} supports the main idea.`;
  const secondChoiceAnswer = `Connect ${concept.toLowerCase()} to one clear source detail.`;

  return [
    {
      id: createId('exercise'),
      type: 'multiple_choice',
      prompt: `In “${lessonTitle},” what is the best first step for learning ${concept.toLowerCase()}?`,
      choices: createChoices(multipleChoiceAnswer, [
        'Ignore the source and rely only on prior knowledge.',
        'Memorize every sentence without grouping ideas.',
        'Treat all details as equally important.'
      ]),
      answer: multipleChoiceAnswer,
      acceptedAnswers: [multipleChoiceAnswer],
      explanation: `${reviewLanguage} The best first step is to connect ${concept.toLowerCase()} to the source material's main idea, because that makes later details easier to organize.`,
      hint: 'Look for the option that connects the concept to meaning, not memorization.',
      sourceReference,
      concept
    },
    {
      id: createId('exercise'),
      type: 'true_false',
      prompt: `True or false: Understanding ${concept.toLowerCase()} is easier when you connect it to examples from the source material.`,
      answer: true,
      acceptedAnswers: ['true'],
      explanation: `True. Examples act like anchors, so ${concept.toLowerCase()} becomes easier to recall and apply later.`,
      hint: 'Think about whether examples make abstract ideas more concrete.',
      sourceReference,
      concept
    },
    {
      id: createId('exercise'),
      type: 'multiple_choice',
      prompt: `Which choice best supports a playful, bite-sized lesson about ${concept.toLowerCase()}?`,
      choices: createChoices(secondChoiceAnswer, [
        'Add unsupported facts that sound interesting.',
        'Skip practice until the end of the course.',
        'Use only facts that are not in the source.'
      ]),
      answer: secondChoiceAnswer,
      acceptedAnswers: [secondChoiceAnswer],
      explanation: `A source-grounded course uses the material itself and turns supported ideas about ${concept.toLowerCase()} into short practice.`,
      hint: 'Choose the option that stays closest to the source material.',
      sourceReference,
      concept
    },
    {
      id: createId('exercise'),
      type: 'true_false',
      prompt: `True or false: A review lesson can revisit ${concept.toLowerCase()} without adding unsupported outside facts.`,
      answer: true,
      acceptedAnswers: ['true'],
      explanation: 'Review can strengthen recall by reusing supported material rather than adding new claims.',
      hint: 'Think about what source-grounded means.',
      sourceReference,
      concept
    }
  ];
}

function createLesson(
  blueprintTitle: string,
  blueprintSummary: string,
  blueprintFocus: string,
  globalLessonIndex: number,
  keyConcepts: string[],
  sourcePreview: string
): Lesson {
  const lessonType = getLessonType(globalLessonIndex);
  const concept = getConceptForLesson(keyConcepts, globalLessonIndex);
  const fullFocus = `${blueprintFocus}: ${concept}`;

  return {
    id: createId('lesson'),
    title: blueprintTitle,
    type: lessonType,
    estimatedMinutes: getMinutesForLesson(lessonType),
    learningObjectives: [
      `Identify the role of ${concept.toLowerCase()} in the source material.`,
      `Answer practice questions about ${concept.toLowerCase()} with confidence.`,
      `Explain ${concept.toLowerCase()} in simple, study-friendly language.`
    ],
    summary: `${blueprintSummary} Focus area: ${fullFocus}.`,
    exercises: createExerciseSet(concept, blueprintTitle, sourcePreview, lessonType, globalLessonIndex)
  };
}

function createUnits(
  keyConcepts: string[],
  sourcePreview: string
): Unit[] {
  let globalLessonIndex = 0;

  return MOCK_SECTION_BLUEPRINTS.map((unitBlueprint) => {
    const sections: Section[] = unitBlueprint.units.map((sectionBlueprint) => {
      const lessons: Lesson[] = sectionBlueprint.lessons.map((lessonBlueprint) => {
        globalLessonIndex += 1;
        return createLesson(
          lessonBlueprint.title,
          lessonBlueprint.summary,
          lessonBlueprint.focus,
          globalLessonIndex,
          keyConcepts,
          sourcePreview
        );
      });

      return {
        id: createId('section'),
        title: sectionBlueprint.title,
        description: sectionBlueprint.description,
        lessons
      };
    });

    return {
      id: createId('unit'),
      title: unitBlueprint.title,
      description: unitBlueprint.description,
      sections
    };
  });
}

function calculateEstimatedTotalMinutes(units: Unit[]): number {
  return units.reduce(
    (unitTotal, unit) =>
      unitTotal + unit.sections.reduce(
        (sectionTotal, section) =>
          sectionTotal + section.lessons.reduce((lessonTotal, lesson) => lessonTotal + lesson.estimatedMinutes, 0),
        0
      ),
    0
  );
}

export function generateMockCourse({
  sourceMaterial,
  optionalTitle,
}: MockCourseGeneratorOptions): Course {
  const now = new Date().toISOString();
  const sourcePreview = getSourcePreview(sourceMaterial);
  const keyConcepts = extractKeyConcepts(sourceMaterial);
  const units = createUnits(keyConcepts, sourcePreview);
  const title = optionalTitle?.trim() || MOCK_COURSE_TITLE;

  return {
    id: createId('course'),
    title,
    description: getCourseDescription(sourcePreview),
    sourceMaterialPreview: sourcePreview,
    createdAt: now,
    updatedAt: now,
    estimatedTotalMinutes: calculateEstimatedTotalMinutes(units),
    units,
    keyConcepts
  };
}

export function generateMockCourseFromValues(
  sourceMaterial: string,
  optionalTitle?: string
): Course {
  return generateMockCourse({
    sourceMaterial,
    optionalTitle
  });
}

export function getFirstLessonId(course: Course): string | undefined {
  return course.units[0]?.sections[0]?.lessons[0]?.id;
}

export function getAllLessonIds(course: Course): string[] {
  return course.units.flatMap((unit) =>
    unit.sections.flatMap((section) => section.lessons.map((lesson) => lesson.id))
  );
}

export function getExerciseTypeCounts(course: Course): Record<ExerciseType, number> {
  const exerciseTypes: ExerciseType[] = ['multiple_choice', 'true_false'];

  const initialCounts = exerciseTypes.reduce<Record<ExerciseType, number>>((counts, type) => {
    counts[type] = 0;
    return counts;
  }, {} as Record<ExerciseType, number>);

  return course.units.reduce((counts, unit) => {
    unit.sections.forEach((section) => {
      section.lessons.forEach((lesson) => {
        lesson.exercises.forEach((exercise) => {
          counts[exercise.type] += 1;
        });
      });
    });

    return counts;
  }, initialCounts);
}
