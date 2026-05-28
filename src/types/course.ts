import type { CourseStyle, Difficulty } from './settings';

export type ISODateString = string;

export type LessonType = 'standard' | 'review' | 'final_challenge';

export type ExerciseType =
  | 'multiple_choice'
  | 'true_false'
  | 'fill_blank'
  | 'matching'
  | 'ordering'
  | 'short_answer'
  | 'flashcard'
  | 'scenario'
  | 'explain_concept';

export interface Course {
  id: string;
  title: string;
  description: string;
  sourceMaterialPreview: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  difficulty: Difficulty;
  style: CourseStyle;
  estimatedTotalMinutes: number;
  sections: Section[];
  keyConcepts: string[];
}

export interface Section {
  id: string;
  title: string;
  description: string;
  units: Unit[];
}

export interface Unit {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
}

export interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  estimatedMinutes: number;
  learningObjectives: string[];
  summary: string;
  exercises: Exercise[];
}

export interface ExerciseChoice {
  id: string;
  text: string;
}

export interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

export interface OrderingItem {
  id: string;
  text: string;
}

export interface SourceReference {
  sourceId?: string;
  title?: string;
  excerpt?: string;
  location?: string;
}

export type ExerciseAnswer = string | boolean | string[];

export interface Exercise {
  id: string;
  type: ExerciseType;
  prompt: string;
  choices?: ExerciseChoice[];
  answer?: ExerciseAnswer;
  acceptedAnswers?: string[];
  explanation?: string;
  hint?: string;
  sourceReference?: SourceReference;
  pairs?: MatchingPair[];
  items?: OrderingItem[];
  correctOrder?: string[];
  concept?: string;
}
