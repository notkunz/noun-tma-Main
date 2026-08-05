import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET() {
  try {
    // Simple ping — just check if DB responds
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id")
      .limit(1);

    if (error) throw error;

    return NextResponse.json({ status: "ok", pinged: new Date() });
  } catch (err) {
    console.error("Health check failed:", err);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
