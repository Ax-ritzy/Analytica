"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  FileText,
  Sparkles,
  Save,
  Download,
  Clock,
  ListOrdered,
  History,
  Printer,
  Copy,
  Check,
  CheckCircle2,
} from "lucide-react";
import { motion } from "motion/react";
import Navbar from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";
import { Course, GeneratedDocument, LessonPlanContent } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";

export default function LessonPlannerPage() {
  const toast = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [courseName, setCourseName] = useState("");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [teachingLevel, setTeachingLevel] = useState("Undergraduate (Introductory)");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [learningObjectives, setLearningObjectives] = useState("");

  const [generating, setGenerating] = useState(false);
  const [lessonPlan, setLessonPlan] = useState<LessonPlanContent | null>(null);
  const [savedPlans, setSavedPlans] = useState<GeneratedDocument[]>([]);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"planner" | "saved">("planner");

  const loadSavedPlans = useCallback(async (userId: string) => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("generated_documents")
        .select("*")
        .eq("owner_id", userId)
        .eq("document_type", "lesson_plan")
        .order("created_at", { ascending: false });

      if (data) {
        setSavedPlans(data as GeneratedDocument[]);
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
        const { data: cList } = await supabase
          .from("courses")
          .select("id, name, course_code")
          .eq("owner_id", user.id)
          .order("name");

        if (cList && cList.length > 0) {
          setCourses(cList as Course[]);
          setSelectedCourseId(cList[0].id);
          setCourseName(cList[0].name);
          setSubject(cList[0].name);
        }

        await loadSavedPlans(user.id);
      }
    } catch {
      // Ignored
    }
  }, [loadSavedPlans]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  function handleCourseChange(courseId: string) {
    setSelectedCourseId(courseId);
    const found = courses.find((c) => c.id === courseId);
    if (found) {
      setCourseName(found.name);
      setSubject(found.name);
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;

    setGenerating(true);

    try {
      const res = await fetch("/api/lesson-planner/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: selectedCourseId || undefined,
          courseName: courseName.trim() || subject.trim() || "Higher Education Course",
          subject: subject.trim() || courseName.trim() || "Academic Subject",
          topic: topic.trim(),
          teachingLevel,
          durationMinutes: Number(durationMinutes),
          learningObjectives: learningObjectives.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate lesson plan.");
      }

      setLessonPlan(data.lessonPlan);
      toast.success("AI Curriculum Plan synthesized successfully.", "Lesson Plan Ready");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Generation failed.";
      toast.error(msg, "Generation Error");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSavePlan() {
    if (!lessonPlan) return;
    setSaving(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Please sign in to save lesson plans.");

      const title = `${lessonPlan.topic} (${lessonPlan.subject})`;

      const { error } = await supabase.from("generated_documents").insert({
        owner_id: user.id,
        course_id: selectedCourseId || null,
        title,
        document_type: "lesson_plan",
        content: lessonPlan as unknown as Record<string, unknown>,
        status: "approved",
      });

      if (error) throw error;

      toast.success(`"${title}" saved to your documents.`, "Saved Successfully");
      loadSavedPlans(user.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save plan.";
      toast.error(msg, "Save Failed");
    } finally {
      setSaving(false);
    }
  }

  function handleExportMarkdown() {
    if (!lessonPlan) return;

    const md = `# Lesson Plan: ${lessonPlan.topic}
**Subject:** ${lessonPlan.subject}  
**Level:** ${lessonPlan.teaching_level}  
**Duration:** ${lessonPlan.total_duration_minutes} Minutes  

## Learning Objectives
${lessonPlan.learning_objectives.map((obj) => `- ${obj}`).join("\n")}

## Required Materials
${lessonPlan.required_materials.map((mat) => `- ${mat}`).join("\n")}

## Lesson Structure & Activities
${lessonPlan.lesson_structure
  .map(
    (act, i) => `### Phase ${i + 1}: ${act.phase} (${act.duration_minutes} mins)
**Description:** ${act.description}  
${act.materials ? `**Materials:** ${act.materials}` : ""}
`
  )
  .join("\n")}

## Assessment Methods
${lessonPlan.assessment_methods.map((am) => `- ${am}`).join("\n")}

${lessonPlan.homework_or_extension ? `## Homework / Extension\n${lessonPlan.homework_or_extension}\n` : ""}
${lessonPlan.notes_for_faculty ? `## Faculty Notes\n${lessonPlan.notes_for_faculty}\n` : ""}
`;

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Lesson_Plan_${lessonPlan.topic.replace(/[^a-zA-Z0-9]/g, "_")}.md`;
    link.click();
    URL.revokeObjectURL(url);
    toast.info("Lesson plan downloaded as Markdown file.", "Export Complete");
  }

  function handleCopyJson() {
    if (!lessonPlan) return;
    navigator.clipboard.writeText(JSON.stringify(lessonPlan, null, 2));
    setCopied(true);
    toast.info("Lesson plan data copied to clipboard.", "Copied");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSelectSaved(doc: GeneratedDocument) {
    setLessonPlan(doc.content as LessonPlanContent);
    setActiveTab("planner");
    toast.info(`Loaded plan: ${doc.title}`, "Saved Plan Loaded");
  }

  return (
    <div className="min-h-screen bg-[#080d18] text-[#e8edf7]">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400">
              <Sparkles size={14} /> Pedagogical Design
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">AI Lesson Planner</h1>
            <p className="mt-1 text-xs text-slate-400">
              Transform syllabus topics into structured higher-education curriculum timelines.
            </p>
          </div>

          <div className="flex rounded-2xl bg-[#0f172a] p-1 border border-white/10 shadow-sm">
            <button
              onClick={() => setActiveTab("planner")}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                activeTab === "planner" ? "bg-blue-600 text-white shadow-md shadow-blue-900/40" : "text-slate-400 hover:text-white"
              }`}
            >
              Planner
            </button>
            <button
              onClick={() => setActiveTab("saved")}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                activeTab === "saved" ? "bg-blue-600 text-white shadow-md shadow-blue-900/40" : "text-slate-400 hover:text-white"
              }`}
            >
              <History size={13} /> Saved Plans ({savedPlans.length})
            </button>
          </div>
        </div>

        {activeTab === "planner" ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-12">
            {/* Input Form (Col 1-5) */}
            <div className="lg:col-span-5 rounded-3xl border border-white/10 bg-[#0f172a] p-6 shadow-sm">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText size={16} className="text-blue-400" /> Lesson Parameters
              </h2>
              <p className="mt-1 text-xs text-slate-400">Specify criteria for the AI curriculum generator.</p>

              <form onSubmit={handleGenerate} className="mt-5 space-y-4">
                {courses.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300">Target Course</label>
                    <select
                      value={selectedCourseId}
                      onChange={(e) => handleCourseChange(e.target.value)}
                      className="mt-1.5 w-full rounded-2xl border border-white/10 bg-[#090d16] px-3.5 py-2.5 text-xs text-white outline-none focus:border-blue-500 transition-colors"
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
                  <label className="block text-xs font-semibold text-slate-300">Subject / Discipline *</label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Distributed Operating Systems"
                    className="mt-1.5 w-full rounded-2xl border border-white/10 bg-[#090d16] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300">Lesson Topic *</label>
                  <input
                    type="text"
                    required
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Raft Consensus Algorithm & Leader Election"
                    className="mt-1.5 w-full rounded-2xl border border-white/10 bg-[#090d16] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300">Duration (Minutes)</label>
                    <input
                      type="number"
                      min={15}
                      max={360}
                      step={5}
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(Number(e.target.value))}
                      className="mt-1.5 w-full rounded-2xl border border-white/10 bg-[#090d16] px-3.5 py-2.5 text-xs text-white outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300">Teaching Level</label>
                    <select
                      value={teachingLevel}
                      onChange={(e) => setTeachingLevel(e.target.value)}
                      className="mt-1.5 w-full rounded-2xl border border-white/10 bg-[#090d16] px-3.5 py-2.5 text-xs text-white outline-none focus:border-blue-500 transition-colors"
                    >
                      <option value="Undergraduate (Introductory)">Undergraduate (Introductory)</option>
                      <option value="Undergraduate (Advanced)">Undergraduate (Advanced)</option>
                      <option value="Postgraduate / Master's">Postgraduate / Master&apos;s</option>
                      <option value="Doctoral / Seminar">Doctoral / Seminar</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300">
                    Faculty Objectives / Focus (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={learningObjectives}
                    onChange={(e) => setLearningObjectives(e.target.value)}
                    placeholder="e.g. Emphasize network partitions, split-brain scenarios, and log consistency checks."
                    className="mt-1.5 w-full resize-none rounded-2xl border border-white/10 bg-[#090d16] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={generating || !topic.trim()}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-xs font-bold text-white shadow-xl shadow-blue-900/40 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 transition-all"
                >
                  <Sparkles size={16} className={generating ? "animate-spin" : ""} />
                  {generating ? "Synthesizing Curriculum with Gemini..." : "Generate Lesson Plan"}
                </motion.button>
              </form>
            </div>

            {/* Generated Plan Output (Col 6-12) */}
            <div className="lg:col-span-7">
              {generating ? (
                <div className="h-full min-h-[460px] flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-[#0f172a] p-12 text-center">
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-400">
                    <Sparkles size={32} className="animate-spin" />
                    <div className="absolute inset-0 rounded-2xl border-2 border-blue-400/40 animate-ping" />
                  </div>
                  <h3 className="mt-5 text-base font-bold text-white">Structuring Higher Education Curriculum</h3>
                  <p className="mt-1.5 text-xs text-slate-400 max-w-sm">
                    Gemini 3.5 Flash is generating learning objectives, instructional phases, and formative assessments.
                  </p>
                </div>
              ) : lessonPlan ? (
                <motion.div
                  initial={false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className="rounded-3xl border border-white/10 bg-[#0f172a] p-6 shadow-sm"
                >
                  {/* Action Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                    <div>
                      <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[10px] font-bold text-blue-300 border border-blue-500/30">
                        {lessonPlan.teaching_level}
                      </span>
                      <h2 className="mt-1.5 text-lg font-bold text-white">{lessonPlan.topic}</h2>
                      <p className="text-xs text-slate-400">
                        {lessonPlan.subject} • {lessonPlan.total_duration_minutes} Minutes Total
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <motion.button
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={handleSavePlan}
                        disabled={saving}
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors shadow-md shadow-emerald-950/40"
                      >
                        <Save size={14} /> {saving ? "Saving..." : "Save"}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={handleExportMarkdown}
                        className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 transition-colors"
                      >
                        <Download size={14} /> Export .md
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={handleCopyJson}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 transition-colors"
                        title="Copy JSON data"
                      >
                        {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => window.print()}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 transition-colors"
                        title="Print lesson plan"
                      >
                        <Printer size={14} />
                      </motion.button>
                      <Link
                        href={`/question-studio?topic=${encodeURIComponent(lessonPlan.topic)}&courseId=${selectedCourseId || ""}`}
                        className="flex items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/15 px-3 py-2 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/25 transition-colors shadow-sm"
                        title="Create examination questions from this lesson plan"
                      >
                        <Sparkles size={14} className="text-indigo-400" />
                        <span>Create Exam</span>
                      </Link>
                    </div>
                  </div>

                  {/* Plan Content */}
                  <div className="mt-6 space-y-6">
                    {/* Objectives */}
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <CheckCircle2 size={14} className="text-blue-400" /> Learning Outcomes
                      </h3>
                      <ul className="mt-2.5 list-disc pl-5 space-y-1.5 text-xs text-slate-200">
                        {lessonPlan.learning_objectives.map((obj, i) => (
                          <li key={i}>{obj}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Materials */}
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Required Materials</h3>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {lessonPlan.required_materials.map((m, i) => (
                          <span
                            key={i}
                            className="rounded-xl bg-white/5 border border-white/5 px-3 py-1 text-xs text-slate-300"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Interactive Timeline Structure */}
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <ListOrdered size={14} className="text-blue-400" /> Lesson Structure & Teaching Timeline
                      </h3>
                      <div className="mt-3 space-y-3">
                        {lessonPlan.lesson_structure.map((act, i) => (
                          <motion.div
                            key={i}
                            whileHover={{ x: 2 }}
                            className="rounded-2xl border border-white/5 bg-[#090d16] p-4.5 transition-all"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-white">
                                Phase {i + 1}: {act.phase}
                              </span>
                              <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                                <Clock size={11} /> {act.duration_minutes} min
                              </span>
                            </div>
                            <p className="mt-2 text-xs leading-relaxed text-slate-300">{act.description}</p>
                            {act.materials && (
                              <p className="mt-2 text-[11px] text-slate-500">
                                <span className="text-slate-400 font-semibold">Resources:</span> {act.materials}
                              </p>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* Assessments */}
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Formative Assessment Strategies
                      </h3>
                      <ul className="mt-2.5 list-disc pl-5 space-y-1.5 text-xs text-slate-200">
                        {lessonPlan.assessment_methods.map((am, i) => (
                          <li key={i}>{am}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Faculty Notes */}
                    {lessonPlan.notes_for_faculty && (
                      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[.06] p-4 text-xs text-amber-200">
                        <p className="font-bold text-amber-300">Faculty Delivery Guidance:</p>
                        <p className="mt-1 leading-relaxed text-slate-300">{lessonPlan.notes_for_faculty}</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : (
                <div className="h-full min-h-[460px] flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-[#0f172a] p-12 text-center">
                  <FileText className="text-slate-600" size={38} />
                  <h3 className="mt-3 text-sm font-bold text-white">No Lesson Plan Generated Yet</h3>
                  <p className="mt-1.5 text-xs text-slate-400 max-w-sm leading-relaxed">
                    Configure your discipline and topic parameters on the left and click &quot;Generate Lesson Plan&quot; to
                    synthesize an AI-aligned syllabus.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Saved Plans Tab */
          <div className="mt-8 rounded-3xl border border-white/10 bg-[#0f172a] p-6 shadow-sm">
            <h2 className="text-base font-bold text-white">Saved Curriculum Plans</h2>
            <p className="text-xs text-slate-400">Stored lesson plans accessible across your academic sessions.</p>

            <div className="mt-5 space-y-3">
              {savedPlans.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-500">
                  No saved plans yet. Generate a curriculum above and click &quot;Save&quot;.
                </div>
              ) : (
                savedPlans.map((doc) => (
                  <motion.div
                    key={doc.id}
                    whileHover={{ x: 2 }}
                    className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#090d16] p-4.5 transition-all"
                  >
                    <div>
                      <h4 className="text-sm font-bold text-white">{doc.title}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Created on {new Date(doc.created_at).toLocaleDateString()} • Status: {doc.status.toUpperCase()}
                      </p>
                    </div>

                    <button
                      onClick={() => handleSelectSaved(doc)}
                      className="rounded-xl bg-blue-600/30 border border-blue-500/30 px-3.5 py-1.5 text-xs font-bold text-blue-300 hover:bg-blue-600/50 transition-colors"
                    >
                      Open Plan →
                    </button>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
