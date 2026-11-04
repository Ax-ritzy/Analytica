"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Users,
  BookOpen,
  Activity,
  Plus,
  UserCheck,
  Search,
  RefreshCw,
  Cpu,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";
import { Profile, Course, AiUsageLog, ActivityLog } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { CountUp } from "@/components/ui/CountUp";
import { SlideUp, FadeIn, motion } from "@/components/ui/MotionWrapper";
import { SkeletonCard } from "@/components/ui/Skeleton";

export default function AdminPage() {
  const { addToast } = useToast();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "faculty" | "courses" | "audit">("overview");

  // Data state
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [aiLogs, setAiLogs] = useState<AiUsageLog[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Provision Faculty Modal
  const [isProvisionOpen, setIsProvisionOpen] = useState(false);
  const [newFacultyName, setNewFacultyName] = useState("");
  const [newFacultyEmail, setNewFacultyEmail] = useState("");
  const [newFacultyPassword, setNewFacultyPassword] = useState("");
  const [newFacultyRole, setNewFacultyRole] = useState<"faculty" | "admin">("faculty");
  const [provisionLoading, setProvisionLoading] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  const loadAdminData = useCallback(async () => {
    try {
      const supabase = createClient();

      // 1. All Profiles
      const { data: profs } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profs) setProfiles(profs as Profile[]);

      // 2. All Institutional Courses
      const { data: cList } = await supabase
        .from("courses")
        .select("*")
        .order("created_at", { ascending: false });

      if (cList) setCourses(cList as Course[]);

      // 3. AI Usage Logs
      const { data: aiList } = await supabase
        .from("ai_usage_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(25);

      if (aiList) setAiLogs(aiList as AiUsageLog[]);

      // 4. Activity Logs
      const { data: actList } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(25);

      if (actList) setActivityLogs(actList as ActivityLog[]);
    } catch {
      // Ignored
    }
  }, []);

  const checkAdminAccess = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", user.id)
        .maybeSingle();

      const role = prof?.role?.toLowerCase() || "faculty";
      const hasAdmin = role === "admin" && (prof?.is_active ?? true);

      setIsAdmin(hasAdmin);

      if (hasAdmin) {
        await loadAdminData();
      }
    } catch {
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, [loadAdminData]);

  useEffect(() => {
    checkAdminAccess();
  }, [checkAdminAccess]);

  async function toggleFacultyStatus(profile: Profile) {
    try {
      const supabase = createClient();
      const nextStatus = !profile.is_active;

      const { error } = await supabase
        .from("profiles")
        .update({ is_active: nextStatus })
        .eq("id", profile.id);

      if (error) throw error;

      // Log activity
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase.from("activity_logs").insert({
        actor_id: user?.id || null,
        action: nextStatus ? "faculty_activated" : "faculty_deactivated",
        resource_type: "profiles",
        resource_id: profile.id,
        metadata: { target_name: profile.full_name },
      });

      addToast({
        title: nextStatus ? "Account Activated" : "Account Deactivated",
        description: `Account for ${profile.full_name} is now ${nextStatus ? "active" : "deactivated"}.`,
        type: nextStatus ? "success" : "info",
      });
      loadAdminData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update profile status.";
      addToast({
        title: "Action Failed",
        description: msg,
        type: "error",
      });
    }
  }

  async function changeFacultyRole(profile: Profile, newRole: "faculty" | "admin") {
    try {
      const supabase = createClient();
      
      // Attempt secure administrative RPC first
      const { error: rpcErr } = await supabase.rpc("admin_set_user_role", {
        target_user_id: profile.id,
        target_role: newRole,
      });

      if (rpcErr) {
        // Graceful fallback to table update if RPC migration 004 is pending
        const { error: updateErr } = await supabase
          .from("profiles")
          .update({ role: newRole })
          .eq("id", profile.id);

        if (updateErr) throw updateErr;
      }

      addToast({
        title: "Role Updated",
        description: `Role for ${profile.full_name} set to ${newRole.toUpperCase()}.`,
        type: "success",
      });
      loadAdminData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update role.";
      addToast({
        title: "Role Update Failed",
        description: msg,
        type: "error",
      });
    }
  }

  async function handleProvisionFaculty(e: React.FormEvent) {
    e.preventDefault();
    if (!newFacultyEmail.trim() || !newFacultyPassword) return;

    setProvisionLoading(true);

    try {
      const res = await fetch("/api/admin/provision-faculty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newFacultyEmail.trim(),
          password: newFacultyPassword,
          fullName: newFacultyName.trim() || newFacultyEmail.split("@")[0],
          role: newFacultyRole,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to provision account");
      }

      addToast({
        title: "Account Provisioned",
        description: result.message || `Account ${newFacultyEmail} created successfully.`,
        type: "success",
      });
      setIsProvisionOpen(false);
      setNewFacultyName("");
      setNewFacultyEmail("");
      setNewFacultyPassword("");
      await loadAdminData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to provision faculty account.";
      addToast({
        title: "Provisioning Failed",
        description: msg,
        type: "error",
      });
    } finally {
      setProvisionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080d18] text-[#e8edf7]">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 space-y-6">
          <SkeletonCard />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#080d18] text-[#e8edf7]">
        <Navbar />
        <main className="mx-auto max-w-2xl px-6 py-20 text-center">
          <motion.span
            initial={false}
            animate={{ scale: 1, opacity: 1 }}
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-lg shadow-amber-950/40"
          >
            <ShieldCheck size={32} />
          </motion.span>
          <h1 className="mt-6 text-2xl font-bold text-white">Administrator Access Required</h1>
          <p className="mt-2 text-xs text-slate-400 leading-relaxed">
            You are signed in as a faculty member. The Administrator Console is strictly restricted to verified
            institutional administrators.
          </p>

          <div className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/[.06] p-5 text-left text-xs text-amber-200">
            <p className="font-semibold text-amber-300">Setting up the first Administrator?</p>
            <p className="mt-1 leading-5 text-slate-300">
              Execute the query in <code className="text-amber-300">003_admin_bootstrap.sql</code> in the Supabase SQL
              Editor with your account email to assign the <code className="text-amber-300">admin</code> role.
            </p>
          </div>

          <div className="mt-8 flex justify-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
            >
              ← Back to Faculty Dashboard
            </Link>
            <Link
              href="/login?portal=admin"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-slate-300 hover:bg-white/10 transition-colors"
            >
              Sign In as Admin
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const filteredProfiles = profiles.filter(
    (p) =>
      (p.full_name && p.full_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      p.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalTokens = aiLogs.reduce((acc, log) => acc + (log.input_tokens || 0) + (log.output_tokens || 0), 0);

  return (
    <div className="min-h-screen bg-[#080d18] text-[#e8edf7] selection:bg-amber-500/30">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Header */}
        <SlideUp>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
                <ShieldCheck size={14} /> Institutional Governance
              </div>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">Administrator Portal</h1>
              <p className="mt-1 text-xs text-slate-400">
                Centralised oversight of faculty credentials, institutional course catalogs, and AI telemetry audits.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => {
                  loadAdminData();
                  addToast({ title: "Refreshed", description: "Admin telemetry reloaded.", type: "info" });
                }}
                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 cursor-pointer transition-colors"
              >
                <RefreshCw size={13} /> Refresh
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsProvisionOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 px-4 py-2 text-xs font-semibold text-white hover:from-amber-500 hover:to-amber-400 shadow-lg shadow-amber-950/40 transition-all cursor-pointer"
              >
                <Plus size={15} /> Provision Faculty
              </motion.button>
            </div>
          </div>
        </SlideUp>

        {/* Tab Controls */}
        <SlideUp delay={0.1}>
          <div className="mt-8 flex rounded-xl bg-[#0f172a] p-1 border border-white/10 w-fit shadow-inner">
            <button
              onClick={() => setActiveTab("overview")}
              className={`relative rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === "overview" ? "text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {activeTab === "overview" && (
                <motion.div
                  layoutId="adminTab"
                  className="absolute inset-0 rounded-lg bg-amber-600 shadow-sm shadow-amber-500/40"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <ShieldCheck size={13} /> Overview & Metrics
              </span>
            </button>
            <button
              onClick={() => setActiveTab("faculty")}
              className={`relative rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === "faculty" ? "text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {activeTab === "faculty" && (
                <motion.div
                  layoutId="adminTab"
                  className="absolute inset-0 rounded-lg bg-amber-600 shadow-sm shadow-amber-500/40"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Users size={13} /> Faculty Directory ({profiles.length})
              </span>
            </button>
            <button
              onClick={() => setActiveTab("courses")}
              className={`relative rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === "courses" ? "text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {activeTab === "courses" && (
                <motion.div
                  layoutId="adminTab"
                  className="absolute inset-0 rounded-lg bg-amber-600 shadow-sm shadow-amber-500/40"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <BookOpen size={13} /> All Courses ({courses.length})
              </span>
            </button>
            <button
              onClick={() => setActiveTab("audit")}
              className={`relative rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === "audit" ? "text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {activeTab === "audit" && (
                <motion.div
                  layoutId="adminTab"
                  className="absolute inset-0 rounded-lg bg-amber-600 shadow-sm shadow-amber-500/40"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Activity size={13} /> AI & Activity Audit ({aiLogs.length})
              </span>
            </button>
          </div>
        </SlideUp>

        {/* Tab 1: Overview */}
        {activeTab === "overview" && (
          <FadeIn className="mt-6 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <motion.div
                whileHover={{ y: -2 }}
                className="rounded-2xl border border-white/10 bg-[#0f172a]/90 backdrop-blur-md p-5 shadow-xl transition-all"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-400">Total Faculty Accounts</p>
                  <Users size={16} className="text-blue-400" />
                </div>
                <div className="mt-2 text-3xl font-bold text-white">
                  <CountUp to={profiles.length} />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {profiles.filter((p) => p.is_active).length} active profiles
                </p>
              </motion.div>

              <motion.div
                whileHover={{ y: -2 }}
                className="rounded-2xl border border-white/10 bg-[#0f172a]/90 backdrop-blur-md p-5 shadow-xl transition-all"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-400">Institutional Courses</p>
                  <BookOpen size={16} className="text-amber-400" />
                </div>
                <div className="mt-2 text-3xl font-bold text-amber-400">
                  <CountUp to={courses.length} />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">Catalog across all departments</p>
              </motion.div>

              <motion.div
                whileHover={{ y: -2 }}
                className="rounded-2xl border border-white/10 bg-[#0f172a]/90 backdrop-blur-md p-5 shadow-xl transition-all"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-400">AI Assistance Requests</p>
                  <Cpu size={16} className="text-blue-400" />
                </div>
                <div className="mt-2 text-3xl font-bold text-blue-400">
                  <CountUp to={aiLogs.length} />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">Logged free-tier transactions</p>
              </motion.div>

              <motion.div
                whileHover={{ y: -2 }}
                className="rounded-2xl border border-white/10 bg-[#0f172a]/90 backdrop-blur-md p-5 shadow-xl transition-all"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-400">Total Tokens Processed</p>
                  <Activity size={16} className="text-emerald-400" />
                </div>
                <div className="mt-2 text-3xl font-bold text-emerald-400">
                  <CountUp to={totalTokens} />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">Gemini 3.5 Flash tokens</p>
              </motion.div>
            </div>

            {/* Quick summary grid */}
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-[#0f172a]/90 backdrop-blur-md p-6 shadow-xl">
                <h3 className="font-bold text-white text-sm">Recent Faculty Registrations</h3>
                <div className="mt-4 space-y-2.5">
                  {profiles.slice(0, 5).map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-xl border border-white/5 bg-[#090d16] p-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <UserCheck size={15} className="text-blue-400" />
                        <div>
                          <p className="font-semibold text-white">{p.full_name}</p>
                          <p className="text-[10px] text-slate-500">
                            Role: {p.role.toUpperCase()} • Joined {new Date(p.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                          p.is_active ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
                        }`}
                      >
                        {p.is_active ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#0f172a]/90 backdrop-blur-md p-6 shadow-xl">
                <h3 className="font-bold text-white text-sm">Recent Institutional Activity</h3>
                <div className="mt-4 space-y-2.5">
                  {activityLogs.length === 0 ? (
                    <p className="py-8 text-center text-xs text-slate-500">No system events logged yet.</p>
                  ) : (
                    activityLogs.slice(0, 5).map((act) => (
                      <div
                        key={act.id}
                        className="flex items-center justify-between rounded-xl border border-white/5 bg-[#090d16] p-3 text-xs"
                      >
                        <div>
                          <p className="font-semibold text-white capitalize">{act.action.replace("_", " ")}</p>
                          <p className="text-[10px] text-slate-500">
                            {new Date(act.created_at).toLocaleTimeString()} • Resource: {act.resource_type || "system"}
                          </p>
                        </div>
                        <span className="font-mono text-[10px] text-slate-400">ID: {act.id.slice(0, 8)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </FadeIn>
        )}

        {/* Tab 2: Faculty Directory & Account Management */}
        {activeTab === "faculty" && (
          <FadeIn className="mt-6 rounded-2xl border border-white/10 bg-[#0f172a]/90 backdrop-blur-md p-6 shadow-xl">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center border-b border-white/10 pb-4">
              <div>
                <h3 className="font-bold text-white text-sm">Faculty Accounts & Permissions</h3>
                <p className="text-xs text-slate-400">Manage account states, assign administrator roles, and govern permissions</p>
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter faculty..."
                  className="rounded-xl border border-white/10 bg-[#090d16] py-1.5 pl-8 pr-3 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="py-3 px-3.5">Faculty Name</th>
                    <th className="py-3 px-3.5">Account ID</th>
                    <th className="py-3 px-3.5">Role</th>
                    <th className="py-3 px-3.5">Status</th>
                    <th className="py-3 px-3.5">Registered</th>
                    <th className="py-3 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-200">
                  {filteredProfiles.map((p) => (
                    <tr key={p.id} className="hover:bg-white/[.02] transition-colors">
                      <td className="py-3 px-3.5 font-semibold text-white">{p.full_name || "Faculty Member"}</td>
                      <td className="py-3 px-3.5 font-mono text-[11px] text-slate-400">{p.id.slice(0, 13)}...</td>
                      <td className="py-3 px-3.5">
                        <select
                          value={p.role}
                          onChange={(e) => changeFacultyRole(p, e.target.value as "faculty" | "admin")}
                          className="rounded-lg border border-white/10 bg-[#090d16] px-2 py-1 text-xs text-white outline-none focus:border-amber-500 cursor-pointer"
                        >
                          <option value="faculty">FACULTY</option>
                          <option value="admin">ADMIN</option>
                        </select>
                      </td>
                      <td className="py-3 px-3.5">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                            p.is_active ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
                          }`}
                        >
                          {p.is_active ? "ACTIVE" : "DISABLED"}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-slate-500">{new Date(p.created_at).toLocaleDateString()}</td>
                      <td className="py-3 px-3.5 text-right">
                        <button
                          onClick={() => toggleFacultyStatus(p)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer transition-colors ${
                            p.is_active
                              ? "border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                              : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                          }`}
                        >
                          {p.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeIn>
        )}

        {/* Tab 3: Institutional Courses */}
        {activeTab === "courses" && (
          <FadeIn className="mt-6 rounded-2xl border border-white/10 bg-[#0f172a]/90 backdrop-blur-md p-6 shadow-xl">
            <h3 className="font-bold text-white text-sm">Institutional Course Catalog</h3>
            <p className="text-xs text-slate-400">All courses administered across faculty workspaces</p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="py-3 px-3.5">Course Code</th>
                    <th className="py-3 px-3.5">Course Title</th>
                    <th className="py-3 px-3.5">Faculty Owner ID</th>
                    <th className="py-3 px-3.5">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-200">
                  {courses.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500">
                        No courses recorded yet.
                      </td>
                    </tr>
                  ) : (
                    courses.map((c) => (
                      <tr key={c.id} className="hover:bg-white/[.02] transition-colors">
                        <td className="py-3 px-3.5 font-mono font-medium text-amber-300">{c.course_code || "—"}</td>
                        <td className="py-3 px-3.5 font-semibold text-white">{c.name}</td>
                        <td className="py-3 px-3.5 font-mono text-slate-400">{c.owner_id.slice(0, 13)}...</td>
                        <td className="py-3 px-3.5 text-slate-500">{new Date(c.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </FadeIn>
        )}

        {/* Tab 4: AI Usage & Audit Monitoring */}
        {activeTab === "audit" && (
          <FadeIn className="mt-6 space-y-6">
            <div className="rounded-2xl border border-white/10 bg-[#0f172a]/90 backdrop-blur-md p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h3 className="font-bold text-white text-sm">Gemini AI Usage Logs</h3>
                  <p className="text-xs text-slate-400">Free-tier telemetry, token metrics, and API latency audit</p>
                </div>
                <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[10px] font-mono text-blue-300">
                  gemini-3.5-flash
                </span>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400">
                      <th className="py-3 px-3.5">Timestamp</th>
                      <th className="py-3 px-3.5">Model</th>
                      <th className="py-3 px-3.5">Status</th>
                      <th className="py-3 px-3.5">Prompt Tokens</th>
                      <th className="py-3 px-3.5">Output Tokens</th>
                      <th className="py-3 px-3.5">Faculty Owner</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-200 font-mono text-[11px]">
                    {aiLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">
                          No AI calls logged yet.
                        </td>
                      </tr>
                    ) : (
                      aiLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-white/[.02] transition-colors">
                          <td className="py-3 px-3.5 text-slate-400">{new Date(log.created_at).toLocaleTimeString()}</td>
                          <td className="py-3 px-3.5 text-blue-300">{log.model || "gemini-3.5-flash"}</td>
                          <td className="py-3 px-3.5">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                                log.status === "success"
                                    ? "bg-emerald-500/20 text-emerald-300"
                                  : "bg-red-500/20 text-red-300"
                              }`}
                            >
                              {log.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-slate-300">{log.input_tokens ?? "—"}</td>
                          <td className="py-3 px-3.5 text-slate-300">{log.output_tokens ?? "—"}</td>
                          <td className="py-3 px-3.5 text-slate-500">{log.owner_id ? log.owner_id.slice(0, 8) : "System"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </FadeIn>
        )}
      </main>

      {/* Provision Faculty Account Modal */}
      <Modal
        isOpen={isProvisionOpen}
        onClose={() => setIsProvisionOpen(false)}
        title="Provision Faculty Account"
      >
        <form onSubmit={handleProvisionFaculty} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300">Faculty Full Name *</label>
            <input
              type="text"
              required
              value={newFacultyName}
              onChange={(e) => setNewFacultyName(e.target.value)}
              placeholder="e.g. Dr. Aris Thorne"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#090d16] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">Institutional Email *</label>
            <input
              type="email"
              required
              value={newFacultyEmail}
              onChange={(e) => setNewFacultyEmail(e.target.value)}
              placeholder="faculty@institution.edu"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#090d16] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">Temporary Password *</label>
            <input
              type="password"
              required
              minLength={6}
              value={newFacultyPassword}
              onChange={(e) => setNewFacultyPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#090d16] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">Account Role</label>
            <select
              value={newFacultyRole}
              onChange={(e) => setNewFacultyRole(e.target.value as "faculty" | "admin")}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#090d16] px-3.5 py-2.5 text-xs text-white outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="faculty">Faculty Member</option>
              <option value="admin">Institutional Administrator</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={() => setIsProvisionOpen(false)}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs text-slate-300 hover:bg-white/5 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={provisionLoading}
              className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50 cursor-pointer"
            >
              {provisionLoading ? "Creating..." : "Provision Account"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
