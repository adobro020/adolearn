import { useState } from 'react';
import { BottomNav } from './components/BottomNav';
import { Header } from './components/Header';
import { CourseMapPage } from './pages/CourseMapPage';
import { CreateCoursePage } from './pages/CreateCoursePage';
import { DashboardPage } from './pages/DashboardPage';
import { LessonPlayerPage } from './pages/LessonPlayerPage';
import { ReviewPage } from './pages/ReviewPage';
import { SettingsPage } from './pages/SettingsPage';
import type { PageId } from './types/navigation';

export default function App() {
  const [activePage, setActivePage] = useState<PageId>('dashboard');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [selectedReviewCourseId, setSelectedReviewCourseId] = useState<string | null>(null);

  function openDashboard() {
    setActivePage('dashboard');
  }

  function openCreateCourse() {
    setActivePage('create');
  }

  function openSettings() {
    setActivePage('settings');
  }

  function openCourseMap(courseId: string) {
    setSelectedCourseId(courseId);
    setSelectedLessonId(null);
    setActivePage('courseMap');
  }

  function openLessonPlayer(courseId: string, lessonId: string) {
    setSelectedCourseId(courseId);
    setSelectedLessonId(lessonId);
    setActivePage('lessonPlayer');
  }

  function openReview(courseId?: string | null) {
    setSelectedReviewCourseId(courseId ?? null);
    if (courseId) {
      setSelectedCourseId(courseId);
    }
    setSelectedLessonId(null);
    setActivePage('review');
  }

  function returnToCourseMap() {
    if (selectedCourseId) {
      setActivePage('courseMap');
      return;
    }

    openDashboard();
  }

  function renderPage() {
    switch (activePage) {
      case 'create':
        return <CreateCoursePage onCourseCreated={openCourseMap} />;
      case 'settings':
        return <SettingsPage />;
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
      case 'dashboard':
      default:
        return (
          <DashboardPage
            onCreateCourse={openCreateCourse}
            onOpenCourse={openCourseMap}
            onOpenSettings={openSettings}
            onOpenReview={openReview}
          />
        );
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#d1fae5,_transparent_34rem),linear-gradient(180deg,_#f8fafc,_#eef2ff)] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-3 pb-28 md:px-6 md:py-6">
        <Header />
        <BottomNav activePage={activePage} onPageChange={setActivePage} />

        <main className="mx-auto mt-6 w-full max-w-5xl flex-1" id="main-content">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
