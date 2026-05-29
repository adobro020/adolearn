import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { PageCard } from '../components/PageCard';
import { EmptyState, NoticeBanner } from '../components/Polish';
import type { Course } from '../types/course';
import type { AppSettings, ThemePreference } from '../types/settings';
import { deleteCourse, getCourses, saveCourse } from '../services/courseService';
import {
  createAdoLearnExportData,
  downloadJSON,
  saveAllImportedData,
  validateAllDataImport,
  validateCourseImport
} from '../services/dataPortabilityService';
import {
  deleteAllProgress,
  getProgressData,
  resetCourseProgress
} from '../services/progressService';
import { DEFAULT_SETTINGS, getSettings, resetSettings, saveSettings } from '../services/settingsService';
import { clearAdoLearnData, isStorageAvailable } from '../services/storageService';

type NoticeTone = 'success' | 'error' | 'info';

interface Notice {
  tone: NoticeTone;
  message: string;
}


const themes: Array<{ value: ThemePreference; label: string }> = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' }
];


function createExportFilename(scope: string): string {
  const datePart = new Date().toISOString().slice(0, 10);
  return `adolearn-${scope}-${datePart}.json`;
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}

function getCourseLessonCount(course: Course): number {
  return course.sections.reduce(
    (sectionTotal, section) =>
      sectionTotal + section.units.reduce((unitTotal, unit) => unitTotal + unit.lessons.length, 0),
    0
  );
}

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(() => getSettings());
  const [courses, setCourses] = useState<Course[]>(() => getCourses());
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const storageAvailable = useMemo(() => isStorageAvailable(), []);
  const selectedCourse = courses.find((course) => course.id === selectedCourseId) ?? null;

  useEffect(() => {
    if (!selectedCourseId && courses.length > 0) {
      setSelectedCourseId(courses[0].id);
      return;
    }

    if (selectedCourseId && !courses.some((course) => course.id === selectedCourseId)) {
      setSelectedCourseId(courses[0]?.id ?? '');
    }
  }, [courses, selectedCourseId]);

  function refreshLocalData() {
    setSettings(getSettings());
    setCourses(getCourses());
  }

  function showNotice(tone: NoticeTone, message: string) {
    setNotice({ tone, message });
  }

  function updateSettings(nextSettings: AppSettings) {
    setSettings(nextSettings);
    const saved = saveSettings(nextSettings);
    showNotice(
      saved ? 'success' : 'error',
      saved ? 'Settings saved locally in this browser.' : 'Settings could not be saved in this browser.'
    );
  }

  function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    updateSettings({
      ...settings,
      [key]: value
    });
  }

  function exportAllData() {
    const exportData = createAdoLearnExportData(getCourses(), getProgressData(), getSettings());
    downloadJSON(createExportFilename('all-data'), exportData);
    showNotice('success', 'All AdoLearn data was exported as JSON.');
  }

  function exportCoursesOnly() {
    downloadJSON(createExportFilename('courses'), {
      app: 'AdoLearn',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        courses: getCourses()
      }
    });
    showNotice('success', 'Courses were exported as JSON.');
  }

  async function importAllData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    const rawJSON = await file.text();
    const validation = validateAllDataImport(rawJSON, new Set(courses.map((course) => course.id)));

    if (!validation.ok || !validation.data) {
      showNotice('error', validation.error ?? 'That import file could not be validated.');
      return;
    }

    const confirmed = window.confirm(
      'Importing all data will replace your current courses, progress, and settings in this browser. Continue?'
    );

    if (!confirmed) {
      showNotice('info', 'Import canceled. Your current data was not changed.');
      return;
    }

    const saved = saveAllImportedData(validation.data);
    refreshLocalData();
    showNotice(
      saved ? 'success' : 'error',
      saved
        ? 'Imported AdoLearn data replaced your local browser data.'
        : 'The imported data was valid, but it could not be saved in this browser.'
    );
  }

  async function importCourse(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    const rawJSON = await file.text();
    const validation = validateCourseImport(rawJSON, new Set(courses.map((course) => course.id)));

    if (!validation.ok || !validation.data) {
      showNotice('error', validation.error ?? 'That course file could not be validated.');
      return;
    }

    const saved = saveCourse(validation.data);
    refreshLocalData();
    showNotice(
      saved ? 'success' : 'error',
      saved
        ? `Imported “${validation.data.title}” as a local course.`
        : 'The course was valid, but it could not be saved in this browser.'
    );
  }

  function clearAllLocalData() {
    const confirmed = window.confirm(
      'This will permanently clear all AdoLearn courses, progress, review history, and settings from this browser. Continue?'
    );

    if (!confirmed) {
      return;
    }

    const cleared = clearAdoLearnData();
    refreshLocalData();
    showNotice(
      cleared ? 'success' : 'error',
      cleared ? 'All saved AdoLearn data was cleared.' : 'Some saved data could not be cleared.'
    );
  }

  function resetAllProgress() {
    const confirmed = window.confirm(
      'This will delete all lesson progress, XP, streaks, review history, weak concepts, and incorrect answers. Courses and settings will stay. Continue?'
    );

    if (!confirmed) {
      return;
    }

    const reset = deleteAllProgress();
    refreshLocalData();
    showNotice(
      reset ? 'success' : 'error',
      reset ? 'All progress was reset.' : 'Progress could not be reset in this browser.'
    );
  }

  function resetLocalSettings() {
    const confirmed = window.confirm('Reset settings to the AdoLearn defaults?');

    if (!confirmed) {
      return;
    }

    const defaults = resetSettings();
    setSettings(defaults);
    showNotice('success', 'Settings were reset to defaults.');
  }

  function resetSelectedCourseProgress() {
    if (!selectedCourse) {
      return;
    }

    const confirmed = window.confirm(`Reset progress for “${selectedCourse.title}”?`);

    if (!confirmed) {
      return;
    }

    const reset = resetCourseProgress(selectedCourse.id);
    refreshLocalData();
    showNotice(
      reset ? 'success' : 'error',
      reset
        ? `Progress for “${selectedCourse.title}” was reset.`
        : 'That course progress could not be reset.'
    );
  }

  function deleteSelectedCourse() {
    if (!selectedCourse) {
      return;
    }

    const confirmed = window.confirm(
      `Delete “${selectedCourse.title}” and its saved progress from this browser?`
    );

    if (!confirmed) {
      return;
    }

    const courseDeleted = deleteCourse(selectedCourse.id);
    const progressDeleted = resetCourseProgress(selectedCourse.id);
    refreshLocalData();
    showNotice(
      courseDeleted && progressDeleted ? 'success' : 'error',
      courseDeleted && progressDeleted
        ? `“${selectedCourse.title}” was deleted.`
        : 'The selected course could not be fully deleted.'
    );
  }

  return (
    <div className="space-y-6">
      <PageCard
        eyebrow="Settings"
        title="Control AdoLearn locally"
        description="Choose how AdoLearn looks and manages saved data on this device."
      >
        <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[1.75rem] bg-gradient-to-br from-emerald-50 to-sky-50 p-5 ring-1 ring-emerald-100">
            <h3 className="text-lg font-black text-slate-950">Production-ready app</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              Real AI generation uses the Server proxy route. Courses and progress remain local to this browser; AdoLearn still has no accounts, database, or cloud course storage.
            </p>
          </div>
          <div className="rounded-[1.75rem] bg-white p-5 ring-1 ring-slate-200">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">
              Browser save status
            </p>
            <p className="mt-2 text-2xl font-black text-slate-950">
              {storageAvailable ? 'Available' : 'Unavailable'}
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              {storageAvailable
                ? 'Your browser can currently save local AdoLearn data.'
                : 'This browser may block browser storage, so saved data may not persist.'}
            </p>
          </div>
        </div>

        {notice ? (
          <div className="mt-5">
            <NoticeBanner tone={notice.tone} title={notice.tone === 'success' ? 'Saved' : notice.tone === 'error' ? 'Action needed' : 'Heads up'}>
              {notice.message}
            </NoticeBanner>
          </div>
        ) : null}
      </PageCard>

      <PageCard
        eyebrow="Appearance"
        title="Theme preference"
        description="Choose how AdoLearn should remember your preferred appearance."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {themes.map((theme) => {
            const isSelected = settings.theme === theme.value;

            return (
              <button
                key={theme.value}
                type="button"
                onClick={() => updateSetting('theme', theme.value)}
                aria-pressed={isSelected}
                className={`rounded-3xl px-5 py-4 text-left ring-1 transition ${
                  isSelected
                    ? 'bg-slate-950 text-white ring-slate-950 shadow-lg shadow-slate-900/10'
                    : 'bg-white text-slate-700 ring-slate-200 hover:-translate-y-0.5 hover:ring-emerald-200'
                }`}
              >
                <span className="text-base font-black">{theme.label}</span>
              </button>
            );
          })}
        </div>
      </PageCard>

      <PageCard
        eyebrow="Data"
        title="Import, export, and reset"
        description="Download backups, import AdoLearn JSON, or reset local data in this browser."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[1.75rem] bg-slate-50 p-5 ring-1 ring-slate-200">
            <h3 className="text-lg font-black text-slate-950">Backup and import</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              Export files are plain JSON. Imports are validated before anything is saved.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={exportAllData}
                className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-100 transition hover:-translate-y-0.5 hover:bg-emerald-700"
              >
                Export all data
              </button>
              <button
                type="button"
                onClick={exportCoursesOnly}
                className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:ring-emerald-200"
              >
                Export courses only
              </button>
              <label className="cursor-pointer rounded-2xl bg-white px-4 py-3 text-center text-sm font-black text-slate-700 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:ring-emerald-200">
                Import all data
                <input type="file" accept="application/json,.json" onChange={importAllData} className="sr-only" />
              </label>
              <label className="cursor-pointer rounded-2xl bg-white px-4 py-3 text-center text-sm font-black text-slate-700 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:ring-emerald-200">
                Import course JSON
                <input type="file" accept="application/json,.json" onChange={importCourse} className="sr-only" />
              </label>
            </div>
          </div>

          <div className="rounded-[1.75rem] bg-rose-50 p-5 ring-1 ring-rose-100">
            <h3 className="text-lg font-black text-rose-600 dark:text-rose-300">Data controls</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-rose-500 dark:text-rose-300/90">
              These actions affect only this browser. They do not delete anything from a server because
              AdoLearn has no backend yet.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={resetAllProgress}
                className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-rose-700 ring-1 ring-rose-200 transition hover:-translate-y-0.5"
              >
                Reset all progress
              </button>
              <button
                type="button"
                onClick={resetLocalSettings}
                className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-rose-700 ring-1 ring-rose-200 transition hover:-translate-y-0.5"
              >
                Reset settings
              </button>
              <button
                type="button"
                onClick={clearAllLocalData}
                className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-rose-100 transition hover:-translate-y-0.5 hover:bg-rose-700 sm:col-span-2"
              >
                Clear all data
              </button>
            </div>
          </div>
        </div>
      </PageCard>

      <PageCard
        eyebrow="Individual course data"
        title="Manage one saved course"
        description="Reset progress or delete a selected course without affecting your other courses."
      >
        {courses.length === 0 ? (
          <EmptyState
            icon="🗂️"
            title="No saved courses yet"
            message="Create or import a course before using individual course controls."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
            <label className="block rounded-[1.75rem] bg-slate-50 p-5 ring-1 ring-slate-200">
              <span className="text-sm font-black text-slate-700">Selected course</span>
              <select
                value={selectedCourseId}
                onChange={(event) => setSelectedCourseId(event.target.value)}
                className="mt-2 w-full rounded-2xl border-0 bg-white px-4 py-3 text-base font-bold text-slate-950 ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>

              {selectedCourse ? (
                <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                  <p className="text-base font-black text-slate-950">{selectedCourse.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-slate-600">
                    {selectedCourse.description || 'No description saved.'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-black text-slate-600">
                    <span className="rounded-full bg-slate-100 px-3 py-1">
                      {getCourseLessonCount(selectedCourse)} lessons
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1">
                      Updated {formatDate(selectedCourse.updatedAt)}
                    </span>
                  </div>
                </div>
              ) : null}
            </label>

            <div className="rounded-[1.75rem] bg-white p-5 ring-1 ring-slate-200">
              <h3 className="text-lg font-black text-slate-950">Course actions</h3>
              <div className="mt-4 grid gap-3">
                <button
                  type="button"
                  onClick={resetSelectedCourseProgress}
                  disabled={!selectedCourse}
                  className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-lg shadow-slate-900/10 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Reset selected course progress
                </button>
                <button
                  type="button"
                  onClick={deleteSelectedCourse}
                  disabled={!selectedCourse}
                  className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-rose-100 transition hover:-translate-y-0.5 hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-200"
                >
                  Delete selected course
                </button>
              </div>
            </div>
          </div>
        )}
      </PageCard>
    </div>
  );
}
