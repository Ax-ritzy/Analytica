"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BookOpen,
  FileText,
  BrainCircuit,
  BarChart3,
  Plus,
  ArrowUpRight,
  HelpCircle,
  Clock,
  Sparkles,
  CheckCircle2,
  FolderOpen,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";
import { Course, GeneratedDocument, Profile } from "@/lib/types";
import { SlideUp, StaggerContainer, StaggerItem, motion } from "@/components/ui/MotionWrapper";
import { CountUp } from "@/components/ui/CountUp";
import { StatCardSkeleton } from "@/components/ui/Skeleton";

export default function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [recentDocs, setRecentDocs] = useState<GeneratedDocument[]>([]);
  const [stats, setStats] = useState({
    coursesCount: 0,
    docsCount: 0,
    aiTasksCount: 0,
    studentsCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          // 1. Profile
          const { data: prof } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();

          if (prof) setProfile(prof as Profile);

          // 2. Courses
          const { data: courseList, count: cCount } = await supabase
            .from("courses")
            .select("*", { count: "exact" })
            .eq("owner_id", user.id)
            .order("created_at", { ascending: false });

          if (courseList) {
            setCourses(courseList as Course[]);
          }

          // 3. Generated Docs
          const { data: docs, count: dCount } = await supabase
            .from("generated_documents")
            .select("*", { count: "exact" })
            .eq("owner_id", user.id)
            .order("created_at", { ascending: false })
            .limit(5);

          if (docs) {
            setRecentDocs(docs as GeneratedDocument[]);
          }

          // 4. AI usage logs count
          const { count: aiCount } = await supabase
            .from("ai_usage_logs")
            .select("id", { count: "exact", head: true })
            .eq("owner_id", user.id);

          // 5. Students count
          const { count: sCount } = await supabase
            .from("students")
            .select("id", { count: "exact", head: true })
            .eq("owner_id", user.id);

          setStats({
            coursesCount: cCount ?? 0,
            docsCount: dCount ?? 0,
            aiTasksCount: aiCount ?? 0,
            studentsCount: sCount ?? 0,
          });
        }
      } catch {
        // Fallback for unconfigured or offline instances
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  const modules = [
    {
      title: "My Courses",
      desc: "Manage syllabi, course structures, and linked reference files.",
      href: "/courses",
      icon: BookOpen,
      badge: `${stats.coursesCount} Active`,
      color: "from-blue-600/20 to-blue-400/5",
    },
    {
      title: "Lesson Planner",
      desc: "Generate syllabus-aligned pedagogical teaching timelines.",
      href: "/lesson-planner",
      icon: FileText,
      badge: "Gemini 3.5 Flash",
      color: "from-violet-600/20 to-violet-400/5",
    },
    {
      title: "Question Studio",
      desc: "Create exam papers, MCQs, short answers, and rubrics.",
      href: "/question-studio",
      icon: HelpCircle,
      badge: "AI Powered",
      color: "from-indigo-600/20 to-indigo-400/5",
    },
    {
      title: "Student Analytics",
      desc: "Evaluate actual student performance, marks, and trends.",
      href: "/analytics",
      icon: BarChart3,
      badge: `${stats.studentsCount} Students`,
      color: "from-emerald-600/20 to-emerald-400/5",
    },
    {
      title: "AI Faculty Assistant",
      desc: "Conversational task coordinator for academic productivity.",
      href: "/assistant",
      icon: BrainCircuit,
      badge: "Interactive",
      color: "from-cyan-600/20 to-cyan-400/5",
    },
  ];

  return (
    <div className="min-h-screen bg-[#080d18] text-[#e8edf7]">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Welcome Header */}
        <SlideUp>
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-300">
                <Sparkles size={13} /> Faculty Workspace
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Welcome back, {profile?.full_name || "Professor"}
              </h1>
              <p className="mt-1 text-xs text-slate-400">
                Your higher education productivity command center.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Link
                  href="/courses"
                  className="flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-900/40 hover:bg-blue-500 transition-colors"
                >
                  <Plus size={16} /> New Course
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Link
                  href="/assistant"
                  className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-white/10 transition-colors"
                >
                  <BrainCircuit size={16} className="text-blue-300" /> Open Assistant
                </Link>
              </motion.div>
            </div>
          </div>
        </SlideUp>

        {/* Live Animated Statistics */}
        <div className="mt-8">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </div>
          ) : (
            <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StaggerItem>
                <StatCard
                  label="Active Courses"
                  count={stats.coursesCount}
                  note="Curricula in management"
                  icon={BookOpen}
                  color="blue"
                />
              </StaggerItem>
              <StaggerItem>
                <StatCard
                  label="Generated Documents"
                  count={stats.docsCount}
                  note="Saved lesson plans & exams"
                  icon={FileText}
                  color="emerald"
                />
              </StaggerItem>
              <StaggerItem>
                <StatCard
                  label="Enrolled Students"
                  count={stats.studentsCount}
                  note="Across your courses"
                  icon={BarChart3}
                  color="amber"
                />
              </StaggerItem>
              <StaggerItem>
                <StatCard
                  label="AI Workload Tasks"
                  count={stats.aiTasksCount}
                  note="Free-tier requests logged"
                  icon={BrainCircuit}
                  color="purple"
                />
              </StaggerItem>
            </StaggerContainer>
          )}
        </div>

        {/* Modules Grid */}
        <div className="mt-12">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Academic Modules</h2>
              <p className="text-xs text-slate-400">Direct workflows engineered for university faculty.</p>
            </div>
          </div>

          <StaggerContainer className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {modules.map((m) => {
              const Icon = m.icon;
              return (
                <StaggerItem key={m.title}>
                  <Link href={m.href} className="block group">
                    <motion.div
                      whileHover={{ y: -4, scale: 1.01 }}
                      transition={{ duration: 0.2 }}
                      className="relative h-full rounded-3xl border border-white/10 bg-[#0f172a] p-6 shadow-sm overflow-hidden hover:border-blue-500/40 hover:shadow-xl transition-all"
                    >
                      {/* Subtle gradient hover glow */}
                      <div
                        className={`absolute inset-0 bg-gradient-to-br ${m.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`}
                      />

                      <div className="relative z-10 flex items-center justify-between">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-400 border border-blue-500/20 group-hover:scale-105 transition-transform">
                          <Icon size={22} />
                        </span>
                        <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-bold text-slate-300 border border-white/5">
                          {m.badge}
                        </span>
                      </div>

                      <div className="relative z-10 mt-5 flex items-center justify-between font-bold text-white">
                        <span className="text-sm">{m.title}</span>
                        <ArrowUpRight
                          size={18}
                          className="text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-blue-300"
                        />
                      </div>

                      <p className="relative z-10 mt-1.5 text-xs leading-relaxed text-slate-400">{m.desc}</p>
                    </motion.div>
                  </Link>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        </div>

        {/* Master Details: Courses & Recent Generated Assets */}
        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {/* Recent Courses */}
          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="rounded-3xl border border-white/10 bg-[#0f172a] p-6 shadow-sm"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="font-bold text-white text-sm">Your Courses</h3>
                <p className="text-xs text-slate-400">Current active subjects</p>
              </div>
              <Link href="/courses" className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors">
                Manage all →
              </Link>
            </div>

            <div className="mt-4 space-y-3">
              {courses.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
                  <FolderOpen className="mx-auto text-slate-600" size={30} />
                  <p className="mt-2 text-xs font-semibold text-slate-300">No courses created yet.</p>
                  <Link
                    href="/courses"
                    className="mt-3 inline-block rounded-xl bg-blue-600/30 border border-blue-500/30 px-3 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-600/50 transition-colors"
                  >
                    + Create first course
                  </Link>
                </div>
              ) : (
                courses.slice(0, 4).map((c) => (
                  <motion.div
                    key={c.id}
                    whileHover={{ x: 2 }}
                    className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#090d16] p-4 transition-all"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-white">{c.name}</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {c.course_code ? `${c.course_code} • ` : ""}
                        {c.description ? c.description.slice(0, 48) + "..." : "No description"}
                      </p>
                    </div>
                    <Link
                      href={`/courses?id=${c.id}`}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 transition-colors"
                    >
                      Manage
                    </Link>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>

          {/* Recent AI Materials */}
          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-3xl border border-white/10 bg-[#0f172a] p-6 shadow-sm"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="font-bold text-white text-sm">Recent Generated Assets</h3>
                <p className="text-xs text-slate-400">Curricula & assessments structured by Gemini</p>
              </div>
              <Link href="/lesson-planner" className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors">
                Planner →
              </Link>
            </div>

            <div className="mt-4 space-y-3">
              {recentDocs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
                  <FileText className="mx-auto text-slate-600" size={30} />
                  <p className="mt-2 text-xs font-semibold text-slate-300">No generated materials saved yet.</p>
                  <div className="mt-3 flex justify-center gap-2">
                    <Link
                      href="/lesson-planner"
                      className="rounded-xl bg-blue-600/30 border border-blue-500/30 px-3 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-600/50 transition-colors"
                    >
                      Plan Lesson
                    </Link>
                    <Link
                      href="/question-studio"
                      className="rounded-xl bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 transition-colors"
                    >
                      Make Questions
                    </Link>
                  </div>
                </div>
              ) : (
                recentDocs.map((doc) => (
                  <motion.div
                    key={doc.id}
                    whileHover={{ x: 2 }}
                    className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#090d16] p-4 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {doc.document_type === "lesson_plan" ? <FileText size={17} /> : <HelpCircle size={17} />}
                      </span>
                      <div>
                        <h4 className="text-xs font-bold text-white">{doc.title}</h4>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          <span className="capitalize">{doc.document_type.replace("_", " ")}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock size={10} />
                            {new Date(doc.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 uppercase">
                      {doc.status}
                    </span>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        </div>

        {/* Security & System Info Footer */}
        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/5 bg-[#090d16] p-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400" />
            <span>AI Provider: Google Gemini 3.5 Flash (Verified Free Tier)</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Database: Supabase PostgreSQL with Row Level Security</span>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  label,
  count,
  note,
  icon: Icon,
  color,
}: {
  label: string;
  count: number;
  note: string;
  icon: React.ComponentType<{ size: number; className?: string }>;
  color: "blue" | "emerald" | "amber" | "purple";
}) {
  const colorMap = {
    blue: "text-blue-400 bg-blue-500/15 border-blue-500/20",
    emerald: "text-emerald-400 bg-emerald-500/15 border-emerald-500/20",
    amber: "text-amber-400 bg-amber-500/15 border-amber-500/20",
    purple: "text-purple-400 bg-purple-500/15 border-purple-500/20",
  };

  return (
    <motion.div
      whileHover={{ y: -3 }}
      className="rounded-3xl border border-white/10 bg-[#0f172a] p-6 shadow-sm transition-all"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-400">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl border ${colorMap[color]}`}>
          <Icon size={18} />
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-white">
        <CountUp to={count} />
      </p>
      <p className="mt-1 text-[11px] text-slate-500">{note}</p>
    </motion.div>
  );
}
