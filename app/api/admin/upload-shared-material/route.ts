import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unexpected error";
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: Request) {
  try {
    const { course_code, material_url } = await req.json();

    if (!course_code || !material_url) {
      return NextResponse.json(
        { error: "Missing course code or URL" },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin.from("shared_materials").upsert(
      {
        course_code: course_code.toUpperCase(),
        material_url,
        material_indexed: false,
      },
      { onConflict: "course_code" },
    );

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
