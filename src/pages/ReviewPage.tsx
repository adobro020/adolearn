import { useMemo } from 'react';
import { PageCard } from '../components/PageCard';
import { EmptyState } from '../components/Polish';
import { getCourseById } from '../services/courseService';
import { createReviewSession } from '../services/reviewService';
import { LessonPlayerPage } from './LessonPlayerPage';

interface ReviewPageProps {
  courseId?: string | null;
  onBackToDashboard: () => void;
  onBackToCourseMap: (courseId: string) => void;
}

export function ReviewPage({ courseId = null, onBackToDashboard, onBackToCourseMap }: ReviewPageProps) {
  const reviewSession = useMemo(() => createReviewSession(courseId), [courseId]);
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

  return (
    <LessonPlayerPage
      courseId={courseId}
      lessonId={reviewSession.lesson.id}
      reviewSession={reviewSession}
      onBackToCourseMap={returnToOrigin}
      onBackToDashboard={onBackToDashboard}
      exitLabel="Exit review"
      returnLabel={courseId ? 'Return to Course Map' : 'Back to Dashboard'}
    />
  );
}
