import { LessonPlanContent, QuestionSetContent } from "@/lib/types";

export interface GeminiMessage {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

export interface AiGenerationResult<T = string> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
  tokens?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  modelUsed?: string;
}

/**
 * Core Gemini API Caller
 * Uses official free-tier Google AI Studio REST endpoints with zero third-party paid wrappers.
 */
export async function callGeminiRaw(options: {
  contents: GeminiMessage[];
  systemInstruction?: string;
  temperature?: number;
  responseMimeType?: "text/plain" | "application/json";
  maxOutputTokens?: number;
}): Promise<AiGenerationResult<string>> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";

  if (!apiKey || apiKey.trim() === "" || apiKey === "placeholder-gemini-key") {
    return {
      success: false,
      error:
        "Gemini API key is not configured. Please add GEMINI_API_KEY to your .env.local file or server environment.",
      statusCode: 503,
    };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const payload: Record<string, unknown> = {
    contents: options.contents,
    generationConfig: {
      temperature: options.temperature ?? 0.4,
      responseMimeType: options.responseMimeType ?? "text/plain",
      ...(options.maxOutputTokens ? { maxOutputTokens: options.maxOutputTokens } : {}),
    },
  };

  if (options.systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: options.systemInstruction }],
    };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45000),
    });

    const data = await response.json().catch(() => null);

    if (response.ok) {
      const text =
        data?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text || "")
          .join("") || "";

      const usage = data?.usageMetadata;
      const tokens = usage
        ? {
            promptTokens: usage.promptTokenCount || 0,
            completionTokens: usage.candidatesTokenCount || 0,
            totalTokens: usage.totalTokenCount || 0,
          }
        : undefined;

      return {
        success: true,
        data: text,
        tokens,
        modelUsed: model,
      };
    }

    if (response.status === 429) {
      return {
        success: false,
        error:
          "Google Gemini free-tier quota or rate limit reached. Please wait a moment before trying again.",
        statusCode: 429,
      };
    }

    const apiMessage = data?.error?.message || `AI Service Error (${response.status})`;
    return {
      success: false,
      error: apiMessage,
      statusCode: response.status,
    };
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    return {
      success: false,
      error: isTimeout
        ? "AI generation timed out after 45 seconds. Try a shorter request."
        : "Failed to connect to the AI service. Verify internet connectivity.",
      statusCode: isTimeout ? 504 : 502,
    };
  }
}

/**
 * AI Assistant Chat helper
 */
export async function generateChatReply(
  history: Array<{ role: "user" | "assistant"; content: string }>,
  currentMessage: string,
  context?: string
): Promise<AiGenerationResult<string>> {
  const systemInstruction = `You are FAW-AI (Faculty AI Workload Assistant), an academic productivity assistant designed specifically for higher education faculty.
Your primary duties are:
1. Assisting professors with curriculum planning, syllabus structuring, and pedagogy.
2. Generating academic assessments, exam questions, rubrics, and answer keys.
3. Providing clear, respectful, and academically grounded recommendations.
4. Adhering to factual academic standards. Do not fabricate student information or make false claims about files unless provided in context.
${context ? `\nActive Academic Context:\n${context}` : ""}`;

  const contents: GeminiMessage[] = history.map((h) => ({
    role: h.role === "assistant" ? "model" : "user",
    parts: [{ text: h.content }],
  }));

  contents.push({
    role: "user",
    parts: [{ text: currentMessage }],
  });

  return callGeminiRaw({
    contents,
    systemInstruction,
    temperature: 0.5,
  });
}

/**
 * Lesson Planner AI Generator
 */
export async function generateLessonPlanAi(input: {
  courseName: string;
  subject: string;
  topic: string;
  learningObjectives: string;
  durationMinutes: number;
  teachingLevel: string;
}): Promise<AiGenerationResult<LessonPlanContent>> {
  const prompt = `You are an expert curriculum designer in higher education.
Generate a comprehensive, structured lesson plan in JSON format based on the following parameters:
- Course: ${input.courseName}
- Subject: ${input.subject}
- Topic: ${input.topic}
- Target Teaching Level: ${input.teachingLevel}
- Duration: ${input.durationMinutes} minutes
- Faculty Learning Objectives: ${input.learningObjectives || "Standard higher education curriculum objectives"}

Output ONLY valid JSON matching this schema:
{
  "subject": "${input.subject}",
  "topic": "${input.topic}",
  "teaching_level": "${input.teachingLevel}",
  "total_duration_minutes": ${input.durationMinutes},
  "learning_objectives": ["string", "string"],
  "required_materials": ["string", "string"],
  "lesson_structure": [
    {
      "phase": "Introduction / Hook",
      "duration_minutes": 10,
      "description": "Detailed explanation of activities",
      "materials": "Slides, whiteboard"
    },
    {
      "phase": "Core Concept Instruction",
      "duration_minutes": 25,
      "description": "Detailed explanation of lecture and concept delivery",
      "materials": "Syllabus notes"
    },
    {
      "phase": "Interactive Application / Discussion",
      "duration_minutes": 15,
      "description": "Group work or problem-solving prompt",
      "materials": "Worksheets / case study"
    },
    {
      "phase": "Summary & Formative Check",
      "duration_minutes": 10,
      "description": "Wrap-up and exit ticket",
      "materials": "Quick quiz or survey"
    }
  ],
  "assessment_methods": ["string"],
  "homework_or_extension": "string",
  "notes_for_faculty": "string"
}`;

  const result = await callGeminiRaw({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    systemInstruction: "You are a senior academic curriculum specialist. Respond with valid JSON only.",
    responseMimeType: "application/json",
    temperature: 0.3,
    maxOutputTokens: 2500,
  });

  if (!result.success || !result.data) {
    return {
      success: false,
      error: result.error || "Failed to generate lesson plan.",
      statusCode: result.statusCode,
    };
  }

  try {
    const parsed = JSON.parse(result.data) as LessonPlanContent;
    return {
      success: true,
      data: parsed,
      tokens: result.tokens,
      modelUsed: result.modelUsed,
    };
  } catch {
    return {
      success: false,
      error: "The AI returned an invalid lesson plan format. Please try again.",
      statusCode: 502,
    };
  }
}

/**
 * Question Studio AI Generator
 */
export async function generateQuestionStudioAi(input: {
  courseName: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  questionType: "mcq" | "short" | "long" | "true_false";
  count: number;
}): Promise<AiGenerationResult<QuestionSetContent>> {
  const prompt = `You are a university professor preparing examination questions.
Generate ${input.count} syllabus-aligned questions in JSON format based on:
- Course: ${input.courseName}
- Topic: ${input.topic}
- Difficulty Level: ${input.difficulty}
- Question Format: ${input.questionType}

Output ONLY valid JSON matching this schema:
{
  "topic": "${input.topic}",
  "difficulty": "${input.difficulty}",
  "total_marks": ${input.count * (input.questionType === "mcq" ? 2 : input.questionType === "short" ? 5 : 10)},
  "questions": [
    {
      "id": "q1",
      "question_type": "${input.questionType}",
      "prompt": "Question text here",
      ${
        input.questionType === "mcq"
          ? `"options": ["Option A", "Option B", "Option C", "Option D"],`
          : input.questionType === "true_false"
          ? `"options": ["True", "False"],`
          : ""
      }
      "correct_answer": "Model correct answer or option letter",
      "explanation": "Academic explanation or rubric justification",
      "marks": ${input.questionType === "mcq" ? 2 : input.questionType === "short" ? 5 : 10},
      "difficulty": "${input.difficulty}"
    }
  ]
}`;

  const result = await callGeminiRaw({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    systemInstruction: "You are a university examination board evaluator. Respond with valid JSON only.",
    responseMimeType: "application/json",
    temperature: 0.3,
    maxOutputTokens: 2500,
  });

  if (!result.success || !result.data) {
    return {
      success: false,
      error: result.error || "Failed to generate questions.",
      statusCode: result.statusCode,
    };
  }

  try {
    const parsed = JSON.parse(result.data) as QuestionSetContent;
    return {
      success: true,
      data: parsed,
      tokens: result.tokens,
      modelUsed: result.modelUsed,
    };
  } catch {
    return {
      success: false,
      error: "The AI returned an invalid question set format. Please try again.",
      statusCode: 502,
    };
  }
}
