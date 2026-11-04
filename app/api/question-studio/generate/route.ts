import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateQuestionStudioAi } from "@/lib/ai/gemini";

const QuestionStudioSchema = z.object({
  courseName: z.string().trim().min(1, "Course name is required"),
  topic: z.string().trim().min(1, "Topic is required"),
  difficulty: z.enum(["easy", "medium", "hard"]),
  questionType: z.enum(["mcq", "short", "long", "true_false"]),
  count: z.number().int().min(1).max(20).default(5),
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
    const parsed = QuestionStudioSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input parameters." },
        { status: 400 }
      );
    }

    const result = await generateQuestionStudioAi(parsed.data);

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
        { error: result.error || "Failed to generate questions." },
        { status: result.statusCode || 502 }
      );
    }

    return NextResponse.json({ questionSet: result.data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
