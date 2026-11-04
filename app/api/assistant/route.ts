import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateChatReply } from "@/lib/ai/gemini";
import { chunkAcademicText, formatGroundingContext, DocumentChunk } from "@/lib/ai/documentProcessor";

interface CachedCourseGrounding {
  groundingContext: string;
  cachedAt: number;
}

// In-memory cache for extracted syllabus & document grounding (5 min TTL)
// Dramatically reduces storage download latency and egress bandwidth on repeated chat turns
const groundingCache = new Map<string, CachedCourseGrounding>();
const GROUNDING_CACHE_TTL_MS = 5 * 60 * 1000;

const AssistantSchema = z.object({
  message: z.string().trim().min(1, "Message cannot be empty").max(8000),
  conversationId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // 1. Authentication check
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required. Please sign in to use the AI Assistant." },
        { status: 401 }
      );
    }

    // 2. Body validation
    const rawBody = await request.json().catch(() => null);
    const parsed = AssistantSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid request payload." },
        { status: 400 }
      );
    }

    const { message, courseId } = parsed.data;
    let conversationId = parsed.data.conversationId;

    // 3. Conversation management
    if (!conversationId) {
      const { data: newConv, error: convErr } = await supabase
        .from("agent_conversations")
        .insert({
          owner_id: user.id,
          title: message.slice(0, 50) + (message.length > 50 ? "..." : ""),
        })
        .select("id")
        .single();

      if (!convErr && newConv) {
        conversationId = newConv.id;
      }
    }

    // 4. Retrieve recent conversation history (last 10 messages for context)
    let history: Array<{ role: "user" | "assistant"; content: string }> = [];
    if (conversationId) {
      const { data: messages } = await supabase
        .from("agent_messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(10);

      if (messages) {
        history = messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));
      }
    }

    // 5. Course context & Document Grounding retrieval (RAG)
    let courseContext = "";
    if (courseId) {
      const { data: course } = await supabase
        .from("courses")
        .select("name, course_code, description")
        .eq("id", courseId)
        .single();

      if (course) {
        courseContext = `Active Course: ${course.name} (${course.course_code || "No code"})\nDescription: ${
          course.description || "N/A"
        }`;

        // Retrieve attached academic documents from Cache or Supabase Storage (Parallel + Cached)
        try {
          const cached = groundingCache.get(courseId);
          if (cached && Date.now() - cached.cachedAt < GROUNDING_CACHE_TTL_MS) {
            courseContext += `\n\n${cached.groundingContext}`;
          } else {
            const { data: docs } = await supabase
              .from("academic_documents")
              .select("filename, bucket_name, object_path, mime_type")
              .eq("course_id", courseId)
              .limit(5);

            if (docs && docs.length > 0) {
              // Execute downloads in parallel with Promise.allSettled for maximum speed
              const downloadResults = await Promise.allSettled(
                docs.map(async (doc) => {
                  const { data: blob, error: dlErr } = await supabase.storage
                    .from(doc.bucket_name)
                    .download(doc.object_path);

                  if (dlErr || !blob) return null;
                  const text = await blob.text();
                  const cleanText = text
                    .replace(/[^\x20-\x7E\t\n\r]/g, " ")
                    .replace(/\s+/g, " ")
                    .trim();

                  if (cleanText.length > 20) {
                    return chunkAcademicText(cleanText, {
                      metadata: { filename: doc.filename, courseId },
                    });
                  }
                  return null;
                })
              );

              const docChunks: DocumentChunk[] = [];
              for (const result of downloadResults) {
                if (result.status === "fulfilled" && result.value) {
                  docChunks.push(...result.value);
                }
              }

              if (docChunks.length > 0) {
                const groundingContext = formatGroundingContext(docChunks, 6000);
                groundingCache.set(courseId, {
                  groundingContext,
                  cachedAt: Date.now(),
                });
                courseContext += `\n\n${groundingContext}`;
              }
            }
          }
        } catch {
          // Graceful non-blocking fallback if storage read encounters errors
        }
      }
    }

    // 6. Call AI service
    const aiResult = await generateChatReply(history, message, courseContext);

    // 7. Usage logging
    try {
      await supabase.from("ai_usage_logs").insert({
        owner_id: user.id,
        provider: "gemini",
        model: aiResult.modelUsed || process.env.GEMINI_MODEL || "gemini-2.0-flash",
        status: aiResult.success ? "success" : "failed",
        input_tokens: aiResult.tokens?.promptTokens ?? null,
        output_tokens: aiResult.tokens?.completionTokens ?? null,
        error_code: aiResult.success ? null : `HTTP_${aiResult.statusCode || 500}`,
      });
    } catch {
      // Non-blocking log failure
    }

    if (!aiResult.success) {
      return NextResponse.json(
        { error: aiResult.error || "The AI assistant could not process your request." },
        { status: aiResult.statusCode || 502 }
      );
    }

    // 8. Persist conversation messages
    if (conversationId) {
      await supabase.from("agent_messages").insert([
        {
          conversation_id: conversationId,
          owner_id: user.id,
          role: "user",
          content: message,
        },
        {
          conversation_id: conversationId,
          owner_id: user.id,
          role: "assistant",
          content: aiResult.data || "",
        },
      ]);
    }

    return NextResponse.json({
      reply: aiResult.data,
      conversationId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected server error";
    return NextResponse.json(
      { error: `Internal assistant error: ${message}` },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  // Return conversation history for the authenticated user
  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("conversationId");

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (conversationId) {
      const { data: messages, error } = await supabase
        .from("agent_messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return NextResponse.json({ messages });
    }

    // Otherwise return list of user conversations
    const { data: conversations, error } = await supabase
      .from("agent_conversations")
      .select("id, title, created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ conversations });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch conversations." },
      { status: 500 }
    );
  }
}
