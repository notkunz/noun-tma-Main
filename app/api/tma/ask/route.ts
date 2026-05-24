import { createClient } from '@supabase/supabase-js'
import Groq from 'groq-sdk'
import { NextResponse } from 'next/server'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function slidingWindowSearch(
  question: string,
  materialCode: string,
  courseId: string
): Promise<any[]> {
  const words = question
    .replace(/[^a-zA-Z\s]/g, ' ')
    .split(' ')
    .filter((w: string) => w.length > 2)

  const searchPhrases: string[] = []
  words.forEach((w: string) => searchPhrases.push(w))
  for (let i = 0; i < words.length - 1; i++) {
    searchPhrases.push(`${words[i]} ${words[i + 1]}`)
  }
  for (let i = 0; i < words.length - 2; i++) {
    searchPhrases.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`)
  }

  const limitedPhrases = searchPhrases.slice(0, 15)
  const chunkMap = new Map<string, string>()
  let foundChunks: any[] = []

  for (const phrase of limitedPhrases) {
    if (foundChunks.length >= 6) break
    const { data: matched } = await supabaseAdmin
      .from('shared_material_chunks')
      .select('chunk_text')
      .eq('course_code', materialCode)
      .ilike('chunk_text', `%${phrase}%`)
      .limit(2) as { data: any[] | null }

    if (matched && matched.length > 0) {
      matched.forEach((m: any) => {
        if (!chunkMap.has(m.chunk_text)) chunkMap.set(m.chunk_text, m.chunk_text)
      })
      foundChunks = Array.from(chunkMap.values()).map(t => ({ chunk_text: t }))
    }
  }

  if (foundChunks.length === 0) {
    for (const phrase of limitedPhrases.slice(0, 10)) {
      const { data: matched } = await supabaseAdmin
        .from('course_material_chunks')
        .select('chunk_text')
        .eq('course_id', courseId)
        .ilike('chunk_text', `%${phrase}%`)
        .limit(2) as { data: any[] | null }

      if (matched && matched.length > 0) {
        matched.forEach((m: any) => {
          if (!chunkMap.has(m.chunk_text)) chunkMap.set(m.chunk_text, m.chunk_text)
        })
        foundChunks = Array.from(chunkMap.values()).map(t => ({ chunk_text: t }))
        if (foundChunks.length >= 4) break
      }
    }
  }

  if (foundChunks.length === 0) {
    const { data: fallback } = await supabaseAdmin
      .from('shared_material_chunks')
      .select('chunk_text')
      .eq('course_code', materialCode)
      .limit(8) as { data: any[] | null }
    foundChunks = fallback || []
  }

  return foundChunks
}

export async function POST(req: Request) {
  try {
    const { session_id, course_id, question, optionsText } = await req.json()

    if (!question || question.trim().length < 3) {
      return NextResponse.json({ error: 'Question is too short.' }, { status: 400 })
    }

    const { data: session } = await supabaseAdmin
      .from('tma_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('status', 'active')
      .single() as { data: any }

    if (!session) return NextResponse.json({ error: 'Session not found or already closed.' }, { status: 400 })
    if (session.question_count >= 10) return NextResponse.json({ error: 'TMA limit reached.' }, { status: 400 })

    const questionNumber = session.question_count + 1

    // Check question bank — skip Groq call if empty
    const { data: bankEntries } = await supabaseAdmin
      .from('question_bank')
      .select('id, question_text, answer_text, times_asked')
      .eq('course_id', course_id)
      .limit(50) as { data: any[] | null }

    let bankHit = null
    if (bankEntries && bankEntries.length > 0) {
      const bankList = bankEntries.map((e, i) => `[${i}] ${e.question_text}`).join('\n')
      const matchResult = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [{
          role: 'user',
          content: `You are an exact question matcher. 
Student question: "${question}"

Bank questions:
${bankList}

STRICT RULES:
- Only match if questions are asking about the EXACT same topic AND same blank/answer
- Do NOT match questions that are merely on the same subject
- Reply MATCH:N only if 90%+ similar
- Otherwise reply NO_MATCH`
        }],
        max_tokens: 10
      })

      const matchResponse = matchResult.choices[0]?.message?.content?.trim() || ''
      if (matchResponse.startsWith('MATCH:')) {
        const index = parseInt(matchResponse.replace('MATCH:', '').trim())
        if (!isNaN(index) && bankEntries[index]) bankHit = bankEntries[index]
      }
    }

    if (bankHit) {
      await supabaseAdmin
        .from('question_bank')
        .update({ times_asked: (bankHit.times_asked || 0) + 1 })
        .eq('id', bankHit.id)

      const qa = await saveQA(session_id, session.user_id, course_id, question, bankHit.answer_text, 'question_bank', questionNumber)
      await incrementSession(session_id, questionNumber)
      return NextResponse.json({ qa })
    }

    const { data: courseData } = await supabaseAdmin
      .from('courses')
      .select('course_title, course_code, material_text, shared_material_code')
      .eq('id', course_id)
      .single() as { data: any }

    if (!courseData) return NextResponse.json({ error: 'Course not found.' }, { status: 404 })

    const materialCode = courseData.shared_material_code || courseData.course_code
    const foundChunks = await slidingWindowSearch(question, materialCode, course_id)

    let materialContext = ''
    if (foundChunks.length > 0) {
      materialContext = foundChunks.map((c: any) => c.chunk_text).join('\n\n---\n\n')
    } else if (courseData.material_text) {
      materialContext = courseData.material_text.slice(0, 10000)
    }

    const hasMaterial = materialContext.length > 0

    const prompt = `You are a NOUN TMA assistant.
${hasMaterial ? `COURSE MATERIAL:\n${materialContext}\n\n` : ''}
QUESTION: "${question}"
${optionsText ? `OPTIONS:\n${optionsText}` : ''}

RULES:
1. For fill-in-the-blank questions, find the sentence in the material that contains those exact words with the blank filled in
2. For definition questions, find what the material says defines or describes the subject
3. Match your finding to the closest option
4. The answer in the material may appear as a definition e.g "Radio Rural Forum is the strategy which..." means the answer to "______ is the strategy which..." is "Radio Rural Forum"
5. "They" or "it" in the material refers to the last named subject — use that as the answer
6. If the material mentions a group (Sociologists, Economists etc) doing something, that group IS the answer to "who believes/does ___"
7. Reply with ONLY the letter and option text e.g "B. Sociologists"
8. If not found reply: ANSWER_NOT_FOUND`

    const result = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024
    })

    const answer = result.choices[0]?.message?.content || ''

    if (!answer || answer.trim() === '') {
      return NextResponse.json({ error: 'AI returned empty response. Please try again.' }, { status: 500 })
    }

    if (answer.trim() === 'ANSWER_NOT_FOUND') {
      const qa = await saveQA(session_id, session.user_id, course_id, question, '⚠️ Answer not found in course material.', 'course_material', questionNumber)
      await incrementSession(session_id, questionNumber)
      return NextResponse.json({ qa, needs_internet: true })
    }

    const qa = await saveQA(session_id, session.user_id, course_id, question, answer, 'course_material', questionNumber)
    await incrementSession(session_id, questionNumber)
    return NextResponse.json({ qa })

  } catch (err: any) {
    console.error('TMA ask error:', err)
    return NextResponse.json({ error: 'Something went wrong: ' + err.message }, { status: 500 })
  }
}

async function saveQA(session_id: string, user_id: string, course_id: string, question: string, answer: string, source: string, questionNumber: number) {
  const { data } = await supabaseAdmin
    .from('tma_questions')
    .insert({ session_id, user_id, course_id, question_text: question, answer_text: answer, source, question_number: questionNumber })
    .select()
    .single()
  return data
}

async function incrementSession(session_id: string, newCount: number) {
  await supabaseAdmin
    .from('tma_sessions')
    .update({ question_count: newCount })
    .eq('id', session_id)
}