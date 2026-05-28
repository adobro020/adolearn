import type { ExerciseAnswer, ISODateString } from './course';

export interface UserStats {
  totalXP: number;
  currentStreak: number;
  longestStreak: number;
  lastStudyDate: ISODateString | null;
  totalLessonsCompleted: number;
  totalCoursesCreated: number;
}

export interface CourseProgress {
  courseId: string;
  completedLessons: string[];
  unlockedLessons: string[];
  lessonScores: Record<string, number>;
  lessonProgress: Record<string, LessonProgress>;
  weakConcepts: WeakConcept[];
  incorrectAnswers: IncorrectAnswerRecord[];
  lastStudiedAt: ISODateString | null;
  masteryScore: number;
  xpEarned: number;
  reviewAttempts: ReviewAttemptRecord[];
}

export interface ReviewAttemptRecord {
  id: string;
  courseId: string;
  sessionId: string;
  scopeCourseId: string | null;
  sourceLessonIds: string[];
  exerciseIds: string[];
  scorePercentage: number;
  correctCount: number;
  incorrectCount: number;
  xpEarned: number;
  reviewedAt: ISODateString;
}

export interface LessonProgress {
  lessonId: string;
  bestScore: number;
  attempts: number;
  completedAt: ISODateString | null;
  lastAttemptAt: ISODateString | null;
  passed: boolean;
}

export interface WeakConcept {
  concept: string;
  misses: number;
  lastMissedAt: ISODateString;
  reviewDueAt?: ISODateString;
  masteryScore: number;
}

export interface IncorrectAnswerRecord {
  id: string;
  courseId: string;
  lessonId: string;
  exerciseId: string;
  prompt: string;
  userAnswer: ExerciseAnswer;
  correctAnswer: ExerciseAnswer;
  concept?: string;
  missedAt: ISODateString;
  explanation?: string;
}
