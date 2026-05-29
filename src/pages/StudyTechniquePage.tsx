interface StudyTechniquePageProps {
  techniqueId: string | null;
  onCreateCourse: () => void;
  onBackToDashboard: () => void;
}

interface StudyTechniqueContent {
  id: string;
  title: string;
  summary: string;
  sections: Array<{
    title: string;
    paragraphs: string[];
    points?: string[];
  }>;
}

export const TECHNIQUES: StudyTechniqueContent[] = [
  {
    id: 'active-recall',
    title: 'Active Recall',
    summary:
      'Active recall is a study method based on deliberately retrieving information from memory instead of only reviewing material by rereading it.',
    sections: [
      {
        title: 'Definition',
        paragraphs: [
          'Active recall is a learning technique in which a learner attempts to produce an answer, idea, definition, or explanation before checking the source material. The central action is retrieval: the learner pauses, searches memory, gives an answer, and then compares that answer with the material being studied.',
          'The method is often contrasted with passive review. In passive review, a learner may reread notes or look over highlighted passages without needing to reconstruct the information. In active recall, the learner has to bring the information back without seeing the answer first.'
        ]
      },
      {
        title: 'Process',
        paragraphs: [
          'A typical active recall session begins by turning a piece of material into a question. The learner hides the answer, responds from memory, checks the response, and marks the material as known, partly known, or still difficult.',
          'The process can be short. A question may ask for a definition, a sequence, a cause, a difference between two ideas, or the meaning of a term. The important part is that the learner tries before looking.'
        ],
        points: [
          'Read a small section of material.',
          'Create or answer a question about the section.',
          'Attempt the answer without looking at the source.',
          'Check the answer and correct any missing or inaccurate parts.',
          'Return to missed ideas later instead of treating mistakes as failure.'
        ]
      },
      {
        title: 'Use in studying',
        paragraphs: [
          'Active recall is commonly used with practice questions, closed-book summaries, flashcard-style prompts, self-quizzing, and oral explanation. It can be used alone or combined with other techniques, such as spaced repetition, to revisit difficult material over time.',
          'The technique is useful when a learner needs to remember facts, definitions, relationships, steps, or explanations. It is also useful for identifying weak areas because the learner can see which answers are easy to retrieve and which ones are incomplete.'
        ]
      },
      {
        title: 'Common limitations',
        paragraphs: [
          'Active recall depends on the quality of the questions being asked. Very vague prompts can produce vague answers, while questions that are too narrow may test memorization without helping understanding. The method also works best when feedback is available so incorrect answers can be corrected.',
          'Learners may also overuse recognition-based questions, such as multiple-choice questions, without checking whether they can explain the idea independently. A balanced session often includes both quick checks and short explanations from memory.'
        ]
      }
    ]
  },
  {
    id: 'spaced-repetition',
    title: 'Spaced Repetition',
    summary:
      'Spaced repetition is a study approach in which material is reviewed across multiple sessions separated by time rather than concentrated into one long session.',
    sections: [
      {
        title: 'Definition',
        paragraphs: [
          'Spaced repetition is based on the idea that review can be distributed over time. Instead of studying the same material repeatedly in one sitting, a learner returns to it after intervals. These intervals may be short at first and longer after the material becomes easier to remember.',
          'The technique is commonly used for vocabulary, terminology, formulas, dates, procedures, and concepts that need to remain available in memory after the first study session.'
        ]
      },
      {
        title: 'Review intervals',
        paragraphs: [
          'In a spaced schedule, difficult items are reviewed sooner, while easier items are reviewed later. The exact timing can be simple or detailed. A learner might review the same idea later the same day, again after a few days, and again after a longer delay.',
          'The purpose of spacing is not to delay review until everything is forgotten. The goal is to return to the material when retrieval takes effort but is still possible, because that effort can make the review more meaningful.'
        ],
        points: [
          'Start with an initial learning session.',
          'Review the material after a short delay.',
          'Move easy items farther apart.',
          'Bring difficult items back sooner.',
          'Use missed answers to decide what needs another review.'
        ]
      },
      {
        title: 'Use in studying',
        paragraphs: [
          'Spaced repetition is often paired with active recall. Instead of simply rereading a topic at each interval, the learner answers questions or explains ideas from memory. This makes each return to the material a test of retrieval rather than only a review of recognition.',
          'The method can be applied to a full course, a single chapter, a set of key terms, or a small group of difficult ideas. It is especially useful when learning continues over days or weeks.'
        ]
      },
      {
        title: 'Common limitations',
        paragraphs: [
          'Spaced repetition requires some tracking. Without a list, calendar, review system, or routine, it can be easy to forget which material needs to come back. It can also become mechanical if every item is treated the same regardless of difficulty.',
          'The technique is strongest when review is targeted. Material that is already easy may need less attention, while confusing or frequently missed ideas may need more direct explanation before being placed back into a spaced schedule.'
        ]
      }
    ]
  },
  {
    id: 'interleaving',
    title: 'Interleaving',
    summary:
      'Interleaving is a study method in which related topics or problem types are mixed during practice instead of being practiced in separate, uninterrupted blocks.',
    sections: [
      {
        title: 'Definition',
        paragraphs: [
          'Interleaving means alternating between related ideas during a practice session. Instead of completing many similar questions in a row, a learner moves between different but connected topics. The learner must decide which idea, rule, method, or category applies each time.',
          'The technique is often discussed alongside blocked practice. In blocked practice, one topic is practiced repeatedly before moving to the next. In interleaved practice, several topics appear in a mixed order.'
        ]
      },
      {
        title: 'Purpose',
        paragraphs: [
          'The purpose of interleaving is to make comparison part of learning. When similar ideas appear near each other, the learner has to notice what makes them different. This can help with choosing the correct method instead of simply repeating the method from the previous question.',
          'Interleaving can feel harder than blocked practice because the next step is less predictable. That difficulty is part of the technique: the learner has to identify the problem type or concept before answering.'
        ],
        points: [
          'Mix related topics rather than unrelated material.',
          'Compare similar concepts and notice their differences.',
          'Practice choosing a method, not only applying one.',
          'Return to blocked practice when a topic is still completely new.',
          'Use explanations to connect why one answer fits better than another.'
        ]
      },
      {
        title: 'Use in studying',
        paragraphs: [
          'Interleaving is commonly used in mathematics, science, language learning, and other areas where learners must select between similar procedures or concepts. It can also be used when reviewing definitions, categories, examples, and cause-and-effect relationships.',
          'A practical session might include a small set of questions from several related lessons. After each answer, the learner checks not only whether the answer is correct, but also why that type of question required that answer.'
        ]
      },
      {
        title: 'Common limitations',
        paragraphs: [
          'Interleaving is less useful when the learner has no basic understanding of the material. Some initial blocked practice may be needed so the learner can recognize each concept before comparing it with others.',
          'The technique also works best with related material. Mixing unrelated topics at random can make a session feel scattered rather than productive. A useful interleaved set usually contains ideas that can be compared meaningfully.'
        ]
      }
    ]
  },
  {
    id: 'focused-sessions',
    title: 'Focused Study Sessions',
    summary:
      'A focused study session is a planned period of learning built around a small goal, limited distractions, and a clear stopping point.',
    sections: [
      {
        title: 'Definition',
        paragraphs: [
          'A focused study session is a short, intentional block of time used to complete a specific learning task. The task may be reading a section, answering practice questions, reviewing missed items, summarizing a concept, or preparing for a later review.',
          'The method is based on narrowing attention. Rather than beginning with a broad goal such as studying an entire subject, the learner chooses a task small enough to finish during the session.'
        ]
      },
      {
        title: 'Structure',
        paragraphs: [
          'A focused session usually has three parts: a goal, a work period, and a closing step. The goal defines what will be completed. The work period is protected from avoidable distractions. The closing step records what was finished and what should happen next.',
          'The length can vary. Some sessions may be brief, especially when motivation is low or the material is difficult. Longer sessions can still be focused if they are divided into clear chunks.'
        ],
        points: [
          'Choose one task before starting.',
          'Keep the goal small enough to finish.',
          'Remove or reduce obvious distractions.',
          'Work through the chosen task before switching topics.',
          'End by writing the next action or marking what needs review.'
        ]
      },
      {
        title: 'Use in studying',
        paragraphs: [
          'Focused sessions are useful for starting work, reducing overwhelm, and turning broad learning goals into manageable actions. They can be combined with active recall, spaced repetition, or interleaving depending on the task.',
          'A learner might use one session to learn a new topic, another to answer questions from memory, and another to review mistakes. The main feature is not the exact activity but the clear boundary around the session.'
        ]
      },
      {
        title: 'Common limitations',
        paragraphs: [
          'A focused session can become too narrow if the learner never connects the small task to the larger subject. It can also become too rigid if the chosen goal is unrealistic for the time available.',
          'The approach is most useful when the session ends with a simple record of progress. Without a closing step, it can be hard to know what to review next or whether the session actually achieved its goal.'
        ]
      }
    ]
  }
];

export function findTechnique(id: string | null): StudyTechniqueContent {
  return TECHNIQUES.find((technique) => technique.id === id) ?? TECHNIQUES[0];
}

export function getStudyTechniqueTitle(id: string | null): string {
  return findTechnique(id).title;
}

export function StudyTechniquePage({ techniqueId, onCreateCourse }: StudyTechniquePageProps) {
  const technique = findTechnique(techniqueId);

  return (
    <div className="space-y-8 pb-4">
      <article className="mx-auto max-w-4xl rounded-[1.25rem] border border-slate-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/72 sm:p-8">
        <header className="border-b border-slate-200 pb-5 dark:border-slate-800">
          <h1 className="text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-5xl dark:text-white">
            {technique.title}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600 dark:text-slate-300 sm:text-lg">
            {technique.summary}
          </p>
        </header>

        <div className="mt-6 grid gap-8 lg:grid-cols-[12rem_minmax(0,1fr)]">
          <nav className="h-fit rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-900/40" aria-label="Article contents">
            <p className="font-black text-slate-950 dark:text-white">Contents</p>
            <ol className="mt-3 space-y-2 text-slate-600 dark:text-slate-300">
              {technique.sections.map((section, index) => (
                <li key={section.title}>
                  <a className="hover:text-emerald-600 dark:hover:text-emerald-300" href={`#${technique.id}-${index}`}>
                    {index + 1}. {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="space-y-8">
            {technique.sections.map((section, index) => (
              <section key={section.title} id={`${technique.id}-${index}`} className="scroll-mt-24 space-y-3">
                <h2 className="border-b border-slate-200 pb-2 text-2xl font-black tracking-[-0.03em] text-slate-950 dark:border-slate-800 dark:text-white">
                  {section.title}
                </h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="text-base leading-8 text-slate-700 dark:text-slate-300">
                    {paragraph}
                  </p>
                ))}
                {section.points ? (
                  <ul className="list-disc space-y-2 pl-6 text-base leading-8 text-slate-700 dark:text-slate-300">
                    {section.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
        </div>
      </article>

      <section className="grid gap-4 rounded-[2rem] border border-slate-200/70 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/72 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">Put it into practice</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950 dark:text-white">Build a course from your own material</h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
            AdoLearn uses your pasted or uploaded source material to create structured units, sections, lessons, reviews, hints, and explanations.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateCourse}
          className="rounded-full bg-emerald-500 px-6 py-3 text-sm font-black text-slate-950 shadow-[0_14px_34px_rgba(16,185,129,0.22)] transition hover:-translate-y-0.5 hover:bg-emerald-400"
        >
          Create course
        </button>
      </section>
    </div>
  );
}
