/**
 * User-selectable course generation preferences and app settings.
 * These are plain type definitions only; persistence lives in src/services.
 */
export type Difficulty = 'Auto' | 'Beginner' | 'Intermediate' | 'Advanced';

export type CourseStyle =
  | 'Exam prep'
  | 'Quick overview'
  | 'Deep learning'
  | 'Flashcard-heavy';

export type LessonLength = 'Short' | 'Medium' | 'Long';

export type ThemePreference = 'system' | 'light' | 'dark';

export type GenerationMode = 'mock' | 'api' | 'vercel_proxy';

export interface AppSettings {
  modelName: string;
  apiKey: string;
  theme: ThemePreference;
  generationMode: GenerationMode;
  preferredDifficulty: Difficulty;
  preferredCourseStyle: CourseStyle;
  preferredLessonLength: LessonLength;
  dailyGoalMinutes: number;
  soundEffectsEnabled: boolean;
  remindersEnabled: boolean;
}
