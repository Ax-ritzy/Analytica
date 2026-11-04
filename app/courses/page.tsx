"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BookOpen,
  Plus,
  Trash2,
  Edit2,
  FileText,
  Upload,
  Download,
  Layers,
  Search,
  File,
} from "lucide-react";
import { motion } from "motion/react";
import Navbar from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";
import { Course, AcademicDocument } from "@/lib/types";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

export default function CoursesPage() {
  const toast = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [documents, setDocuments] = useState<AcademicDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [courseName, setCourseName] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [courseDesc, setCourseDesc] = useState("");
  const [courseSemester, setCourseSemester] = useState("Fall 2026");
  const [courseYear, setCourseYear] = useState("2026-2027");
  const [actionLoading, setActionLoading] = useState(false);

  // File upload state & Drag and Drop
  const [uploadingFile, setUploadingFile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data, error } = await supabase
          .from("courses")
          .select("*")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setCourses(data as Course[]);
        if (data && data.length > 0 && !selectedCourse) {
          setSelectedCourse(data[0] as Course);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load courses.";
      toast.error(msg, "Courses Error");
    } finally {
      setLoading(false);
    }
  }, [selectedCourse, toast]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  async function loadDocuments(courseId: string) {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("academic_documents")
        .select("*")
        .eq("course_id", courseId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocuments(data as AcademicDocument[]);
    } catch {
      // document load fallback
    }
  }

  async function handleCreateCourse(e: React.FormEvent) {
    e.preventDefault();
    if (!courseName.trim()) return;
    setActionLoading(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Authentication required.");

      const coursePayload: Record<string, unknown> = {
        owner_id: user.id,
        name: courseName.trim(),
        course_code: courseCode.trim() || null,
        description: courseDesc.trim() || null,
        semester: courseSemester,
        academic_year: courseYear,
      };

      let { data, error } = await supabase
        .from("courses")
        .insert(coursePayload)
        .select()
        .single();

      // Graceful fallback if migration 004 columns are not yet active on remote schema cache
      if (error && (error.code === "PGRST204" || error.message?.includes("column"))) {
        const fallback = await supabase
          .from("courses")
          .insert({
            owner_id: user.id,
            name: courseName.trim(),
            course_code: courseCode.trim() || null,
            description: courseDesc.trim() || null,
          })
          .select()
          .single();
        data = fallback.data;
        error = fallback.error;
      }

      if (error) throw error;

      toast.success(`Course "${courseName}" created successfully.`, "Course Added");
      setIsCreateOpen(false);
      setCourseName("");
      setCourseCode("");
      setCourseDesc("");
      loadCourses();
      if (data) setSelectedCourse(data as Course);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create course.";
      toast.error(msg, "Error");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUpdateCourse(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCourse || !courseName.trim()) return;
    setActionLoading(true);

    try {
      const supabase = createClient();
      const updatePayload: Record<string, unknown> = {
        name: courseName.trim(),
        course_code: courseCode.trim() || null,
        description: courseDesc.trim() || null,
        semester: courseSemester,
        academic_year: courseYear,
        updated_at: new Date().toISOString(),
      };

      let { error } = await supabase
        .from("courses")
        .update(updatePayload)
        .eq("id", selectedCourse.id);

      if (error && (error.code === "PGRST204" || error.message?.includes("column"))) {
        const fallback = await supabase
          .from("courses")
          .update({
            name: courseName.trim(),
            course_code: courseCode.trim() || null,
            description: courseDesc.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", selectedCourse.id);
        error = fallback.error;
      }

      if (error) throw error;

      toast.success("Course details saved successfully.", "Course Updated");
      setIsEditOpen(false);
      loadCourses();
      setSelectedCourse({
        ...selectedCourse,
        name: courseName.trim(),
        course_code: courseCode.trim() || null,
        description: courseDesc.trim() || null,
        semester: courseSemester,
        academic_year: courseYear,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update course.";
      toast.error(msg, "Error");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteCourse(courseId: string) {
    if (!confirm("Are you sure you want to delete this course? Associated documents will also be detached.")) {
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.from("courses").delete().eq("id", courseId);
      if (error) throw error;

      toast.info("Course deleted successfully.", "Course Removed");
      if (selectedCourse?.id === courseId) {
        setSelectedCourse(null);
      }
      loadCourses();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete course.";
      toast.error(msg, "Error");
    }
  }

  async function processUpload(file: File) {
    if (!selectedCourse) return;

    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];

    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(pdf|docx|txt)$/i)) {
      toast.error(
        "Unsupported format. Please upload PDF (.pdf), Word (.docx), or Text (.txt) files.",
        "Invalid File Type"
      );
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size exceeds 10MB limit.", "File Too Large");
      return;
    }

    setUploadingFile(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Authentication required.");

      const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const objectPath = `${user.id}/${Date.now()}_${sanitizedFilename}`;

      const { error: uploadError } = await supabase.storage
        .from("academic-documents")
        .upload(objectPath, file, {
          cacheControl: "86400, immutable",
          upsert: false,
        });

      if (uploadError) {
        if (uploadError.message.includes("Bucket not found") || uploadError.message.includes("not found")) {
          throw new Error("Supabase Storage bucket 'academic-documents' not found. Please apply 002_enhanced_schema.sql.");
        }
        throw uploadError;
      }

      const { error: dbError } = await supabase.from("academic_documents").insert({
        owner_id: user.id,
        course_id: selectedCourse.id,
        filename: file.name,
        mime_type: file.type || "application/octet-stream",
        file_size: file.size,
        storage_provider: "supabase-primary",
        bucket_name: "academic-documents",
        object_path: objectPath,
        processing_status: "uploaded",
      });

      if (dbError) throw dbError;

      toast.success(`"${file.name}" uploaded and attached to syllabus.`, "File Uploaded");
      loadDocuments(selectedCourse.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to upload document.";
      toast.error(msg, "Upload Failed");
    } finally {
      setUploadingFile(false);
    }
  }

  async function handleDownloadDoc(doc: AcademicDocument) {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.storage.from(doc.bucket_name).createSignedUrl(doc.object_path, 300);
      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate download URL.";
      toast.error(msg, "Download Error");
    }
  }

  async function handleDeleteDoc(doc: AcademicDocument) {
    if (!confirm(`Delete document "${doc.filename}"?`)) return;

    try {
      const supabase = createClient();
      await supabase.storage.from(doc.bucket_name).remove([doc.object_path]);
      const { error } = await supabase.from("academic_documents").delete().eq("id", doc.id);
      if (error) throw error;

      toast.info(`"${doc.filename}" deleted.`, "Document Deleted");
      if (selectedCourse) loadDocuments(selectedCourse.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete document.";
      toast.error(msg, "Error");
    }
  }

  const filteredCourses = courses.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.course_code && c.course_code.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#080d18] text-[#e8edf7]">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400">
              <Layers size={14} /> Curriculum & Materials
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">Course Management</h1>
            <p className="mt-1 text-xs text-slate-400">
              Organise your teaching subjects, syllabi, and reference documents.
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setCourseName("");
              setCourseCode("");
              setCourseDesc("");
              setIsCreateOpen(true);
            }}
            className="flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-900/40 hover:bg-blue-500 transition-colors"
          >
            <Plus size={16} /> Create Course
          </motion.button>
        </div>

        {/* Master-Detail Layout */}
        <div className="mt-8 grid gap-6 lg:grid-cols-12">
          {/* Courses List Directory (Col 1-4) */}
          <div className="lg:col-span-4 rounded-3xl border border-white/10 bg-[#0f172a] p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="font-bold text-white text-sm">Course Directory</h2>
              <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[10px] font-bold text-slate-400 border border-white/5">
                {courses.length} Total
              </span>
            </div>

            {/* Search */}
            <div className="mt-3 relative">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search courses..."
                className="w-full rounded-2xl border border-white/10 bg-[#090d16] py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="mt-4 space-y-2 max-h-[620px] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-xs text-slate-500">Loading courses...</div>
              ) : filteredCourses.length === 0 ? (
                <div className="p-8 text-center">
                  <BookOpen className="mx-auto text-slate-600" size={26} />
                  <p className="mt-2 text-xs text-slate-400">No courses found.</p>
                </div>
              ) : (
                filteredCourses.map((c) => {
                  const isSelected = selectedCourse?.id === c.id;
                  return (
                    <motion.div
                      key={c.id}
                      whileHover={{ x: 2 }}
                      onClick={() => setSelectedCourse(c)}
                      className={`cursor-pointer rounded-2xl border p-3.5 transition-all ${
                        isSelected
                          ? "border-blue-500/60 bg-blue-600/15 shadow-sm"
                          : "border-white/5 bg-[#090d16] hover:border-white/20 hover:bg-white/[.02]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{c.name}</span>
                        {c.course_code && (
                          <span className="rounded-md bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-mono font-bold text-blue-300">
                            {c.course_code}
                          </span>
                        )}
                      </div>
                      {c.description && (
                        <p className="mt-1 line-clamp-1 text-[11px] text-slate-400">{c.description}</p>
                      )}
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>

          {/* Selected Course Details & Documents (Col 5-12) */}
          <div className="lg:col-span-8 space-y-6">
            {selectedCourse ? (
              <motion.div
                key={selectedCourse.id}
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Course Metadata Banner */}
                <div className="rounded-3xl border border-white/10 bg-[#0f172a] p-6 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h2 className="text-xl font-bold text-white">{selectedCourse.name}</h2>
                        {selectedCourse.course_code && (
                          <span className="rounded-lg bg-blue-500/20 px-2 py-0.5 font-mono text-xs font-bold text-blue-300 border border-blue-500/30">
                            {selectedCourse.course_code}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-slate-300 leading-relaxed max-w-2xl">
                        {selectedCourse.description || "No description provided for this course."}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                          setCourseName(selectedCourse.name);
                          setCourseCode(selectedCourse.course_code || "");
                          setCourseDesc(selectedCourse.description || "");
                          setCourseSemester(selectedCourse.semester || "Fall 2026");
                          setCourseYear(selectedCourse.academic_year || "2026-2027");
                          setIsEditOpen(true);
                        }}
                        className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 transition-colors"
                      >
                        <Edit2 size={13} /> Edit
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleDeleteCourse(selectedCourse.id)}
                        className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20 transition-colors"
                      >
                        <Trash2 size={13} /> Delete
                      </motion.button>
                    </div>
                  </div>
                </div>

                {/* Drag-and-Drop Course Materials Card */}
                <div className="rounded-3xl border border-white/10 bg-[#0f172a] p-6 shadow-sm">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center border-b border-white/10 pb-4">
                    <div>
                      <h3 className="font-bold text-white text-sm">Course Materials & Syllabi</h3>
                      <p className="text-xs text-slate-400">
                        Upload reference files (PDF, DOCX, TXT) used for AI curriculum planning.
                      </p>
                    </div>

                    <label className="flex items-center justify-center gap-2 cursor-pointer rounded-2xl bg-blue-600/25 border border-blue-500/40 px-4 py-2 text-xs font-bold text-blue-300 hover:bg-blue-600/40 transition-colors">
                      <Upload size={14} />
                      <span>{uploadingFile ? "Uploading..." : "Upload File"}</span>
                      <input
                        type="file"
                        accept=".pdf,.docx,.txt"
                        disabled={uploadingFile}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) processUpload(f);
                          e.target.value = "";
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Drag and Drop Zone */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const f = e.dataTransfer.files?.[0];
                      if (f) processUpload(f);
                    }}
                    className={`mt-4 rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
                      isDragging
                        ? "border-blue-500 bg-blue-500/10 scale-[1.01]"
                        : "border-white/10 bg-[#090d16] hover:border-white/20"
                    }`}
                  >
                    <Upload className="mx-auto text-slate-500 mb-2" size={24} />
                    <p className="text-xs font-semibold text-slate-300">
                      Drag & drop your syllabus or lecture notes here
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">Supports PDF, DOCX, TXT (up to 10MB)</p>
                  </div>

                  {/* Uploaded Documents List */}
                  <div className="mt-5 space-y-3">
                    {documents.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-500">
                        No documents uploaded for this course yet.
                      </div>
                    ) : (
                      documents.map((doc) => (
                        <motion.div
                          key={doc.id}
                          whileHover={{ x: 2 }}
                          className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#090d16] p-4 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              <FileText size={18} />
                            </span>
                            <div>
                              <p className="text-xs font-bold text-white">{doc.filename}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : "Document"} •{" "}
                                {new Date(doc.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <motion.button
                              whileHover={{ scale: 1.08 }}
                              whileTap={{ scale: 0.92 }}
                              onClick={() => handleDownloadDoc(doc)}
                              title="Download document"
                              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
                            >
                              <Download size={14} />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.08 }}
                              whileTap={{ scale: 0.92 }}
                              onClick={() => handleDeleteDoc(doc)}
                              title="Delete document"
                              className="flex h-8 w-8 items-center justify-center rounded-xl border border-red-500/20 text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                            >
                              <Trash2 size={14} />
                            </motion.button>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="rounded-3xl border border-dashed border-white/10 bg-[#0f172a] p-12 text-center">
                <BookOpen className="mx-auto text-slate-600" size={34} />
                <h3 className="mt-3 text-sm font-bold text-white">Select a course</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Choose a course from the directory on the left or create a new one.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Create Course Animated Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Course"
        subtitle="Define course title, code, and curriculum overview"
      >
        <form onSubmit={handleCreateCourse} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300">Course Title *</label>
            <input
              type="text"
              required
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              placeholder="e.g. Distributed Systems Architecture"
              className="mt-1.5 w-full rounded-2xl border border-white/10 bg-[#090d16] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300">Course Code (Optional)</label>
            <input
              type="text"
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
              placeholder="e.g. CS-401"
              className="mt-1.5 w-full rounded-2xl border border-white/10 bg-[#090d16] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300">Semester</label>
              <select
                value={courseSemester}
                onChange={(e) => setCourseSemester(e.target.value)}
                className="mt-1.5 w-full rounded-2xl border border-white/10 bg-[#090d16] px-3.5 py-2.5 text-xs text-white outline-none focus:border-blue-500 transition-colors cursor-pointer"
              >
                <option value="Fall 2026">Fall 2026</option>
                <option value="Spring 2027">Spring 2027</option>
                <option value="Summer 2027">Summer 2027</option>
                <option value="Winter 2026">Winter 2026</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300">Academic Year</label>
              <select
                value={courseYear}
                onChange={(e) => setCourseYear(e.target.value)}
                className="mt-1.5 w-full rounded-2xl border border-white/10 bg-[#090d16] px-3.5 py-2.5 text-xs text-white outline-none focus:border-blue-500 transition-colors cursor-pointer"
              >
                <option value="2026-2027">2026-2027</option>
                <option value="2025-2026">2025-2026</option>
                <option value="2027-2028">2027-2028</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300">Semester</label>
              <select
                value={courseSemester}
                onChange={(e) => setCourseSemester(e.target.value)}
                className="mt-1.5 w-full rounded-2xl border border-white/10 bg-[#090d16] px-3.5 py-2.5 text-xs text-white outline-none focus:border-blue-500 transition-colors cursor-pointer"
              >
                <option value="Fall 2026">Fall 2026</option>
                <option value="Spring 2027">Spring 2027</option>
                <option value="Summer 2027">Summer 2027</option>
                <option value="Winter 2026">Winter 2026</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300">Academic Year</label>
              <select
                value={courseYear}
                onChange={(e) => setCourseYear(e.target.value)}
                className="mt-1.5 w-full rounded-2xl border border-white/10 bg-[#090d16] px-3.5 py-2.5 text-xs text-white outline-none focus:border-blue-500 transition-colors cursor-pointer"
              >
                <option value="2026-2027">2026-2027</option>
                <option value="2025-2026">2025-2026</option>
                <option value="2027-2028">2027-2028</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300">Description</label>
            <textarea
              rows={3}
              value={courseDesc}
              onChange={(e) => setCourseDesc(e.target.value)}
              placeholder="Course objectives, target student level, semester notes..."
              className="mt-1.5 w-full resize-none rounded-2xl border border-white/10 bg-[#090d16] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading || !courseName.trim()}
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors shadow-md shadow-blue-900/40"
            >
              {actionLoading ? "Creating..." : "Create Course"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Course Animated Modal */}
      {selectedCourse && (
        <Modal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          title="Edit Course Details"
          subtitle={`Update details for ${selectedCourse.name}`}
        >
          <form onSubmit={handleUpdateCourse} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300">Course Title *</label>
              <input
                type="text"
                required
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                className="mt-1.5 w-full rounded-2xl border border-white/10 bg-[#090d16] px-3.5 py-2.5 text-xs text-white outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300">Course Code</label>
              <input
                type="text"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                className="mt-1.5 w-full rounded-2xl border border-white/10 bg-[#090d16] px-3.5 py-2.5 text-xs text-white outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300">Description</label>
              <textarea
                rows={3}
                value={courseDesc}
                onChange={(e) => setCourseDesc(e.target.value)}
                className="mt-1.5 w-full resize-none rounded-2xl border border-white/10 bg-[#090d16] px-3.5 py-2.5 text-xs text-white outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading || !courseName.trim()}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors shadow-md shadow-blue-900/40"
              >
                {actionLoading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
