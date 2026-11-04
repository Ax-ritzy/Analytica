"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  GraduationCap,
  BookOpen,
  FileText,
  HelpCircle,
  BarChart3,
  BrainCircuit,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  UserCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/lib/types";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { NotificationCenter } from "@/components/NotificationCenter";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    async function loadUser() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();

          if (data) {
            setProfile(data as Profile);
          } else {
            setProfile({
              id: user.id,
              full_name: (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "Faculty Member",
              role: "faculty",
              is_active: true,
              created_at: new Date().toISOString(),
            });
          }
        }
      } catch {
        // Fallback for unconfigured instance
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  async function handleSignOut() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Ignored
    }
    router.push("/login");
    router.refresh();
  }

  const role = profile?.role?.toLowerCase();
  const isAdmin = role === "admin";

  const facultyNav = [
    { label: "Dashboard", href: "/dashboard", icon: GraduationCap },
    { label: "Courses", href: "/courses", icon: BookOpen },
    { label: "Lesson Planner", href: "/lesson-planner", icon: FileText },
    { label: "Question Studio", href: "/question-studio", icon: HelpCircle },
    { label: "Student Analytics", href: "/analytics", icon: BarChart3 },
    { label: "AI Assistant", href: "/assistant", icon: BrainCircuit },
  ];

  const adminNav = [
    { label: "Admin Console", href: "/admin", icon: ShieldCheck },
    { label: "Faculty Portal", href: "/dashboard", icon: GraduationCap },
  ];

  const navItems = isAdmin ? adminNav : facultyNav;

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a1120]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-7">
          <Link
            href={isAdmin ? "/admin" : "/dashboard"}
            className="group flex items-center gap-2.5 font-semibold tracking-wide transition-transform hover:scale-[1.02]"
          >
            <motion.span
              whileHover={{ rotate: 5, scale: 1.05 }}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 text-blue-400 border border-blue-500/30 shadow-md shadow-blue-950/30"
            >
              <GraduationCap size={20} />
            </motion.span>
            <span className="text-lg">
              FAW<span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">-AI</span>
            </span>
          </Link>

          {/* Desktop Navigation with Animated Pill */}
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/dashboard" && item.href !== "/admin" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                    active ? "text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-xl bg-blue-600/25 border border-blue-500/40 shadow-sm"
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    />
                  )}
                  <Icon size={14} className={active ? "text-blue-300 relative z-10" : "relative z-10"} />
                  <span className="relative z-10">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2.5">
          <NotificationCenter />
          <ThemeToggle />

          {profile ? (
            <div className="hidden items-center gap-3 sm:flex">
              <div className="text-right">
                <p className="text-xs font-semibold text-slate-200">{profile.full_name || "Faculty"}</p>
                <div className="flex items-center justify-end gap-1 text-[10px]">
                  <span
                    className={`inline-block rounded-md px-1.5 py-0.5 font-bold uppercase tracking-wider ${
                      isAdmin
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                    }`}
                  >
                    {isAdmin ? "ADMIN" : "FACULTY"}
                  </span>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSignOut}
                title="Sign out"
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 text-slate-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 transition-colors"
              >
                <LogOut size={15} />
              </motion.button>
            </div>
          ) : !loading ? (
            <Link
              href="/login"
              className="rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-blue-900/40 hover:bg-blue-500 transition-colors"
            >
              Sign in
            </Link>
          ) : null}

          {/* Mobile hamburger menu button */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-slate-300 md:hidden hover:bg-white/5 transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </motion.button>
        </div>
      </div>

      {/* Mobile Animated Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="border-b border-white/10 bg-[#0e172a] px-4 py-4 md:hidden overflow-hidden"
          >
            {profile && (
              <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400">
                    <UserCheck size={16} />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-white">{profile.full_name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      {isAdmin ? "ADMINISTRATOR" : "FACULTY"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400"
                >
                  <LogOut size={13} /> Sign out
                </button>
              </div>
            )}

            <div className="grid gap-1.5">
              {navItems.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-medium transition-colors ${
                      active
                        ? "bg-blue-600 text-white shadow-md shadow-blue-900/40"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Icon size={16} className={active ? "text-white" : "text-blue-400"} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
