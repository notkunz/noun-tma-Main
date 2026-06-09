import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unexpected error";
}

type UserProfile = { id: string; full_name?: string; matric_number?: string };
type WalletRow = { balance: number };
type SessionRow = {
  id?: string;
  started_at?: string;
  courses?: { course_code?: string };
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401, headers: corsHeaders },
      );
    }

    const token = data.session?.access_token;

    const { data: profile } = (await supabaseAdmin
      .from("users")
      .select("id, full_name, matric_number")
      .eq("auth_id", data.user.id)
      .single()) as { data: UserProfile | null };

    const { data: wallet } = (await supabaseAdmin
      .from("wallets")
      .select("balance")
      .eq("user_id", profile.id)
      .single()) as { data: WalletRow | null };

    const { data: session } = (await supabaseAdmin
      .from("tma_sessions")
      .select("*, courses(course_code)")
      .eq("user_id", profile.id)
      .eq("status", "active")
      .order("started_at", { ascending: false })
      .limit(1)
      .single()) as { data: SessionRow | null };

    return NextResponse.json(
      {
        token,
        user: profile,
        wallet: wallet?.balance || 0,
        session: session || null,
      },
      { headers: corsHeaders },
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "Connection error: " + getErrorMessage(err) },
      { status: 500, headers: corsHeaders },
    );
  }
}
