"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  FileText,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  ChartNoAxesCombined,
  ChevronRight,
  Zap,
} from "lucide-react";
import { FadeIn, SlideUp, StaggerContainer, StaggerItem, motion } from "@/components/ui/MotionWrapper";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const features = [
  {
    icon: BookOpen,
    title: "Curriculum & Lesson Planning",
    desc: "Transform course syllabi into structured, pedagogically sound teaching timelines, exercises, and outcomes with Gemini 3.5.",
    tag: "Faculty Core",
  },
  {
    icon: FileText,
    title: "Assessment Studio",
    desc: "Generate syllabus-aligned multiple choice questions, short evaluations, and essay prompts complete with faculty scoring rubrics.",
    tag: "Evaluation",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Empirical Analytics",
    desc: "Track student cohorts with live grade distributions, class averages, percentiles, and instant marksheet management.",
    tag: "Analytics",
  },
  {
    icon: BrainCircuit,
    title: "Context-Grounded AI Assistant",
    desc: "Coordinate academic workloads with a conversational assistant grounded directly in your syllabus and departmental files.",
    tag: "Productivity",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#080d18] text-[#e8edf7] selection:bg-blue-500/30 overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 left-1/4 w-[500px] h-[500px] rounded-full bg-blue-600/15 blur-[120px]" />
        <div className="absolute -top-20 right-1/4 w-[400px] h-[400px] rounded-full bg-indigo-600/10 blur-[100px]" />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 border-b border-white/5 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-3 font-semibold tracking-wide">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-900/40">
            <GraduationCap size={22} />
          </span>
          <span className="text-lg font-bold text-white">
            FAW<span className="text-blue-400">-AI</span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-all"
            href="/login"
          >
            Sign in
          </Link>
          <Link
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-900/40 hover:from-blue-500 hover:to-indigo-500 transition-all cursor-pointer"
            href="/login"
          >
            Open Workspace <ArrowRight size={14} />
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-6 pb-20 pt-16 lg:grid-cols-[1.1fr_.9fr] lg:pt-24">
        <SlideUp>
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-3.5 py-1.5 text-xs font-medium text-blue-200 backdrop-blur-sm">
              <Sparkles size={14} className="text-blue-400 animate-pulse" />
              <span>Higher Education Faculty Productivity Suite</span>
            </div>

            <h1 className="max-w-2xl text-5xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl text-white">
              Give faculty more time to{" "}
              <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-violet-400 bg-clip-text text-transparent">
                teach and inspire.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-400">
              A unified institutional AI assistant to structure curricula, generate examination papers, manage course
              repositories, and evaluate cohort grade distributions.
            </p>

            {/* Portal Action Buttons */}
            <div className="mt-8 flex flex-wrap gap-3.5">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Link
                  href="/login?portal=faculty"
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 hover:from-blue-500 hover:to-indigo-500 transition-all"
                >
                  <GraduationCap size={18} /> Enter Faculty Portal <ArrowRight size={16} />
                </Link>
              </motion.div>

              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Link
                  href="/login?portal=admin"
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0f172a]/80 backdrop-blur-md px-5 py-3 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-all"
                >
                  <ShieldCheck size={18} className="text-amber-400" /> Administrator Portal
                </Link>
              </motion.div>
            </div>

            <div className="mt-10 flex items-center gap-2.5 text-xs text-slate-400">
              <ShieldCheck size={16} className="text-emerald-400" />
              <span>Strict Role-Based Isolation (RLS) • Legitimate Google Gemini Free-Tier</span>
            </div>
          </div>
        </SlideUp>

        {/* Hero Interactive Workspace Preview Card */}
        <SlideUp delay={0.2}>
          <div className="relative">
            <div className="relative rounded-3xl border border-white/10 bg-[#0f172a]/90 backdrop-blur-xl p-6 shadow-2xl shadow-blue-950/60">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400">
                    <GraduationCap size={18} />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-white">Faculty Command Center</p>
                    <p className="text-[10px] text-slate-400">Institutional Workspace Preview</p>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live System
                </span>
              </div>

              {/* Mini Module Grid */}
              <div className="mt-5 grid grid-cols-2 gap-3">
                {[
                  { n: "Course Catalog", v: "Manage syllabi & files", i: "01", icon: BookOpen },
                  { n: "Lesson Planner", v: "AI teaching timelines", i: "02", icon: Zap },
                  { n: "Question Studio", v: "Exams & rubrics", i: "03", icon: FileText },
                  { n: "Student Analytics", v: "Marks & grade curves", i: "04", icon: ChartNoAxesCombined },
                ].map((x) => (
                  <div
                    key={x.i}
                    className="rounded-2xl border border-white/5 bg-white/[.025] p-3.5 hover:border-blue-500/30 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-blue-400 font-bold">{x.i}</span>
                      <x.icon size={14} className="text-slate-400" />
                    </div>
                    <p className="mt-3 text-xs font-semibold text-white">{x.n}</p>
                    <p className="mt-0.5 text-[10px] text-slate-400">{x.v}</p>
                  </div>
                ))}
              </div>

              {/* Assistant Snippet */}
              <div className="mt-4 rounded-2xl border border-blue-400/20 bg-blue-500/[.07] p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-300">
                  <BrainCircuit size={16} /> FAW-AI Assistant Active
                </div>
                <p className="mt-2.5 rounded-xl bg-black/30 border border-white/5 p-3 text-xs leading-relaxed text-slate-300">
                  &ldquo;Synthesize an interactive 60-minute lesson plan on Distributed Consensus algorithms with learning
                  outcomes and assessment questions.&rdquo;
                </p>
                <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Gemini 3.5 Flash Grounded</span>
                  <span className="text-blue-400 font-medium">Free-Tier Logged</span>
                </div>
              </div>
            </div>
          </div>
        </SlideUp>
      </section>

      {/* Features Grid */}
      <section id="features" className="border-t border-white/5 bg-[#0b1220]/70 backdrop-blur-md px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <FadeIn>
            <div className="text-center max-w-2xl mx-auto">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">Integrated Capabilities</p>
              <h2 className="mt-2 text-3xl font-extrabold text-white">Designed specifically around faculty workflow.</h2>
              <p className="mt-3 text-xs text-slate-400 leading-relaxed">
                A connected suite of high-utility tools built to simplify syllabus preparation, exam creation, and
                grading analytics.
              </p>
            </div>
          </FadeIn>

          <StaggerContainer className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <StaggerItem key={f.title}>
                <motion.article
                  whileHover={{ y: -4 }}
                  className="h-full rounded-2xl border border-white/10 bg-[#0f172a]/90 backdrop-blur-md p-6 shadow-xl flex flex-col justify-between hover:border-blue-500/40 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400">
                        <f.icon size={20} />
                      </span>
                      <span className="rounded-full bg-white/5 border border-white/5 px-2.5 py-0.5 text-[10px] font-medium text-slate-400">
                        {f.tag}
                      </span>
                    </div>
                    <h3 className="mt-5 text-sm font-bold text-white">{f.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-slate-400">{f.desc}</p>
                  </div>

                  <Link
                    href="/login"
                    className="mt-6 flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Access tool <ChevronRight size={14} />
                  </Link>
                </motion.article>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto flex max-w-7xl flex-wrap justify-between gap-4 px-6 py-8 text-xs text-slate-500 border-t border-white/5">
        <div className="flex items-center gap-2">
          <GraduationCap size={16} className="text-blue-400" />
          <span>FAW-AI · Faculty AI Workload Assistant</span>
        </div>
        <span>Academic discretion and content control remain strictly with the institutional educator.</span>
      </footer>
    </main>
  );
}
