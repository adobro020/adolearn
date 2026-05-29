/**
 * User-selectable course generation preferences and app settings.
 * These settings are stored locally in the browser; API secrets stay on the server.
 */
export type Difficulty = 'Auto' | 'Beginner' | 'Intermediate' | 'Advanced';

export type CourseStyle =
  | 'Exam prep'
  | 'Quick overview'
  | 'Deep learning'
  | 'Flashcard-heavy';

export type LessonLength = 'Short' | 'Medium' | 'Long';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface AppSettings {
  modelName: string;
  theme: ThemePreference;
  preferredDifficulty: Difficulty;
  preferredCourseStyle: CourseStyle;
  preferredLessonLength: LessonLength;
  dailyGoalMinutes: number;
  soundEffectsEnabled: boolean;
  remindersEnabled: boolean;
}
