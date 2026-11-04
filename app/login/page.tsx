"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import {
  GraduationCap,
  ShieldCheck,
  Mail,
  Lock,
  User,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Server,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const initialPortal = searchParams.get("portal") === "admin" ? "admin" : "faculty";

  const [portal, setPortal] = useState<"faculty" | "admin">(initialPortal);
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    setConfigured(isSupabaseConfigured());
  }, []);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!configured) {
      setErrorMsg(
        "Supabase is not configured yet. Please configure NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in X:\\FAW-AI\\.env.local."
      );
      toast.error("Supabase Publishable Key missing in .env.local", "Configuration Required");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      if (isSignUp) {
        // Faculty registration
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              role: "faculty",
            },
          },
        });

        if (error) throw error;

        if (data.user) {
          await supabase.from("profiles").upsert({
            id: data.user.id,
            full_name: fullName.trim() || email.split("@")[0],
            role: "faculty",
            is_active: true,
          });
        }

        setSuccessMsg("Account registered successfully! You may now sign in.");
        toast.success("Account created successfully. Please sign in.", "Welcome to FAW-AI");
        setIsSignUp(false);
      } else {
        // Sign In
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        if (data.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role, is_active")
            .eq("id", data.user.id)
            .maybeSingle();

          const userRole = profile?.role?.toLowerCase() || (data.user.user_metadata?.role as string)?.toLowerCase();

          if (portal === "admin") {
            if (userRole !== "admin") {
              await supabase.auth.signOut();
              throw new Error("Access denied. This account does not possess institutional administrator rights.");
            }
            toast.success("Welcome to Administrator Console", "Authenticated");
            router.push("/admin");
          } else {
            toast.success("Welcome to Faculty Workspace", "Authenticated");
            router.push("/dashboard");
          }
          router.refresh();
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Authentication failed.";
      if (
        message.includes("Invalid API key") ||
        message.includes("UNAUTHORIZED_INVALID_API_KEY") ||
        message.includes("invalid_api_key")
      ) {
        setErrorMsg(
          "Supabase API key rejected: The key provided in NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is invalid for project 'rltvgdcwmgwikoukdjxq'. Verify your Publishable key in the Supabase Dashboard (Settings -> API)."
        );
      } else {
        setErrorMsg(message);
      }
      toast.error(message, "Authentication Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-12 overflow-hidden bg-[#080d18]">
      {/* Subtle ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full bg-gradient-to-tr from-blue-600/10 via-violet-600/10 to-transparent blur-3xl pointer-events-none" />

      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#0f172a]/90 p-8 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300"
      >
        {/* Brand */}
        <Link href="/" className="inline-flex items-center gap-2.5 font-semibold tracking-wide group">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 text-blue-400 border border-blue-500/30 shadow-md transition-transform group-hover:scale-105">
            <GraduationCap size={22} />
          </span>
          <span className="text-xl font-bold text-white">
            FAW<span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">-AI</span>
          </span>
        </Link>

        {/* Portal Switching Tabs */}
        <div className="mt-6 flex rounded-2xl bg-[#090d16] p-1 border border-white/5">
          <button
            type="button"
            onClick={() => {
              setPortal("faculty");
              setErrorMsg(null);
            }}
            className={`relative flex-1 rounded-xl py-2 text-xs font-bold transition-colors ${
              portal === "faculty" ? "text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {portal === "faculty" && (
              <motion.span
                layoutId="portal-tab"
                className="absolute inset-0 rounded-xl bg-blue-600 shadow-md shadow-blue-900/40"
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
              />
            )}
            <span className="relative z-10">Faculty Portal</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setPortal("admin");
              setIsSignUp(false);
              setErrorMsg(null);
            }}
            className={`relative flex-1 rounded-xl py-2 text-xs font-bold transition-colors ${
              portal === "admin" ? "text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {portal === "admin" && (
              <motion.span
                layoutId="portal-tab"
                className="absolute inset-0 rounded-xl bg-amber-600 shadow-md shadow-amber-900/40"
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
              />
            )}
            <span className="relative z-10">Administrator Portal</span>
          </button>
        </div>

        {/* Title Header */}
        <div className="mt-6">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {portal === "admin"
              ? "Administrator Access"
              : isSignUp
              ? "Register Faculty Account"
              : "Faculty Sign In"}
          </h1>
          <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
            {portal === "admin"
              ? "Institutional administration, course audits, and account provisioning."
              : isSignUp
              ? "Register for your personal academic workload coordinator workspace."
              : "Access your syllabi, AI lesson planners, question banks, and analytics."}
          </p>
        </div>

        {/* Missing Key Educational Alert */}
        {!configured && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/[.07] p-3.5 text-xs text-amber-200"
          >
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <Server size={15} /> Supabase Configuration Notice
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-300">
              The application is configured to connect to <code className="text-amber-200 font-mono">rltvgdcwmgwikoukdjxq</code>, but{" "}
              <code className="text-amber-200 font-mono">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> is currently empty in{" "}
              <code className="text-amber-200 font-mono">.env.local</code>.
            </p>
            <p className="mt-1 text-[11px] text-amber-300 font-medium">
              Copy your publishable key (<code className="font-mono">sb_publishable_...</code>) from Supabase Dashboard → Project Settings → API.
            </p>
          </motion.div>
        )}

        {/* Alerts */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 flex items-start gap-2.5 rounded-2xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs leading-5 text-red-200 overflow-hidden"
            >
              <AlertCircle size={16} className="shrink-0 text-red-400 mt-0.5" />
              <span>{errorMsg}</span>
            </motion.div>
          )}

          {successMsg && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 flex items-start gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs leading-5 text-emerald-200 overflow-hidden"
            >
              <CheckCircle2 size={16} className="shrink-0 text-emerald-400 mt-0.5" />
              <span>{successMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Auth Form */}
        <form onSubmit={handleAuth} className="mt-5 space-y-4">
          <AnimatePresence>
            {isSignUp && portal === "faculty" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <label className="block text-xs font-semibold text-slate-300">Full Name</label>
                <div className="mt-1.5 relative">
                  <User size={16} className="absolute left-3.5 top-3 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Prof. Evelyn Carter"
                    className="w-full rounded-2xl border border-white/10 bg-[#090d16] py-2.5 pl-10 pr-3.5 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label className="block text-xs font-semibold text-slate-300">Institutional Email</label>
            <div className="mt-1.5 relative">
              <Mail size={16} className="absolute left-3.5 top-3 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={portal === "admin" ? "admin@institution.edu" : "faculty@institution.edu"}
                className="w-full rounded-2xl border border-white/10 bg-[#090d16] py-2.5 pl-10 pr-3.5 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300">Password</label>
            <div className="mt-1.5 relative">
              <Lock size={16} className="absolute left-3.5 top-3 text-slate-500" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-2xl border border-white/10 bg-[#090d16] py-2.5 pl-10 pr-3.5 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className={`w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-xs font-bold text-white shadow-xl disabled:opacity-50 transition-all ${
              portal === "admin"
                ? "bg-amber-600 hover:bg-amber-500 shadow-amber-950/40"
                : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-950/40"
            }`}
          >
            {loading ? "Verifying..." : isSignUp ? "Register Account" : "Sign In to Workspace"}
            <ArrowRight size={15} />
          </motion.button>
        </form>

        {/* Toggle sign-up for faculty */}
        {portal === "faculty" && (
          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold transition-colors"
            >
              {isSignUp ? "Already registered? Sign in" : "New faculty member? Register account"}
            </button>
          </div>
        )}

        {/* Admin Bootstrap Guidance */}
        {portal === "admin" && (
          <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/[.06] p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
              <ShieldCheck size={16} /> Initial Administrator Setup
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-300">
              Register an account in the Faculty tab, then run the SQL statement in{" "}
              <code className="text-amber-200 font-mono">003_admin_bootstrap.sql</code> via the Supabase Dashboard SQL Editor to assign the{" "}
              <code className="text-amber-200 font-mono">admin</code> role.
            </p>
          </div>
        )}

        <div className="mt-6 border-t border-white/10 pt-4 text-center">
          <Link href="/" className="text-xs text-slate-400 hover:text-white transition-colors">
            ← Back to FAW-AI Home
          </Link>
        </div>
      </motion.div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#080d18] text-xs text-slate-400">Loading workspace...</div>}>
      <LoginForm />
    </Suspense>
  );
}
