export interface MockCourseGeneratorOptions {
  sourceMaterial: string;
  optionalTitle?: string;
}

export interface MockLessonBlueprint {
  title: string;
  focus: string;
  summary: string;
}

export interface MockUnitBlueprint {
  title: string;
  description: string;
  lessons: MockLessonBlueprint[];
}

export interface MockSectionBlueprint {
  title: string;
  description: string;
  units: MockUnitBlueprint[];
}

export const MOCK_COURSE_TITLE = 'Generated Learning Path';

export const MOCK_SOURCE_FALLBACK =
  'This learning path is based on the source material you provide. Future AI generation will replace this mock content with lessons tailored to the pasted notes, article, transcript, or study guide.';

export const MOCK_SECTION_BLUEPRINTS: MockSectionBlueprint[] = [
  {
    title: 'Build the Foundation',
    description:
      'Start with the core vocabulary, main ideas, and relationships that make the source material easier to understand.',
    units: [
      {
        title: 'Core Ideas',
        description:
          'Identify the central topic, repeated themes, and the first layer of meaning in the source material.',
        lessons: [
          {
            title: 'What This Material Is About',
            focus: 'central idea',
            summary:
              'You will turn the source material into a clear mental map by spotting its main purpose and recurring ideas.'
          },
          {
            title: 'Key Terms and Signals',
            focus: 'vocabulary',
            summary:
              'You will notice important terms, phrases, and signals that reveal how the material is organized.'
          },
          {
            title: 'Cause, Effect, and Structure',
            focus: 'relationships',
            summary:
              'You will connect ideas by asking how one point supports, explains, or changes another.'
          }
        ]
      },
      {
        title: 'Understanding the Details',
        description:
          'Practice reading for evidence, examples, and important distinctions instead of memorizing isolated facts.',
        lessons: [
          {
            title: 'Evidence and Examples',
            focus: 'evidence',
            summary:
              'You will learn to separate claims from examples and use examples to reinforce memory.'
          },
          {
            title: 'Compare and Contrast',
            focus: 'comparison',
            summary:
              'You will compare related ideas so small differences become easier to recall.'
          },
          {
            title: 'Section Review Sprint',
            focus: 'review',
            summary:
              'You will quickly review the foundation by combining definitions, examples, and short explanations.'
          }
        ]
      }
    ]
  },
  {
    title: 'Apply and Remember',
    description:
      'Move from recognition to recall by explaining, applying, and checking understanding in realistic scenarios.',
    units: [
      {
        title: 'Active Recall',
        description:
          'Strengthen memory with prompts that ask you to retrieve ideas instead of rereading them passively.',
        lessons: [
          {
            title: 'Recall the Big Picture',
            focus: 'active recall',
            summary:
              'You will practice retrieving the main message and supporting details from memory.'
          },
          {
            title: 'Explain It Simply',
            focus: 'plain-language explanation',
            summary:
              'You will explain important concepts in simple language to prove you understand them.'
          },
          {
            title: 'Apply the Ideas',
            focus: 'application',
            summary:
              'You will use the source material in small situations that feel closer to real study questions.'
          }
        ]
      },
      {
        title: 'Mastery Check',
        description:
          'Consolidate the learning path with cumulative questions, confidence checks, and a final challenge.',
        lessons: [
          {
            title: 'Fix Common Confusions',
            focus: 'misconceptions',
            summary:
              'You will identify ideas that are easy to mix up and practice choosing the clearest interpretation.'
          },
          {
            title: 'Connect the Concepts',
            focus: 'synthesis',
            summary:
              'You will link the most important ideas together into one reusable study framework.'
          },
          {
            title: 'Final Challenge',
            focus: 'mastery',
            summary:
              'You will complete a final mixed check that combines recall, explanation, and application.'
          }
        ]
      }
    ]
  }
];

export const FALLBACK_KEY_CONCEPTS = [
  'Main idea',
  'Key evidence',
  'Important vocabulary',
  'Cause and effect',
  'Compare and contrast',
  'Application',
  'Review strategy',
  'Mastery check'
];

export const STOP_WORDS = new Set([
  'about',
  'after',
  'again',
  'also',
  'because',
  'been',
  'before',
  'being',
  'between',
  'both',
  'could',
  'does',
  'each',
  'from',
  'have',
  'into',
  'more',
  'most',
  'only',
  'other',
  'over',
  'same',
  'such',
  'than',
  'that',
  'their',
  'then',
  'there',
  'these',
  'they',
  'this',
  'through',
  'using',
  'very',
  'were',
  'what',
  'when',
  'where',
  'which',
  'while',
  'with',
  'would',
  'your'
]);


export const DEMO_SOURCE_MATERIAL = `Cells are the basic unit of life. In biology, cells carry out the processes that keep organisms alive, including using energy, making proteins, responding to the environment, and reproducing. Plant and animal cells share many structures, such as a cell membrane, cytoplasm, DNA, ribosomes, and mitochondria. Plant cells also have a cell wall and chloroplasts, which help them capture sunlight for photosynthesis.

Mitochondria release usable energy from food through cellular respiration. Chloroplasts use light energy, carbon dioxide, and water to make glucose and oxygen. These two processes are connected because the products of photosynthesis can become the inputs for cellular respiration. Understanding cells helps explain how larger organisms grow, repair tissues, and maintain stable internal conditions.`;
