"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Plus,
  TrendingUp,
  FileSpreadsheet,
  Printer,
  Award,
  GraduationCap,
  Percent,
  Download,
  UploadCloud,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";
import { Course, Student, StudentAssessment, StudentScore } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { CountUp } from "@/components/ui/CountUp";
import { SlideUp, FadeIn, motion } from "@/components/ui/MotionWrapper";

export default function AnalyticsPage() {
  const { addToast } = useToast();

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [assessments, setAssessments] = useState<StudentAssessment[]>([]);
  const [scores, setScores] = useState<Record<string, Record<string, number>>>({}); // assessmentId -> studentId -> score

  const [activeTab, setActiveTab] = useState<"summary" | "students" | "marks">("summary");

  // Add Student Modal
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [studentIdNum, setStudentIdNum] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");

  // Bulk CSV Import Modal
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [parsedRows, setParsedRows] = useState<
    Array<{ rollNo: string; name: string; email: string; isDuplicate: boolean; isValid: boolean }>
  >([]);
  const [importLoading, setImportLoading] = useState(false);

  // Add Assessment Modal
  const [isAddAssessmentOpen, setIsAddAssessmentOpen] = useState(false);
  const [assessmentTitle, setAssessmentTitle] = useState("");
  const [assessmentType, setAssessmentType] = useState<
    "quiz" | "assignment" | "midterm" | "final" | "project" | "other"
  >("quiz");
  const [maxScore, setMaxScore] = useState(100);

  const loadCourseData = useCallback(async (courseId: string) => {
    try {
      const supabase = createClient();
      // Load Students
      const { data: stList } = await supabase
        .from("students")
        .select("*")
        .eq("course_id", courseId)
        .order("student_id_number");

      setStudents((stList as Student[]) || []);

      // Load Assessments
      const { data: assList } = await supabase
        .from("student_assessments")
        .select("*")
        .eq("course_id", courseId)
        .order("created_at", { ascending: true });

      setAssessments((assList as StudentAssessment[]) || []);

      // Load Scores
      if (assList && assList.length > 0) {
        const assIds = assList.map((a) => a.id);
        const { data: scList } = await supabase
          .from("student_scores")
          .select("*")
          .in("assessment_id", assIds);

        const scoreMap: Record<string, Record<string, number>> = {};
        if (scList) {
          scList.forEach((s: StudentScore) => {
            if (!scoreMap[s.assessment_id]) scoreMap[s.assessment_id] = {};
            scoreMap[s.assessment_id][s.student_id] = Number(s.score);
          });
        }
        setScores(scoreMap);
      } else {
        setScores({});
      }
    } catch {
      // Ignored
    }
  }, []);

  const loadCourses = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data } = await supabase
          .from("courses")
          .select("id, name, course_code")
          .eq("owner_id", user.id)
          .order("name");

        if (data && data.length > 0) {
          setCourses(data as Course[]);
          setSelectedCourseId(data[0].id);
        }
      }
    } catch {
      // Ignored
    }
  }, []);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    if (selectedCourseId) {
      loadCourseData(selectedCourseId);
    }
  }, [selectedCourseId, loadCourseData]);

  function handleCsvFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        addToast({
          title: "Empty or Invalid CSV",
          description: "File must contain a header row and student data rows.",
          type: "error",
        });
        return;
      }

      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, ""));
      const rollIdx = headers.findIndex((h) => h.includes("roll") || h.includes("id") || h.includes("identifier") || h.includes("student_id"));
      const nameIdx = headers.findIndex((h) => h.includes("name") || h.includes("student"));
      const emailIdx = headers.findIndex((h) => h.includes("email") || h.includes("mail"));

      const existingRolls = new Set(students.map((s) => s.student_id_number.trim().toLowerCase()));
      const rows: Array<{ rollNo: string; name: string; email: string; isDuplicate: boolean; isValid: boolean }> = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
        const roll = (rollIdx !== -1 ? cols[rollIdx] : cols[0]) || "";
        const name = (nameIdx !== -1 ? cols[nameIdx] : cols[1]) || "";
        const email = (emailIdx !== -1 ? cols[emailIdx] : cols[2]) || "";

        if (roll || name) {
          const isDuplicate = existingRolls.has(roll.toLowerCase()) || rows.some((r) => r.rollNo.toLowerCase() === roll.toLowerCase());
          const isValid = roll.length > 0 && name.length > 0;
          rows.push({ rollNo: roll, name, email, isDuplicate, isValid });
        }
      }

      setParsedRows(rows);
    };
    reader.readAsText(file);
  }

  async function handleExecuteBulkImport() {
    const validRows = parsedRows.filter((r) => r.isValid && !r.isDuplicate);
    if (validRows.length === 0 || !selectedCourseId) return;

    setImportLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required.");

      const insertBatch = validRows.map((r) => ({
        course_id: selectedCourseId,
        owner_id: user.id,
        student_id_number: r.rollNo,
        full_name: r.name,
        email: r.email || null,
      }));

      const { error } = await supabase.from("students").insert(insertBatch);
      if (error) throw error;

      addToast({
        title: "Bulk Import Complete",
        description: `Successfully enrolled ${validRows.length} students into this course cohort.`,
        type: "success",
      });
      setIsBulkImportOpen(false);
      setParsedRows([]);
      loadCourseData(selectedCourseId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bulk import failed.";
      addToast({ title: "Import Error", description: msg, type: "error" });
    } finally {
      setImportLoading(false);
    }
  }

  function handleExportMarksheetCsv() {
    if (students.length === 0) {
      addToast({ title: "No Data", description: "Roster has no students to export.", type: "info" });
      return;
    }

    const currentCourse = courses.find((c) => c.id === selectedCourseId);
    const courseTitle = currentCourse ? currentCourse.name : "Course";

    const headerRow = ["Student Roll No", "Full Name", "Email"];
    assessments.forEach((a) => headerRow.push(`"${a.title} (Max ${a.max_score})"`.replace(/\n/g, "")));
    headerRow.push("Total Obtained", "Max Possible", "Percentage", "Letter Grade");

    const maxPossibleTotal = assessments.reduce((acc, a) => acc + Number(a.max_score), 0);
    const rows: string[] = [headerRow.join(",")];

    students.forEach((st) => {
      let totalObtained = 0;
      const rowCols = [`"${st.student_id_number}"`, `"${st.full_name}"`, `"${st.email || ""}"`];

      assessments.forEach((ass) => {
        const val = scores[ass.id]?.[st.id];
        if (typeof val === "number") {
          totalObtained += val;
          rowCols.push(val.toString());
        } else {
          rowCols.push("—");
        }
      });

      const pct = maxPossibleTotal > 0 ? (totalObtained / maxPossibleTotal) * 100 : 0;
      let grade = "F";
      if (pct >= 85) grade = "A";
      else if (pct >= 70) grade = "B";
      else if (pct >= 55) grade = "C";
      else if (pct >= 40) grade = "D";

      rowCols.push(
        totalObtained.toFixed(1),
        maxPossibleTotal.toString(),
        `${pct.toFixed(1)}%`,
        grade
      );

      rows.push(rowCols.join(","));
    });

    const csvContent = "data:text/csv;charset=utf-8," + rows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${courseTitle.replace(/[^a-zA-Z0-9]/g, "_")}_Marksheet_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast({
      title: "Marksheet Exported",
      description: "Downloaded CSV marksheet file.",
      type: "success",
    });
  }

  async function handleAddStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!studentName.trim() || !studentIdNum.trim() || !selectedCourseId) return;

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Authentication required.");

      const { error } = await supabase.from("students").insert({
        course_id: selectedCourseId,
        owner_id: user.id,
        student_id_number: studentIdNum.trim(),
        full_name: studentName.trim(),
        email: studentEmail.trim() || null,
      });

      if (error) throw error;

      addToast({
        title: "Student Registered",
        description: `${studentName} (${studentIdNum}) added to course roster.`,
        type: "success",
      });
      setIsAddStudentOpen(false);
      setStudentIdNum("");
      setStudentName("");
      setStudentEmail("");
      loadCourseData(selectedCourseId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add student.";
      addToast({
        title: "Registration Failed",
        description: msg,
        type: "error",
      });
    }
  }

  async function handleAddAssessment(e: React.FormEvent) {
    e.preventDefault();
    if (!assessmentTitle.trim() || !selectedCourseId) return;

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Authentication required.");

      const { error } = await supabase.from("student_assessments").insert({
        course_id: selectedCourseId,
        owner_id: user.id,
        title: assessmentTitle.trim(),
        assessment_type: assessmentType,
        max_score: Number(maxScore),
      });

      if (error) throw error;

      addToast({
        title: "Assessment Created",
        description: `Assessment "${assessmentTitle}" (Max: ${maxScore}) configured.`,
        type: "success",
      });
      setIsAddAssessmentOpen(false);
      setAssessmentTitle("");
      setMaxScore(100);
      loadCourseData(selectedCourseId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create assessment.";
      addToast({
        title: "Creation Error",
        description: msg,
        type: "error",
      });
    }
  }

  async function handleScoreChange(assessmentId: string, studentId: string, val: string) {
    const num = parseFloat(val);
    if (isNaN(num)) return;

    try {
      const supabase = createClient();
      await supabase.from("student_scores").upsert({
        assessment_id: assessmentId,
        student_id: studentId,
        score: num,
      });

      setScores((prev) => ({
        ...prev,
        [assessmentId]: {
          ...(prev[assessmentId] || {}),
          [studentId]: num,
        },
      }));

      addToast({
        title: "Mark Saved",
        description: `Updated score to ${num}.`,
        type: "info",
      });
    } catch {
      // Ignored
    }
  }

  // Statistical calculations across all entered scores
  const allRecordedScores: number[] = [];
  Object.values(scores).forEach((studMap) => {
    Object.values(studMap).forEach((s) => {
      allRecordedScores.push(s);
    });
  });

  const count = allRecordedScores.length;
  const rawAverage = count > 0 ? allRecordedScores.reduce((a, b) => a + b, 0) / count : 0;
  const sorted = [...allRecordedScores].sort((a, b) => a - b);
  const rawMedian =
    count > 0
      ? count % 2 === 0
        ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
        : sorted[Math.floor(count / 2)]
      : 0;
  const min = count > 0 ? sorted[0] : 0;
  const max = count > 0 ? sorted[count - 1] : 0;
  const passingCount = allRecordedScores.filter((s) => s >= 50).length;
  const rawPassRate = count > 0 ? Math.round((passingCount / count) * 100) : 0;

  // Grade Distribution Tiers
  const distA = allRecordedScores.filter((s) => s >= 85).length;
  const distB = allRecordedScores.filter((s) => s >= 70 && s < 85).length;
  const distC = allRecordedScores.filter((s) => s >= 55 && s < 70).length;
  const distD = allRecordedScores.filter((s) => s >= 40 && s < 55).length;
  const distF = allRecordedScores.filter((s) => s < 40).length;

  return (
    <div className="min-h-screen bg-[#080d18] text-[#e8edf7] selection:bg-blue-500/30">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Header */}
        <SlideUp>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-400">
                <TrendingUp size={14} className="animate-pulse" /> Empirical Assessment & Progress
              </div>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">Student Analytics</h1>
              <p className="mt-1 text-xs text-slate-400">
                Track academic progress, maintain institutional rosters, and evaluate cohort performance distributions.
              </p>
            </div>

            {/* Course Selector */}
            {courses.length > 0 && (
              <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#0f172a] px-3.5 py-1.5 shadow-sm">
                <GraduationCap size={16} className="text-blue-400" />
                <span className="text-xs font-medium text-slate-400">Course:</span>
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-white outline-none cursor-pointer"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id} className="bg-[#0f172a] text-white">
                      {c.name} {c.course_code ? `(${c.course_code})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </SlideUp>

        {/* Tab Controls */}
        <SlideUp delay={0.1}>
          <div className="mt-8 flex rounded-xl bg-[#0f172a] p-1 border border-white/10 w-fit shadow-inner">
            <button
              onClick={() => setActiveTab("summary")}
              className={`relative rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === "summary" ? "text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {activeTab === "summary" && (
                <motion.div
                  layoutId="analyticsTab"
                  className="absolute inset-0 rounded-lg bg-blue-600 shadow-sm shadow-blue-500/40"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <TrendingUp size={13} /> Cohort Summary & Trends
              </span>
            </button>
            <button
              onClick={() => setActiveTab("students")}
              className={`relative rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === "students" ? "text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {activeTab === "students" && (
                <motion.div
                  layoutId="analyticsTab"
                  className="absolute inset-0 rounded-lg bg-blue-600 shadow-sm shadow-blue-500/40"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Users size={13} /> Class Roster ({students.length})
              </span>
            </button>
            <button
              onClick={() => setActiveTab("marks")}
              className={`relative rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === "marks" ? "text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {activeTab === "marks" && (
                <motion.div
                  layoutId="analyticsTab"
                  className="absolute inset-0 rounded-lg bg-blue-600 shadow-sm shadow-blue-500/40"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <FileSpreadsheet size={13} /> Assessments & Marksheet ({assessments.length})
              </span>
            </button>
          </div>
        </SlideUp>

        {/* Tab 1: Performance Summary */}
        {activeTab === "summary" && (
          <FadeIn className="mt-6 space-y-6">
            {/* Metric Cards with CountUp */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <motion.div
                whileHover={{ y: -2 }}
                className="rounded-2xl border border-white/10 bg-[#0f172a]/90 backdrop-blur-md p-5 shadow-xl transition-all"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-400">Class Average</p>
                  <Award size={16} className="text-blue-400" />
                </div>
                <div className="mt-2 text-3xl font-bold text-white flex items-baseline gap-1">
                  {count > 0 ? <CountUp to={rawAverage} decimals={1} /> : "—"}
                  {count > 0 && <span className="text-xs font-normal text-slate-400">/ 100</span>}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">Based on {count} recorded assessment scores</p>
              </motion.div>

              <motion.div
                whileHover={{ y: -2 }}
                className="rounded-2xl border border-white/10 bg-[#0f172a]/90 backdrop-blur-md p-5 shadow-xl transition-all"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-400">Median Score</p>
                  <TrendingUp size={16} className="text-cyan-400" />
                </div>
                <div className="mt-2 text-3xl font-bold text-cyan-400 flex items-baseline gap-1">
                  {count > 0 ? <CountUp to={rawMedian} decimals={1} /> : "—"}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">50th percentile rank across cohort</p>
              </motion.div>

              <motion.div
                whileHover={{ y: -2 }}
                className="rounded-2xl border border-white/10 bg-[#0f172a]/90 backdrop-blur-md p-5 shadow-xl transition-all"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-400">Pass Rate (≥ 50%)</p>
                  <Percent size={16} className="text-emerald-400" />
                </div>
                <div className="mt-2 text-3xl font-bold text-emerald-400 flex items-baseline">
                  {count > 0 ? <CountUp to={rawPassRate} suffix="%" /> : "—"}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {passingCount} of {count} passing marks
                </p>
              </motion.div>

              <motion.div
                whileHover={{ y: -2 }}
                className="rounded-2xl border border-white/10 bg-[#0f172a]/90 backdrop-blur-md p-5 shadow-xl transition-all"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-400">Score Spread (Min - Max)</p>
                  <Users size={16} className="text-amber-400" />
                </div>
                <div className="mt-2 text-3xl font-bold text-amber-400">
                  {count > 0 ? `${min} - ${max}` : "—"}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">Spread across all evaluation types</p>
              </motion.div>
            </div>

            {/* Distribution Graph with Animated Bars */}
            <div className="rounded-2xl border border-white/10 bg-[#0f172a]/90 backdrop-blur-md p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h3 className="font-bold text-white text-sm">Empirical Grade Distribution</h3>
                  <p className="text-xs text-slate-400">Cohort grading distribution across academic standards</p>
                </div>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 cursor-pointer transition-colors"
                >
                  <Printer size={13} /> Print Summary
                </button>
              </div>

              {count === 0 ? (
                <div className="p-12 text-center text-xs text-slate-500">
                  No marks entered for this course yet. Add students and enter assessment scores in the Marksheet tab to
                  compute live trends.
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {[
                    { label: "Grade A (85 - 100%)", count: distA, color: "from-emerald-600 to-emerald-400" },
                    { label: "Grade B (70 - 84%)", count: distB, color: "from-blue-600 to-blue-400" },
                    { label: "Grade C (55 - 69%)", count: distC, color: "from-cyan-600 to-cyan-400" },
                    { label: "Grade D (40 - 54%)", count: distD, color: "from-amber-600 to-amber-400" },
                    { label: "Fail / Incomplete (< 40%)", count: distF, color: "from-rose-600 to-rose-400" },
                  ].map((tier) => {
                    const pct = count > 0 ? Math.round((tier.count / count) * 100) : 0;
                    return (
                      <div key={tier.label} className="space-y-1.5">
                        <div className="flex justify-between text-xs text-slate-300">
                          <span className="font-medium">{tier.label}</span>
                          <span className="font-mono text-slate-400">
                            {tier.count} students ({pct}%)
                          </span>
                        </div>
                        <div className="h-3 w-full rounded-full bg-white/5 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className={`h-full rounded-full bg-gradient-to-r ${tier.color}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </FadeIn>
        )}

        {/* Tab 2: Students Roster */}
        {activeTab === "students" && (
          <FadeIn className="mt-6 rounded-2xl border border-white/10 bg-[#0f172a]/90 backdrop-blur-md p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <h3 className="font-bold text-white text-sm">Class Enrollment Roster</h3>
                <p className="text-xs text-slate-400">Registered students in this academic cohort</p>
              </div>
              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIsBulkImportOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 transition-colors shadow-sm cursor-pointer"
                >
                  <UploadCloud size={14} /> Bulk CSV Import
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIsAddStudentOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors shadow-sm cursor-pointer"
                >
                  <Plus size={14} /> Add Student
                </motion.button>
              </div>
            </div>

            <div className="mt-4">
              {students.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-500">
                  No students added yet. Click &quot;Add Student&quot; to register students for this course.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-400">
                        <th className="py-3 px-3.5">Student ID</th>
                        <th className="py-3 px-3.5">Full Name</th>
                        <th className="py-3 px-3.5">Institutional Email</th>
                        <th className="py-3 px-3.5">Enrolled On</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-200">
                      {students.map((st) => (
                        <tr key={st.id} className="hover:bg-white/[.02] transition-colors">
                          <td className="py-3 px-3.5 font-mono font-medium text-blue-300">{st.student_id_number}</td>
                          <td className="py-3 px-3.5 font-semibold text-white">{st.full_name}</td>
                          <td className="py-3 px-3.5 text-slate-400">{st.email || "—"}</td>
                          <td className="py-3 px-3.5 text-slate-500">{new Date(st.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </FadeIn>
        )}

        {/* Tab 3: Assessments & Marks Matrix */}
        {activeTab === "marks" && (
          <FadeIn className="mt-6 rounded-2xl border border-white/10 bg-[#0f172a]/90 backdrop-blur-md p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <h3 className="font-bold text-white text-sm">Assessments & Marksheet</h3>
                <p className="text-xs text-slate-400">Log scores live with instant auto-save to database</p>
              </div>
              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleExportMarksheetCsv}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 transition-colors shadow-sm cursor-pointer"
                >
                  <Download size={14} /> Export CSV
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIsAddAssessmentOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors shadow-sm cursor-pointer"
                >
                  <Plus size={14} /> New Assessment
                </motion.button>
              </div>
            </div>

            <div className="mt-4">
              {assessments.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-500">
                  No assessments configured. Create an assessment (e.g. Midterm, Quiz 1, Term Paper) to begin logging marks.
                </div>
              ) : students.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-500">
                  Please add students to this course before recording marks.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-400">
                        <th className="py-3 px-3.5">Student</th>
                        {assessments.map((ass) => (
                          <th key={ass.id} className="py-3 px-3.5">
                            <div className="font-semibold text-white">{ass.title}</div>
                            <span className="text-[10px] text-blue-400 font-mono">Max: {ass.max_score}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-200">
                      {students.map((st) => (
                        <tr key={st.id} className="hover:bg-white/[.02] transition-colors">
                          <td className="py-3 px-3.5">
                            <span className="font-semibold text-white">{st.full_name}</span>
                            <span className="ml-2 font-mono text-[10px] text-slate-400">({st.student_id_number})</span>
                          </td>
                          {assessments.map((ass) => {
                            const currentScore = scores[ass.id]?.[st.id] ?? "";
                            return (
                              <td key={ass.id} className="py-3 px-3.5">
                                <input
                                  type="number"
                                  min={0}
                                  max={ass.max_score}
                                  defaultValue={currentScore}
                                  onBlur={(e) => handleScoreChange(ass.id, st.id, e.target.value)}
                                  className="w-20 rounded-lg border border-white/10 bg-[#090d16] px-2.5 py-1.5 text-xs text-white font-mono outline-none focus:border-blue-500 transition-colors"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </FadeIn>
        )}
      </main>

      {/* Add Student Modal */}
      <Modal
        isOpen={isAddStudentOpen}
        onClose={() => setIsAddStudentOpen(false)}
        title="Add Student to Course Roster"
      >
        <form onSubmit={handleAddStudent} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300">Student Roll / ID Number *</label>
            <input
              type="text"
              required
              value={studentIdNum}
              onChange={(e) => setStudentIdNum(e.target.value)}
              placeholder="e.g. STU-2026-081"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#090d16] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">Full Name *</label>
            <input
              type="text"
              required
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="e.g. Alexander Vance"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#090d16] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">Institutional Email (Optional)</label>
            <input
              type="email"
              value={studentEmail}
              onChange={(e) => setStudentEmail(e.target.value)}
              placeholder="student@institution.edu"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#090d16] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={() => setIsAddStudentOpen(false)}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs text-slate-300 hover:bg-white/5 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 cursor-pointer"
            >
              Register Student
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Assessment Modal */}
      <Modal
        isOpen={isAddAssessmentOpen}
        onClose={() => setIsAddAssessmentOpen(false)}
        title="Create Course Assessment"
      >
        <form onSubmit={handleAddAssessment} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300">Assessment Title *</label>
            <input
              type="text"
              required
              value={assessmentTitle}
              onChange={(e) => setAssessmentTitle(e.target.value)}
              placeholder="e.g. Midterm Examination"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#090d16] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300">Assessment Type</label>
              <select
                value={assessmentType}
                onChange={(e) =>
                  setAssessmentType(
                    e.target.value as "quiz" | "assignment" | "midterm" | "final" | "project" | "other"
                  )
                }
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#090d16] px-3.5 py-2.5 text-xs text-white outline-none focus:border-blue-500"
              >
                <option value="quiz">Quiz</option>
                <option value="assignment">Assignment</option>
                <option value="midterm">Midterm Exam</option>
                <option value="final">Final Exam</option>
                <option value="project">Project</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">Maximum Score</label>
              <input
                type="number"
                min={1}
                max={1000}
                value={maxScore}
                onChange={(e) => setMaxScore(Number(e.target.value))}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#090d16] px-3.5 py-2.5 text-xs text-white outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={() => setIsAddAssessmentOpen(false)}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs text-slate-300 hover:bg-white/5 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 cursor-pointer"
            >
              Create Assessment
            </button>
          </div>
        </form>
      </Modal>
      {/* Bulk CSV Import Modal */}
      <Modal
        isOpen={isBulkImportOpen}
        onClose={() => {
          setIsBulkImportOpen(false);
          setParsedRows([]);
        }}
        title="Bulk Import Students via CSV"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-dashed border-white/10 bg-[#090d16] p-5 text-center">
            <UploadCloud size={32} className="mx-auto text-blue-400" />
            <p className="mt-2 text-xs font-semibold text-white">Select a CSV File</p>
            <p className="mt-1 text-[11px] text-slate-400">
              Columns: <code className="text-blue-300">roll_number, name, email</code>
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={handleCsvFileChange}
              className="mt-3 block w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
            />
          </div>

          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white">Parsed Preview ({parsedRows.length} rows)</span>
                <span className="text-[11px] text-emerald-400">
                  {parsedRows.filter((r) => r.isValid && !r.isDuplicate).length} ready to import
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-[#090d16] p-2 text-xs divide-y divide-white/5">
                {parsedRows.slice(0, 15).map((r, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 px-2">
                    <div>
                      <p className="font-semibold text-white">{r.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{r.rollNo} • {r.email || "No email"}</p>
                    </div>
                    <div>
                      {r.isDuplicate ? (
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                          Duplicate
                        </span>
                      ) : !r.isValid ? (
                        <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold text-rose-300">
                          Invalid
                        </span>
                      ) : (
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                          Ready
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={() => {
                setIsBulkImportOpen(false);
                setParsedRows([]);
              }}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs text-slate-300 hover:bg-white/5 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={importLoading || parsedRows.filter((r) => r.isValid && !r.isDuplicate).length === 0}
              onClick={handleExecuteBulkImport}
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-40 cursor-pointer transition-colors shadow-md shadow-blue-900/40"
            >
              {importLoading
                ? "Enrolling..."
                : `Import ${parsedRows.filter((r) => r.isValid && !r.isDuplicate).length} Students`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
