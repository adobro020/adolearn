export const STORAGE_KEYS = {
  courses: 'adolearn_courses',
  progress: 'adolearn_progress',
  settings: 'adolearn_settings'
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
