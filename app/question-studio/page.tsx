"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  HelpCircle,
  Sparkles,
  Save,
  Download,
  ChevronDown,
  ChevronUp,
  History,
  FileQuestion,
  Printer,
  Copy,
  Check,
  Search,
  BookOpen,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";
import { Course, GeneratedDocument, QuestionSetContent } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { FadeIn, SlideUp, StaggerContainer, StaggerItem, motion, AnimatePresence } from "@/components/ui/MotionWrapper";
import { SkeletonCard } from "@/components/ui/Skeleton";

function QuestionStudioInner() {
  const { addToast } = useToast();
  const searchParams = useSearchParams();

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [courseName, setCourseName] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [questionType, setQuestionType] = useState<"mcq" | "short" | "long" | "true_false">("mcq");
  const [count, setCount] = useState(5);

  const [generating, setGenerating] = useState(false);
  const [questionSet, setQuestionSet] = useState<QuestionSetContent | null>(null);
  const [savedSets, setSavedSets] = useState<GeneratedDocument[]>([]);
  const [saving, setSaving] = useState(false);
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<"studio" | "saved">("studio");
  const [searchSaved, setSearchSaved] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sync search parameters from URL (e.g. from Lesson Planner "Generate Assessment")
  useEffect(() => {
    const urlTopic = searchParams.get("topic");
    const urlCourseId = searchParams.get("courseId");
    if (urlTopic) {
      setTopic(urlTopic);
    }
    if (urlCourseId) {
      setSelectedCourseId(urlCourseId);
    }
  }, [searchParams]);

  const loadSavedSets = useCallback(async (userId: string) => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("generated_documents")
        .select("*")
        .eq("owner_id", userId)
        .eq("document_type", "question_set")
        .order("created_at", { ascending: false });

      if (data) {
        setSavedSets(data as GeneratedDocument[]);
      }
    } catch {
      // Ignored
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Load courses
        const { data: cList } = await supabase
          .from("courses")
          .select("id, name, course_code")
          .eq("owner_id", user.id)
          .order("name");

        if (cList && cList.length > 0) {
          setCourses(cList as Course[]);
          const urlCourseId = searchParams.get("courseId");
          const targetCourseId =
            urlCourseId && cList.some((c) => c.id === urlCourseId)
              ? urlCourseId
              : cList[0].id;
          setSelectedCourseId(targetCourseId);
          const found = cList.find((c) => c.id === targetCourseId);
          if (found) {
            setCourseName(found.name);
          }
        }

        // Load saved question sets
        await loadSavedSets(user.id);
      }
    } catch {
      // Ignored
    }
  }, [loadSavedSets, searchParams]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  function handleCourseChange(courseId: string) {
    setSelectedCourseId(courseId);
    const found = courses.find((c) => c.id === courseId);
    if (found) {
      setCourseName(found.name);
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;

    setGenerating(true);

    try {
      const res = await fetch("/api/question-studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseName: courseName.trim() || "Higher Education Course",
          topic: topic.trim(),
          difficulty,
          questionType,
          count: Number(count),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate questions.");
      }

      setQuestionSet(data.questionSet);
      setRevealedAnswers({});
      addToast({
        title: "Questions Synthesized",
        description: `Generated ${data.questionSet.questions.length} ${difficulty.toUpperCase()} questions on ${data.questionSet.topic}.`,
        type: "success",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Generation failed.";
      addToast({
        title: "Synthesis Error",
        description: msg,
        type: "error",
      });
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveQuestions() {
    if (!questionSet) return;
    setSaving(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Please sign in to save questions.");

      const title = `${questionSet.topic} (${questionType.toUpperCase()} - ${difficulty})`;

      const { error } = await supabase.from("generated_documents").insert({
        owner_id: user.id,
        course_id: selectedCourseId || null,
        title,
        document_type: "question_set",
        content: questionSet as unknown as Record<string, unknown>,
        status: "approved",
      });

      if (error) throw error;

      addToast({
        title: "Saved to Repository",
        description: `Assessment bank "${title}" stored securely in your institutional account.`,
        type: "success",
      });
      loadSavedSets(user.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save questions.";
      addToast({
        title: "Save Failed",
        description: msg,
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  function handleExportExamMarkdown() {
    if (!questionSet) return;

    const md = `# Examination Paper: ${questionSet.topic}
**Difficulty Level:** ${questionSet.difficulty.toUpperCase()}  
**Total Marks:** ${questionSet.total_marks || "N/A"}  
**Instructions:** Answer all questions carefully. Show all workings where applicable.  

---

## Questions

${questionSet.questions
  .map((q, i) => {
    let out = `### Q${i + 1}. ${q.prompt} [${q.marks || 2} Marks]\n`;
    if (q.options && q.options.length > 0) {
      out += q.options.map((opt, oi) => `   (${String.fromCharCode(65 + oi)}) ${opt}`).join("\n") + "\n";
    }
    return out;
  })
  .join("\n")}

---

## Faculty Answer Key & Scoring Rubric

${questionSet.questions
  .map(
    (q, i) => `### Q${i + 1} Solution:
- **Correct Answer:** ${q.correct_answer}
${q.explanation ? `- **Explanation / Rubric:** ${q.explanation}` : ""}
`
  )
  .join("\n")}
`;

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Exam_${questionSet.topic.replace(/[^a-zA-Z0-9]/g, "_")}.md`;
    link.click();
    URL.revokeObjectURL(url);

    addToast({
      title: "Exam Exported",
      description: "Downloaded markdown file with examination questions and faculty answer key.",
      type: "success",
    });
  }

  function handleCopyQuestion(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    addToast({
      title: "Copied to Clipboard",
      description: "Question and options copied successfully.",
      type: "info",
    });
    setTimeout(() => setCopiedId(null), 2000);
  }

  function toggleReveal(id: string) {
    setRevealedAnswers((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleRevealAll() {
    if (!questionSet) return;
    const allRevealed = questionSet.questions.every((q) => revealedAnswers[q.id]);
    const nextState: Record<string, boolean> = {};
    questionSet.questions.forEach((q) => {
      nextState[q.id] = !allRevealed;
    });
    setRevealedAnswers(nextState);
  }

  function handleSelectSaved(doc: GeneratedDocument) {
    setQuestionSet(doc.content as QuestionSetContent);
    setActiveTab("studio");
    addToast({
      title: "Loaded Bank",
      description: `Loaded question set: ${doc.title}`,
      type: "info",
    });
  }

  const filteredSavedSets = savedSets.filter((s) =>
    s.title.toLowerCase().includes(searchSaved.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#080d18] text-[#e8edf7] selection:bg-blue-500/30">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Header */}
        <SlideUp>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-400">
                <Sparkles size={14} className="animate-pulse" /> Assessment Engineering
              </div>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">Question Studio</h1>
              <p className="mt-1 text-xs text-slate-400">
                Generate syllabus-aligned multiple choice, short-answer, and comprehensive essay examination banks.
              </p>
            </div>

            <div className="flex rounded-xl bg-[#0f172a] p-1 border border-white/10 shadow-inner">
              <button
                onClick={() => setActiveTab("studio")}
                className={`relative rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
                  activeTab === "studio" ? "text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {activeTab === "studio" && (
                  <motion.div
                    layoutId="questionTab"
                    className="absolute inset-0 rounded-lg bg-blue-600 shadow-sm shadow-blue-500/40"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <HelpCircle size={13} /> Studio
                </span>
              </button>
              <button
                onClick={() => setActiveTab("saved")}
                className={`relative rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
                  activeTab === "saved" ? "text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {activeTab === "saved" && (
                  <motion.div
                    layoutId="questionTab"
                    className="absolute inset-0 rounded-lg bg-blue-600 shadow-sm shadow-blue-500/40"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <History size={13} /> Saved Banks ({savedSets.length})
                </span>
              </button>
            </div>
          </div>
        </SlideUp>

        {activeTab === "studio" ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-12">
            {/* Input Form (Col 1-5) */}
            <motion.div
              initial={false}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="lg:col-span-5 rounded-2xl border border-white/10 bg-[#0f172a]/90 backdrop-blur-md p-6 shadow-xl"
            >
              <div className="flex items-center gap-2 border-b border-white/10 pb-4">
                <div className="rounded-xl bg-blue-500/15 p-2 text-blue-400">
                  <HelpCircle size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Assessment Criteria</h2>
                  <p className="text-[11px] text-slate-400">Target specific learning goals & difficulty levels.</p>
                </div>
              </div>

              <form onSubmit={handleGenerate} className="mt-5 space-y-4">
                {/* Course Selection */}
                {courses.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-slate-300">Course Connection</label>
                    <select
                      value={selectedCourseId}
                      onChange={(e) => handleCourseChange(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#090d16] px-3.5 py-2.5 text-xs text-white outline-none focus:border-blue-500 transition-colors"
                    >
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.course_code ? `(${c.course_code})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-300">Subject / Module Name *</label>
                  <input
                    type="text"
                    required
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    placeholder="e.g. Advanced Operating Systems"
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#090d16] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300">Assessment Topic or Objective *</label>
                  <input
                    type="text"
                    required
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Memory Virtualization, Page Tables & TLB Thrashing"
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#090d16] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300">Question Format</label>
                    <select
                      value={questionType}
                      onChange={(e) =>
                        setQuestionType(e.target.value as "mcq" | "short" | "long" | "true_false")
                      }
                      className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#090d16] px-3.5 py-2.5 text-xs text-white outline-none focus:border-blue-500 transition-colors"
                    >
                      <option value="mcq">Multiple Choice (MCQ)</option>
                      <option value="short">Short Answer</option>
                      <option value="long">Long Essay / Design</option>
                      <option value="true_false">True / False</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300">Cognitive Level</label>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard")}
                      className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#090d16] px-3.5 py-2.5 text-xs text-white outline-none focus:border-blue-500 transition-colors"
                    >
                      <option value="easy">Easy (Knowledge / Recall)</option>
                      <option value="medium">Medium (Application / Analysis)</option>
                      <option value="hard">Hard (Synthesis / Evaluation)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center text-xs font-medium text-slate-300">
                    <span>Number of Questions</span>
                    <span className="font-mono text-blue-400 font-bold">{count} Questions</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={15}
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                    className="mt-2 w-full accent-blue-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>1 (Quick Check)</span>
                    <span>5 (Quiz)</span>
                    <span>15 (Exam Paper)</span>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={generating || !topic.trim()}
                  className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-xs font-semibold text-white shadow-lg shadow-blue-900/40 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 transition-all cursor-pointer"
                >
                  <Sparkles size={16} className={generating ? "animate-spin" : ""} />
                  {generating ? "Synthesizing Exam Bank with Gemini..." : "Synthesize Question Bank"}
                </motion.button>
              </form>
            </motion.div>

            {/* Generated Question Paper Output (Col 6-12) */}
            <motion.div
              initial={false}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="lg:col-span-7"
            >
              {generating ? (
                <div className="rounded-2xl border border-white/10 bg-[#0f172a] p-6 shadow-xl space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                    <span className="text-xs font-medium text-blue-300">
                      Generating questions, grading rubrics, and distractor options...
                    </span>
                  </div>
                  <SkeletonCard />
                  <SkeletonCard />
                </div>
              ) : questionSet ? (
                <div className="rounded-2xl border border-white/10 bg-[#0f172a]/90 backdrop-blur-md p-6 shadow-xl">
                  {/* Action Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-blue-500/20 border border-blue-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-blue-300 uppercase">
                          {questionSet.difficulty}
                        </span>
                        <span className="text-xs text-slate-400">
                          {questionSet.questions.length} Items • {questionSet.total_marks || "N/A"} Total Marks
                        </span>
                      </div>
                      <h2 className="mt-1 text-lg font-bold text-white">{questionSet.topic}</h2>
                    </div>

                    <div className="flex items-center gap-2">
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={handleSaveQuestions}
                        disabled={saving}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
                      >
                        <Save size={13} /> {saving ? "Saving..." : "Save Bank"}
                      </motion.button>
                      <button
                        onClick={handleExportExamMarkdown}
                        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 cursor-pointer transition-colors"
                      >
                        <Download size={13} /> Export .md
                      </button>
                      <button
                        onClick={toggleRevealAll}
                        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 cursor-pointer transition-colors"
                      >
                        Toggle Keys
                      </button>
                      <button
                        onClick={() => window.print()}
                        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/10 cursor-pointer transition-colors"
                      >
                        <Printer size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Question Cards with Staggered Entrance */}
                  <StaggerContainer className="mt-5 space-y-4">
                    {questionSet.questions.map((q, i) => {
                      const isRevealed = revealedAnswers[q.id];
                      const questionTextToCopy = `${i + 1}. ${q.prompt}\n${
                        q.options ? q.options.map((opt, oi) => `(${String.fromCharCode(65 + oi)}) ${opt}`).join("\n") : ""
                      }\nAnswer: ${q.correct_answer}`;

                      return (
                        <StaggerItem key={q.id || i}>
                          <div className="group rounded-xl border border-white/10 bg-[#090d16] p-4.5 hover:border-blue-500/30 transition-all shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                              <span className="text-xs font-semibold text-white leading-relaxed">
                                <span className="text-blue-400 font-mono mr-1.5">#{i + 1}</span> {q.prompt}
                              </span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="rounded-md bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[10px] font-mono text-blue-300">
                                  {q.marks || 2} Marks
                                </span>
                                <button
                                  onClick={() => handleCopyQuestion(questionTextToCopy, q.id)}
                                  className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/5 transition-colors"
                                  title="Copy question"
                                >
                                  {copiedId === q.id ? (
                                    <Check size={13} className="text-emerald-400" />
                                  ) : (
                                    <Copy size={13} />
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Options if MCQ or True/False */}
                            {q.options && q.options.length > 0 && (
                              <div className="mt-3.5 grid gap-2 sm:grid-cols-2">
                                {q.options.map((opt, oi) => (
                                  <div
                                    key={oi}
                                    className="rounded-lg border border-white/5 bg-white/[.02] p-2.5 text-xs text-slate-300 flex items-start gap-2"
                                  >
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-blue-500/10 text-[10px] font-bold text-blue-400">
                                      {String.fromCharCode(65 + oi)}
                                    </span>
                                    <span className="leading-5">{opt}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Answer Key Toggle with Smooth Height Animation */}
                            <div className="mt-3.5 border-t border-white/5 pt-2.5">
                              <button
                                type="button"
                                onClick={() => toggleReveal(q.id)}
                                className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                              >
                                {isRevealed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                {isRevealed ? "Hide Answer & Scoring Rubric" : "Reveal Answer & Scoring Rubric"}
                              </button>

                              <AnimatePresence>
                                {isRevealed && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="mt-2.5 rounded-xl bg-black/40 p-3.5 text-xs border border-white/10 space-y-2">
                                      <div className="flex items-start gap-2 text-emerald-300 font-medium">
                                        <span className="text-slate-400 shrink-0 font-semibold">Answer:</span>
                                        <span>{q.correct_answer}</span>
                                      </div>
                                      {q.explanation && (
                                        <div className="flex items-start gap-2 text-slate-300 leading-relaxed text-[11px]">
                                          <span className="text-slate-400 shrink-0 font-medium">Rubric:</span>
                                          <span>{q.explanation}</span>
                                        </div>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        </StaggerItem>
                      );
                    })}
                  </StaggerContainer>
                </div>
              ) : (
                <div className="h-full min-h-[420px] flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#0f172a]/50 p-12 text-center backdrop-blur-sm">
                  <div className="rounded-2xl bg-blue-500/10 p-4 text-blue-400">
                    <FileQuestion size={36} />
                  </div>
                  <h3 className="mt-4 text-base font-bold text-white">No Question Set Generated Yet</h3>
                  <p className="mt-1 text-xs text-slate-400 max-w-sm leading-relaxed">
                    Configure your assessment parameters on the left and click &quot;Synthesize Question Bank&quot; to build
                    formal examination papers, midterms, or practice sets.
                  </p>
                </div>
              )}
            </motion.div>
          </div>
        ) : (
          /* Saved Banks Tab */
          <FadeIn className="mt-8 rounded-2xl border border-white/10 bg-[#0f172a]/90 backdrop-blur-md p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <History size={18} className="text-blue-400" /> Saved Assessment Banks
                </h2>
                <p className="text-xs text-slate-400">
                  Access examination papers and question sets previously saved to your institutional profile.
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter question banks..."
                  value={searchSaved}
                  onChange={(e) => setSearchSaved(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#090d16] pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {filteredSavedSets.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-500">
                  {searchSaved ? "No saved question banks matching your query." : "No saved question banks yet. Generate an assessment and click 'Save Bank'."}
                </div>
              ) : (
                filteredSavedSets.map((doc) => (
                  <motion.div
                    key={doc.id}
                    whileHover={{ scale: 1.005 }}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-white/5 bg-[#090d16] p-4.5 hover:border-blue-500/20 transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <BookOpen size={14} className="text-blue-400" />
                        <h4 className="text-sm font-semibold text-white">{doc.title}</h4>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Synthesized on {new Date(doc.created_at).toLocaleDateString()} • Status:{" "}
                        <span className="text-emerald-400 capitalize">{doc.status}</span>
                      </p>
                    </div>

                    <button
                      onClick={() => handleSelectSaved(doc)}
                      className="rounded-lg bg-blue-600/20 border border-blue-500/30 px-3.5 py-1.5 text-xs font-medium text-blue-300 hover:bg-blue-600/40 cursor-pointer transition-colors"
                    >
                      Open in Studio →
                    </button>
                  </motion.div>
                ))
              )}
            </div>
          </FadeIn>
        )}
      </main>
    </div>
  );
}

export default function QuestionStudioPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#090d16]" />}>
      <QuestionStudioInner />
    </Suspense>
  );
}
