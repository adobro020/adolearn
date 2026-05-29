import { STORAGE_KEYS } from '../data/storageKeys';
import type {
  AppSettings,
  CourseStyle,
  Difficulty,
  LessonLength,
  ThemePreference
} from '../types/settings';
import { removeItem, safeGetJSON, safeSetJSON } from './storageService';

const MODEL_VALUES = ['gpt-5-nano', 'gpt-5-mini', 'gpt-5'] as const;

export const DEFAULT_SETTINGS: AppSettings = {
  modelName: 'gpt-5-mini',
  theme: 'system',
  preferredDifficulty: 'Auto',
  preferredCourseStyle: 'Quick overview',
  preferredLessonLength: 'Medium',
  dailyGoalMinutes: 10,
  soundEffectsEnabled: true,
  remindersEnabled: false
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(value: unknown, allowedValues: readonly T[]): value is T {
  return typeof value === 'string' && allowedValues.includes(value as T);
}

function asNonEmptyString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function normalizeSettings(value: unknown): AppSettings {
  if (!isRecord(value)) {
    return { ...DEFAULT_SETTINGS };
  }

  const difficultyValues: readonly Difficulty[] = [
    'Auto',
    'Beginner',
    'Intermediate',
    'Advanced'
  ];
  const courseStyleValues: readonly CourseStyle[] = [
    'Exam prep',
    'Quick overview',
    'Deep learning',
    'Flashcard-heavy'
  ];
  const lessonLengthValues: readonly LessonLength[] = ['Short', 'Medium', 'Long'];
  const themeValues: readonly ThemePreference[] = ['system', 'light', 'dark'];

  return {
    modelName: isOneOf(value.modelName, MODEL_VALUES) ? value.modelName : DEFAULT_SETTINGS.modelName,
    theme: isOneOf(value.theme, themeValues) ? value.theme : DEFAULT_SETTINGS.theme,
    preferredDifficulty: isOneOf(value.preferredDifficulty, difficultyValues)
      ? value.preferredDifficulty
      : DEFAULT_SETTINGS.preferredDifficulty,
    preferredCourseStyle: isOneOf(value.preferredCourseStyle, courseStyleValues)
      ? value.preferredCourseStyle
      : DEFAULT_SETTINGS.preferredCourseStyle,
    preferredLessonLength: isOneOf(value.preferredLessonLength, lessonLengthValues)
      ? value.preferredLessonLength
      : DEFAULT_SETTINGS.preferredLessonLength,
    dailyGoalMinutes: Math.max(
      0,
      asNumber(value.dailyGoalMinutes, DEFAULT_SETTINGS.dailyGoalMinutes)
    ),
    soundEffectsEnabled: asBoolean(
      value.soundEffectsEnabled,
      DEFAULT_SETTINGS.soundEffectsEnabled
    ),
    remindersEnabled: asBoolean(value.remindersEnabled, DEFAULT_SETTINGS.remindersEnabled)
  };
}

export function getSettings(): AppSettings {
  const storedSettings = safeGetJSON<unknown>(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
  const normalizedSettings = normalizeSettings(storedSettings);

  // Rewrite older settings without legacy secret fields or retired generation modes.
  if (
    isRecord(storedSettings) &&
    ('apiKey' in storedSettings || 'generationMode' in storedSettings)
  ) {
    safeSetJSON(STORAGE_KEYS.settings, normalizedSettings);
  }

  return normalizedSettings;
}

function notifySettingsChanged(settings: AppSettings): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent('adolearn-settings-changed', { detail: settings }));
}

export function saveSettings(settings: AppSettings): boolean {
  const normalized = normalizeSettings(settings);
  const saved = safeSetJSON(STORAGE_KEYS.settings, normalized);

  if (saved) {
    notifySettingsChanged(normalized);
  }

  return saved;
}

export function resetSettings(): AppSettings {
  removeItem(STORAGE_KEYS.settings);
  const defaults = { ...DEFAULT_SETTINGS };
  notifySettingsChanged(defaults);
  return defaults;
}
