import { STORAGE_KEYS } from '../data/storageKeys';
import type { Course, ExerciseAnswer, Lesson, LessonType } from '../types/course';
import type {
  CourseProgress,
  IncorrectAnswerRecord,
  LessonProgress,
  ReviewAttemptRecord,
  UserStats,
  WeakConcept
} from '../types/progress';
import { removeItem, safeGetJSON, safeSetJSON } from './storageService';

interface ProgressStore {
  userStats: UserStats;
  courses: Record<string, CourseProgress>;
}

interface LessonPathItem {
  sectionIndex: number;
  unitIndex: number;
  lessonIndex: number;
  lesson: Lesson;
}

export interface LessonAttemptAnswer {
  exerciseId: string;
  prompt: string;
  isCorrect: boolean;
  userAnswer: ExerciseAnswer;
  correctAnswer: ExerciseAnswer;
  concept?: string;
  explanation?: string;
  sourceCourseId?: string;
  sourceLessonId?: string;
  sourceExerciseId?: string;
}

export interface LessonAttemptInput {
  course: Course;
  lessonId: string;
  answers: LessonAttemptAnswer[];
}

export interface ReviewAttemptSource {
  reviewExerciseId: string;
  courseId: string;
  lessonId: string;
  exerciseId: string;
}

export interface ReviewAttemptInput {
  sessionId: string;
  scopeCourseId?: string | null;
  answers: LessonAttemptAnswer[];
  sources: ReviewAttemptSource[];
}

export interface LessonAttemptSaveResult {
  courseProgress: CourseProgress;
  userStats: UserStats;
  correctCount: number;
  incorrectCount: number;
  scorePercentage: number;
  xpEarned: number;
  passed: boolean;
  newlyUnlockedLessons: string[];
}

const PASSING_SCORE = 70;
const XP_PER_CORRECT_ANSWER = 10;
const LESSON_COMPLETION_BONUS_XP = 25;
const PERFECT_LESSON_BONUS_XP = 50;
const REVIEW_COMPLETION_BONUS_XP = 15;

export const DEFAULT_USER_STATS: UserStats = {
  totalXP: 0,
  currentStreak: 0,
  longestStreak: 0,
  lastStudyDate: null,
  totalLessonsCompleted: 0,
  totalCoursesCreated: 0
};

function createId(prefix: string): string {
  const randomId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  return `${prefix}-${randomId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function normalizeScore(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)));
}

function normalizeExerciseAnswer(value: unknown): ExerciseAnswer {
  if (typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string').join(' • ');
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
}

function normalizeRecordOfNumbers(value: unknown): Record<string, number> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, number>>((result, [key, score]) => {
    if (typeof score === 'number' && Number.isFinite(score)) {
      result[key] = normalizeScore(score);
    }

    return result;
  }, {});
}

function normalizeLessonProgress(value: unknown, fallbackLessonId = ''): LessonProgress | null {
  if (!isRecord(value)) {
    return fallbackLessonId ? createEmptyLessonProgress(fallbackLessonId) : null;
  }

  const lessonId = asString(value.lessonId, fallbackLessonId);

  if (!lessonId) {
    return null;
  }

  return {
    lessonId,
    bestScore: normalizeScore(asNumber(value.bestScore)),
    attempts: Math.max(0, Math.round(asNumber(value.attempts))),
    completedAt: asNullableString(value.completedAt),
    lastAttemptAt: asNullableString(value.lastAttemptAt),
    passed: Boolean(value.passed)
  };
}

function normalizeRecordOfLessonProgress(value: unknown): Record<string, LessonProgress> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, LessonProgress>>((result, [lessonId, progress]) => {
    const normalizedProgress = normalizeLessonProgress(progress, lessonId);

    if (normalizedProgress) {
      result[lessonId] = normalizedProgress;
    }

    return result;
  }, {});
}

export function normalizeUserStats(value: unknown): UserStats {
  if (!isRecord(value)) {
    return { ...DEFAULT_USER_STATS };
  }

  const currentStreak = Math.max(0, Math.round(asNumber(value.currentStreak)));
  const longestStreak = Math.max(currentStreak, Math.round(asNumber(value.longestStreak)));

  return {
    totalXP: Math.max(0, Math.round(asNumber(value.totalXP))),
    currentStreak,
    longestStreak,
    lastStudyDate: asNullableString(value.lastStudyDate),
    totalLessonsCompleted: Math.max(0, Math.round(asNumber(value.totalLessonsCompleted))),
    totalCoursesCreated: Math.max(0, Math.round(asNumber(value.totalCoursesCreated)))
  };
}

function normalizeWeakConcept(value: unknown): WeakConcept | null {
  if (!isRecord(value)) {
    return null;
  }

  const concept = asString(value.concept);
  const lastMissedAt = asString(value.lastMissedAt);
  const misses = Math.max(0, Math.round(asNumber(value.misses, asNumber(value.missedCount))));

  if (!concept || !lastMissedAt) {
    return null;
  }

  return {
    concept,
    misses,
    lastMissedAt,
    reviewDueAt: typeof value.reviewDueAt === 'string' ? value.reviewDueAt : undefined,
    masteryScore: normalizeScore(asNumber(value.masteryScore, Math.max(0, 100 - misses * 15)))
  };
}

function normalizeIncorrectAnswer(value: unknown): IncorrectAnswerRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = asString(value.id, createId('miss'));
  const courseId = asString(value.courseId);
  const lessonId = asString(value.lessonId);
  const exerciseId = asString(value.exerciseId);
  const prompt = asString(value.prompt);
  const missedAt = asString(value.missedAt, asString(value.answeredAt));

  if (!id || !courseId || !lessonId || !exerciseId || !prompt || !missedAt) {
    return null;
  }

  return {
    id,
    courseId,
    lessonId,
    exerciseId,
    prompt,
    userAnswer: normalizeExerciseAnswer(value.userAnswer ?? value.submittedAnswer),
    correctAnswer: normalizeExerciseAnswer(value.correctAnswer),
    concept: typeof value.concept === 'string' ? value.concept : undefined,
    missedAt,
    explanation: typeof value.explanation === 'string' ? value.explanation : undefined
  };
}


function normalizeReviewAttempt(value: unknown, fallbackCourseId = ''): ReviewAttemptRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = asString(value.id, createId('review-attempt'));
  const courseId = asString(value.courseId, fallbackCourseId);
  const sessionId = asString(value.sessionId);
  const reviewedAt = asString(value.reviewedAt);

  if (!id || !courseId || !sessionId || !reviewedAt) {
    return null;
  }

  return {
    id,
    courseId,
    sessionId,
    scopeCourseId: asNullableString(value.scopeCourseId),
    sourceLessonIds: asStringArray(value.sourceLessonIds),
    exerciseIds: asStringArray(value.exerciseIds),
    scorePercentage: normalizeScore(asNumber(value.scorePercentage)),
    correctCount: Math.max(0, Math.round(asNumber(value.correctCount))),
    incorrectCount: Math.max(0, Math.round(asNumber(value.incorrectCount))),
    xpEarned: Math.max(0, Math.round(asNumber(value.xpEarned))),
    reviewedAt
  };
}

function createEmptyLessonProgress(lessonId: string): LessonProgress {
  return {
    lessonId,
    bestScore: 0,
    attempts: 0,
    completedAt: null,
    lastAttemptAt: null,
    passed: false
  };
}

export function createEmptyCourseProgress(courseId: string): CourseProgress {
  return {
    courseId,
    completedLessons: [],
    unlockedLessons: [],
    lessonScores: {},
    lessonProgress: {},
    weakConcepts: [],
    incorrectAnswers: [],
    lastStudiedAt: null,
    masteryScore: 0,
    xpEarned: 0,
    reviewAttempts: []
  };
}

export function normalizeCourseProgress(value: unknown, fallbackCourseId = ''): CourseProgress | null {
  if (!isRecord(value)) {
    return fallbackCourseId ? createEmptyCourseProgress(fallbackCourseId) : null;
  }

  const courseId = asString(value.courseId, fallbackCourseId);

  if (!courseId) {
    return null;
  }

  const lessonScores = normalizeRecordOfNumbers(value.lessonScores);
  const lessonProgress = normalizeRecordOfLessonProgress(value.lessonProgress);

  Object.entries(lessonScores).forEach(([lessonId, score]) => {
    if (!lessonProgress[lessonId]) {
      lessonProgress[lessonId] = {
        ...createEmptyLessonProgress(lessonId),
        bestScore: score,
        passed: score >= PASSING_SCORE
      };
    }
  });

  return {
    courseId,
    completedLessons: asStringArray(value.completedLessons),
    unlockedLessons: asStringArray(value.unlockedLessons),
    lessonScores,
    lessonProgress,
    weakConcepts: Array.isArray(value.weakConcepts)
      ? value.weakConcepts
          .map(normalizeWeakConcept)
          .filter((concept): concept is WeakConcept => concept !== null)
      : [],
    incorrectAnswers: Array.isArray(value.incorrectAnswers)
      ? value.incorrectAnswers
          .map(normalizeIncorrectAnswer)
          .filter((answer): answer is IncorrectAnswerRecord => answer !== null)
      : [],
    lastStudiedAt: asNullableString(value.lastStudiedAt),
    masteryScore: normalizeScore(asNumber(value.masteryScore)),
    xpEarned: Math.max(0, Math.round(asNumber(value.xpEarned))),
    reviewAttempts: Array.isArray(value.reviewAttempts)
      ? value.reviewAttempts
          .map((attempt) => normalizeReviewAttempt(attempt, courseId))
          .filter((attempt): attempt is ReviewAttemptRecord => attempt !== null)
      : []
  };
}

function normalizeProgressStore(value: unknown): ProgressStore {
  if (!isRecord(value)) {
    return {
      userStats: { ...DEFAULT_USER_STATS },
      courses: {}
    };
  }

  const storedStats = value.userStats;
  const storedCourses = value.courses;

  const courses = isRecord(storedCourses)
    ? Object.entries(storedCourses).reduce<Record<string, CourseProgress>>(
        (result, [courseId, progress]) => {
          const normalizedProgress = normalizeCourseProgress(progress, courseId);

          if (normalizedProgress) {
            result[courseId] = normalizedProgress;
          }

          return result;
        },
        {}
      )
    : {};

  return {
    userStats: normalizeUserStats(storedStats),
    courses
  };
}

function getProgressStore(): ProgressStore {
  return normalizeProgressStore(safeGetJSON<unknown>(STORAGE_KEYS.progress, {}));
}

function saveProgressStore(store: ProgressStore): boolean {
  return safeSetJSON(STORAGE_KEYS.progress, normalizeProgressStore(store));
}

function dateKeyFromDate(date: Date): string {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function todayDateKey(): string {
  return dateKeyFromDate(new Date());
}

function dateKeyFromISO(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return dateKeyFromDate(date);
}

function getDaysBetween(dateKeyA: string, dateKeyB: string): number {
  const oneDayMs = 24 * 60 * 60 * 1000;
  const dateA = new Date(`${dateKeyA}T00:00:00.000Z`).getTime();
  const dateB = new Date(`${dateKeyB}T00:00:00.000Z`).getTime();

  if (!Number.isFinite(dateA) || !Number.isFinite(dateB)) {
    return 0;
  }

  return Math.round((dateB - dateA) / oneDayMs);
}

function updateStudyStreak(stats: UserStats, studiedAt: string): UserStats {
  const today = todayDateKey();
  const lastStudyDate = dateKeyFromISO(stats.lastStudyDate);

  if (lastStudyDate === today) {
    return {
      ...stats,
      lastStudyDate: studiedAt
    };
  }

  const daysSinceLastStudy = lastStudyDate ? getDaysBetween(lastStudyDate, today) : null;
  const currentStreak = daysSinceLastStudy === 1 ? stats.currentStreak + 1 : 1;

  return {
    ...stats,
    currentStreak,
    longestStreak: Math.max(stats.longestStreak, currentStreak),
    lastStudyDate: studiedAt
  };
}

function calculateMasteryScore(progress: CourseProgress): number {
  const scores = Object.values(progress.lessonScores);

  if (scores.length === 0) {
    return 0;
  }

  const averageScore = scores.reduce((total, score) => total + score, 0) / scores.length;
  return normalizeScore(averageScore);
}

function getLessonPath(course: Course): LessonPathItem[] {
  return course.units.flatMap((unit, unitIndex) =>
    unit.sections.flatMap((section, sectionIndex) =>
      section.lessons.map((lesson, lessonIndex) => ({
        sectionIndex,
        unitIndex,
        lessonIndex,
        lesson
      }))
    )
  );
}

function getLessonIds(course: Course): string[] {
  return getLessonPath(course).map(({ lesson }) => lesson.id);
}

function getFirstLessonId(course: Course): string | undefined {
  return getLessonIds(course)[0];
}

function findLessonPathItem(course: Course, lessonId: string): LessonPathItem | null {
  return getLessonPath(course).find(({ lesson }) => lesson.id === lessonId) ?? null;
}

function findNextLesson(course: Course, currentLessonId: string): LessonPathItem | null {
  const path = getLessonPath(course);
  const currentIndex = path.findIndex(({ lesson }) => lesson.id === currentLessonId);

  if (currentIndex < 0) {
    return null;
  }

  return path[currentIndex + 1] ?? null;
}

function findFirstLessonOfNextSection(course: Course, item: LessonPathItem): LessonPathItem | null {
  const currentUnit = course.units[item.unitIndex];
  const nextSection = currentUnit?.sections[item.sectionIndex + 1];

  if (nextSection?.lessons[0]) {
    return {
      unitIndex: item.unitIndex,
      sectionIndex: item.sectionIndex + 1,
      lessonIndex: 0,
      lesson: nextSection.lessons[0]
    };
  }

  const nextUnit = course.units[item.unitIndex + 1];
  const firstSection = nextUnit?.sections[0];

  if (firstSection?.lessons[0]) {
    return {
      unitIndex: item.unitIndex + 1,
      sectionIndex: 0,
      lessonIndex: 0,
      lesson: firstSection.lessons[0]
    };
  }

  return null;
}

function areSectionLessonsBeforeReviewComplete(course: Course, item: LessonPathItem, completedLessons: Set<string>): boolean {
  const section = course.units[item.unitIndex]?.sections[item.sectionIndex];

  if (!section) {
    return false;
  }

  const reviewIndex = section.lessons.findIndex((lesson) => lesson.type === 'review');

  if (reviewIndex < 0) {
    return false;
  }

  return section.lessons
    .slice(0, reviewIndex)
    .every((lesson) => lesson.type === 'review' || completedLessons.has(lesson.id));
}

function getUnlockedLessonIdsAfterPassing(
  course: Course,
  completedLessonIds: string[],
  existingUnlockedLessonIds: string[]
): string[] {
  const unlockedLessons = new Set(existingUnlockedLessonIds);
  const completedLessons = new Set(completedLessonIds);
  const firstLessonId = getFirstLessonId(course);

  if (firstLessonId) {
    unlockedLessons.add(firstLessonId);
  }

  getLessonPath(course).forEach((item) => {
    if (!completedLessons.has(item.lesson.id)) {
      return;
    }

    if (item.lesson.type === 'review') {
      const nextSectionLesson = findFirstLessonOfNextSection(course, item);

      if (nextSectionLesson) {
        unlockedLessons.add(nextSectionLesson.lesson.id);
      }

      return;
    }

    const nextLesson = findNextLesson(course, item.lesson.id);

    if (!nextLesson) {
      return;
    }

    if (nextLesson.lesson.type === 'review') {
      if (areSectionLessonsBeforeReviewComplete(course, nextLesson, completedLessons)) {
        unlockedLessons.add(nextLesson.lesson.id);
      }

      return;
    }

    unlockedLessons.add(nextLesson.lesson.id);
  });

  return Array.from(unlockedLessons);
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function updateWeakConcepts(
  existingWeakConcepts: WeakConcept[],
  incorrectAnswers: LessonAttemptAnswer[],
  missedAt: string
): WeakConcept[] {
  const weakConceptMap = new Map(existingWeakConcepts.map((concept) => [concept.concept, concept]));

  incorrectAnswers.forEach((answer) => {
    if (!answer.concept) {
      return;
    }

    const existingConcept = weakConceptMap.get(answer.concept);
    const misses = (existingConcept?.misses ?? 0) + 1;

    weakConceptMap.set(answer.concept, {
      concept: answer.concept,
      misses,
      lastMissedAt: missedAt,
      reviewDueAt: addDays(new Date(missedAt), Math.min(7, Math.max(1, misses))).toISOString(),
      masteryScore: normalizeScore(Math.max(0, 100 - misses * 15))
    });
  });

  return Array.from(weakConceptMap.values()).sort((a, b) => b.misses - a.misses || a.concept.localeCompare(b.concept));
}

function createIncorrectAnswerRecord(
  courseId: string,
  lessonId: string,
  answer: LessonAttemptAnswer,
  missedAt: string
): IncorrectAnswerRecord {
  return {
    id: createId('miss'),
    courseId,
    lessonId,
    exerciseId: answer.exerciseId,
    prompt: answer.prompt,
    userAnswer: answer.userAnswer,
    correctAnswer: answer.correctAnswer,
    concept: answer.concept,
    missedAt,
    explanation: answer.explanation
  };
}

function createInitialCourseProgress(course: Course): CourseProgress {
  const firstLessonId = getFirstLessonId(course);

  return {
    ...createEmptyCourseProgress(course.id),
    unlockedLessons: firstLessonId ? [firstLessonId] : []
  };
}

function ensureCourseProgress(course: Course, store: ProgressStore): CourseProgress {
  const existingProgress = store.courses[course.id] ?? createInitialCourseProgress(course);
  const firstLessonId = getFirstLessonId(course);

  if (firstLessonId && !existingProgress.unlockedLessons.includes(firstLessonId)) {
    return {
      ...existingProgress,
      unlockedLessons: [firstLessonId, ...existingProgress.unlockedLessons]
    };
  }

  return existingProgress;
}

export function calculateLessonXP(
  correctCount: number,
  totalExercises: number,
  lessonType: LessonType,
  passed: boolean
): number {
  let xp = Math.max(0, correctCount) * XP_PER_CORRECT_ANSWER;

  if (!passed) {
    return xp;
  }

  xp += LESSON_COMPLETION_BONUS_XP;

  if (totalExercises > 0 && correctCount === totalExercises) {
    xp += PERFECT_LESSON_BONUS_XP;
  }

  if (lessonType === 'review') {
    xp += REVIEW_COMPLETION_BONUS_XP;
  }

  return xp;
}


export function getProgressData(): ProgressStore {
  return getProgressStore();
}

export function saveProgressData(progressData: unknown): boolean {
  return saveProgressStore(normalizeProgressStore(progressData));
}

export function getUserStats(): UserStats {
  return getProgressStore().userStats;
}

export function saveUserStats(stats: UserStats): boolean {
  const store = getProgressStore();
  store.userStats = normalizeUserStats(stats);
  return saveProgressStore(store);
}

export function getCourseProgress(courseId: string): CourseProgress | null {
  return getProgressStore().courses[courseId] ?? null;
}

export function saveCourseProgress(courseId: string, progress: CourseProgress): boolean {
  const normalizedProgress = normalizeCourseProgress(progress, courseId);

  if (!normalizedProgress) {
    return false;
  }

  const store = getProgressStore();
  store.courses[courseId] = {
    ...normalizedProgress,
    courseId
  };

  return saveProgressStore(store);
}

export function initializeCourseProgress(course: Course): CourseProgress {
  const progress = createInitialCourseProgress(course);
  const store = getProgressStore();
  store.courses[course.id] = progress;
  store.userStats = {
    ...store.userStats,
    totalCoursesCreated: store.userStats.totalCoursesCreated + 1
  };
  saveProgressStore(store);

  return progress;
}

export function recordLessonAttempt({
  course,
  lessonId,
  answers
}: LessonAttemptInput): LessonAttemptSaveResult {
  const store = getProgressStore();
  const existingProgress = ensureCourseProgress(course, store);
  const lesson = findLessonPathItem(course, lessonId)?.lesson;
  const totalExercises = lesson?.exercises.length ?? answers.length;
  const correctCount = answers.filter((answer) => answer.isCorrect).length;
  const incorrectCount = Math.max(0, totalExercises - correctCount);
  const scorePercentage = totalExercises > 0 ? normalizeScore((correctCount / totalExercises) * 100) : 0;
  const passed = scorePercentage >= PASSING_SCORE;
  const xpEarned = calculateLessonXP(correctCount, totalExercises, lesson?.type ?? 'standard', passed);
  const now = new Date().toISOString();
  const previousLessonProgress = existingProgress.lessonProgress[lessonId] ?? createEmptyLessonProgress(lessonId);
  const completedBeforeAttempt = existingProgress.completedLessons.includes(lessonId);
  const nextCompletedLessons =
    passed && !completedBeforeAttempt
      ? [...existingProgress.completedLessons, lessonId]
      : existingProgress.completedLessons;
  const nextUnlockedLessons = passed
    ? getUnlockedLessonIdsAfterPassing(course, nextCompletedLessons, existingProgress.unlockedLessons)
    : getUnlockedLessonIdsAfterPassing(course, existingProgress.completedLessons, existingProgress.unlockedLessons);
  const incorrectAttemptAnswers = answers.filter((answer) => !answer.isCorrect);
  const incorrectAnswerRecords = incorrectAttemptAnswers.map((answer) =>
    createIncorrectAnswerRecord(course.id, lessonId, answer, now)
  );
  const nextLessonProgress: LessonProgress = {
    lessonId,
    bestScore: Math.max(previousLessonProgress.bestScore, scorePercentage),
    attempts: previousLessonProgress.attempts + 1,
    completedAt: passed ? previousLessonProgress.completedAt ?? now : previousLessonProgress.completedAt,
    lastAttemptAt: now,
    passed: previousLessonProgress.passed || passed
  };

  const nextProgress: CourseProgress = {
    ...existingProgress,
    completedLessons: Array.from(new Set(nextCompletedLessons)),
    unlockedLessons: Array.from(new Set(nextUnlockedLessons)),
    lessonScores: {
      ...existingProgress.lessonScores,
      [lessonId]: Math.max(existingProgress.lessonScores[lessonId] ?? 0, scorePercentage)
    },
    lessonProgress: {
      ...existingProgress.lessonProgress,
      [lessonId]: nextLessonProgress
    },
    weakConcepts: updateWeakConcepts(existingProgress.weakConcepts, incorrectAttemptAnswers, now),
    incorrectAnswers: [...existingProgress.incorrectAnswers, ...incorrectAnswerRecords],
    lastStudiedAt: now,
    xpEarned: existingProgress.xpEarned + xpEarned,
    masteryScore: existingProgress.masteryScore
  };
  nextProgress.masteryScore = calculateMasteryScore(nextProgress);

  const nextStats = updateStudyStreak(
    {
      ...store.userStats,
      totalXP: store.userStats.totalXP + xpEarned,
      totalLessonsCompleted:
        passed && !completedBeforeAttempt
          ? store.userStats.totalLessonsCompleted + 1
          : store.userStats.totalLessonsCompleted
    },
    now
  );

  store.userStats = nextStats;
  store.courses[course.id] = nextProgress;
  saveProgressStore(store);

  return {
    courseProgress: nextProgress,
    userStats: nextStats,
    correctCount,
    incorrectCount,
    scorePercentage,
    xpEarned,
    passed,
    newlyUnlockedLessons: nextProgress.unlockedLessons.filter(
      (lesson) => !existingProgress.unlockedLessons.includes(lesson)
    )
  };
}


function getReviewSourceMap(sources: ReviewAttemptSource[]): Map<string, ReviewAttemptSource> {
  return new Map(sources.map((source) => [source.reviewExerciseId, source]));
}

function groupReviewAnswersByCourse(
  answers: LessonAttemptAnswer[],
  sources: ReviewAttemptSource[]
): Map<string, LessonAttemptAnswer[]> {
  const sourceMap = getReviewSourceMap(sources);
  const answersByCourse = new Map<string, LessonAttemptAnswer[]>();

  answers.forEach((answer) => {
    const source = sourceMap.get(answer.exerciseId);
    const courseId = answer.sourceCourseId ?? source?.courseId;
    const lessonId = answer.sourceLessonId ?? source?.lessonId;
    const exerciseId = answer.sourceExerciseId ?? source?.exerciseId;

    if (!courseId || !lessonId || !exerciseId) {
      return;
    }

    const sourceAnswer: LessonAttemptAnswer = {
      ...answer,
      sourceCourseId: courseId,
      sourceLessonId: lessonId,
      sourceExerciseId: exerciseId
    };

    answersByCourse.set(courseId, [...(answersByCourse.get(courseId) ?? []), sourceAnswer]);
  });

  return answersByCourse;
}

function allocateReviewXP(totalXP: number, answersByCourse: Map<string, LessonAttemptAnswer[]>): Map<string, number> {
  const totalAnswers = Array.from(answersByCourse.values()).reduce((total, answers) => total + answers.length, 0);
  const courseIds = Array.from(answersByCourse.keys());
  const allocatedXP = new Map<string, number>();
  let remainingXP = totalXP;

  courseIds.forEach((courseId, index) => {
    const courseAnswerCount = answersByCourse.get(courseId)?.length ?? 0;
    const xpForCourse =
      index === courseIds.length - 1
        ? remainingXP
        : Math.round(totalAnswers > 0 ? (totalXP * courseAnswerCount) / totalAnswers : 0);

    allocatedXP.set(courseId, Math.max(0, xpForCourse));
    remainingXP -= xpForCourse;
  });

  return allocatedXP;
}

function createReviewIncorrectAnswerRecord(
  courseId: string,
  answer: LessonAttemptAnswer,
  missedAt: string
): IncorrectAnswerRecord {
  return {
    id: createId('miss'),
    courseId,
    lessonId: answer.sourceLessonId ?? answer.exerciseId,
    exerciseId: answer.sourceExerciseId ?? answer.exerciseId,
    prompt: answer.prompt,
    userAnswer: answer.userAnswer,
    correctAnswer: answer.correctAnswer,
    concept: answer.concept,
    missedAt,
    explanation: answer.explanation
  };
}

function createReviewAttemptRecord(
  courseId: string,
  input: ReviewAttemptInput,
  answers: LessonAttemptAnswer[],
  xpEarned: number,
  correctCount: number,
  incorrectCount: number,
  scorePercentage: number,
  reviewedAt: string
): ReviewAttemptRecord {
  return {
    id: createId('review-attempt'),
    courseId,
    sessionId: input.sessionId,
    scopeCourseId: input.scopeCourseId ?? null,
    sourceLessonIds: Array.from(new Set(answers.map((answer) => answer.sourceLessonId).filter(Boolean) as string[])),
    exerciseIds: Array.from(new Set(answers.map((answer) => answer.sourceExerciseId).filter(Boolean) as string[])),
    scorePercentage,
    correctCount,
    incorrectCount,
    xpEarned,
    reviewedAt
  };
}

export function recordReviewAttempt(input: ReviewAttemptInput): LessonAttemptSaveResult {
  const store = getProgressStore();
  const totalExercises = input.answers.length;
  const correctCount = input.answers.filter((answer) => answer.isCorrect).length;
  const incorrectCount = Math.max(0, totalExercises - correctCount);
  const scorePercentage = totalExercises > 0 ? normalizeScore((correctCount / totalExercises) * 100) : 0;
  const passed = scorePercentage >= PASSING_SCORE;
  const xpEarned = calculateLessonXP(correctCount, totalExercises, 'review', passed);
  const now = new Date().toISOString();
  const answersByCourse = groupReviewAnswersByCourse(input.answers, input.sources);
  const xpByCourse = allocateReviewXP(xpEarned, answersByCourse);
  let firstUpdatedProgress: CourseProgress | null = null;

  answersByCourse.forEach((courseAnswers, courseId) => {
    const existingProgress = store.courses[courseId] ?? createEmptyCourseProgress(courseId);
    const incorrectAttemptAnswers = courseAnswers.filter((answer) => !answer.isCorrect);
    const incorrectAnswerRecords = incorrectAttemptAnswers.map((answer) =>
      createReviewIncorrectAnswerRecord(courseId, answer, now)
    );
    const courseXPEarned = xpByCourse.get(courseId) ?? 0;
    const reviewAttemptRecord = createReviewAttemptRecord(
      courseId,
      input,
      courseAnswers,
      courseXPEarned,
      courseAnswers.filter((answer) => answer.isCorrect).length,
      incorrectAttemptAnswers.length,
      scorePercentage,
      now
    );

    const nextProgress: CourseProgress = {
      ...existingProgress,
      weakConcepts: updateWeakConcepts(existingProgress.weakConcepts, incorrectAttemptAnswers, now),
      incorrectAnswers: [...existingProgress.incorrectAnswers, ...incorrectAnswerRecords],
      lastStudiedAt: now,
      xpEarned: existingProgress.xpEarned + courseXPEarned,
      reviewAttempts: [...existingProgress.reviewAttempts, reviewAttemptRecord]
    };
    nextProgress.masteryScore = calculateMasteryScore(nextProgress);

    store.courses[courseId] = nextProgress;
    if (!firstUpdatedProgress || input.scopeCourseId === courseId) {
      firstUpdatedProgress = nextProgress;
    }
  });

  const nextStats = updateStudyStreak(
    {
      ...store.userStats,
      totalXP: store.userStats.totalXP + xpEarned
    },
    now
  );

  store.userStats = nextStats;
  saveProgressStore(store);

  return {
    courseProgress: firstUpdatedProgress ?? createEmptyCourseProgress(input.scopeCourseId ?? 'review'),
    userStats: nextStats,
    correctCount,
    incorrectCount,
    scorePercentage,
    xpEarned,
    passed,
    newlyUnlockedLessons: []
  };
}

export function markLessonComplete(courseId: string, lessonId: string, score: number): CourseProgress {
  const store = getProgressStore();
  const existingProgress = store.courses[courseId] ?? createEmptyCourseProgress(courseId);
  const normalizedScore = normalizeScore(score);
  const wasAlreadyCompleted = existingProgress.completedLessons.includes(lessonId);
  const completedLessons =
    normalizedScore >= PASSING_SCORE && !wasAlreadyCompleted
      ? [...existingProgress.completedLessons, lessonId]
      : existingProgress.completedLessons;
  const now = new Date().toISOString();
  const previousLessonProgress = existingProgress.lessonProgress[lessonId] ?? createEmptyLessonProgress(lessonId);

  const nextProgress: CourseProgress = {
    ...existingProgress,
    completedLessons,
    unlockedLessons: Array.from(new Set([...existingProgress.unlockedLessons, lessonId])),
    lessonScores: {
      ...existingProgress.lessonScores,
      [lessonId]: Math.max(existingProgress.lessonScores[lessonId] ?? 0, normalizedScore)
    },
    lessonProgress: {
      ...existingProgress.lessonProgress,
      [lessonId]: {
        lessonId,
        bestScore: Math.max(previousLessonProgress.bestScore, normalizedScore),
        attempts: previousLessonProgress.attempts + 1,
        completedAt:
          normalizedScore >= PASSING_SCORE
            ? previousLessonProgress.completedAt ?? now
            : previousLessonProgress.completedAt,
        lastAttemptAt: now,
        passed: previousLessonProgress.passed || normalizedScore >= PASSING_SCORE
      }
    },
    lastStudiedAt: now
  };
  nextProgress.masteryScore = calculateMasteryScore(nextProgress);

  store.courses[courseId] = nextProgress;
  store.userStats = updateStudyStreak(store.userStats, now);
  saveProgressStore(store);
  return nextProgress;
}

export function unlockLesson(courseId: string, lessonId: string): CourseProgress {
  const store = getProgressStore();
  const existingProgress = store.courses[courseId] ?? createEmptyCourseProgress(courseId);
  const nextProgress: CourseProgress = {
    ...existingProgress,
    unlockedLessons: Array.from(new Set([...existingProgress.unlockedLessons, lessonId]))
  };

  store.courses[courseId] = nextProgress;
  saveProgressStore(store);
  return nextProgress;
}

export function resetCourseProgress(courseId: string): boolean {
  const store = getProgressStore();
  delete store.courses[courseId];
  return saveProgressStore(store);
}

export function deleteAllProgress(): boolean {
  return removeItem(STORAGE_KEYS.progress);
}
