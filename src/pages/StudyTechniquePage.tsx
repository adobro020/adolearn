import { PageCard } from '../components/PageCard';
import { ROBOT_GRAPHICS } from '../data/mascotGraphics';

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

const TECHNIQUES: StudyTechniqueContent[] = [
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
        body: 'Review lessons and final challenges give you natural checkpoints for coming back to a course after an initial pass.',
        tips: ['Finish one section, then revisit its review.', 'Use final challenges as later checkpoints.', 'Keep sessions short and focused.']
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
        body: 'Units, sections, reviews, and final challenges make it easier to move between related concepts while keeping the course structure clear.',
        tips: ['Use section reviews to connect nearby lessons.', 'Use final challenges to mix the whole course.', 'Track which concepts keep appearing.']
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

function findTechnique(id: string | null): StudyTechniqueContent {
  return TECHNIQUES.find((technique) => technique.id === id) ?? TECHNIQUES[0];
}

export function StudyTechniquePage({ techniqueId, onCreateCourse, onBackToDashboard }: StudyTechniquePageProps) {
  const technique = findTechnique(techniqueId);
  const relatedTechniques = TECHNIQUES.filter((item) => item.id !== technique.id);

  return (
    <div className="space-y-6 pb-4">
      <PageCard eyebrow={technique.eyebrow} title={technique.title} description={technique.summary}>
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div className="rounded-[2rem] border border-emerald-100 bg-emerald-50/70 p-5 dark:border-emerald-400/20 dark:bg-emerald-400/10">
            <img src={ROBOT_GRAPHICS.workflow} alt="Robot organizing study cards" className="mx-auto h-56 w-full object-contain" />
          </div>
          <div className="grid gap-4">
            {technique.sections.map((section) => (
              <article key={section.title} className="rounded-[1.75rem] border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/72">
                <h3 className="text-xl font-black tracking-[-0.03em] text-slate-950 dark:text-white">{section.title}</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">{section.body}</p>
                <ul className="mt-4 grid gap-2">
                  {section.tips.map((tip) => (
                    <li key={tip} className="flex gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </PageCard>

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

      <section className="rounded-[2rem] border border-slate-200/70 bg-white/78 p-5 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/72">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">More study pages</p>
            <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950 dark:text-white">Keep exploring from the footer</h2>
          </div>
          <button
            type="button"
            onClick={onBackToDashboard}
            className="w-fit rounded-full bg-slate-100 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            Back to dashboard
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {relatedTechniques.slice(0, 3).map((item) => (
            <article key={item.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/70">
              <h3 className="text-base font-black text-slate-950 dark:text-white">{item.title}</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">{item.summary}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
