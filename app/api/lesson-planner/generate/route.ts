import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateLessonPlanAi } from "@/lib/ai/gemini";

const LessonPlanInputSchema = z.object({
  courseId: z.string().uuid().optional(),
  courseName: z.string().trim().min(1, "Course name is required"),
  subject: z.string().trim().min(1, "Subject is required"),
  topic: z.string().trim().min(1, "Topic is required"),
  learningObjectives: z.string().trim().default(""),
  durationMinutes: z.number().int().min(15).max(360).default(60),
  teachingLevel: z.string().trim().default("Undergraduate"),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = LessonPlanInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input data." },
        { status: 400 }
      );
    }

    const result = await generateLessonPlanAi(parsed.data);

    // AI usage logging
    try {
      await supabase.from("ai_usage_logs").insert({
        owner_id: user.id,
        provider: "gemini",
        model: result.modelUsed || process.env.GEMINI_MODEL || "gemini-2.0-flash",
        status: result.success ? "success" : "failed",
        input_tokens: result.tokens?.promptTokens ?? null,
        output_tokens: result.tokens?.completionTokens ?? null,
        error_code: result.success ? null : `HTTP_${result.statusCode || 500}`,
      });
    } catch {
      // non-blocking
    }

    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: result.error || "Failed to generate lesson plan." },
        { status: result.statusCode || 502 }
      );
    }

    return NextResponse.json({ lessonPlan: result.data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
