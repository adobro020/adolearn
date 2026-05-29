interface StudyTechniquePageProps {
  techniqueId: string | null;
  onCreateCourse: () => void;
  onBackToDashboard: () => void;
}

interface StudyTechniqueContent {
  id: string;
  title: string;
  eyebrow: string;
  summary: string;
  sections: Array<{
    title: string;
    body: string;
    tips: string[];
  }>;
}

export const TECHNIQUES: StudyTechniqueContent[] = [
  {
    id: 'active-recall',
    title: 'Active Recall',
    eyebrow: 'Study technique',
    summary: 'Practice pulling answers from memory instead of only rereading notes.',
    sections: [
      {
        title: 'What it means',
        body: 'Active recall turns study time into a question-and-answer loop. You pause, try to remember, check the answer, then repeat the parts that were hard.',
        tips: ['Cover the answer before checking it.', 'Say the answer out loud or choose it from options.', 'Review mistakes as useful signals.']
      },
      {
        title: 'How AdoLearn can help',
        body: 'A course made from your source material can turn key ideas into quick lesson questions, hints, and explanations so review feels more interactive.',
        tips: ['Create a course from your notes.', 'Complete lesson practice without peeking ahead.', 'Use explanations to repair weak spots.']
      }
    ]
  },
  {
    id: 'spaced-repetition',
    title: 'Spaced Repetition',
    eyebrow: 'Study technique',
    summary: 'Return to material over time so review is spread out instead of packed into one session.',
    sections: [
      {
        title: 'What it means',
        body: 'Spaced repetition means revisiting ideas after a delay. The goal is to make review frequent enough to stay fresh but not so constant that it becomes passive rereading.',
        tips: ['Review soon after learning.', 'Come back later for a shorter check.', 'Spend extra time on ideas you miss.']
      },
      {
        title: 'How AdoLearn can help',
        body: 'Review lessons give you natural checkpoints for coming back to a course after an initial pass.',
        tips: ['Finish one section, then revisit its review.', 'Use review lessons as later checkpoints.', 'Keep sessions short and focused.']
      }
    ]
  },
  {
    id: 'interleaving',
    title: 'Interleaving',
    eyebrow: 'Study technique',
    summary: 'Mix related ideas during practice so you learn when and how to use each one.',
    sections: [
      {
        title: 'What it means',
        body: 'Interleaving means rotating between related concepts instead of practicing one idea in a long uninterrupted block.',
        tips: ['Compare two similar ideas.', 'Switch between lesson topics during review.', 'Notice why an answer fits one concept and not another.']
      },
      {
        title: 'How AdoLearn can help',
        body: 'Units, sections, and reviews make it easier to move between related concepts while keeping the course structure clear.',
        tips: ['Use section reviews to connect nearby lessons.', 'Mix related lesson topics during practice.', 'Track which concepts keep appearing.']
      }
    ]
  },
  {
    id: 'focused-sessions',
    title: 'Focused Study Sessions',
    eyebrow: 'Study technique',
    summary: 'Make learning easier to start by choosing a small goal and finishing one bite-sized chunk.',
    sections: [
      {
        title: 'What it means',
        body: 'A focused session is a short block of intentional learning. Pick one target, remove distractions, complete the target, and stop with a clear next step.',
        tips: ['Choose one lesson or review.', 'Keep the task small enough to finish.', 'Write down what to do next.']
      },
      {
        title: 'How AdoLearn can help',
        body: 'Bite-sized lessons, progress states, and compact practice can make each study session feel finishable.',
        tips: ['Start with the next unlocked lesson.', 'Use hints only after trying first.', 'End by checking progress on the course map.']
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
      <article className="mx-auto max-w-3xl space-y-7">
        <header className="border-b border-slate-200/80 pb-6 dark:border-slate-800">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400">
            {technique.eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl dark:text-white">
            {technique.title}
          </h1>
          <p className="mt-3 text-base font-semibold leading-7 text-slate-600 dark:text-slate-300 sm:text-lg sm:leading-8">
            {technique.summary}
          </p>
        </header>

        {technique.sections.map((section) => (
          <section key={section.title} className="space-y-3">
            <h2 className="text-xl font-black tracking-[-0.03em] text-slate-950 sm:text-2xl dark:text-white">{section.title}</h2>
            <p className="text-base font-semibold leading-8 text-slate-600 dark:text-slate-300">{section.body}</p>
            <ul className="list-disc space-y-2 pl-6 text-base font-semibold leading-7 text-slate-700 dark:text-slate-200">
              {section.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </section>
        ))}
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
