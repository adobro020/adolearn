/**
 * User-selectable course generation preferences and app settings.
 * These settings are stored locally in the browser; API secrets live only in Vercel env vars.
 */
export type Difficulty = 'Auto' | 'Beginner' | 'Intermediate' | 'Advanced';

export type CourseStyle =
  | 'Exam prep'
  | 'Quick overview'
  | 'Deep learning'
  | 'Flashcard-heavy';

export type LessonLength = 'Short' | 'Medium' | 'Long';

export type ThemePreference = 'system' | 'light' | 'dark';

export type GenerationMode = 'mock' | 'vercel_proxy';

export interface AppSettings {
  modelName: string;
  theme: ThemePreference;
  generationMode: GenerationMode;
  preferredDifficulty: Difficulty;
  preferredCourseStyle: CourseStyle;
  preferredLessonLength: LessonLength;
  dailyGoalMinutes: number;
  soundEffectsEnabled: boolean;
  remindersEnabled: boolean;
}
