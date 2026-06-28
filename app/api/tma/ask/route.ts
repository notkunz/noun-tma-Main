import { createClient } from "@supabase/supabase-js";
import Groq from "groq-sdk";
import { NextResponse } from "next/server";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unexpected error";
}

type ChunkRow = { chunk_text?: string };
type BankEntry = {
  id: string;
  question_text: string;
  answer_text: string;
  times_asked?: number;
};
type SessionRow = { id: string; user_id: string; question_count: number };
type CourseRow = {
  course_title?: string;
  course_code?: string;
  material_text?: string;
  shared_material_code?: string;
};

async function callGroqWithRetry(
  groqClient: unknown,
  params: unknown,
  retries = 2,
): Promise<unknown> {
  for (let i = 0; i <= retries; i++) {
    try {
      // use a runtime cast to call the SDK method — preserved logic
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await (groqClient as any).chat.completions.create(params);
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      // detect rate-limit by message text
      if (message.includes("429") && i < retries) {
        console.log(`Rate limited, waiting 10s before retry ${i + 1}`);
        await new Promise((r) => setTimeout(r, 10000));
        continue;
      }
      throw err;
    }
  }
}

async function slidingWindowSearch(
  question: string,
  materialCode: string,
  courseId: string,
): Promise<ChunkRow[]> {
  console.log("DEBUG: slidingWindowSearch called with:", {
    question,
    materialCode,
    courseId,
  });
  const words = question
    .replace(/[^a-zA-Z\s]/g, " ")
    .split(" ")
    .filter((w) => w.length > 2);

  const searchPhrases: string[] = [];
  words.forEach((w) => searchPhrases.push(w));
  for (let i = 0; i < words.length - 1; i++) {
    searchPhrases.push(`${words[i]} ${words[i + 1]}`);
  }
  for (let i = 0; i < words.length - 2; i++) {
    searchPhrases.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  }

  const limitedPhrases = searchPhrases.slice(0, 15);
  const chunkMap = new Map<string, string>();
  let foundChunks: ChunkRow[] = [];

  for (const phrase of limitedPhrases) {
    if (foundChunks.length >= 6) break;
    const { data: matched } = (await supabaseAdmin
      .from("shared_material_chunks")
      .select("chunk_text")
      .eq("course_code", materialCode)
      .ilike("chunk_text", `%${phrase}%`)
      .limit(2)) as { data: ChunkRow[] | null };

    if (matched && matched.length > 0) {
      matched.forEach((m) => {
        if (m.chunk_text && !chunkMap.has(m.chunk_text))
          chunkMap.set(m.chunk_text, m.chunk_text);
      });
      foundChunks = Array.from(chunkMap.values()).map((t) => ({
        chunk_text: t,
      }));
    }
  }

  if (foundChunks.length === 0) {
    for (const phrase of limitedPhrases.slice(0, 10)) {
      const { data: matched } = (await supabaseAdmin
        .from("course_material_chunks")
        .select("chunk_text")
        .eq("course_id", courseId)
        .ilike("chunk_text", `%${phrase}%`)
        .limit(2)) as { data: ChunkRow[] | null };

      if (matched && matched.length > 0) {
        matched.forEach((m) => {
          if (m.chunk_text && !chunkMap.has(m.chunk_text))
            chunkMap.set(m.chunk_text, m.chunk_text);
        });
        foundChunks = Array.from(chunkMap.values()).map((t) => ({
          chunk_text: t,
        }));
        if (foundChunks.length >= 4) break;
      }
    }
  }

  if (foundChunks.length === 0) {
    const { data: fallback } = (await supabaseAdmin
      .from("shared_material_chunks")
      .select("chunk_text")
      .eq("course_code", materialCode)
      .limit(8)) as { data: ChunkRow[] | null };
    foundChunks = fallback || [];
  }

  console.log(
    "DEBUG: slidingWindowSearch returning",
    foundChunks.length,
    "chunks",
  );
  return foundChunks;
}

export async function POST(req: Request) {
  try {
    const { session_id, course_id, question, optionsText } = await req.json();

    if (!question || question.trim().length < 3) {
      return NextResponse.json(
        { error: "Question is too short." },
        { status: 400 },
      );
    }

    const { data: session } = (await supabaseAdmin
      .from("tma_sessions")
      .select("*")
      .eq("id", session_id)
      .eq("status", "active")
      .single()) as { data: SessionRow | null };

    if (!session)
      return NextResponse.json(
        { error: "Session not found or already closed." },
        { status: 400 },
      );
    if (session.question_count >= 10)
      return NextResponse.json(
        { error: "TMA limit reached." },
        { status: 400 },
      );

    const questionNumber = session.question_count + 1;

    const { data: bankEntries } = (await supabaseAdmin
      .from("question_bank")
      .select("id, question_text, answer_text, times_asked")
      .eq("course_id", course_id)
      .limit(50)) as { data: BankEntry[] | null };

    let bankHit: BankEntry | null = null;
    if (bankEntries && bankEntries.length > 0) {
      const bankList = bankEntries
        .map((e, i) => `[${i}] ${e.question_text}`)
        .join("\n");
      const matchResult = await callGroqWithRetry(groq, {
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "user",
            content: `You are an exact question matcher. \nStudent question: "${question}"\n\nBank questions:\n${bankList}\n\nSTRICT RULES:\n- Only match if questions are asking about the EXACT same topic AND same blank/answer\n- Do NOT match questions that are merely on the same subject\n- Reply MATCH:N only if 90%+ similar\n- Otherwise reply NO_MATCH`,
          },
        ],
        max_tokens: 10,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const matchResponse =
        (matchResult as any).choices?.[0]?.message?.content?.trim() || "";
      if (matchResponse.startsWith("MATCH:")) {
        const index = parseInt(matchResponse.replace("MATCH:", "").trim());
        if (!isNaN(index) && bankEntries[index]) bankHit = bankEntries[index];
      }
    }

    if (bankHit) {
      await supabaseAdmin
        .from("question_bank")
        .update({ times_asked: (bankHit.times_asked || 0) + 1 })
        .eq("id", bankHit.id);

      const qa = await saveQA(
        session_id,
        session.user_id,
        course_id,
        question,
        bankHit.answer_text,
        "question_bank",
        questionNumber,
        99,
      );
      await incrementSession(session_id, questionNumber);
      return NextResponse.json({ qa });
    }

    const { data: courseData } = (await supabaseAdmin
      .from("courses")
      .select("course_title, course_code, material_text, shared_material_code")
      .eq("id", course_id)
      .single()) as { data: CourseRow | null };

    if (!courseData)
      return NextResponse.json({ error: "Course not found." }, { status: 404 });

    const materialCode =
      courseData.shared_material_code || courseData.course_code;
    console.log("DEBUG: materialCode =", materialCode);
    console.log(
      "DEBUG: shared_material_code =",
      courseData.shared_material_code,
    );
    console.log("DEBUG: course_code =", courseData.course_code);

    const foundChunks = await slidingWindowSearch(
      question,
      materialCode || "",
      course_id,
    );

    let materialContext = "";
    if (foundChunks.length > 0) {
      console.log('DEBUG: Found chunks:');
      materialContext = foundChunks
        .map((c) => c.chunk_text || "")
        .join("\n\n---\n\n");
    } else if (courseData.material_text) {
      materialContext = courseData.material_text.slice(0, 10000);
               console.log(`Chunk ${idx}: ${chunk.chunk_text?.slice(0, 150)}...`);

    }

    const hasMaterial = materialContext.length > 0;
    console.log(
      "DEBUG: hasMaterial =",
      hasMaterial,
      "length =",
      materialContext.length,
    );

    const prompt = `You are a NOUN TMA assistant.\n${hasMaterial ? `COURSE MATERIAL:\n${materialContext}\n\n` : ""}\nQUESTION: "${question}"\n${optionsText ? `OPTIONS:\n${optionsText}` : ""}\n\nRULES:\n1. For fill-in-the-blank questions, find the sentence in the material that contains those exact words with the blank filled in\n2. For definition questions, find what the material says defines or describes the subject\n3. Match your finding to the closest option\n4. The answer in the material may appear as a definition e.g "Radio Rural Forum is the strategy which..." means the answer to "______ is the strategy which..." is "Radio Rural Forum"\n5. "They" or "it" in the material refers to the last named subject — use that as the answer\n6. If the material mentions a group (Sociologists, Economists etc) doing something, that group IS the answer to "who believes/does ___"\n7. Reply with ONLY the letter and option text e.g "B. Sociologists"\n8. If not found reply: ANSWER_NOT_FOUND`;

    const result = await callGroqWithRetry(groq, {
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1024,
      
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const answer = (result as any).choices?.[0]?.message?.content || "";

    if (!answer || answer.trim() === "")
      return NextResponse.json({ error: "Please try again." }, { status: 500 });

    if (answer.trim() === "ANSWER_NOT_FOUND") {
      const qa = await saveQA(
        session_id,
        session.user_id,
        course_id,
        question,
        "Answer not found",
        "not_found",
        questionNumber,
        0,
      );
      await incrementSession(session_id, questionNumber);
      return NextResponse.json({ qa, needs_internet: true });
    }

    const qa = await saveQA(
      session_id,
      session.user_id,
      course_id,
      question,
      answer,
      "course_material",
      questionNumber,
      foundChunks.length > 0 ? Math.min(95, 60 + foundChunks.length * 5) : 30, // <- confidence score
    );

    await incrementSession(session_id, questionNumber);
    return NextResponse.json({ qa });
  } catch (err: unknown) {
    console.error("TMA ask error:", err);

    const message = getErrorMessage(err);
    if (message.includes("rate_limit_exceeded") || message.includes("429")) {
      const retryMatch = message.match(/try again in (\d+)m(\d+)?/);
      const minuteMatch = message.match(/(\d+)m/);
      const minutes = retryMatch?.[1] || minuteMatch?.[1] || "30";
      return NextResponse.json(
        { error: `Please try again in ${minutes} minutes.` },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}

async function saveQA(
  session_id: string,
  user_id: string,
  course_id: string,
  question: string,
  answer: string,
  source: string,
  questionNumber: number,
  matchPercentage: number = 0,
) {
  const { data } = await supabaseAdmin
    .from("tma_questions")
    .insert({
      session_id,
      user_id,
      course_id,
      question_text: question,
      answer_text: answer,
      source,
      question_number: questionNumber,
      match_percentage: matchPercentage,
    })
    .select()
    .single();
  return data;
}

async function incrementSession(session_id: string, newCount: number) {
  await supabaseAdmin
    .from("tma_sessions")
    .update({ question_count: newCount })
    .eq("id", session_id);
}
