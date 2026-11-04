export type UserRole = "faculty" | "professor" | "admin";

export interface Profile {
  id: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface Course {
  id: string;
  owner_id: string;
  name: string;
  course_code: string | null;
  description: string | null;
  semester?: string | null;
  academic_year?: string | null;
  created_at: string;
  updated_at: string;
  // Join properties
  owner?: Profile;
  documents_count?: number;
  students_count?: number;
}

export interface AcademicDocument {
  id: string;
  owner_id: string;
  course_id: string | null;
  filename: string;
  mime_type: string | null;
  file_size: number | null;
  storage_provider: string;
  bucket_name: string;
  object_path: string;
  processing_status: "uploaded" | "processing" | "processed" | "failed";
  created_at: string;
  course?: { name: string; course_code: string | null };
}

export interface LessonPlanActivity {
  phase: string;
  duration_minutes: number;
  description: string;
  materials?: string;
}

export interface LessonPlanContent {
  subject: string;
  topic: string;
  teaching_level: string;
  total_duration_minutes: number;
  learning_objectives: string[];
  required_materials: string[];
  lesson_structure: LessonPlanActivity[];
  assessment_methods: string[];
  homework_or_extension?: string;
  notes_for_faculty?: string;
}

export interface QuestionItem {
  id: string;
  question_type: "mcq" | "short" | "long" | "true_false";
  prompt: string;
  options?: string[];
  correct_answer: string;
  explanation?: string;
  marks?: number;
  difficulty: "easy" | "medium" | "hard";
}

export interface QuestionSetContent {
  topic: string;
  difficulty: string;
  total_marks?: number;
  questions: QuestionItem[];
}

export interface GeneratedDocument {
  id: string;
  owner_id: string;
  course_id: string | null;
  task_id: string | null;
  title: string;
  document_type: "lesson_plan" | "question_set" | "syllabus" | "report";
  content: LessonPlanContent | QuestionSetContent | Record<string, unknown>;
  content_json?: LessonPlanContent | QuestionSetContent | Record<string, unknown>;
  version: number;
  status: "draft" | "reviewed" | "approved";
  created_at: string;
}

export interface Student {
  id: string;
  course_id: string;
  owner_id: string;
  student_id_number: string;
  full_name: string;
  email: string | null;
  created_at: string;
}

export interface StudentAssessment {
  id: string;
  course_id: string;
  owner_id: string;
  title: string;
  assessment_type: "quiz" | "assignment" | "midterm" | "final" | "project" | "other";
  max_score: number;
  created_at: string;
  scores?: StudentScore[];
}

export interface StudentScore {
  id: string;
  assessment_id: string;
  student_id: string;
  score: number;
  feedback: string | null;
  created_at: string;
  student?: Student;
}

export interface AgentConversation {
  id: string;
  owner_id: string;
  title: string;
  created_at: string;
}

export interface AgentMessage {
  id: string;
  conversation_id: string;
  owner_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

export interface AiUsageLog {
  id: string;
  owner_id: string | null;
  provider: string;
  model: string | null;
  status: string;
  input_tokens: number | null;
  output_tokens: number | null;
  error_code: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  actor_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
