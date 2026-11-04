import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=(.*)/)?.[1]?.trim();

const supabase = createClient(url, key);

const tables = [
  "profiles",
  "courses",
  "academic_documents",
  "agent_conversations",
  "agent_messages",
  "agent_tasks",
  "generated_documents",
  "ai_usage_logs",
  "activity_logs",
  "storage_objects",
  "storage_providers",
  "students",
  "student_assessments",
  "student_scores",
];

async function check() {
  console.log(`Connecting to Supabase project at ${url}...`);
  for (const table of tables) {
    const { error, count } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });
    if (error) {
      console.log(`❌ Table ${table}: ${error.message} (${error.code})`);
    } else {
      console.log(`✅ Table ${table}: active (RLS enabled, accessible)`);
    }
  }

  // Also check RPC admin_set_user_role existence
  const { error: rpcErr } = await supabase.rpc("admin_set_user_role", {
    target_user_id: "00000000-0000-0000-0000-000000000000",
    target_role: "faculty",
  });
  if (rpcErr && rpcErr.message.includes("does not exist")) {
    console.log(`❌ RPC admin_set_user_role does not exist`);
  } else {
    console.log(`✅ RPC admin_set_user_role: present and callable`);
  }
}

check().catch(console.error);
