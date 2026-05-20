import { createClient } from '@supabase/supabase-js'
import Groq from 'groq-sdk'
import { NextResponse } from 'next/server'

// Initialize Groq client once to avoid using it before declaration
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { session_id, course_id, question } = await req.json()

    if (!question || question.trim().length < 3) {
      return NextResponse.json({ error: 'Question is too short.' }, { status: 400 })
    }

    // 1. Validate session
    const { data: session } = await supabaseAdmin
      .from('tma_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('status', 'active')
      .single() as { data: any }

    if (!session) return NextResponse.json({ error: 'Session not found or already closed.' }, { status: 400 })
    if (session.question_count >= 10) return NextResponse.json({ error: 'TMA limit reached.' }, { status: 400 })

    const questionNumber = session.question_count + 1

// 2. Smart question bank check using AI similarity
const { data: bankEntries } = await supabaseAdmin
  .from('question_bank')
  .select('id, question_text, answer_text, times_asked')
  .eq('course_id', course_id)
  .limit(50) as { data: any[] | null }

let bankHit = null

if (bankEntries && bankEntries.length > 0) {
  // Build a list of bank questions to send to AI
  const bankList = bankEntries
    .map((e, i) => `[${i}] ${e.question_text}`)
    .join('\n')

  const matchResult = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{
      role: 'user',
      content: `You are a question matcher. A student asked this question:
"${question}"

Here are questions already in the question bank:
${bankList}

If any question in the bank is asking the SAME thing (even if worded differently), reply with ONLY the number in brackets like: MATCH:3
If none match, reply with ONLY: NO_MATCH
Do not explain anything.`
    }],
    max_tokens: 10
  })

  const matchResponse = matchResult.choices[0]?.message?.content?.trim() || ''

  if (matchResponse.startsWith('MATCH:')) {
    const index = parseInt(matchResponse.replace('MATCH:', '').trim())
    if (!isNaN(index) && bankEntries[index]) {
      bankHit = bankEntries[index]
    }
  }
}

if (bankHit) {
  await supabaseAdmin
    .from('question_bank')
    .update({ times_asked: (bankHit.times_asked || 0) + 1 })
    .eq('id', bankHit.id)

  const qa = await saveQA(
    session_id, session.user_id, course_id,
    question, bankHit.answer_text,
    'question_bank', questionNumber
  )
  await incrementSession(session_id, questionNumber)
  return NextResponse.json({ qa })
}

      // 3. Get course data
// Get course data including course_code
const { data: courseData } = await supabaseAdmin
  .from('courses')
  .select('course_title, course_code, material_text')
  .eq('id', course_id)
  .single() as { data: any }

if (!courseData) return NextResponse.json({ error: 'Course not found.' }, { status: 404 })

// Check shared chunks first, then course-specific chunks
let materialContext = ''

// Build search keywords from question — remove common words
const keywords = question
  .replace(/[^a-zA-Z\s]/g, '')
  .split(' ')
  .filter((w: string) => w.length > 3)
  .slice(0, 5)
  .join(' | ')

// Search shared chunks using full text search
let foundChunks: any[] = []

if (keywords) {
  const { data: searchedShared } = await supabaseAdmin
    .from('shared_material_chunks')
    .select('chunk_text')
    .eq('course_code', courseData.course_code)
    .textSearch('search_vector', keywords)
    .limit(4) as { data: any[] | null }

  if (searchedShared && searchedShared.length > 0) {
    foundChunks = searchedShared
  }
}

// If text search found nothing, fall back to first chunks
if (foundChunks.length === 0) {
  const { data: fallbackShared } = await supabaseAdmin
    .from('shared_material_chunks')
    .select('chunk_text')
    .eq('course_code', courseData.course_code)
    .limit(6) as { data: any[] | null }

  if (fallbackShared && fallbackShared.length > 0) {
    foundChunks = fallbackShared
  } else {
    // Try course-specific chunks
    const { data: specificChunks } = await supabaseAdmin
      .from('course_material_chunks')
      .select('chunk_text')
      .eq('course_id', course_id)
      .limit(6) as { data: any[] | null }

    if (specificChunks && specificChunks.length > 0) {
      foundChunks = specificChunks
    }
  }
}

if (foundChunks.length > 0) {
  materialContext = `Course material:\n\n${foundChunks.map(c => c.chunk_text).join('\n\n---\n\n')}`
} else if (courseData.material_text) {
  materialContext = `Course material:\n\n${courseData.material_text.slice(0, 10000)}`
}

    // 5. Call Grok
    const prompt = `You are an academic assistant for NOUN (National Open University of Nigeria).
Course: ${courseData.course_title} (${courseData.course_code})

${materialContext ? materialContext + '\n\n' : ''}RULES:
1. Read the course material carefully
2. Answer ONLY from the material if provided
3. Be concise and accurate
4. For math questions show full step-by-step working
5. If the answer is not in the material, respond with exactly: ANSWER_NOT_FOUND

Question: ${question}`

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