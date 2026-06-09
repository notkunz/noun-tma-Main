import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type CourseRow = {
  material_url?: string;
  course_code?: string;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unexpected error";
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const CHUNK_SIZE = 3000;
const OVERLAP = 200;

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = start + CHUNK_SIZE;
    chunks.push(text.slice(start, end));
    start = end - OVERLAP;
    if (start >= text.length) break;
  }
  return chunks;
}

export async function POST(req: Request) {
  try {
    const { course_id } = await req.json();

    const { data: course } = (await supabaseAdmin
      .from("courses")
      .select("material_url, course_code")
      .eq("id", course_id)
      .single()) as { data: CourseRow | null };

    if (!course?.material_url) {
      return NextResponse.json(
        { error: "No material uploaded for this course" },
        { status: 400 },
      );
    }

    const response = await fetch(course.material_url);
    if (!response.ok) {
      return NextResponse.json(
        { error: "Could not download PDF" },
        { status: 400 },
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let extractedText = "";
    let numPages = 0;

    try {
      const { extractText } = await import("unpdf");
      const { text, totalPages } = await extractText(new Uint8Array(buffer), {
        mergePages: true,
      });
      extractedText = text;
      numPages = totalPages;
    } catch (pdfErr: unknown) {
      const message = getErrorMessage(pdfErr);
      console.error("PDF parse error:", pdfErr);
      return NextResponse.json(
        { error: "Failed to read PDF: " + message },
        { status: 500 },
      );
    }

    if (!extractedText || extractedText.trim().length < 50) {
      return NextResponse.json(
        {
          error:
            "PDF appears to be image-based or empty. Please upload a text-based PDF.",
        },
        { status: 400 },
      );
    }

    const chunks = chunkText(extractedText);

    await supabaseAdmin
      .from("course_material_chunks")
      .delete()
      .eq("course_id", course_id);

    const batchSize = 20;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize).map((chunk, j) => ({
        course_id,
        chunk_index: i + j,
        chunk_text: chunk,
      }));
      await supabaseAdmin.from("course_material_chunks").insert(batch);
    }

    await supabaseAdmin
      .from("courses")
      .update({
        material_text: extractedText.slice(0, 10000),
        material_indexed: true,
      })
      .eq("id", course_id);

    return NextResponse.json({
      success: true,
      chunks: chunks.length,
      pages: numPages,
      characters: extractedText.length,
    });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    console.error("Index material error:", err);
    return NextResponse.json(
      { error: "Unexpected error: " + message },
      { status: 500 },
    );
  }
}
