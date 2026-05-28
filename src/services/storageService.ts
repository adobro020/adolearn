import { STORAGE_KEYS } from '../data/storageKeys';

const STORAGE_TEST_KEY = '__adolearn_storage_test__';

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined' || !('localStorage' in window)) {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Checks whether localStorage can be read and written in the current browser.
 * This guards against SSR, private browsing quota errors, blocked storage, and
 * browsers that expose localStorage but throw when it is accessed.
 */
export function isStorageAvailable(): boolean {
  const storage = getLocalStorage();

  if (!storage) {
    return false;
  }

  try {
    storage.setItem(STORAGE_TEST_KEY, STORAGE_TEST_KEY);
    storage.removeItem(STORAGE_TEST_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely reads and parses JSON from localStorage.
 *
 * Unit-test-friendly behavior:
 * - missing key -> fallback
 * - invalid JSON -> fallback
 * - parsed null/undefined -> fallback
 * - localStorage unavailable or throwing -> fallback
 */
export function safeGetJSON<T>(key: string, fallback: T): T {
  const storage = getLocalStorage();

  if (!storage) {
    return fallback;
  }

  try {
    const rawValue = storage.getItem(key);

    if (rawValue === null) {
      return fallback;
    }

    const parsedValue: unknown = JSON.parse(rawValue);

    if (parsedValue === null || parsedValue === undefined) {
      return fallback;
    }

    return parsedValue as T;
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // Ignore cleanup failures and still recover with the caller's fallback.
    }

    return fallback;
  }
}

/**
 * Safely serializes and writes JSON to localStorage.
 * Returns false instead of throwing when storage is unavailable, quota-limited,
 * blocked by privacy mode, or the value cannot be serialized.
 */
export function safeSetJSON<T>(key: string, value: T): boolean {
  const storage = getLocalStorage();

  if (!storage) {
    return false;
  }

  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeItem(key: string): boolean {
  const storage = getLocalStorage();

  if (!storage) {
    return false;
  }

  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function clearAdoLearnData(): boolean {
  const results = [
    removeItem(STORAGE_KEYS.courses),
    removeItem(STORAGE_KEYS.progress),
    removeItem(STORAGE_KEYS.settings)
  ];

  return results.every(Boolean);
}
