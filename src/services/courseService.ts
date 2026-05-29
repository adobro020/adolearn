import { STORAGE_KEYS } from '../data/storageKeys';
import type { Course } from '../types/course';
import { normalizeCourseFromAIJSON } from './courseNormalizer';
import { removeItem, safeGetJSON, safeSetJSON } from './storageService';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeCourse(value: unknown): Course | null {
  if (!isRecord(value)) {
    return null;
  }

  const normalized = normalizeCourseFromAIJSON(value, {
    fallbackTitle: typeof value.title === 'string' ? value.title : 'Generated Learning Path',
    sourceMaterialPreview: typeof value.sourceMaterialPreview === 'string' ? value.sourceMaterialPreview : undefined
  });

  return normalized.title ? normalized : null;
}

function normalizeCourses(value: unknown): Course[] {
  const possibleCourses = isRecord(value) && Array.isArray(value.courses) ? value.courses : value;

  if (!Array.isArray(possibleCourses)) {
    return [];
  }

  return possibleCourses
    .map(normalizeCourse)
    .filter((course): course is Course => course !== null);
}

function persistCourses(courses: Course[]): boolean {
  return safeSetJSON(STORAGE_KEYS.courses, courses);
}

export function getCourses(): Course[] {
  const storedCourses = safeGetJSON<unknown>(STORAGE_KEYS.courses, []);
  const normalizedCourses = normalizeCourses(storedCourses);

  if (Array.isArray(storedCourses) && JSON.stringify(storedCourses) !== JSON.stringify(normalizedCourses)) {
    safeSetJSON(STORAGE_KEYS.courses, normalizedCourses);
  }

  return normalizedCourses;
}

export function getCourseById(courseId: string): Course | undefined {
  return getCourses().find((course) => course.id === courseId);
}

export function saveCourse(course: Course): boolean {
  const normalizedCourse = normalizeCourse(course);

  if (!normalizedCourse) {
    return false;
  }

  const courses = getCourses();
  const existingIndex = courses.findIndex((storedCourse) => storedCourse.id === normalizedCourse.id);

  if (existingIndex >= 0) {
    courses[existingIndex] = normalizedCourse;
  } else {
    courses.unshift(normalizedCourse);
  }

  return persistCourses(courses);
}

export function deleteCourse(courseId: string): boolean {
  return persistCourses(getCourses().filter((course) => course.id !== courseId));
}

export function updateCourse(course: Course): boolean {
  const courses = getCourses();
  const existingIndex = courses.findIndex((storedCourse) => storedCourse.id === course.id);
  const normalizedCourse = normalizeCourse(course);

  if (existingIndex < 0 || !normalizedCourse) {
    return false;
  }

  courses[existingIndex] = {
    ...normalizedCourse,
    updatedAt: new Date().toISOString()
  };

  return persistCourses(courses);
}

export function deleteAllCourses(): boolean {
  return removeItem(STORAGE_KEYS.courses);
}
