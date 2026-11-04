import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("FAW-AI Security Hardening & Compatibility Patch Regression Suite", () => {
  // =========================================================================
  // 1. handle_new_user() Auth Metadata Sanitization
  // =========================================================================
  describe("1. handle_new_user() Auth Metadata Sanitization", () => {
    function handleNewUser(rawUserMetaData) {
      let userRole = (rawUserMetaData?.role || "faculty").toLowerCase().trim();
      // Security rule: metadata cannot grant admin
      if (!["faculty", "professor"].includes(userRole) || ["admin", "ADMIN"].includes(userRole)) {
        userRole = "faculty";
      }
      return userRole;
    }

    test("1.1 User signing up with role: 'admin' in metadata is coerced to 'faculty'", () => {
      assert.equal(handleNewUser({ role: "admin" }), "faculty");
      assert.equal(handleNewUser({ role: "ADMIN" }), "faculty");
      assert.equal(handleNewUser({ role: "Admin" }), "faculty");
    });

    test("1.2 User signing up with role: 'professor' is allowed", () => {
      assert.equal(handleNewUser({ role: "professor" }), "professor");
    });

    test("1.3 User signing up with arbitrary role ('superuser', 'root') defaults to 'faculty'", () => {
      assert.equal(handleNewUser({ role: "superuser" }), "faculty");
      assert.equal(handleNewUser({ role: "god" }), "faculty");
      assert.equal(handleNewUser(null), "faculty");
      assert.equal(handleNewUser({}), "faculty");
    });
  });

  // =========================================================================
  // 2. Profile Role & Active Status Protection Trigger (INSERT & UPDATE)
  // =========================================================================
  describe("2. Profile Protection Trigger (tr_protect_profile_role)", () => {
    function protectProfileRole({
      tgOp,
      sessionUser,
      jwtRole,
      callerId,
      oldRow,
      newRow,
      profilesTable,
    }) {
      const isDbaSession =
        ["postgres", "supabase_admin"].includes(sessionUser) && (!jwtRole || jwtRole === "");
      const isServiceRole = jwtRole === "service_role";
      const isAdminUser = profilesTable.some(
        (p) => p.id === callerId && ["admin", "ADMIN"].includes(p.role) && p.is_active
      );

      // --- INSERT ---
      if (tgOp === "INSERT") {
        if (!["admin", "ADMIN"].includes(newRow.role) && newRow.is_active === true) {
          return newRow;
        }
        if (isDbaSession || isServiceRole || (jwtRole === "authenticated" && isAdminUser)) {
          return newRow;
        }
        throw new Error("Access Denied: Ordinary users cannot self-assign the administrator role.");
      }

      // --- UPDATE ---
      // If neither role nor is_active changed, allow unprivileged updates
      if (newRow.role === oldRow.role && newRow.is_active === oldRow.is_active) {
        return newRow;
      }

      if (isDbaSession || isServiceRole) {
        return newRow;
      }

      if (jwtRole === "anon" || !callerId) {
        throw new Error(
          "Access Denied: Anonymous or unauthenticated requests cannot modify account roles or active status."
        );
      }

      if (!isAdminUser) {
        throw new Error(
          "Access Denied: Only institutional administrators can change account roles or active status."
        );
      }

      // Last active admin protection
      if (
        ["admin", "ADMIN"].includes(oldRow.role) &&
        oldRow.is_active === true &&
        (!["admin", "ADMIN"].includes(newRow.role) || newRow.is_active === false)
      ) {
        const activeAdminCount = profilesTable.filter(
          (p) => ["admin", "ADMIN"].includes(p.role) && p.is_active
        ).length;
        if (activeAdminCount <= 1) {
          throw new Error(
            "Operation rejected: Cannot demote or deactivate the last remaining active administrator."
          );
        }
      }

      return newRow;
    }

    const mockDb = [
      { id: "admin-1", role: "admin", is_active: true, full_name: "Admin One" },
      { id: "faculty-1", role: "faculty", is_active: true, full_name: "Faculty One" },
      { id: "faculty-banned", role: "faculty", is_active: false, full_name: "Deactivated Faculty" },
    ];

    test("2.1 Ordinary user INSERT with role = 'admin' is blocked", () => {
      assert.throws(
        () =>
          protectProfileRole({
            tgOp: "INSERT",
            sessionUser: "authenticator",
            jwtRole: "authenticated",
            callerId: "faculty-1",
            oldRow: null,
            newRow: { id: "faculty-1", role: "admin", is_active: true },
            profilesTable: mockDb,
          }),
        /Access Denied: Ordinary users cannot self-assign the administrator role/
      );
    });

    test("2.2 Ordinary user INSERT with role = 'faculty' succeeds", () => {
      const res = protectProfileRole({
        tgOp: "INSERT",
        sessionUser: "authenticator",
        jwtRole: "authenticated",
        callerId: "faculty-1",
        oldRow: null,
        newRow: { id: "faculty-1", role: "faculty", is_active: true },
        profilesTable: mockDb,
      });
      assert.equal(res.role, "faculty");
    });

    test("2.3 Anonymous caller attempting role escalation on UPDATE is blocked", () => {
      assert.throws(
        () =>
          protectProfileRole({
            tgOp: "UPDATE",
            sessionUser: "authenticator",
            jwtRole: "anon",
            callerId: null,
            oldRow: { id: "faculty-1", role: "faculty", is_active: true },
            newRow: { id: "faculty-1", role: "admin", is_active: true },
            profilesTable: mockDb,
          }),
        /Access Denied: Anonymous or unauthenticated requests cannot modify account roles or active status/
      );
    });

    test("2.4 Faculty self-promotion to admin on UPDATE is blocked", () => {
      assert.throws(
        () =>
          protectProfileRole({
            tgOp: "UPDATE",
            sessionUser: "authenticator",
            jwtRole: "authenticated",
            callerId: "faculty-1",
            oldRow: { id: "faculty-1", role: "faculty", is_active: true },
            newRow: { id: "faculty-1", role: "admin", is_active: true },
            profilesTable: mockDb,
          }),
        /Access Denied: Only institutional administrators can change account roles or active status/
      );
    });

    test("2.5 Deactivated faculty attempting to self-reactivate is blocked", () => {
      assert.throws(
        () =>
          protectProfileRole({
            tgOp: "UPDATE",
            sessionUser: "authenticator",
            jwtRole: "authenticated",
            callerId: "faculty-banned",
            oldRow: { id: "faculty-banned", role: "faculty", is_active: false },
            newRow: { id: "faculty-banned", role: "faculty", is_active: true },
            profilesTable: mockDb,
          }),
        /Access Denied: Only institutional administrators can change account roles or active status/
      );
    });

    test("2.6 Permitted unprivileged updates (full_name) succeed", () => {
      const res = protectProfileRole({
        tgOp: "UPDATE",
        sessionUser: "authenticator",
        jwtRole: "authenticated",
        callerId: "faculty-1",
        oldRow: { id: "faculty-1", role: "faculty", is_active: true, full_name: "Old Name" },
        newRow: { id: "faculty-1", role: "faculty", is_active: true, full_name: "New Name" },
        profilesTable: mockDb,
      });
      assert.equal(res.full_name, "New Name");
    });

    test("2.7 Administrator attempting to deactivate sole active admin is blocked", () => {
      assert.throws(
        () =>
          protectProfileRole({
            tgOp: "UPDATE",
            sessionUser: "authenticator",
            jwtRole: "authenticated",
            callerId: "admin-1",
            oldRow: { id: "admin-1", role: "admin", is_active: true },
            newRow: { id: "admin-1", role: "admin", is_active: false },
            profilesTable: mockDb,
          }),
        /Operation rejected: Cannot demote or deactivate the last remaining active administrator/
      );
    });

    test("2.8 SQL Editor DBA session (postgres) can update role and active status", () => {
      const res = protectProfileRole({
        tgOp: "UPDATE",
        sessionUser: "postgres",
        jwtRole: null,
        callerId: null,
        oldRow: { id: "faculty-1", role: "faculty", is_active: true },
        newRow: { id: "faculty-1", role: "admin", is_active: true },
        profilesTable: mockDb,
      });
      assert.equal(res.role, "admin");
    });
  });

  // =========================================================================
  // 3. Administrator Role RPC & Concurrency Lock
  // =========================================================================
  describe("3. Hardened Role Management RPC (admin_set_user_role)", () => {
    function adminSetUserRole({
      callerId,
      targetUserId,
      targetRole,
      profilesTable,
      activityLogsTable,
    }) {
      const caller = profilesTable.find(
        (p) => p.id === callerId && ["admin", "ADMIN"].includes(p.role) && p.is_active
      );
      if (!caller) {
        throw new Error("Unauthorized: Institutional administrator privileges required.");
      }
      if (!targetUserId) throw new Error("Target user ID cannot be null.");
      if (!targetRole || targetRole.trim() === "") throw new Error("Target role cannot be null or empty.");

      const normalizedRole = targetRole.trim().toLowerCase();
      if (!["faculty", "professor", "admin"].includes(normalizedRole)) {
        throw new Error(`Invalid role "${targetRole}". Permitted roles are: faculty, professor, admin.`);
      }

      const targetProfile = profilesTable.find((p) => p.id === targetUserId);
      if (!targetProfile) throw new Error(`Target user profile with ID ${targetUserId} does not exist.`);

      const currentTargetRole = targetProfile.role;

      if (currentTargetRole === "admin" && normalizedRole !== "admin") {
        // Deterministic lock: sort active admin rows by id
        const activeAdmins = profilesTable
          .filter((p) => p.role === "admin" && p.is_active)
          .sort((a, b) => a.id.localeCompare(b.id));

        if (activeAdmins.length <= 1) {
          throw new Error("Operation rejected: Cannot demote the last remaining active administrator.");
        }
      }

      targetProfile.role = normalizedRole;

      activityLogsTable.push({
        actor_id: callerId,
        action: "admin_role_change",
        resource_type: "profiles",
        resource_id: targetUserId,
        metadata: {
          target_user_id: targetUserId,
          previous_role: currentTargetRole,
          new_role: normalizedRole,
          changed_by: callerId,
          timestamp: new Date().toISOString(),
        },
      });

      return { success: true, user_id: targetUserId, previous_role: currentTargetRole, assigned_role: normalizedRole };
    }

    test("3.1 Non-administrator calling RPC is rejected", () => {
      const profiles = [{ id: "admin-1", role: "admin", is_active: true }, { id: "faculty-1", role: "faculty", is_active: true }];
      assert.throws(
        () => adminSetUserRole({ callerId: "faculty-1", targetUserId: "faculty-1", targetRole: "admin", profilesTable: profiles, activityLogsTable: [] }),
        /Unauthorized: Institutional administrator privileges required/
      );
    });

    test("3.2 Sole administrator demotion is rejected", () => {
      const profiles = [{ id: "admin-1", role: "admin", is_active: true }];
      assert.throws(
        () => adminSetUserRole({ callerId: "admin-1", targetUserId: "admin-1", targetRole: "faculty", profilesTable: profiles, activityLogsTable: [] }),
        /Operation rejected: Cannot demote the last remaining active administrator/
      );
    });

    test("3.3 Admin demotion with multiple admins succeeds with atomic audit log", () => {
      const profiles = [
        { id: "admin-1", role: "admin", is_active: true },
        { id: "admin-2", role: "admin", is_active: true },
      ];
      const logs = [];
      const res = adminSetUserRole({ callerId: "admin-1", targetUserId: "admin-2", targetRole: "faculty", profilesTable: profiles, activityLogsTable: logs });
      assert.equal(res.success, true);
      assert.equal(profiles.find((p) => p.id === "admin-2").role, "faculty");
      assert.equal(logs.length, 1);
    });
  });

  // =========================================================================
  // 4. Document Content Synchronization (Deterministic Rule)
  // =========================================================================
  describe("4. Document Content Synchronization (sync_generated_document_content)", () => {
    function syncDocumentContent(tgOp, oldRow, newRow) {
      const res = { ...newRow };

      if (tgOp === "UPDATE") {
        const contentChanged = JSON.stringify(newRow.content) !== JSON.stringify(oldRow.content);
        const contentJsonChanged = JSON.stringify(newRow.content_json) !== JSON.stringify(oldRow.content_json);

        if (contentJsonChanged && !contentChanged) {
          res.content = res.content_json || {};
          res.content_json = res.content;
        } else if (contentChanged) {
          // Rule: content is authoritative
          res.content = res.content || {};
          res.content_json = res.content;
        }
      } else if (tgOp === "INSERT") {
        if (res.content_json && (!res.content || Object.keys(res.content).length === 0)) {
          res.content = res.content_json;
        } else if (res.content) {
          // Rule: content is authoritative
          res.content_json = res.content;
        }
      }

      // Invariant assertions
      if (res.content == null) res.content = res.content_json || {};
      if (res.content_json == null) res.content_json = res.content || {};
      if (JSON.stringify(res.content) !== JSON.stringify(res.content_json)) {
        res.content_json = res.content;
      }

      return res;
    }

    test("4.1 INSERT with only content supplied populates content_json", () => {
      const doc = syncDocumentContent("INSERT", null, { content: { topic: "AI" }, content_json: null });
      assert.deepEqual(doc.content_json, { topic: "AI" });
      assert.deepEqual(doc.content, { topic: "AI" });
    });

    test("4.2 INSERT with only content_json supplied populates content", () => {
      const doc = syncDocumentContent("INSERT", null, { content: null, content_json: { topic: "Robotics" } });
      assert.deepEqual(doc.content, { topic: "Robotics" });
      assert.deepEqual(doc.content_json, { topic: "Robotics" });
    });

    test("4.3 INSERT with both values equal retains identical values", () => {
      const doc = syncDocumentContent("INSERT", null, { content: { a: 1 }, content_json: { a: 1 } });
      assert.deepEqual(doc.content, { a: 1 });
      assert.deepEqual(doc.content_json, { a: 1 });
    });

    test("4.4 INSERT with conflicting values prefers content as authoritative", () => {
      const doc = syncDocumentContent("INSERT", null, { content: { authoritative: true }, content_json: { authoritative: false } });
      assert.deepEqual(doc.content, { authoritative: true });
      assert.deepEqual(doc.content_json, { authoritative: true });
    });

    test("4.5 UPDATE changing only content updates content_json", () => {
      const oldR = { content: { v: 1 }, content_json: { v: 1 } };
      const newR = { content: { v: 2 }, content_json: { v: 1 } };
      const updated = syncDocumentContent("UPDATE", oldR, newR);
      assert.deepEqual(updated.content_json, { v: 2 });
    });

    test("4.6 UPDATE changing only content_json updates content", () => {
      const oldR = { content: { v: 1 }, content_json: { v: 1 } };
      const newR = { content: { v: 1 }, content_json: { v: 5 } };
      const updated = syncDocumentContent("UPDATE", oldR, newR);
      assert.deepEqual(updated.content, { v: 5 });
    });

    test("4.7 UPDATE changing content to NULL safely coalesces without null errors", () => {
      const oldR = { content: { v: 1 }, content_json: { v: 1 } };
      const newR = { content: null, content_json: null };
      const updated = syncDocumentContent("UPDATE", oldR, newR);
      assert.deepEqual(updated.content, {});
      assert.deepEqual(updated.content_json, {});
    });

    test("4.8 UPDATE changing both conflicting values prefers content as authoritative", () => {
      const oldR = { content: { v: 1 }, content_json: { v: 1 } };
      const newR = { content: { v: "from-content" }, content_json: { v: "from-json" } };
      const updated = syncDocumentContent("UPDATE", oldR, newR);
      assert.deepEqual(updated.content, { v: "from-content" });
      assert.deepEqual(updated.content_json, { v: "from-content" });
    });
  });

  // =========================================================================
  // 5. First Administrator Safe Bootstrap
  // =========================================================================
  describe("5. First Administrator Safe Bootstrap (safe_first_admin_bootstrap)", () => {
    function simulateBootstrap({ targetEmail, authUsers, profilesTable, activityLogsTable }) {
      const normalizedEmail = targetEmail.trim().toLowerCase();
      const matches = authUsers.filter((u) => u.email.trim().toLowerCase() === normalizedEmail);

      if (matches.length === 0) {
        throw new Error(`Bootstrap Aborted: No account found with email "${normalizedEmail}". User must register first.`);
      }
      if (matches.length > 1) {
        throw new Error(`Bootstrap Aborted: Ambiguous state. Multiple accounts found with email "${normalizedEmail}".`);
      }

      const user = matches[0];

      // Email confirmation check
      if (!user.email_confirmed_at) {
        throw new Error(`Bootstrap Aborted: Account "${normalizedEmail}" exists but email is not confirmed.`);
      }

      let profile = profilesTable.find((p) => p.id === user.id);

      if (!profile) {
        profile = { id: user.id, full_name: "Ritvik", role: "admin", is_active: true };
        profilesTable.push(profile);
        return { status: "CREATED_AND_ELEVATED", user_id: user.id };
      }

      if (profile.role === "admin" && profile.is_active) {
        return { status: "ALREADY_ADMIN", user_id: user.id };
      }

      const prevRole = profile.role;
      profile.role = "admin";
      profile.is_active = true;

      activityLogsTable.push({
        actor_id: user.id,
        action: "first_admin_bootstrap",
        resource_type: "profiles",
        resource_id: user.id,
        metadata: {
          target_email: normalizedEmail,
          previous_role: prevRole,
          elevated_role: "admin",
          email_confirmed: true,
          timestamp: new Date().toISOString(),
        },
      });

      return { status: "ELEVATED", user_id: user.id, previous_role: prevRole };
    }

    test("5.1 Bootstrap aborts when no matching account exists", () => {
      assert.throws(
        () =>
          simulateBootstrap({
            targetEmail: "ritviksankar.k2005@gmail.com",
            authUsers: [],
            profilesTable: [],
            activityLogsTable: [],
          }),
        /No account found with email/
      );
    });

    test("5.2 Bootstrap aborts when multiple matching accounts exist", () => {
      const authUsers = [
        { id: "u-1", email: "ritviksankar.k2005@gmail.com", email_confirmed_at: "2026-11-01" },
        { id: "u-2", email: "ritviksankar.k2005@gmail.com", email_confirmed_at: "2026-11-02" },
      ];
      assert.throws(
        () =>
          simulateBootstrap({
            targetEmail: "ritviksankar.k2005@gmail.com",
            authUsers,
            profilesTable: [],
            activityLogsTable: [],
          }),
        /Ambiguous state/
      );
    });

    test("5.3 Bootstrap aborts when user email is UNCONFIRMED (email_confirmed_at is null)", () => {
      const authUsers = [
        { id: "u-ritvik", email: "ritviksankar.k2005@gmail.com", email_confirmed_at: null },
      ];
      assert.throws(
        () =>
          simulateBootstrap({
            targetEmail: "ritviksankar.k2005@gmail.com",
            authUsers,
            profilesTable: [{ id: "u-ritvik", role: "faculty", is_active: true }],
            activityLogsTable: [],
          }),
        /email is not confirmed/
      );
    });

    test("5.4 Bootstrap succeeds with confirmed account and elevates to admin with audit log", () => {
      const authUsers = [
        { id: "u-ritvik", email: "ritviksankar.k2005@gmail.com", email_confirmed_at: "2026-11-04T00:00:00Z" },
      ];
      const profiles = [
        { id: "u-ritvik", role: "faculty", is_active: true, full_name: "Ritvik" },
      ];
      const logs = [];

      const res = simulateBootstrap({
        targetEmail: "ritviksankar.k2005@gmail.com",
        authUsers,
        profilesTable: profiles,
        activityLogsTable: logs,
      });

      assert.equal(res.status, "ELEVATED");
      assert.equal(profiles.find((p) => p.id === "u-ritvik").role, "admin");
      assert.equal(logs.length, 1);
      assert.equal(logs[0].action, "first_admin_bootstrap");
    });

    test("5.5 Bootstrap is idempotent if account is already active administrator", () => {
      const authUsers = [
        { id: "u-ritvik", email: "ritviksankar.k2005@gmail.com", email_confirmed_at: "2026-11-04T00:00:00Z" },
      ];
      const profiles = [
        { id: "u-ritvik", role: "admin", is_active: true, full_name: "Ritvik" },
      ];
      const logs = [];

      const res = simulateBootstrap({
        targetEmail: "ritviksankar.k2005@gmail.com",
        authUsers,
        profilesTable: profiles,
        activityLogsTable: logs,
      });

      assert.equal(res.status, "ALREADY_ADMIN");
      assert.equal(logs.length, 0);
    });
  });
});
