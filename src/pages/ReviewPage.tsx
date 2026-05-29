import { useMemo } from 'react';
import { PageCard } from '../components/PageCard';
import { AnimatedNumber, EmptyState, NoticeBanner } from '../components/Polish';
import { getCourseById } from '../services/courseService';
import { createReviewSession, getReviewSummary } from '../services/reviewService';
import { LessonPlayerPage } from './LessonPlayerPage';

interface ReviewPageProps {
  courseId?: string | null;
  onBackToDashboard: () => void;
  onBackToCourseMap: (courseId: string) => void;
}

function getScopeLabel(courseId?: string | null): string {
  return courseId ? getCourseById(courseId)?.title ?? 'this course' : 'a course';
}

export function ReviewPage({ courseId = null, onBackToDashboard, onBackToCourseMap }: ReviewPageProps) {
  const reviewSession = useMemo(() => createReviewSession(courseId), [courseId]);
  const reviewSummary = useMemo(() => getReviewSummary(courseId), [courseId]);
  const scopeLabel = getScopeLabel(courseId);
  const returnToOrigin = () => {
    if (courseId) {
      onBackToCourseMap(courseId);
      return;
    }

    onBackToDashboard();
  };

  if (!reviewSession) {
    return (
      <PageCard
        eyebrow="Course Review"
        title="No course review available"
        description="Open a saved course and use Comprehensive Review to test every question from that course."
      >
        <div className="space-y-5">
          <EmptyState
            icon="🎯"
            title="No course selected"
            message="Comprehensive Review is available from each individual course page."
          >
            <button
              type="button"
              onClick={returnToOrigin}
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-slate-800"
            >
              {courseId ? 'Back to Course Map' : 'Back to Dashboard'}
            </button>
          </EmptyState>
        </div>
      </PageCard>
    );
  }

  const topWeakConcepts = reviewSession.weakConcepts.slice(0, 3);

  return (
    <div className="space-y-6">
      <PageCard
        eyebrow="Course Review"
        title="Comprehensive Review"
        description={`A full-course test built from ${scopeLabel}. It includes every question from every lesson in this course.`}
      >
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-600">Questions</p>
              <p className="mt-2 text-3xl font-black text-slate-950"><AnimatedNumber value={reviewSession.lesson.exercises.length} /></p>
            </div>
            <div className="rounded-3xl bg-amber-50 p-4 ring-1 ring-amber-100">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-600">Included</p>
              <p className="mt-2 text-3xl font-black text-slate-950"><AnimatedNumber value={reviewSession.totalAvailableItems} /></p>
            </div>
            <div className="rounded-3xl bg-sky-50 p-4 ring-1 ring-sky-100">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-600">Past misses</p>
              <p className="mt-2 text-3xl font-black text-slate-950"><AnimatedNumber value={reviewSummary.incorrectAnswerCount} /></p>
            </div>
          </div>

          <div className="rounded-[2rem] bg-gradient-to-br from-slate-50 to-white p-5 ring-1 ring-slate-200">
            <p className="text-sm font-black text-slate-950">What is included?</p>
            <ul className="mt-3 space-y-2 text-sm font-bold leading-6 text-slate-600">
              {reviewSession.reasonSummary.map((reason) => (
                <li key={reason} className="flex gap-2">
                  <span aria-hidden="true">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
            {topWeakConcepts.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {topWeakConcepts.map((concept) => (
                  <span
                    key={concept.concept}
                    className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200"
                  >
                    {concept.concept} | {concept.misses} misses
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </PageCard>

      <LessonPlayerPage
        courseId={courseId}
        lessonId={reviewSession.lesson.id}
        reviewSession={reviewSession}
        onBackToCourseMap={returnToOrigin}
        onBackToDashboard={onBackToDashboard}
        exitLabel="Exit review"
        returnLabel={courseId ? 'Return to Course Map' : 'Back to Dashboard'}
      />
    </div>
  );
}
