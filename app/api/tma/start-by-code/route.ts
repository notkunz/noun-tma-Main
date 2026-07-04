import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const TMA_COST = 400;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unexpected error";
}

type ProfileRow = { id: string };
type WalletRow = { balance: number };
type CourseRow = { id: string };
type SessionRow = { id: string; question_count?: number };

export async function POST(req: Request) {
  try {
    const { course_code } = await req.json();
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          },
        },
      },
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = (await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .single()) as { data: ProfileRow | null };

    if (!profile)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Check wallet
    const { data: wallet } = (await supabaseAdmin
      .from("wallets")
      .select("balance")
      .eq("user_id", profile.id)
      .single()) as { data: WalletRow | null };

    if (!wallet || wallet.balance < TMA_COST) {
      return NextResponse.json(
        {
          error: `Insufficient wallet balance. You need ₦${TMA_COST} to start a TMA.`,
        },
        { status: 400 },
      );
    }

    // Find or create course by code
    let { data: course } = (await supabaseAdmin
      .from("courses")
      .select("id")
      .ilike("course_code", `%${course_code}%`)
      .limit(1)
      .single()) as { data: CourseRow | null };

    // If course doesn't exist, create a minimal one
    if (!course) {
      const { data: newCourse, error: courseError } = (await supabaseAdmin
        .from("courses")
        .insert({
          course_code: course_code.toUpperCase(),
          course_title: course_code.toUpperCase(),
          level: "100",
          semester: "first",
          tma_cost: TMA_COST,
          shared_material_code: course_code.toUpperCase(),
          material_indexed: true,
        })
        .select()
        .single()) as { data: CourseRow | null; error: any };

      if (courseError || !newCourse) {
        console.error("Course creation failed:", courseError);
        return NextResponse.json(
          {
            error:
              "Failed to create course: " + (courseError?.message || "unknown"),
          },
          { status: 500 },
        );
      }
      course = newCourse;
    }

    // Check for existing active session
    const { data: existingList } = (await supabaseAdmin
      .from("tma_sessions")
      .select("id, question_count")
      .eq("user_id", profile.id)
      .eq("course_id", course!.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)) as { data: SessionRow[] | null };

    const existing = existingList?.[0] || null;

    if (existing) {
      return NextResponse.json({
        course_id: course!.id,
        session_id: existing.id,
        resumed: true,
      });
    }

    // Deduct wallet
    await supabaseAdmin.rpc("debit_wallet", {
      p_user_id: profile.id,
      p_amount: TMA_COST,
    });

    await supabaseAdmin.from("transactions").insert({
      user_id: profile.id,
      type: "debit",
      amount: TMA_COST,
      description: `TMA: ${course_code.toUpperCase()}`,
      payment_provider: "system",
      status: "success",
    });

    // Create session
    const { data: session } = (await supabaseAdmin
      .from("tma_sessions")
      .insert({
        user_id: profile.id,
        course_id: course!.id,
      })
      .select()
      .single()) as { data: SessionRow | null };

    return NextResponse.json({
      course_id: course!.id,
      session_id: session!.id,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
