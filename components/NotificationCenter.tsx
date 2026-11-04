"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, CheckCheck, Info, AlertTriangle, Sparkles, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { createClient } from "@/lib/supabase/client";

export interface InstitutionalNotice {
  id: string;
  title: string;
  message: string;
  category: "academic" | "system" | "feature";
  timestamp: string;
  read: boolean;
}

const DEFAULT_NOTICES: InstitutionalNotice[] = [
  {
    id: "notice-1",
    title: "Institutional AI Assistance Ready",
    message: "Gemini 3.5 Flash is integrated for syllabus design, lesson planning, and question generation under official free-tier quotas.",
    category: "feature",
    timestamp: "Today",
    read: false,
  },
  {
    id: "notice-2",
    title: "Fall 2026 Academic Calendar Active",
    message: "Course rosters and assessment marksheets are now open for syllabus planning and midterm marks entry.",
    category: "academic",
    timestamp: "Yesterday",
    read: false,
  },
  {
    id: "notice-3",
    title: "Document Storage & Security Protocols",
    message: "All uploaded syllabi and examination papers are secured with tenant-level Row Level Security in private institutional storage.",
    category: "system",
    timestamp: "Nov 3, 2026",
    read: true,
  },
];

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notices, setNotices] = useState<InstitutionalNotice[]>(DEFAULT_NOTICES);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch real institutional activity logs and merge with announcements
  useEffect(() => {
    async function fetchLiveActivities() {
      try {
        const supabase = createClient();
        const { data: logs } = await supabase
          .from("activity_logs")
          .select("id, action, created_at, metadata")
          .order("created_at", { ascending: false })
          .limit(4);

        if (logs && logs.length > 0) {
          const liveNotices: InstitutionalNotice[] = logs.map((log) => {
            let title = "System Activity";
            let message = "Activity recorded in institutional audit log.";
            let category: "academic" | "system" | "feature" = "system";

            if (log.action === "first_admin_bootstrap") {
              title = "Administrator Bootstrapped";
              message = "Primary institutional administrator account was safely verified.";
              category = "system";
            } else if (log.action === "faculty_provisioned") {
              title = "Faculty Account Provisioned";
              const email = (log.metadata as { provisioned_email?: string })?.provisioned_email || "faculty member";
              message = `New account created for ${email}.`;
              category = "academic";
            } else if (log.action.includes("role")) {
              title = "Permission Updated";
              message = `Account role modified by institutional administrator.`;
              category = "system";
            } else {
              title = log.action.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
              message = "Audit event logged in institutional database.";
            }

            const dt = new Date(log.created_at);
            const timeStr = dt.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            return {
              id: log.id,
              title,
              message,
              category,
              timestamp: timeStr,
              read: false,
            };
          });

          setNotices(() => {
            const stored = typeof window !== "undefined" ? localStorage.getItem("faw_read_notifications") : null;
            const readIds: string[] = stored ? JSON.parse(stored) : [];
            const combined = [...liveNotices, ...DEFAULT_NOTICES];
            const seen = new Set<string>();
            return combined
              .filter((item) => {
                if (seen.has(item.id)) return false;
                seen.add(item.id);
                return true;
              })
              .map((item) => ({
                ...item,
                read: readIds.includes(item.id) || item.read,
              }));
          });
        }
      } catch {
        // Fallback to DEFAULT_NOTICES
      }
    }

    fetchLiveActivities();
  }, []);

  // Load read status from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("faw_read_notifications");
      if (stored) {
        const readIds: string[] = JSON.parse(stored);
        setNotices((prev) =>
          prev.map((n) => ({
            ...n,
            read: readIds.includes(n.id) || n.read,
          }))
        );
      }
    } catch {
      // Ignored
    }
  }, []);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notices.filter((n) => !n.read).length;

  const markAllAsRead = () => {
    setNotices((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      const allIds = notices.map((n) => n.id);
      localStorage.setItem("faw_read_notifications", JSON.stringify(allIds));
    } catch {
      // Ignored
    }
  };

  const markAsRead = (id: string) => {
    setNotices((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    try {
      const stored = localStorage.getItem("faw_read_notifications");
      const readIds: string[] = stored ? JSON.parse(stored) : [];
      if (!readIds.includes(id)) {
        readIds.push(id);
        localStorage.setItem("faw_read_notifications", JSON.stringify(readIds));
      }
    } catch {
      // Ignored
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="View notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-[#0f172a] text-slate-300 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white shadow-sm ring-2 ring-[#0a1120]">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-white/10 bg-[#0f172a]/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 bg-[#090d16]/50">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-white">Notifications</span>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-medium text-blue-300">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-blue-400 transition-colors"
                  >
                    <CheckCheck size={13} /> Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Notification List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-white/5 text-xs">
              {notices.map((n) => {
                const CategoryIcon =
                  n.category === "feature"
                    ? Sparkles
                    : n.category === "academic"
                    ? Info
                    : AlertTriangle;
                const iconColor =
                  n.category === "feature"
                    ? "text-blue-400"
                    : n.category === "academic"
                    ? "text-emerald-400"
                    : "text-amber-400";

                return (
                  <div
                    key={n.id}
                    onClick={() => markAsRead(n.id)}
                    className={`p-3.5 flex gap-3 cursor-pointer transition-colors ${
                      n.read ? "bg-transparent opacity-75" : "bg-blue-500/[.04] hover:bg-white/[.04]"
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      <CategoryIcon size={15} className={iconColor} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className={`font-semibold text-xs truncate ${n.read ? "text-slate-300" : "text-white"}`}>
                          {n.title}
                        </p>
                        <span className="text-[10px] text-slate-500 shrink-0 font-mono">{n.timestamp}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                        {n.message}
                      </p>
                    </div>
                    {!n.read && (
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
