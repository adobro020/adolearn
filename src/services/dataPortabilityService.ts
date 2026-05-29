import { STORAGE_KEYS } from '../data/storageKeys';
import type { Course } from '../types/course';
import type { CourseProgress, UserStats } from '../types/progress';
import type { AppSettings } from '../types/settings';
import { normalizeCourse } from './courseService';
import { normalizeCourseProgress, normalizeUserStats } from './progressService';
import { DEFAULT_SETTINGS, normalizeSettings } from './settingsService';
import { safeSetJSON } from './storageService';

export interface ProgressExportData {
  userStats: UserStats;
  courses: Record<string, CourseProgress>;
}

export interface AdoLearnExportData {
  app: 'AdoLearn';
  version: 1;
  exportedAt: string;
  data: {
    courses: Course[];
    progress: ProgressExportData;
    settings: AppSettings;
  };
}

export interface ImportValidationResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

interface IdRewriteMap {
  courses: Map<string, string>;
  sections: Map<string, string>;
  units: Map<string, string>;
  lessons: Map<string, string>;
  exercises: Map<string, string>;
  choices: Map<string, string>;
}

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

function parseJSON(rawJSON: string): ImportValidationResult<unknown> {
  try {
    return { ok: true, data: JSON.parse(rawJSON) as unknown };
  } catch {
    return {
      ok: false,
      error: 'That file is not valid JSON. Please choose an AdoLearn export or course JSON file.'
    };
  }
}

function getExportPayload(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }

  if (isRecord(value.data)) {
    return value.data;
  }

  return value;
}

function getStringId(value: unknown, fallbackPrefix: string, rewriteMap: Map<string, string>): string {
  const originalId = typeof value === 'string' && value.trim() ? value : '';

  if (!originalId) {
    return createId(fallbackPrefix);
  }

  const replacementId = createId(fallbackPrefix);
  rewriteMap.set(originalId, replacementId);
  return replacementId;
}

function rewriteCourseIds(course: Course, forcedCourseId?: string): Course {
  const rewrites: IdRewriteMap = {
    courses: new Map(),
    sections: new Map(),
    units: new Map(),
    lessons: new Map(),
    exercises: new Map(),
    choices: new Map(),
  };
  const nextCourseId = forcedCourseId ?? getStringId(course.id, 'course', rewrites.courses);

  return {
    ...course,
    id: nextCourseId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    units: course.units.map((unit) => ({
      ...unit,
      id: getStringId(unit.id, 'unit', rewrites.units),
      sections: unit.sections.map((section) => ({
        ...section,
        id: getStringId(section.id, 'section', rewrites.sections),
        lessons: section.lessons.map((lesson) => ({
          ...lesson,
          id: getStringId(lesson.id, 'lesson', rewrites.lessons),
          exercises: lesson.exercises.map((exercise) => ({
            ...exercise,
            id: getStringId(exercise.id, 'exercise', rewrites.exercises),
            choices: exercise.choices?.map((choice) => ({
              ...choice,
              id: getStringId(choice.id, 'choice', rewrites.choices)
            }))
          }))
        }))
      }))
    }))
  };
}

function needsNewCourseId(course: Course, existingCourseIds: Set<string>): boolean {
  return !course.id || existingCourseIds.has(course.id);
}

function normalizeImportedCourse(value: unknown, existingCourseIds: Set<string>): Course | null {
  const normalizedCourse = normalizeCourse(value);

  if (!normalizedCourse) {
    return null;
  }

  if (needsNewCourseId(normalizedCourse, existingCourseIds)) {
    return {
      ...normalizedCourse,
      id: createId('course'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  return normalizedCourse;
}

function normalizeImportedCourseWithFreshIds(value: unknown, existingCourseIds: Set<string>): Course | null {
  const normalizedCourse = normalizeCourse(value);

  if (!normalizedCourse) {
    return null;
  }

  if (!needsNewCourseId(normalizedCourse, existingCourseIds)) {
    return normalizedCourse;
  }

  return {
    ...normalizedCourse,
    id: createId('course'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function normalizeCoursesList(value: unknown, existingCourseIds: Set<string>, forceFreshIds = false): Course[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const importedCourses = value
    .map((course) =>
      forceFreshIds
        ? normalizeImportedCourseWithFreshIds(course, existingCourseIds)
        : normalizeImportedCourse(course, existingCourseIds)
    )
    .filter((course): course is Course => course !== null);

  return importedCourses.length === value.length ? importedCourses : null;
}

function normalizeProgressImport(value: unknown, courseIds: Set<string>): ProgressExportData | null {
  if (!isRecord(value)) {
    return null;
  }

  const rawCourses = value.courses;

  if (!isRecord(rawCourses)) {
    return null;
  }

  const courseProgressEntries = Object.entries(rawCourses);

  if (courseProgressEntries.some(([courseId]) => !courseIds.has(courseId))) {
    return null;
  }

  const courses = courseProgressEntries.reduce<Record<string, CourseProgress>>(
    (result, [courseId, progress]) => {
      const normalizedProgress = normalizeCourseProgress(progress, courseId);

      if (normalizedProgress && normalizedProgress.courseId === courseId) {
        result[courseId] = normalizedProgress;
      }

      return result;
    },
    {}
  );

  if (Object.keys(courses).length !== courseProgressEntries.length) {
    return null;
  }

  return {
    userStats: normalizeUserStats(value.userStats),
    courses
  };
}

export function createAdoLearnExportData(
  courses: Course[],
  progress: ProgressExportData,
  settings: AppSettings
): AdoLearnExportData {
  return {
    app: 'AdoLearn',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      courses,
      progress,
      settings
    }
  };
}

export function downloadJSON(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function validateAllDataImport(
  rawJSON: string,
  existingCourseIds: Set<string>
): ImportValidationResult<AdoLearnExportData['data']> {
  const parsedResult = parseJSON(rawJSON);

  if (!parsedResult.ok) {
    return parsedResult as ImportValidationResult<AdoLearnExportData['data']>;
  }

  const payload = getExportPayload(parsedResult.data);

  if (!payload) {
    return { ok: false, error: 'This JSON does not look like an AdoLearn export.' };
  }

  const courses = normalizeCoursesList(payload.courses, new Set(), false);

  if (!courses) {
    return { ok: false, error: 'The imported courses are missing required AdoLearn fields.' };
  }

  const importedCourseIds = new Set(courses.map((course) => course.id));

  if (importedCourseIds.size !== courses.length) {
    return { ok: false, error: 'The imported courses contain duplicate IDs. Export the data again or import courses one at a time.' };
  }
  const progress = payload.progress
    ? normalizeProgressImport(payload.progress, importedCourseIds)
    : { userStats: normalizeUserStats({}), courses: {} };

  if (!progress) {
    return {
      ok: false,
      error: 'The imported progress data is not valid for the imported courses.'
    };
  }

  const settings = payload.settings ? normalizeSettings(payload.settings) : { ...DEFAULT_SETTINGS };

  return {
    ok: true,
    data: {
      courses,
      progress,
      settings
    }
  };
}

export function validateCourseImport(rawJSON: string, existingCourseIds: Set<string>): ImportValidationResult<Course> {
  const parsedResult = parseJSON(rawJSON);

  if (!parsedResult.ok) {
    return parsedResult as ImportValidationResult<Course>;
  }

  const parsedValue = parsedResult.data;
  let rawCourse: unknown = parsedValue;

  if (isRecord(parsedValue) && isRecord(parsedValue.course)) {
    rawCourse = parsedValue.course;
  }

  if (isRecord(parsedValue) && Array.isArray(parsedValue.courses)) {
    rawCourse = parsedValue.courses[0];
  }

  if (isRecord(parsedValue) && isRecord(parsedValue.data) && Array.isArray(parsedValue.data.courses)) {
    rawCourse = parsedValue.data.courses[0];
  }

  const course = normalizeImportedCourseWithFreshIds(rawCourse, existingCourseIds);

  if (!course) {
    return { ok: false, error: 'This JSON does not contain a valid AdoLearn course.' };
  }

  return { ok: true, data: course };
}

export function saveAllImportedData(data: AdoLearnExportData['data']): boolean {
  const results = [
    safeSetJSON(STORAGE_KEYS.courses, data.courses),
    safeSetJSON(STORAGE_KEYS.progress, data.progress),
    safeSetJSON(STORAGE_KEYS.settings, data.settings)
  ];

  return results.every(Boolean);
}
