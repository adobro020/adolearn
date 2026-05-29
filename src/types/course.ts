export type ISODateString = string;

export type LessonType = 'standard' | 'review' | 'final_challenge';

export type ExerciseType = 'multiple_choice' | 'true_false';

export interface Course {
  id: string;
  title: string;
  description: string;
  sourceMaterialPreview: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  estimatedTotalMinutes: number;
  units: Unit[];
  keyConcepts: string[];
}

export interface Unit {
  id: string;
  title: string;
  description: string;
  sections: Section[];
}

export interface Section {
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

export interface SourceReference {
  sourceId?: string;
  title?: string;
  excerpt?: string;
  location?: string;
}

export type ExerciseAnswer = string | boolean;

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
  concept?: string;
}
