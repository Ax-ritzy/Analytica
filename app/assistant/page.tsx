"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  BrainCircuit,
  Send,
  Sparkles,
  User,
  Plus,
  MessageSquare,
  Menu,
  X,
  Copy,
  Check,
  BookOpen,
  Trash2,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";
import { Course, AgentConversation, AgentMessage } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { motion, AnimatePresence } from "@/components/ui/MotionWrapper";

export default function AssistantPage() {
  const { addToast } = useToast();

  const [conversations, setConversations] = useState<AgentConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Courses for optional context injection
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

        if (cList) setCourses(cList as Course[]);

        // Load conversations
        const { data: convList } = await supabase
          .from("agent_conversations")
          .select("*")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false });

        if (convList && convList.length > 0) {
          setConversations(convList as AgentConversation[]);
          setActiveConversationId(convList[0].id);
        }
      }
    } catch {
      // Ignored
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("agent_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages((data as AgentMessage[]) || []);
    } catch {
      // Ignored
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId);
    } else {
      setMessages([]);
    }
  }, [activeConversationId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  function handleNewChat() {
    setActiveConversationId(null);
    setMessages([]);
    setSidebarOpen(false);
  }

  async function handleDeleteConversation(convId: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const supabase = createClient();
      await supabase.from("agent_conversations").delete().eq("id", convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConversationId === convId) {
        handleNewChat();
      }
      addToast({
        title: "Thread Cleared",
        description: "Conversation thread deleted.",
        type: "info",
      });
    } catch {
      // Ignored
    }
  }

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    addToast({
      title: "Copied to Clipboard",
      description: "Message content copied.",
      type: "info",
    });
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function sendMessage(textToSend?: string) {
    const text = textToSend || inputMessage;
    if (!text.trim() || busy) return;

    setBusy(true);

    const tempUserMsg: AgentMessage = {
      id: "temp-" + Date.now(),
      conversation_id: activeConversationId || "new",
      owner_id: "current",
      role: "user",
      content: text.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setInputMessage("");

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text.trim(),
          conversationId: activeConversationId || undefined,
          courseId: selectedCourseId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "The AI assistant could not process your request.");
      }

      if (data.conversationId && data.conversationId !== activeConversationId) {
        setActiveConversationId(data.conversationId);
        // Refresh conversation list
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: convs } = await supabase
            .from("agent_conversations")
            .select("*")
            .eq("owner_id", user.id)
            .order("created_at", { ascending: false });
          if (convs) setConversations(convs as AgentConversation[]);
        }
      }

      const tempAssistantMsg: AgentMessage = {
        id: "temp-ai-" + Date.now(),
        conversation_id: data.conversationId || activeConversationId || "",
        owner_id: "ai",
        role: "assistant",
        content: data.reply,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, tempAssistantMsg]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to communicate with assistant.";
      addToast({
        title: "Communication Failure",
        description: msg,
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  const activeCourse = courses.find((c) => c.id === selectedCourseId);

  const promptStarters = [
    "Plan a 60-minute interactive seminar on Distributed Consensus algorithms.",
    "Draft 5 challenging multiple-choice questions on Operating System Virtual Memory.",
    "Provide a detailed rubric for evaluating a postgraduate Software Architecture design document.",
    "Synthesize formative classroom assessment techniques for large undergraduate cohorts.",
  ];

  return (
    <div className="flex h-screen flex-col bg-[#080d18] text-[#e8edf7] selection:bg-blue-500/30">
      <Navbar />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Backdrop */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-30 bg-black/60 backdrop-blur-xs md:hidden"
            />
          )}
        </AnimatePresence>

        {/* Sidebar: Conversation Threads */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-72 transform border-r border-white/10 bg-[#0c1322] p-4 transition-transform duration-300 md:static md:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleNewChat}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600/20 border border-blue-500/30 py-2.5 text-xs font-semibold text-blue-300 hover:bg-blue-600/40 transition-colors cursor-pointer"
            >
              <Plus size={15} /> New Conversation
            </motion.button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="ml-2 text-slate-400 hover:text-white md:hidden cursor-pointer p-1"
            >
              <X size={18} />
            </button>
          </div>

          {/* Context Selector */}
          {courses.length > 0 && (
            <div className="mt-4 border-b border-white/10 pb-4">
              <label className="block text-[11px] font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
                <BookOpen size={12} className="text-blue-400" /> Active Course Focus
              </label>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#090d16] px-3 py-2 text-xs text-white outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">General Academic Context</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.course_code ? `(${c.course_code})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Conversation List */}
          <div className="mt-4 space-y-1 overflow-y-auto max-h-[calc(100vh-230px)]">
            <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">History Threads</p>
            {conversations.length === 0 ? (
              <p className="px-2 py-4 text-xs text-slate-500">No previous conversations.</p>
            ) : (
              conversations.map((conv) => {
                const isSelected = activeConversationId === conv.id;
                return (
                  <div
                    key={conv.id}
                    onClick={() => {
                      setActiveConversationId(conv.id);
                      setSidebarOpen(false);
                    }}
                    className={`group flex items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-all cursor-pointer ${
                      isSelected
                        ? "bg-blue-600/20 text-blue-200 border border-blue-500/30 font-medium"
                        : "text-slate-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <MessageSquare size={13} className="shrink-0 text-slate-500" />
                      <span className="truncate">{conv.title}</span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteConversation(conv.id, e)}
                      className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 transition-opacity p-0.5"
                      title="Delete thread"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Chat Main Area */}
        <main className="flex flex-1 flex-col overflow-hidden bg-[#080d18]">
          {/* Top Bar */}
          <div className="flex items-center justify-between border-b border-white/10 bg-[#0c1322]/80 backdrop-blur-md px-4 py-2.5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-lg border border-white/10 p-1.5 text-slate-400 hover:text-white md:hidden cursor-pointer"
              >
                <Menu size={16} />
              </button>
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400">
                  <BrainCircuit size={18} />
                </span>
                <div>
                  <h2 className="text-xs font-bold text-white flex items-center gap-2">
                    FAW-AI Academic Assistant
                    {activeCourse && (
                      <span className="rounded-md bg-blue-500/20 border border-blue-500/30 px-2 py-0.5 text-[10px] font-mono text-blue-300 hidden sm:inline-block">
                        Course: {activeCourse.name}
                      </span>
                    )}
                  </h2>
                  <p className="text-[10px] text-slate-400">Google Gemini 3.5 Flash • Context Grounded</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> Free-Tier Active
            </div>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            {messages.length === 0 ? (
              <div className="mx-auto max-w-2xl py-8 text-center">
                <motion.div
                  initial={false}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600/20 to-indigo-600/20 border border-blue-500/30 text-blue-400 shadow-lg shadow-blue-950/50"
                >
                  <BrainCircuit size={32} />
                </motion.div>
                <h3 className="mt-4 text-xl font-bold text-white">How can I assist your faculty workload today?</h3>
                <p className="mt-2 text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  I can structure comprehensive course curricula, draft assessment questions, build grading rubrics, and
                  coordinate higher-education documentation.
                </p>

                {/* Prompt Starters */}
                <div className="mt-8 grid gap-3 sm:grid-cols-2 text-left">
                  {promptStarters.map((starter, i) => (
                    <motion.button
                      key={i}
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => sendMessage(starter)}
                      className="rounded-2xl border border-white/10 bg-[#0f172a]/90 backdrop-blur-md p-4 text-xs text-slate-300 hover:border-blue-500/40 hover:bg-[#131d35] transition-all cursor-pointer shadow-sm"
                    >
                      <Sparkles size={14} className="text-blue-400 mb-2" />
                      <p className="leading-relaxed font-medium">{starter}</p>
                    </motion.button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-5">
                <AnimatePresence initial={false}>
                  {messages.map((m) => {
                    const isUser = m.role === "user";
                    return (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                      >
                        {!isUser && (
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400 mt-1">
                            <BrainCircuit size={16} />
                          </span>
                        )}

                        <div className="group relative max-w-[85%]">
                          <div
                            className={`rounded-2xl p-4 text-xs leading-relaxed ${
                              isUser
                                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-none shadow-md shadow-blue-950/40"
                                : "border border-white/10 bg-[#0f172a]/95 text-slate-200 rounded-bl-none shadow-sm whitespace-pre-wrap"
                            }`}
                          >
                            {m.content}
                          </div>

                          <button
                            onClick={() => handleCopy(m.content, m.id)}
                            className={`absolute top-2 ${
                              isUser ? "-left-8" : "-right-8"
                            } opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-black/50 text-slate-400 hover:text-white transition-opacity`}
                            title="Copy message"
                          >
                            {copiedId === m.id ? (
                              <Check size={12} className="text-emerald-400" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>

                        {isUser && (
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-slate-300 mt-1">
                            <User size={16} />
                          </span>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {busy && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-3 justify-start"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400 animate-pulse mt-1">
                      <BrainCircuit size={16} />
                    </span>
                    <div className="rounded-2xl rounded-bl-none border border-white/10 bg-[#0f172a] p-4 text-xs text-slate-400 flex items-center gap-3">
                      <div className="flex gap-1">
                        <span className="h-2 w-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="h-2 w-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="h-2 w-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                      <span className="text-[11px] text-slate-400">Synthesizing with Gemini 3.5 Flash...</span>
                    </div>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Box */}
          <div className="border-t border-white/10 bg-[#0c1322] p-4">
            <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-white/10 bg-[#090d16] p-2.5 focus-within:border-blue-500/60 focus-within:ring-1 focus-within:ring-blue-500/60 shadow-lg transition-all">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Ask FAW-AI to plan a lesson, draft exam questions, or format academic materials..."
                rows={2}
                className="min-w-0 flex-1 resize-none bg-transparent p-2 text-xs text-white placeholder-slate-500 outline-none"
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => sendMessage()}
                disabled={busy || !inputMessage.trim()}
                className="rounded-xl bg-blue-600 p-2.5 text-white shadow-md hover:bg-blue-500 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <Send size={15} />
              </motion.button>
            </div>
            <p className="mt-2 text-center text-[10px] text-slate-500">
              Conversations persist in your institutional database. Free-tier Gemini AI calls are logged under your account.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
