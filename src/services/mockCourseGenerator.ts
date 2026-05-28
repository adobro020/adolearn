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
import type { CourseStyle, Difficulty, LessonLength } from '../types/settings';

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

function getMinutesForLesson(lessonLength: LessonLength, lessonType: LessonType): number {
  const baseMinutesByLength: Record<LessonLength, number> = {
    Short: 5,
    Medium: 8,
    Long: 12
  };

  const challengeBonus = lessonType === 'final_challenge' ? 4 : 0;
  const reviewBonus = lessonType === 'review' ? 2 : 0;

  return baseMinutesByLength[lessonLength] + challengeBonus + reviewBonus;
}

function getCourseDescription(
  sourcePreview: string,
  difficulty: Difficulty,
  courseStyle: CourseStyle
): string {
  return `A ${difficulty.toLowerCase()} ${courseStyle.toLowerCase()} course that turns the pasted material into short lessons, practice questions, and review checkpoints. Preview: ${sourcePreview}`;
}

function getLessonType(globalLessonIndex: number): LessonType {
  if (globalLessonIndex === 6) {
    return 'review';
  }

  if (globalLessonIndex === 12) {
    return 'final_challenge';
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
      : lessonType === 'final_challenge'
        ? 'This final challenge question asks you to combine recall with explanation.'
        : 'This question builds confidence with the lesson focus before moving on.';

  const multipleChoiceAnswer = `Identify how ${concept.toLowerCase()} supports the main idea.`;
  const multipleChoiceDistractors = [
    'Ignore the source and rely only on prior knowledge.',
    'Memorize every sentence without grouping ideas.',
    'Treat all details as equally important.'
  ];

  const flashcardExercise: Exercise = {
    id: createId('exercise'),
    type: 'flashcard',
    prompt: `Flashcard front: What should you remember about ${concept}?`,
    answer: `${concept} is one of the important ideas to identify, explain, and revisit while studying this material.`,
    acceptedAnswers: [concept.toLowerCase()],
    explanation: `Flashcards are useful for quick recall. This one helps you remember that ${concept.toLowerCase()} should be connected to the bigger lesson, not memorized in isolation.`,
    hint: 'Say the idea in one simple sentence.',
    sourceReference,
    concept
  };

  const shortAnswerExercise: Exercise = {
    id: createId('exercise'),
    type: 'short_answer',
    prompt: `In one sentence, explain how ${concept.toLowerCase()} could help someone understand the pasted source material.`,
    answer: `${concept} helps organize the source material into a clearer learning path.`,
    acceptedAnswers: [
      `${concept.toLowerCase()} helps organize the source material`,
      `${concept.toLowerCase()} makes the material easier to understand`,
      `${concept.toLowerCase()} connects details to the main idea`
    ],
    explanation: `A strong answer explains the role of ${concept.toLowerCase()} in making the material clearer, easier to remember, or easier to apply.`,
    hint: 'Focus on how the concept improves understanding.',
    sourceReference,
    concept
  };

  const matchingExercise: Exercise = {
    id: createId('exercise'),
    type: 'matching',
    prompt: `Match each ${concept.toLowerCase()} study term with the best definition.`,
    pairs: [
      {
        id: createId('pair'),
        left: 'Main idea',
        right: 'The central point that organizes the lesson.'
      },
      {
        id: createId('pair'),
        left: 'Example',
        right: 'A concrete detail that makes an idea easier to remember.'
      },
      {
        id: createId('pair'),
        left: concept,
        right: 'The focus concept to explain, practice, and revisit.'
      }
    ],
    explanation: `Matching checks whether you can connect labels to meanings. These connections make ${concept.toLowerCase()} easier to use later.`,
    hint: 'Start with the definition that clearly mentions the focus concept.',
    sourceReference,
    concept
  };

  const firstOrderItemId = createId('order');
  const secondOrderItemId = createId('order');
  const thirdOrderItemId = createId('order');
  const orderingExercise: Exercise = {
    id: createId('exercise'),
    type: 'ordering',
    prompt: `Put these study steps for ${concept.toLowerCase()} in the best order.`,
    items: [
      { id: firstOrderItemId, text: 'Identify the main idea in the source material.' },
      { id: secondOrderItemId, text: `Connect ${concept.toLowerCase()} to one clear example.` },
      { id: thirdOrderItemId, text: 'Explain the idea in your own words.' }
    ],
    correctOrder: [firstOrderItemId, secondOrderItemId, thirdOrderItemId],
    explanation: `A strong study sequence starts with the main idea, anchors it to an example, and then checks understanding through explanation.`,
    hint: 'Think: identify, connect, explain.',
    sourceReference,
    concept
  };

  const scenarioAnswer = `Use ${concept.toLowerCase()} to connect the details back to the main idea.`;
  const scenarioExercise: Exercise = {
    id: createId('exercise'),
    type: 'scenario',
    prompt: `Scenario: A classmate remembers isolated facts from “${lessonTitle}” but cannot explain why they matter. What should they do next?`,
    choices: createChoices(scenarioAnswer, [
      'Reread randomly until the facts feel familiar.',
      'Skip the confusing details and move to a new topic.',
      'Memorize the longest sentence from the notes.'
    ]),
    answer: scenarioAnswer,
    acceptedAnswers: [scenarioAnswer],
    explanation: `The best response uses ${concept.toLowerCase()} to turn separate facts into a useful mental structure.`,
    hint: 'Pick the option that turns details into meaning.',
    sourceReference,
    concept
  };

  const explainConceptExercise: Exercise = {
    id: createId('exercise'),
    type: 'explain_concept',
    prompt: `Explain ${concept.toLowerCase()} in your own words for someone reviewing this material tomorrow.`,
    answer: `${concept} connects details to the larger learning goal.`,
    acceptedAnswers: [
      `${concept.toLowerCase()} connects details`,
      `${concept.toLowerCase()} supports the main idea`,
      `${concept.toLowerCase()} helps explain the learning goal`
    ],
    explanation: `A good explanation does not need to be long. It should show what ${concept.toLowerCase()} means and why it matters in the course path.`,
    hint: 'Mention what it means and why it matters.',
    sourceReference,
    concept
  };

  const baseExercises: Exercise[] = [
    {
      id: createId('exercise'),
      type: 'multiple_choice',
      prompt: `In “${lessonTitle},” what is the best first step for learning ${concept.toLowerCase()}?`,
      choices: createChoices(multipleChoiceAnswer, multipleChoiceDistractors),
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
      acceptedAnswers: ['true', 'yes'],
      explanation: `True. Examples act like anchors, so ${concept.toLowerCase()} becomes easier to recall and apply later.`,
      hint: 'Think about whether examples make abstract ideas more concrete.',
      sourceReference,
      concept
    },
    {
      id: createId('exercise'),
      type: 'fill_blank',
      prompt: `Fill in the blank: A useful study path turns scattered notes into a clear ______ path.`,
      answer: 'learning',
      acceptedAnswers: ['learning', 'study', 'practice'],
      explanation:
        'The mock course is designed to transform raw source material into a structured learning path with lessons, practice, and review.',
      hint: 'The app tagline uses a similar idea.',
      sourceReference,
      concept
    }
  ];

  const extensionSets: Exercise[][] = [
    [flashcardExercise, shortAnswerExercise],
    [matchingExercise, shortAnswerExercise],
    [orderingExercise, flashcardExercise],
    [scenarioExercise, explainConceptExercise]
  ];

  return [...baseExercises, ...extensionSets[(globalLessonIndex - 1) % extensionSets.length]] satisfies Exercise[];
}

function createLesson(
  blueprintTitle: string,
  blueprintSummary: string,
  blueprintFocus: string,
  globalLessonIndex: number,
  lessonLength: LessonLength,
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
    estimatedMinutes: getMinutesForLesson(lessonLength, lessonType),
    learningObjectives: [
      `Identify the role of ${concept.toLowerCase()} in the source material.`,
      `Answer practice questions about ${concept.toLowerCase()} with confidence.`,
      `Explain ${concept.toLowerCase()} in simple, study-friendly language.`
    ],
    summary: `${blueprintSummary} Focus area: ${fullFocus}.`,
    exercises: createExerciseSet(concept, blueprintTitle, sourcePreview, lessonType, globalLessonIndex)
  };
}

function createSections(
  keyConcepts: string[],
  sourcePreview: string,
  lessonLength: LessonLength
): Section[] {
  let globalLessonIndex = 0;

  return MOCK_SECTION_BLUEPRINTS.map((sectionBlueprint) => {
    const units: Unit[] = sectionBlueprint.units.map((unitBlueprint) => {
      const lessons: Lesson[] = unitBlueprint.lessons.map((lessonBlueprint) => {
        globalLessonIndex += 1;
        return createLesson(
          lessonBlueprint.title,
          lessonBlueprint.summary,
          lessonBlueprint.focus,
          globalLessonIndex,
          lessonLength,
          keyConcepts,
          sourcePreview
        );
      });

      return {
        id: createId('unit'),
        title: unitBlueprint.title,
        description: unitBlueprint.description,
        lessons
      };
    });

    return {
      id: createId('section'),
      title: sectionBlueprint.title,
      description: sectionBlueprint.description,
      units
    };
  });
}

function calculateEstimatedTotalMinutes(sections: Section[]): number {
  return sections.reduce(
    (sectionTotal, section) =>
      sectionTotal +
      section.units.reduce(
        (unitTotal, unit) =>
          unitTotal + unit.lessons.reduce((lessonTotal, lesson) => lessonTotal + lesson.estimatedMinutes, 0),
        0
      ),
    0
  );
}

export function generateMockCourse({
  sourceMaterial,
  optionalTitle,
  difficulty,
  courseStyle,
  lessonLength
}: MockCourseGeneratorOptions): Course {
  const now = new Date().toISOString();
  const sourcePreview = getSourcePreview(sourceMaterial);
  const keyConcepts = extractKeyConcepts(sourceMaterial);
  const sections = createSections(keyConcepts, sourcePreview, lessonLength);
  const title = optionalTitle?.trim() || MOCK_COURSE_TITLE;

  return {
    id: createId('course'),
    title,
    description: getCourseDescription(sourcePreview, difficulty, courseStyle),
    sourceMaterialPreview: sourcePreview,
    createdAt: now,
    updatedAt: now,
    difficulty,
    style: courseStyle,
    estimatedTotalMinutes: calculateEstimatedTotalMinutes(sections),
    sections,
    keyConcepts
  };
}

export function generateMockCourseFromValues(
  sourceMaterial: string,
  optionalTitle: string | undefined,
  difficulty: Difficulty,
  courseStyle: CourseStyle,
  lessonLength: LessonLength
): Course {
  return generateMockCourse({
    sourceMaterial,
    optionalTitle,
    difficulty,
    courseStyle,
    lessonLength
  });
}

export function getFirstLessonId(course: Course): string | undefined {
  return course.sections[0]?.units[0]?.lessons[0]?.id;
}

export function getAllLessonIds(course: Course): string[] {
  return course.sections.flatMap((section) =>
    section.units.flatMap((unit) => unit.lessons.map((lesson) => lesson.id))
  );
}

export function getExerciseTypeCounts(course: Course): Record<ExerciseType, number> {
  const exerciseTypes: ExerciseType[] = [
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

  const initialCounts = exerciseTypes.reduce<Record<ExerciseType, number>>((counts, type) => {
    counts[type] = 0;
    return counts;
  }, {} as Record<ExerciseType, number>);

  return course.sections.reduce((counts, section) => {
    section.units.forEach((unit) => {
      unit.lessons.forEach((lesson) => {
        lesson.exercises.forEach((exercise) => {
          counts[exercise.type] += 1;
        });
      });
    });

    return counts;
  }, initialCounts);
}
