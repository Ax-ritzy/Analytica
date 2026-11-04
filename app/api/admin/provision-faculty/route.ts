import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/config";

export async function POST(req: Request) {
  try {
    // 1. Authenticate caller using server session
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized: Active administrator session required." },
        { status: 401 }
      );
    }

    // 2. Authorize caller via public.profiles database role
    const { data: profile, error: profError } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (profError || !profile || profile.role !== "admin" || !profile.is_active) {
      return NextResponse.json(
        { error: "Forbidden: Verified institutional administrator role required." },
        { status: 403 }
      );
    }

    // 3. Parse and validate payload
    const body = await req.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    const requestedRole = body.role === "admin" ? "admin" : "faculty";

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Validation error: A valid email address is required." },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "Validation error: Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    const { url, key } = getSupabaseEnv();
    if (!key) {
      return NextResponse.json(
        { error: "Configuration error: Supabase key is missing." },
        { status: 500 }
      );
    }

    // 4. Provision via an isolated client that does NOT persist session or touch admin cookies
    const isolatedClient = createSupabaseClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const displayName = fullName || email.split("@")[0];
    const { data: signUpData, error: signUpError } = await isolatedClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: displayName,
          role: "faculty", // Default safely; role escalation handled via admin RPC
        },
      },
    });

    if (signUpError) {
      return NextResponse.json(
        { error: `Provisioning error: ${signUpError.message}` },
        { status: 400 }
      );
    }

    const newUserId = signUpData.user?.id;
    if (!newUserId) {
      return NextResponse.json(
        { error: "Provisioning error: No user ID returned from authentication provider." },
        { status: 500 }
      );
    }

    // 5. If admin role requested, elevate target user via the admin_set_user_role RPC
    if (requestedRole === "admin") {
      const { error: rpcError } = await supabase.rpc("admin_set_user_role", {
        target_user_id: newUserId,
        target_role: "admin",
      });

      if (rpcError) {
        // Fallback update if RPC is not present
        await supabase
          .from("profiles")
          .update({ role: "admin" })
          .eq("id", newUserId);
      }
    }

    // 6. Write audit trail entry
    await supabase.from("activity_logs").insert({
      actor_id: user.id,
      action: "faculty_provisioned",
      resource_type: "profiles",
      resource_id: newUserId,
      metadata: {
        provisioned_email: email,
        provisioned_name: displayName,
        assigned_role: requestedRole,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Account for ${displayName} (${email}) provisioned successfully as ${requestedRole.toUpperCase()}.`,
      user: {
        id: newUserId,
        email,
        fullName: displayName,
        role: requestedRole,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
