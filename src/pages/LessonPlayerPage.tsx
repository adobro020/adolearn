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
import { ROBOT_GRAPHICS } from '../data/mascotGraphics';

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
  const pairs = getMatchingPairs(exercise);
  return pairs.map((pair) => {
    const selectedDefinitionId = matchingAnswers[pair.id];
    const selectedDefinition = pairs.find((candidate) => candidate.id === selectedDefinitionId)?.right ?? 'No match selected';
    return `${pair.left} → ${selectedDefinition}`;
  });
}

function isMatchingAnswerCorrect(
  exercise: Exercise,
  matchingAnswers: Record<string, string>
): boolean {
  const pairs = getMatchingPairs(exercise);

  return pairs.length > 0 && pairs.every((pair) => matchingAnswers[pair.id] === pair.id);
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
  const [selectedMatchTermId, setSelectedMatchTermId] = useState<string | null>(null);
  const [orderedItemIds, setOrderedItemIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [attemptAnswers, setAttemptAnswers] = useState<LessonAttemptAnswer[]>([]);
  const [savedAttempt, setSavedAttempt] = useState<LessonAttemptSaveResult | null>(null);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const practiceExercises = useMemo(
    () => lesson?.exercises ?? [],
    [lesson]
  );
  const currentExercise = practiceExercises[currentExerciseIndex] ?? null;

  useEffect(() => {
    setMatchingAnswers({});
    setSelectedMatchTermId(null);
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

  const totalExercises = practiceExercises.length;
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
    setSelectedMatchTermId(null);
    setOrderedItemIds(getInitialOrderingIds(lesson?.exercises[currentExerciseIndex + 1] ?? null));
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

  function updateMatchingAnswer(pairId: string, selectedDefinitionId: string) {
    setMatchingAnswers((previousAnswers) => ({
      ...previousAnswers,
      [pairId]: selectedDefinitionId
    }));
  }

  function handleMatchTermClick(pairId: string) {
    if (feedback) {
      return;
    }

    playClickSound();
    setSelectedMatchTermId((currentPairId) => (currentPairId === pairId ? null : pairId));
  }

  function handleMatchDefinitionClick(definitionPairId: string) {
    if (feedback || !selectedMatchTermId) {
      return;
    }

    playClickSound();
    updateMatchingAnswer(selectedMatchTermId, definitionPairId);
    setSelectedMatchTermId(null);
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

    if (exercise.type === 'matching') {
      const pairs = getMatchingPairs(exercise);
      const definitionPairs = pairs.map((pair) => ({ id: pair.id, text: pair.right }));
      const usedDefinitions = new Set(Object.values(matchingAnswers));

      return (
        <div className="space-y-4">
          <div className="rounded-3xl bg-sky-50 p-4 text-sm font-bold leading-6 text-sky-900 ring-1 ring-sky-100">
            Tap a term, then tap its matching definition. Matched pairs lock into place as you complete the set.
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Terms</p>
              {pairs.map((pair, index) => {
                const selected = selectedMatchTermId === pair.id;
                const matched = Boolean(matchingAnswers[pair.id]);

                return (
                  <button
                    key={pair.id}
                    type="button"
                    onClick={() => handleMatchTermClick(pair.id)}
                    disabled={Boolean(feedback)}
                    className={classNames(
                      'w-full rounded-3xl p-4 text-left ring-2 transition sm:p-5',
                      selected && 'bg-emerald-50 text-emerald-900 ring-emerald-300 shadow-sm shadow-emerald-100',
                      !selected && matched && 'bg-sky-50 text-sky-900 ring-sky-200',
                      !selected && !matched && 'bg-white text-slate-800 ring-slate-200 hover:-translate-y-0.5 hover:ring-emerald-200',
                      feedback && !matched && 'opacity-70'
                    )}
                  >
                    <span className="block text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                      Term {index + 1}
                    </span>
                    <span className="mt-1 block text-base font-black leading-6">{pair.left}</span>
                    {matched ? (
                      <span className="mt-3 block rounded-2xl bg-white/70 px-3 py-2 text-xs font-bold leading-5 text-slate-600 ring-1 ring-white/80">
                        Matched to: {definitionPairs.find((definitionPair) => definitionPair.id === matchingAnswers[pair.id])?.text ?? 'Matched'}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Definitions</p>
              {definitionPairs.map((definitionPair, index) => {
                const used = usedDefinitions.has(definitionPair.id);

                return (
                  <button
                    key={definitionPair.id}
                    type="button"
                    onClick={() => handleMatchDefinitionClick(definitionPair.id)}
                    disabled={Boolean(feedback) || !selectedMatchTermId || used}
                    className={classNames(
                      'w-full rounded-3xl p-4 text-left text-sm font-bold leading-6 ring-2 transition sm:p-5',
                      used && 'bg-emerald-50 text-emerald-900 ring-emerald-200 opacity-80',
                      !used && selectedMatchTermId && 'bg-white text-slate-800 ring-emerald-200 hover:-translate-y-0.5 hover:bg-emerald-50',
                      !used && !selectedMatchTermId && 'bg-white text-slate-700 ring-slate-200'
                    )}
                  >
                    <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                      Definition {index + 1}
                    </span>
                    {definitionPair.text}
                  </button>
                );
              })}
            </div>
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


    return (
      <div className="rounded-3xl bg-amber-50 p-5 text-sm font-bold leading-6 text-amber-800 ring-1 ring-amber-100">
        This exercise type is not recognized yet.
      </div>
    );
  }

  if (showEndScreen) {
    return (
      <section className="relative min-h-screen w-full overflow-x-hidden bg-white px-4 py-6 text-slate-950 dark:bg-[#080a12] dark:text-white sm:px-8">
        <button
          type="button"
          onClick={onBackToCourseMap}
          aria-label={resolvedReturnLabel}
          className="fixed left-4 top-4 z-30 grid h-12 w-12 place-items-center rounded-full bg-white/90 text-2xl font-black text-slate-700 shadow-lg shadow-slate-900/10 ring-1 ring-slate-200 backdrop-blur transition hover:scale-105 hover:bg-slate-50 dark:bg-slate-950/90 dark:text-white dark:ring-zinc-800"
        >
          ×
        </button>

        <ConfettiBurst active={result.passed} />

        <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl flex-col items-center justify-center gap-8 pt-14 text-center">
          <img
            src={result.passed ? ROBOT_GRAPHICS.celebration : ROBOT_GRAPHICS.teacher}
            alt={result.passed ? 'Robot celebrating lesson completion' : 'Robot encouraging another try'}
            className="h-48 w-full object-contain sm:h-64"
          />

          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300">
              {isReviewMode ? 'Review complete' : 'Lesson complete'}
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-6xl">
              {result.passed ? (isReviewMode ? 'Review session complete!' : 'You passed this lesson!') : 'Keep practicing'}
            </h1>
            <p className="mt-5 text-7xl font-black tracking-tight text-slate-950 dark:text-white sm:text-8xl">
              <AnimatedNumber value={result.scorePercentage} suffix="%" />
            </p>
            <p className="mt-3 text-sm font-bold text-slate-600 dark:text-zinc-300">
              {result.passed ? 'Passed' : 'Needs retry'} | Passing score is {PASSING_PERCENTAGE}%
            </p>
          </div>

          <div className="grid w-full max-w-3xl gap-3 sm:grid-cols-3">
            <div className="rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-zinc-800">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Correct</p>
              <p className="mt-2 text-3xl font-black text-emerald-600"><AnimatedNumber value={result.correctCount} /></p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-zinc-800">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Incorrect</p>
              <p className="mt-2 text-3xl font-black text-rose-600"><AnimatedNumber value={result.incorrectCount} /></p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-zinc-800">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">XP earned</p>
              <p className="mt-2 text-3xl font-black text-amber-600"><AnimatedNumber value={result.xpEarned} prefix="+" /></p>
            </div>
          </div>

          <div className="grid w-full max-w-3xl gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={retryLesson}
              className="rounded-2xl bg-white px-5 py-4 text-sm font-black text-slate-700 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:bg-slate-50 dark:bg-slate-950 dark:text-zinc-200 dark:ring-zinc-800"
            >
              Retry lesson
            </button>
            <button
              type="button"
              onClick={onBackToCourseMap}
              className="rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-slate-800 dark:bg-emerald-400 dark:text-black dark:hover:bg-emerald-300"
            >
              {resolvedReturnLabel}
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (!currentExercise) {
    return (
      <section className="relative min-h-screen w-full bg-white px-4 py-6 text-slate-950 dark:bg-[#080a12] dark:text-white sm:px-8">
        <button
          type="button"
          onClick={onBackToCourseMap}
          aria-label={resolvedExitLabel}
          className="fixed left-4 top-4 z-30 grid h-12 w-12 place-items-center rounded-full bg-white/90 text-2xl font-black text-slate-700 shadow-lg shadow-slate-900/10 ring-1 ring-slate-200 backdrop-blur transition hover:scale-105 hover:bg-slate-50 dark:bg-slate-950/90 dark:text-white dark:ring-zinc-800"
        >
          ×
        </button>
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-3xl flex-col items-center justify-center text-center">
          <h1 className="text-4xl font-black tracking-tight text-slate-950 dark:text-white">No exercises yet</h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-600 dark:text-zinc-300">
This lesson does not include supported practice questions yet.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative min-h-screen w-full overflow-x-hidden bg-white px-4 py-6 text-slate-950 dark:bg-[#080a12] dark:text-white sm:px-8">
      <button
        type="button"
        onClick={onBackToCourseMap}
        aria-label={resolvedExitLabel}
        className="fixed left-4 top-4 z-30 grid h-12 w-12 place-items-center rounded-full bg-white/90 text-2xl font-black text-slate-700 shadow-lg shadow-slate-900/10 ring-1 ring-slate-200 backdrop-blur transition hover:scale-105 hover:bg-slate-50 dark:bg-slate-950/90 dark:text-white dark:ring-zinc-800"
      >
        ×
      </button>

      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl flex-col justify-center gap-6 pt-14">
        <div className="mx-auto w-full max-w-3xl text-center">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300">
            Exercise {exerciseNumber} of {totalExercises}
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
            {lesson.title}
          </h1>
          <div className="mx-auto mt-5 max-w-md">
            <ProgressBar value={progressPercentage} label="Lesson exercise progress" size="lg" tone="violet" />
          </div>
        </div>

        <div className="mx-auto w-full max-w-4xl rounded-[2rem] bg-slate-50 p-5 ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-zinc-800 sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Prompt</p>
          <h2 className="mt-3 text-2xl font-black leading-9 tracking-tight text-slate-950 dark:text-white sm:text-3xl">
            {currentExercise.prompt}
          </h2>
          {currentExercise.hint ? (
            <details className="mt-4 rounded-2xl bg-white p-4 text-sm font-bold leading-6 text-slate-600 ring-1 ring-slate-200 dark:bg-[#080a12] dark:text-zinc-300 dark:ring-zinc-800">
              <summary className="cursor-pointer font-black text-slate-700 dark:text-zinc-200">Need a hint?</summary>
              <p className="mt-2">{currentExercise.hint}</p>
            </details>
          ) : null}
        </div>

        <div className="mx-auto w-full max-w-4xl">
          {renderExerciseInput(currentExercise)}
        </div>

        <button
            type="button"
            onClick={submitAnswer}
            disabled={!canSubmit}
            aria-label="Submit answer"
            className={classNames(
              'mx-auto w-full max-w-4xl rounded-2xl px-5 py-4 text-sm font-black shadow-lg transition',
              canSubmit
                ? 'bg-slate-950 text-white shadow-slate-900/15 hover:-translate-y-0.5 hover:bg-slate-800 dark:bg-emerald-400 dark:text-black dark:hover:bg-emerald-300'
                : 'cursor-not-allowed bg-slate-200 text-slate-400 shadow-transparent dark:bg-zinc-900 dark:text-zinc-600'
            )}
          >
            Submit
          </button>

        {feedback ? (
          <div
            className={classNames(
              'mx-auto w-full max-w-4xl rounded-[2rem] p-5 ring-1 sm:p-6',
              feedback.isCorrect
                ? 'bg-emerald-50 text-emerald-900 ring-emerald-100 dark:bg-slate-950 dark:text-emerald-200 dark:ring-emerald-500/20'
                : 'bg-rose-50 text-rose-900 ring-rose-100 dark:bg-slate-950 dark:text-rose-200 dark:ring-rose-500/20'
            )}
            role="status"
          >
            <p className="flex items-center gap-2 text-lg font-black">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white/80 text-base shadow-sm dark:bg-zinc-950" aria-hidden="true">
                {feedback.isCorrect ? '✓' : '!' }
              </span>
              <span>{feedback.isCorrect ? 'Correct!' : 'Incorrect — review the explanation'}</span>
            </p>
            <p className="mt-2 text-sm font-bold leading-6">{feedback.message}</p>
            <div className="mt-4 rounded-2xl bg-white/70 p-4 text-sm font-bold leading-6 text-slate-700 ring-1 ring-white/80 dark:bg-[#080a12] dark:text-zinc-300 dark:ring-zinc-800">
              <span className="font-black text-slate-950 dark:text-white">Explanation: </span>
              {currentExercise.explanation ??
                'Review the correct answer and connect it back to the lesson goal before continuing.'}
            </div>
            <button
              type="button"
              onClick={continueToNextExercise}
              className="mt-5 w-full rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-slate-800 sm:w-auto dark:bg-emerald-400 dark:text-black dark:hover:bg-emerald-300"
            >
              {currentExerciseIndex >= totalExercises - 1 ? 'See results' : 'Continue'}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
