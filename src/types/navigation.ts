export type PageId = 'dashboard' | 'create' | 'settings' | 'courseMap' | 'lessonPlayer' | 'review';

export interface NavItem {
  id: PageId;
  label: string;
  icon: string;
}
