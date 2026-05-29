import { useEffect, useMemo, useState } from 'react';
import { PageCard } from '../components/PageCard';
import { AnimatedNumber, ConfettiBurst, ProgressBar } from '../components/Polish';
import { getCourseById } from '../services/courseService';
import { playClickSound, playCorrectSound, playIncorrectSound, playLessonCompleteSound, playXpSound } from '../services/soundService';
import {
  calculateLessonXP,
  recordLessonAttempt,
  recordReviewAttempt,
  type LessonAttemptAnswer,
  type LessonAttemptSaveResult
} from '../services/progressService';
import type { ReviewSession } from '../services/reviewService';
import type { Course, Exercise, ExerciseAnswer, Lesson, MatchingPair, OrderingItem } from '../types/course';
import { classNames } from '../utils/classNames';

interface LessonPlayerPageProps {
  courseId: string | null;
  lessonId: string | null;
  onBackToCourseMap: () => void;
  onBackToDashboard: () => void;
  reviewSession?: ReviewSession | null;
  exitLabel?: string;
  returnLabel?: string;
}

interface FeedbackState {
  isCorrect: boolean;
  message: string;
}

interface LessonLookupResult {
  course: Course;
  lesson: Lesson;
}

interface LocalLessonResult {
  correctCount: number;
  incorrectCount: number;
  scorePercentage: number;
  xpEarned: number;
  passed: boolean;
}

const PASSING_PERCENTAGE = 70;
const SHORT_ANSWER_STOP_WORDS = new Set([
  'about',
  'after',
  'could',
  'every',
  'helps',
  'into',
  'later',
  'learn',
  'material',
  'source',
  'study',
  'their',
  'there',
  'these',
  'thing',
  'understand',
  'while',
  'with'
]);

function findLesson(courseId: string | null, lessonId: string | null): LessonLookupResult | null {
  if (!courseId || !lessonId) {
    return null;
  }

  const course = getCourseById(courseId);

  if (!course) {
    return null;
  }

  for (const section of course.sections) {
    for (const unit of section.units) {
      const lesson = unit.lessons.find((candidate) => candidate.id === lessonId);

      if (lesson) {
        return { course, lesson };
      }
    }
  }

  return null;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function answerToStrings(answer: ExerciseAnswer | undefined): string[] {
  if (typeof answer === 'boolean') {
    return [answer ? 'true' : 'false'];
  }

  if (Array.isArray(answer)) {
    return answer;
  }

  return answer ? [answer] : [];
}

function getAcceptedAnswers(exercise: Exercise): string[] {
  return Array.from(
    new Set([
      ...(exercise.acceptedAnswers ?? []),
      ...answerToStrings(exercise.answer)
    ].filter(Boolean))
  );
}

function matchesExactAcceptedAnswer(submittedAnswer: string, exercise: Exercise): boolean {
  const normalizedSubmission = normalizeText(submittedAnswer);

  if (!normalizedSubmission) {
    return false;
  }

  return getAcceptedAnswers(exercise).some((acceptedAnswer) => {
    const normalizedAccepted = normalizeText(acceptedAnswer);
    return normalizedAccepted.length > 0 && normalizedSubmission === normalizedAccepted;
  });
}

function matchesFlexibleAcceptedAnswer(submittedAnswer: string, exercise: Exercise): boolean {
  const normalizedSubmission = normalizeText(submittedAnswer);

  if (!normalizedSubmission) {
    return false;
  }

  return getAcceptedAnswers(exercise).some((acceptedAnswer) => {
    const normalizedAccepted = normalizeText(acceptedAnswer);

    return (
      normalizedAccepted.length > 0 &&
      (normalizedSubmission === normalizedAccepted ||
        normalizedSubmission.includes(normalizedAccepted) ||
        normalizedAccepted.includes(normalizedSubmission))
    );
  });
}

function extractKeywords(value: string): string[] {
  const words = normalizeText(value).match(/[a-z0-9'-]{4,}/g) ?? [];

  return Array.from(new Set(words.filter((word) => !SHORT_ANSWER_STOP_WORDS.has(word))));
}

function matchesKeywordAnswer(submittedAnswer: string, exercise: Exercise): boolean {
  const submittedKeywords = new Set(extractKeywords(submittedAnswer));

  if (submittedKeywords.size === 0) {
    return false;
  }

  const answerKeywords = new Set(
    [
      ...getAcceptedAnswers(exercise).flatMap(extractKeywords),
      ...extractKeywords(exercise.concept ?? '')
    ].filter(Boolean)
  );

  if (answerKeywords.size === 0) {
    return false;
  }

  let matchingKeywordCount = 0;
  answerKeywords.forEach((keyword) => {
    if (submittedKeywords.has(keyword)) {
      matchingKeywordCount += 1;
    }
  });

  return matchingKeywordCount >= Math.min(2, answerKeywords.size);
}

function getMatchingPairs(exercise: Exercise): MatchingPair[] {
  return exercise.pairs ?? [];
}

function getOrderingItems(exercise: Exercise): OrderingItem[] {
  return exercise.items ?? [];
}

function getOrderingItemLabel(exercise: Exercise, itemId: string): string {
  return getOrderingItems(exercise).find((item) => item.id === itemId)?.text ?? itemId;
}

function getCorrectOrderIds(exercise: Exercise): string[] {
  const itemIds = getOrderingItems(exercise).map((item) => item.id);
  const correctOrder = exercise.correctOrder ?? [];
  const correctOrderLooksLikeIds = correctOrder.every((item) => itemIds.includes(item));

  return correctOrderLooksLikeIds && correctOrder.length > 0 ? correctOrder : itemIds;
}

function getCorrectMatchingLabels(exercise: Exercise): string[] {
  return getMatchingPairs(exercise).map((pair) => `${pair.left} → ${pair.right}`);
}

function getSubmittedMatchingLabels(
  exercise: Exercise,
  matchingAnswers: Record<string, string>
): string[] {
  return getMatchingPairs(exercise).map((pair) => {
    const selectedDefinition = matchingAnswers[pair.id] || 'No match selected';
    return `${pair.left} → ${selectedDefinition}`;
  });
}

function isMatchingAnswerCorrect(
  exercise: Exercise,
  matchingAnswers: Record<string, string>
): boolean {
  const pairs = getMatchingPairs(exercise);

  return (
    pairs.length > 0 &&
    pairs.every((pair) => normalizeText(matchingAnswers[pair.id] ?? '') === normalizeText(pair.right))
  );
}

function isOrderingAnswerCorrect(exercise: Exercise, orderedItemIds: string[]): boolean {
  const correctOrderIds = getCorrectOrderIds(exercise);

  return (
    correctOrderIds.length > 0 &&
    orderedItemIds.length === correctOrderIds.length &&
    orderedItemIds.every((itemId, index) => itemId === correctOrderIds[index])
  );
}

function getCorrectAnswer(exercise: Exercise): ExerciseAnswer {
  if (exercise.type === 'matching') {
    return getCorrectMatchingLabels(exercise);
  }

  if (exercise.type === 'ordering') {
    return getCorrectOrderIds(exercise).map((itemId) => getOrderingItemLabel(exercise, itemId));
  }

  return exercise.answer ?? exercise.acceptedAnswers?.[0] ?? 'Review the explanation below.';
}

function getCorrectAnswerLabel(exercise: Exercise): string {
  const correctAnswer = getCorrectAnswer(exercise);

  if (typeof correctAnswer === 'boolean') {
    return correctAnswer ? 'True' : 'False';
  }

  if (Array.isArray(correctAnswer)) {
    return correctAnswer.join(' • ');
  }

  return correctAnswer;
}

function getLessonResult(
  answers: LessonAttemptAnswer[],
  totalExercises: number,
  lesson: Lesson
): LocalLessonResult {
  const correctCount = answers.filter((answer) => answer.isCorrect).length;
  const incorrectCount = Math.max(0, totalExercises - correctCount);
  const scorePercentage = totalExercises > 0 ? Math.round((correctCount / totalExercises) * 100) : 0;
  const passed = scorePercentage >= PASSING_PERCENTAGE;

  return {
    correctCount,
    incorrectCount,
    scorePercentage,
    passed,
    xpEarned: calculateLessonXP(correctCount, totalExercises, lesson.type, passed)
  };
}

function getExerciseTypeLabel(type: Exercise['type']): string {
  return type
    .split('_')
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

function answerLabel(answer: ExerciseAnswer): string {
  if (typeof answer === 'boolean') {
    return answer ? 'True' : 'False';
  }

  if (Array.isArray(answer)) {
    return answer.join(' • ');
  }

  return answer;
}

function shuffleValues<T>(values: T[]): T[] {
  return [...values].sort(() => Math.random() - 0.5);
}

function getInitialOrderingIds(exercise: Exercise | null): string[] {
  if (!exercise || exercise.type !== 'ordering') {
    return [];
  }

  const itemIds = getOrderingItems(exercise).map((item) => item.id);
  return shuffleValues(itemIds);
}

export function LessonPlayerPage({
  courseId,
  lessonId,
  onBackToCourseMap,
  onBackToDashboard,
  reviewSession = null,
  exitLabel,
  returnLabel
}: LessonPlayerPageProps) {
  const isReviewMode = Boolean(reviewSession);
  const lessonLookup = useMemo(() => {
    if (reviewSession) {
      const scopedCourse = reviewSession.scopeCourseId ? getCourseById(reviewSession.scopeCourseId) : null;
      const syntheticCourse: Course = scopedCourse ?? {
        id: reviewSession.scopeCourseId ?? 'review-session',
        title: 'Review Session',
        description: 'Temporary browser-only review session.',
        sourceMaterialPreview: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        difficulty: 'Auto',
        style: 'Quick overview',
        estimatedTotalMinutes: reviewSession.lesson.estimatedMinutes,
        sections: [],
        keyConcepts: reviewSession.weakConcepts.map((concept) => concept.concept)
      };

      return { course: syntheticCourse, lesson: reviewSession.lesson };
    }

    return findLesson(courseId, lessonId);
  }, [courseId, lessonId, reviewSession]);
  const lesson = lessonLookup?.lesson ?? null;
  const course = lessonLookup?.course ?? null;
  const resolvedExitLabel = exitLabel ?? (isReviewMode ? 'Exit review' : 'Exit lesson');
  const resolvedReturnLabel = returnLabel ?? (isReviewMode ? 'Return from Review' : 'Return to Course Map');
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState('');
  const [textAnswer, setTextAnswer] = useState('');
  const [booleanAnswer, setBooleanAnswer] = useState<boolean | null>(null);
  const [matchingAnswers, setMatchingAnswers] = useState<Record<string, string>>({});
  const [orderedItemIds, setOrderedItemIds] = useState<string[]>([]);
  const [flashcardRevealed, setFlashcardRevealed] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [attemptAnswers, setAttemptAnswers] = useState<LessonAttemptAnswer[]>([]);
  const [savedAttempt, setSavedAttempt] = useState<LessonAttemptSaveResult | null>(null);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const currentExercise = lesson?.exercises[currentExerciseIndex] ?? null;

  useEffect(() => {
    setMatchingAnswers({});
    setOrderedItemIds(getInitialOrderingIds(currentExercise));
  }, [currentExercise?.id]);

  if (!lesson || !course) {
    return (
      <PageCard
        eyebrow={isReviewMode ? 'Review mode' : 'Lesson player'}
        title="Lesson not found"
        description="This lesson could not be loaded from local course data."
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onBackToCourseMap}
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-900/15"
          >
            Back to course map
          </button>
          <button
            type="button"
            onClick={onBackToDashboard}
            className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200"
          >
            Back to dashboard
          </button>
        </div>
      </PageCard>
    );
  }

  const totalExercises = lesson.exercises.length;
  const exerciseNumber = Math.min(currentExerciseIndex + 1, totalExercises);
  const progressPercentage = totalExercises > 0 ? (exerciseNumber / totalExercises) * 100 : 0;
  const localResult = getLessonResult(attemptAnswers, totalExercises, lesson);
  const result = savedAttempt ?? localResult;
  const canSubmit = (() => {
    if (!currentExercise || feedback) {
      return false;
    }

    if (currentExercise.type === 'multiple_choice') {
      return selectedChoice.length > 0;
    }

    if (currentExercise.type === 'true_false') {
      return booleanAnswer !== null;
    }

    if (
      currentExercise.type === 'fill_blank' ||
      currentExercise.type === 'short_answer' ||
      currentExercise.type === 'explain_concept'
    ) {
      return textAnswer.trim().length > 0;
    }

    if (currentExercise.type === 'scenario') {
      return currentExercise.choices?.length ? selectedChoice.length > 0 : textAnswer.trim().length > 0;
    }

    if (currentExercise.type === 'matching') {
      const pairs = getMatchingPairs(currentExercise);
      return pairs.length > 0 && pairs.every((pair) => Boolean(matchingAnswers[pair.id]));
    }

    if (currentExercise.type === 'ordering') {
      return orderedItemIds.length > 0;
    }

    return false;
  })();

  function resetExerciseInput() {
    setSelectedChoice('');
    setTextAnswer('');
    setBooleanAnswer(null);
    setMatchingAnswers({});
    setOrderedItemIds(getInitialOrderingIds(lesson?.exercises[currentExerciseIndex + 1] ?? null));
    setFlashcardRevealed(false);
    setFeedback(null);
  }

  function recordAnswer(exercise: Exercise, isCorrect: boolean, userAnswer: ExerciseAnswer) {
    const reviewSource = reviewSession?.sourceItems.find((item) => item.id === exercise.id);
    const answerRecord: LessonAttemptAnswer = {
      exerciseId: exercise.id,
      prompt: exercise.prompt,
      isCorrect,
      userAnswer,
      correctAnswer: getCorrectAnswer(exercise),
      concept: exercise.concept,
      explanation: exercise.explanation,
      sourceCourseId: reviewSource?.courseId,
      sourceLessonId: reviewSource?.lessonId,
      sourceExerciseId: reviewSource?.exerciseId
    };

    setAttemptAnswers((previousAnswers) => [...previousAnswers, answerRecord]);
  }

  function submitAnswer() {
    if (!currentExercise || feedback) {
      return;
    }

    let isCorrect = false;
    let submittedAnswer: ExerciseAnswer = '';

    if (currentExercise.type === 'multiple_choice') {
      submittedAnswer = selectedChoice;
      isCorrect = matchesExactAcceptedAnswer(selectedChoice, currentExercise);
    }

    if (currentExercise.type === 'true_false' && booleanAnswer !== null) {
      submittedAnswer = booleanAnswer;
      isCorrect = booleanAnswer === currentExercise.answer;
    }

    if (currentExercise.type === 'fill_blank') {
      submittedAnswer = textAnswer;
      isCorrect = matchesExactAcceptedAnswer(textAnswer, currentExercise);
    }

    if (currentExercise.type === 'short_answer') {
      submittedAnswer = textAnswer;
      isCorrect =
        matchesFlexibleAcceptedAnswer(textAnswer, currentExercise) ||
        matchesKeywordAnswer(textAnswer, currentExercise);
    }

    if (currentExercise.type === 'matching') {
      submittedAnswer = getSubmittedMatchingLabels(currentExercise, matchingAnswers);
      isCorrect = isMatchingAnswerCorrect(currentExercise, matchingAnswers);
    }

    if (currentExercise.type === 'ordering') {
      submittedAnswer = orderedItemIds.map((itemId) => getOrderingItemLabel(currentExercise, itemId));
      isCorrect = isOrderingAnswerCorrect(currentExercise, orderedItemIds);
    }

    if (currentExercise.type === 'scenario') {
      submittedAnswer = currentExercise.choices?.length ? selectedChoice : textAnswer;
      isCorrect = currentExercise.choices?.length
        ? matchesExactAcceptedAnswer(selectedChoice, currentExercise)
        : matchesFlexibleAcceptedAnswer(textAnswer, currentExercise) ||
          matchesKeywordAnswer(textAnswer, currentExercise);
    }

    if (currentExercise.type === 'explain_concept') {
      submittedAnswer = textAnswer;
      isCorrect =
        matchesFlexibleAcceptedAnswer(textAnswer, currentExercise) ||
        matchesKeywordAnswer(textAnswer, currentExercise);
    }

    recordAnswer(currentExercise, isCorrect, submittedAnswer);
    if (isCorrect) {
      playCorrectSound();
    } else {
      playIncorrectSound();
    }
    setFeedback({
      isCorrect,
      message: isCorrect
        ? 'Nice work — that answer matches the lesson goal.'
        : `Not quite. Correct answer: ${getCorrectAnswerLabel(currentExercise)}${
            answerLabel(submittedAnswer) ? ` Your answer: ${answerLabel(submittedAnswer)}.` : ''
          }`
    });
  }

  function handleFlashcardSelfGrade(isCorrect: boolean) {
    if (!currentExercise || feedback || currentExercise.type !== 'flashcard') {
      return;
    }

    recordAnswer(
      currentExercise,
      isCorrect,
      isCorrect ? 'Self-graded correct' : 'Self-graded incorrect'
    );
    if (isCorrect) {
      playCorrectSound();
    } else {
      playIncorrectSound();
    }
    setFeedback({
      isCorrect,
      message: isCorrect
        ? 'Great recall — count this flashcard as correct.'
        : 'Good review moment — count this flashcard as incorrect and revisit the explanation.'
    });
  }

  function finishLesson() {
    if (!course || !lesson) {
      return;
    }

    if (savedAttempt) {
      setShowEndScreen(true);
      return;
    }

    const saveResult = reviewSession
      ? recordReviewAttempt({
          sessionId: reviewSession.id,
          scopeCourseId: reviewSession.scopeCourseId,
          answers: attemptAnswers,
          sources: reviewSession.sourceItems.map((item) => ({
            reviewExerciseId: item.id,
            courseId: item.courseId,
            lessonId: item.lessonId,
            exerciseId: item.exerciseId
          }))
        })
      : recordLessonAttempt({
          course,
          lessonId: lesson.id,
          answers: attemptAnswers
        });

    if (saveResult.passed) {
      playLessonCompleteSound();
      window.setTimeout(playXpSound, 260);
    } else {
      playIncorrectSound();
    }

    setSavedAttempt(saveResult);
    setShowEndScreen(true);
  }

  function continueToNextExercise() {
    if (currentExerciseIndex >= totalExercises - 1) {
      finishLesson();
      return;
    }

    setCurrentExerciseIndex((previousIndex) => previousIndex + 1);
    resetExerciseInput();
  }

  function retryLesson() {
    setCurrentExerciseIndex(0);
    setAttemptAnswers([]);
    setSavedAttempt(null);
    setShowEndScreen(false);
    resetExerciseInput();
  }

  function updateMatchingAnswer(pairId: string, selectedDefinition: string) {
    setMatchingAnswers((previousAnswers) => ({
      ...previousAnswers,
      [pairId]: selectedDefinition
    }));
  }

  function moveOrderingItem(index: number, direction: 'up' | 'down') {
    setOrderedItemIds((previousIds) => {
      const nextIndex = direction === 'up' ? index - 1 : index + 1;

      if (nextIndex < 0 || nextIndex >= previousIds.length) {
        return previousIds;
      }

      const nextIds = [...previousIds];
      const currentId = nextIds[index];
      nextIds[index] = nextIds[nextIndex];
      nextIds[nextIndex] = currentId;
      return nextIds;
    });
  }

  function renderTextResponseInput(label: string, placeholder: string, note?: string) {
    return (
      <label className="block">
        <span className="mb-2 block text-sm font-black text-slate-600">{label}</span>
        <textarea
          value={textAnswer}
          onChange={(event) => setTextAnswer(event.target.value)}
          disabled={Boolean(feedback)}
          rows={5}
          placeholder={placeholder}
          className="w-full resize-none rounded-3xl border-0 bg-white px-5 py-4 text-base font-bold leading-7 text-slate-950 ring-2 ring-slate-200 placeholder:text-slate-400 focus:ring-emerald-300"
        />
        {note ? <p className="mt-2 text-xs font-bold leading-5 text-slate-500">{note}</p> : null}
      </label>
    );
  }

  function renderChoiceButtons(exercise: Exercise) {
    return (
      <div className="grid gap-3">
        {(exercise.choices ?? []).map((choice) => {
          const selected = selectedChoice === choice.text;

          return (
            <button
              key={choice.id}
              type="button"
              onClick={() => { playClickSound(); setSelectedChoice(choice.text); }}
              disabled={Boolean(feedback)}
              className={classNames(
                'rounded-3xl px-4 py-4 text-left text-sm font-black leading-6 ring-2 transition sm:px-5',
                selected
                  ? 'bg-emerald-50 text-emerald-800 ring-emerald-300 shadow-sm shadow-emerald-100'
                  : 'bg-white text-slate-700 ring-slate-200 hover:-translate-y-0.5 hover:ring-emerald-200',
                feedback && !selected && 'opacity-70'
              )}
            >
              {choice.text}
            </button>
          );
        })}
      </div>
    );
  }

  function renderExerciseInput(exercise: Exercise) {
    if (exercise.type === 'multiple_choice') {
      return renderChoiceButtons(exercise);
    }

    if (exercise.type === 'true_false') {
      return (
        <div className="grid grid-cols-2 gap-3">
          {[true, false].map((value) => {
            const selected = booleanAnswer === value;

            return (
              <button
                key={String(value)}
                type="button"
                onClick={() => { playClickSound(); setBooleanAnswer(value); }}
                disabled={Boolean(feedback)}
                className={classNames(
                  'rounded-3xl px-4 py-5 text-center text-lg font-black ring-2 transition',
                  selected
                    ? 'bg-emerald-50 text-emerald-800 ring-emerald-300 shadow-sm shadow-emerald-100'
                    : 'bg-white text-slate-700 ring-slate-200 hover:-translate-y-0.5 hover:ring-emerald-200',
                  feedback && !selected && 'opacity-70'
                )}
              >
                {value ? 'True' : 'False'}
              </button>
            );
          })}
        </div>
      );
    }

    if (exercise.type === 'fill_blank') {
      return (
        <label className="block">
          <span className="mb-2 block text-sm font-black text-slate-600">Your answer</span>
          <input
            type="text"
            value={textAnswer}
            onChange={(event) => setTextAnswer(event.target.value)}
            disabled={Boolean(feedback)}
            placeholder="Type the missing word or phrase"
            className="w-full rounded-3xl border-0 bg-white px-5 py-4 text-base font-bold text-slate-950 ring-2 ring-slate-200 placeholder:text-slate-400 focus:ring-emerald-300"
          />
        </label>
      );
    }

    if (exercise.type === 'short_answer') {
      return renderTextResponseInput(
        'Your short answer',
        'Write one or two sentences',
        'For now, short answers use accepted-answer and keyword matching. AI grading comes later.'
      );
    }

    if (exercise.type === 'matching') {
      const pairs = getMatchingPairs(exercise);
      const definitions = pairs.map((pair) => pair.right);

      return (
        <div className="space-y-4">
          <div className="rounded-3xl bg-sky-50 p-4 text-sm font-bold leading-6 text-sky-900 ring-1 ring-sky-100">
            Match each term to the definition that fits best.
          </div>
          <div className="grid gap-3">
            {pairs.map((pair, index) => (
              <label
                key={pair.id}
                className="rounded-3xl bg-white p-4 ring-2 ring-slate-200 sm:p-5"
              >
                <span className="block text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Term {index + 1}
                </span>
                <span className="mt-1 block text-base font-black text-slate-950">{pair.left}</span>
                <select
                  value={matchingAnswers[pair.id] ?? ''}
                  onChange={(event) => { playClickSound(); updateMatchingAnswer(pair.id, event.target.value); }}
                  disabled={Boolean(feedback)}
                  className="mt-3 w-full rounded-2xl border-0 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 ring-1 ring-slate-200 focus:ring-emerald-300"
                >
                  <option value="">Choose a definition</option>
                  {definitions.map((definition) => (
                    <option key={definition} value={definition}>
                      {definition}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      );
    }

    if (exercise.type === 'ordering') {
      const displayedOrder = orderedItemIds.length
        ? orderedItemIds
        : getOrderingItems(exercise).map((item) => item.id);

      return (
        <div className="space-y-4">
          <div className="rounded-3xl bg-violet-50 p-4 text-sm font-bold leading-6 text-violet-900 ring-1 ring-violet-100">
            Put the items in the best order. Use the up and down buttons to move each step.
          </div>
          <ol className="space-y-3">
            {displayedOrder.map((itemId, index) => (
              <li
                key={itemId}
                className="flex items-center gap-3 rounded-3xl bg-white p-3 ring-2 ring-slate-200 sm:p-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 text-sm font-black leading-6 text-slate-800">
                  {getOrderingItemLabel(exercise, itemId)}
                </span>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => { playClickSound(); moveOrderingItem(index, 'up'); }}
                    disabled={Boolean(feedback) || index === 0}
                    aria-label={`Move ${getOrderingItemLabel(exercise, itemId)} up`}
                    className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => { playClickSound(); moveOrderingItem(index, 'down'); }}
                    disabled={Boolean(feedback) || index === displayedOrder.length - 1}
                    aria-label={`Move ${getOrderingItemLabel(exercise, itemId)} down`}
                    className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ↓
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </div>
      );
    }

    if (exercise.type === 'scenario') {
      if (exercise.choices?.length) {
        return (
          <div className="space-y-3">
            <p className="rounded-3xl bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900 ring-1 ring-amber-100">
              Apply the lesson to this scenario, then choose the strongest response.
            </p>
            {renderChoiceButtons(exercise)}
          </div>
        );
      }

      return renderTextResponseInput(
        'Your scenario response',
        'Explain what you would do or choose in this situation',
        'Scenario answers use accepted-answer and keyword matching for now.'
      );
    }

    if (exercise.type === 'explain_concept') {
      return renderTextResponseInput(
        'Explain the concept',
        'Explain it in your own words',
        'This is graded with simple keyword matching for now. AI grading may be added later.'
      );
    }

    if (exercise.type === 'flashcard') {
      return (
        <div className="space-y-4">
          <div className="rounded-[2rem] bg-white p-5 text-center ring-2 ring-slate-200 sm:p-7">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Flashcard
            </p>
            <p className="mt-4 text-lg font-black leading-8 text-slate-950 sm:text-xl">
              {flashcardRevealed ? getCorrectAnswerLabel(exercise) : 'Think of your answer, then reveal the card.'}
            </p>
          </div>

          {!flashcardRevealed ? (
            <button
              type="button"
              onClick={() => { playClickSound(); setFlashcardRevealed(true); }}
              className="w-full rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-slate-800"
            >
              Reveal answer
            </button>
          ) : feedback ? null : (
            <div className="space-y-3">
              <p className="text-center text-sm font-black text-slate-600">Did you know this?</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleFlashcardSelfGrade(false)}
                  className="rounded-2xl bg-rose-50 px-4 py-4 text-sm font-black text-rose-700 ring-1 ring-rose-100 transition hover:-translate-y-0.5"
                >
                  Incorrect
                </button>
                <button
                  type="button"
                  onClick={() => handleFlashcardSelfGrade(true)}
                  className="rounded-2xl bg-emerald-500 px-4 py-4 text-sm font-black text-white shadow-lg shadow-emerald-200 transition hover:-translate-y-0.5"
                >
                  Correct
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="rounded-3xl bg-amber-50 p-5 text-sm font-bold leading-6 text-amber-800 ring-1 ring-amber-100">
        This exercise type is not recognized yet.
      </div>
    );
  }

  if (showEndScreen) {
    return (
      <div className="relative">
        <ConfettiBurst active={result.passed} />
      <PageCard
        eyebrow={isReviewMode ? 'Review complete' : 'Lesson complete'}
        title={result.passed ? (isReviewMode ? 'Review session complete!' : 'You passed this lesson!') : 'Keep practicing'}
        description={
          isReviewMode
            ? 'Review results were saved locally, review XP was awarded, and no course lessons were unlocked.'
            : result.passed
              ? 'Progress was saved locally, XP was awarded, and the next available lesson was unlocked.'
              : 'This attempt was saved locally. Score 70% or higher to mark the lesson complete and unlock what comes next.'
        }
      >
        <div className="space-y-6">
          <div
            className={classNames(
              'relative overflow-hidden rounded-[2rem] p-6 text-center ring-1 motion-safe:animate-celebratory-pop',
              result.passed
                ? 'bg-gradient-to-br from-emerald-50 to-sky-50 ring-emerald-100'
                : 'bg-gradient-to-br from-amber-50 to-orange-50 ring-amber-100'
            )}
          >
            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/70 blur-xl" />
            <div className="relative">
              <p className="text-5xl motion-safe:animate-bounce-soft" aria-hidden="true">
                {result.passed ? '🎉' : '💪'}
              </p>
              <p className="mt-3 text-sm font-black uppercase tracking-[0.18em] text-emerald-600">Score</p>
              <p className="mt-2 text-6xl font-black tracking-tight text-slate-950">
                <AnimatedNumber value={result.scorePercentage} suffix="%" />
              </p>
              <p className="mt-3 text-sm font-bold text-slate-600">
                {result.passed ? 'Passed' : 'Needs retry'} · Passing score is {PASSING_PERCENTAGE}%
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-400">Correct</p>
              <p className="mt-2 text-3xl font-black text-emerald-600"><AnimatedNumber value={result.correctCount} /></p>
            </div>
            <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-400">Incorrect</p>
              <p className="mt-2 text-3xl font-black text-rose-600"><AnimatedNumber value={result.incorrectCount} /></p>
            </div>
            <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-400">XP earned</p>
              <p className="mt-2 text-3xl font-black text-amber-600 motion-safe:animate-xp-float"><AnimatedNumber value={result.xpEarned} prefix="+" /></p>
            </div>
          </div>

          <div className="rounded-3xl bg-slate-50 p-5 text-sm font-bold leading-6 text-slate-600 ring-1 ring-slate-200">
            {result.passed ? (
              <span>
                {isReviewMode ? 'Review session saved. No new lesson nodes were unlocked.' : <>Lesson complete. {savedAttempt?.newlyUnlockedLessons.length
                  ? `${savedAttempt.newlyUnlockedLessons.length} new lesson path node was unlocked.`
                  : 'Replay completed lessons any time to practice again.'}</>}
              </span>
            ) : (
              <span>
                {isReviewMode
                  ? 'Review attempts still save incorrect answers and weak concepts, but they never unlock course lessons.'
                  : 'Failed attempts still save your best score, incorrect answers, and weak concepts, but they do not unlock the next lesson.'}
              </span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={retryLesson}
              className="rounded-2xl bg-white px-5 py-4 text-sm font-black text-slate-700 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:bg-slate-50"
            >
              Retry lesson
            </button>
            <button
              type="button"
              onClick={onBackToCourseMap}
              className="rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-slate-800"
            >
              {resolvedReturnLabel}
            </button>
          </div>
        </div>
      </PageCard>
      </div>
    );
  }

  if (!currentExercise) {
    return (
      <PageCard
        eyebrow={isReviewMode ? 'Review mode' : 'Lesson player'}
        title="No exercises yet"
        description="This lesson does not include supported exercises. Return to the course map and try another lesson."
      >
        <button
          type="button"
          onClick={onBackToCourseMap}
          className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-900/15"
        >
          Back to course map
        </button>
      </PageCard>
    );
  }

  return (
    <div className="space-y-6">
      <PageCard eyebrow={isReviewMode ? 'Review mode' : 'Lesson player'} title={lesson.title} description={lesson.summary}>
        <div className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-slate-500">
                Exercise {exerciseNumber} of {totalExercises}
              </p>
              <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-emerald-600">
                {getExerciseTypeLabel(currentExercise.type)} · +10 XP per correct answer
              </p>
            </div>
            <button
              type="button"
              onClick={onBackToCourseMap}
              aria-label={resolvedExitLabel}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:bg-slate-50"
            >
              {resolvedExitLabel}
            </button>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              <span>Lesson progress</span>
              <span>{Math.round(progressPercentage)}%</span>
            </div>
            <ProgressBar value={progressPercentage} label="Lesson exercise progress" size="lg" tone="violet" />
          </div>
        </div>
      </PageCard>

      <section className="rounded-[2rem] bg-white p-5 shadow-sm shadow-slate-200/80 ring-1 ring-slate-200/80 sm:p-7">
        <div className="space-y-6">
          <div className="rounded-[2rem] bg-slate-50 p-5 ring-1 ring-slate-200 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Prompt</p>
            <h2 className="mt-3 text-xl font-black leading-8 tracking-tight text-slate-950 sm:text-2xl">
              {currentExercise.prompt}
            </h2>
            {currentExercise.hint ? (
              <details className="mt-4 rounded-2xl bg-white p-4 text-sm font-bold leading-6 text-slate-600 ring-1 ring-slate-200">
                <summary className="cursor-pointer font-black text-slate-700">Need a hint?</summary>
                <p className="mt-2">{currentExercise.hint}</p>
              </details>
            ) : null}
          </div>

          {renderExerciseInput(currentExercise)}

          {currentExercise.type !== 'flashcard' ? (
            <button
              type="button"
              onClick={submitAnswer}
              disabled={!canSubmit}
              aria-label="Submit answer"
              className={classNames(
                'w-full rounded-2xl px-5 py-4 text-sm font-black shadow-lg transition',
                canSubmit
                  ? 'bg-slate-950 text-white shadow-slate-900/15 hover:-translate-y-0.5 hover:bg-slate-800'
                  : 'cursor-not-allowed bg-slate-200 text-slate-400 shadow-transparent'
              )}
            >
              Submit
            </button>
          ) : null}

          {feedback ? (
            <div
              className={classNames(
                'rounded-[2rem] p-5 ring-1 sm:p-6',
                feedback.isCorrect
                  ? 'bg-emerald-50 text-emerald-900 ring-emerald-100'
                  : 'bg-rose-50 text-rose-900 ring-rose-100'
              )}
              role="status"
            >
              <p className="flex items-center gap-2 text-lg font-black">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-white/80 text-base shadow-sm" aria-hidden="true">
                  {feedback.isCorrect ? '✓' : '!' }
                </span>
                <span>{feedback.isCorrect ? 'Correct!' : 'Incorrect — review the explanation'}</span>
              </p>
              <p className="mt-2 text-sm font-bold leading-6">{feedback.message}</p>
              <div className="mt-4 rounded-2xl bg-white/70 p-4 text-sm font-bold leading-6 text-slate-700 ring-1 ring-white/80">
                <span className="font-black text-slate-950">Explanation: </span>
                {currentExercise.explanation ??
                  'Review the correct answer and connect it back to the lesson goal before continuing.'}
              </div>
              <button
                type="button"
                onClick={continueToNextExercise}
                className="mt-5 w-full rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-slate-800 sm:w-auto"
              >
                {currentExerciseIndex >= totalExercises - 1 ? 'See results' : 'Continue'}
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
