import { useEffect, useState } from 'react';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { CourseMapPage } from './pages/CourseMapPage';
import { CreateCoursePage } from './pages/CreateCoursePage';
import { DashboardPage } from './pages/DashboardPage';
import { LessonPlayerPage } from './pages/LessonPlayerPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ReviewPage } from './pages/ReviewPage';
import { SettingsPage } from './pages/SettingsPage';
import { StudyTechniquePage, getStudyTechniqueTitle } from './pages/StudyTechniquePage';
import { getCourses } from './services/courseService';
import { getSettings } from './services/settingsService';
import type { AppSettings, ThemePreference } from './types/settings';
import type { PageId } from './types/navigation';

type AppRoutePage = PageId | 'studyTechnique' | 'notFound';

interface ParsedRoute {
  page: AppRoutePage;
  courseId: string | null;
  lessonId: string | null;
  reviewCourseId: string | null;
  studyTechniqueId: string | null;
}

function emptyRoute(page: AppRoutePage): ParsedRoute {
  return { page, courseId: null, lessonId: null, reviewCourseId: null, studyTechniqueId: null };
}

function shouldUseDarkTheme(theme: ThemePreference): boolean {
  if (theme === 'dark') {
    return true;
  }

  if (theme === 'light') {
    return false;
  }

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

function cleanPathname(pathname: string): string {
  if (!pathname || pathname === '/') {
    return '/';
  }

  return pathname.replace(/\/+$/g, '').trim() || '/';
}

function safeDecode(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseRoute(pathname: string): ParsedRoute {
  const path = cleanPathname(pathname);
  const parts = path.split('/').filter(Boolean);

  if (parts.length === 0) {
    return emptyRoute('dashboard');
  }

  if (parts.length === 1 && parts[0] === 'create') {
    return emptyRoute('create');
  }

  if (parts.length === 1 && parts[0] === 'settings') {
    return emptyRoute('settings');
  }

  if (parts[0] === 'study-techniques' && parts.length === 2) {
    return { ...emptyRoute('studyTechnique'), studyTechniqueId: safeDecode(parts[1]) };
  }

  if (parts[0] === 'review' && parts.length <= 2) {
    return { ...emptyRoute('review'), reviewCourseId: safeDecode(parts[1]) };
  }

  if (parts[0] === 'course' && parts.length === 2) {
    return { ...emptyRoute('courseMap'), courseId: safeDecode(parts[1]) };
  }

  if (parts[0] === 'course' && parts.length === 4 && parts[2] === 'lesson') {
    return {
      ...emptyRoute('lessonPlayer'),
      courseId: safeDecode(parts[1]),
      lessonId: safeDecode(parts[3])
    };
  }

  return emptyRoute('notFound');
}

function coursePath(courseId: string): string {
  return `/course/${encodeURIComponent(courseId)}`;
}

function lessonPath(courseId: string, lessonId: string): string {
  return `${coursePath(courseId)}/lesson/${encodeURIComponent(lessonId)}`;
}

function reviewPath(courseId?: string | null): string {
  return courseId ? `/review/${encodeURIComponent(courseId)}` : '/review';
}

function scrollToPageTop() {
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  });
}

function navPath(pageId: PageId): string {
  if (pageId === 'create') {
    return '/create';
  }

  if (pageId === 'settings') {
    return '/settings';
  }

  return '/';
}

export default function App() {
  const initialRoute = parseRoute(window.location.pathname);
  const [activePage, setActivePage] = useState<AppRoutePage>(initialRoute.page);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(initialRoute.courseId);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(initialRoute.lessonId);
  const [selectedReviewCourseId, setSelectedReviewCourseId] = useState<string | null>(initialRoute.reviewCourseId);
  const [selectedStudyTechniqueId, setSelectedStudyTechniqueId] = useState<string | null>(initialRoute.studyTechniqueId);
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => getSettings().theme);

  function applyRoute(route: ParsedRoute) {
    setActivePage(route.page);
    setSelectedCourseId(route.courseId);
    setSelectedLessonId(route.lessonId);
    setSelectedReviewCourseId(route.reviewCourseId);
    setSelectedStudyTechniqueId(route.studyTechniqueId);
  }

  function navigate(path: string) {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }

    applyRoute(parseRoute(path));
    scrollToPageTop();
  }

  useEffect(() => {
    function applyTheme(theme: ThemePreference) {
      document.documentElement.classList.toggle('dark', shouldUseDarkTheme(theme));
    }

    function handleSettingsChanged(event: Event) {
      const nextSettings = (event as CustomEvent<AppSettings>).detail;
      if (nextSettings?.theme) {
        setThemePreference(nextSettings.theme);
        applyTheme(nextSettings.theme);
      }
    }

    function handleSystemThemeChange() {
      applyTheme(themePreference);
    }

    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
    applyTheme(themePreference);
    window.addEventListener('adolearn-settings-changed', handleSettingsChanged);
    mediaQuery?.addEventListener?.('change', handleSystemThemeChange);

    return () => {
      window.removeEventListener('adolearn-settings-changed', handleSettingsChanged);
      mediaQuery?.removeEventListener?.('change', handleSystemThemeChange);
    };
  }, [themePreference]);

  useEffect(() => {
    function handlePopState() {
      applyRoute(parseRoute(window.location.pathname));
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const courses = getCourses();
    const selectedCourse = selectedCourseId ? courses.find((course) => course.id === selectedCourseId) : null;
    const reviewCourse = selectedReviewCourseId ? courses.find((course) => course.id === selectedReviewCourseId) : null;
    const selectedLesson = selectedCourse?.units
      .flatMap((unit) => unit.sections)
      .flatMap((section) => section.lessons)
      .find((lesson) => lesson.id === selectedLessonId);

    const pageTitles: Record<AppRoutePage, string> = {
      dashboard: courses.length === 0 ? 'Create Personalized Courses' : 'Dashboard',
      create: 'Create Course',
      settings: 'Settings',
      courseMap: selectedCourse ? selectedCourse.title : 'Course Map',
      lessonPlayer: selectedLesson ? selectedLesson.title : 'Lesson',
      review: reviewCourse ? `${reviewCourse.title} Review` : 'Review',
      studyTechnique: getStudyTechniqueTitle(selectedStudyTechniqueId),
      notFound: 'Page Not Found'
    };

    document.title = `${pageTitles[activePage]} | AdoLearn`;
    document.body.dataset.page = activePage;
  }, [activePage, selectedCourseId, selectedLessonId, selectedReviewCourseId, selectedStudyTechniqueId]);

  function openDashboard() {
    navigate('/');
  }

  function openCreateCourse() {
    navigate('/create');
  }

  function openSettings() {
    navigate('/settings');
  }

  function openCourseMap(courseId: string) {
    navigate(coursePath(courseId));
  }

  function openLessonPlayer(courseId: string, lessonId: string) {
    navigate(lessonPath(courseId, lessonId));
  }

  function openReview(courseId?: string | null) {
    navigate(reviewPath(courseId));
  }

  function returnToCourseMap() {
    if (selectedCourseId) {
      navigate(coursePath(selectedCourseId));
      return;
    }

    openDashboard();
  }

  function handlePageNav(pageId: PageId) {
    navigate(navPath(pageId));
  }

  function renderPage() {
    switch (activePage) {
      case 'create':
        return <CreateCoursePage onCourseCreated={openCourseMap} />;
      case 'settings':
        return <SettingsPage />;
      case 'studyTechnique':
        return (
          <StudyTechniquePage
            techniqueId={selectedStudyTechniqueId}
            onCreateCourse={openCreateCourse}
            onBackToDashboard={openDashboard}
          />
        );
      case 'courseMap':
        return (
          <CourseMapPage
            courseId={selectedCourseId}
            onBackToDashboard={openDashboard}
            onCreateCourse={openCreateCourse}
            onOpenLesson={openLessonPlayer}
            onOpenReview={openReview}
          />
        );
      case 'review':
        return (
          <ReviewPage
            courseId={selectedReviewCourseId}
            onBackToDashboard={openDashboard}
            onBackToCourseMap={openCourseMap}
          />
        );
      case 'lessonPlayer':
        return (
          <LessonPlayerPage
            courseId={selectedCourseId}
            lessonId={selectedLessonId}
            onBackToCourseMap={returnToCourseMap}
            onBackToDashboard={openDashboard}
          />
        );
      case 'notFound':
        return <NotFoundPage onGoHome={openDashboard} onCreateCourse={openCreateCourse} />;
      case 'dashboard':
      default:
        return (
          <DashboardPage
            onCreateCourse={openCreateCourse}
            onOpenCourse={openCourseMap}
            onOpenSettings={openSettings}
          />
        );
    }
  }

  const isLessonFullscreen = activePage === 'lessonPlayer' || activePage === 'review';
  if (isLessonFullscreen) {
    return (
      <div className="min-h-screen bg-white text-slate-950 transition-colors duration-300 dark:bg-[#080a12] dark:text-slate-100">
        <main className="min-h-screen w-full" id="main-content">
          {renderPage()}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_34rem),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.14),_transparent_30rem),linear-gradient(180deg,_#fbfdfa,_#eef5ff)] text-slate-950 transition-colors duration-300 dark:bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_34rem),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.10),_transparent_30rem),linear-gradient(180deg,_#08111f,_#090d18)] dark:text-slate-100">
      <Header activePage={activePage} onLogoClick={openDashboard} onPageChange={handlePageNav} />

      <div className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-6xl flex-col px-3 pb-12 pt-6 md:px-6">
        <main className="mx-auto w-full max-w-5xl flex-1" id="main-content" aria-live="polite">
          {renderPage()}
        </main>
      </div>

      <Footer onNavigate={navigate} onCreateCourse={openCreateCourse} />
    </div>
  );
}
