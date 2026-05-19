import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(req: Request) {
  const { session_id, course_id, question } = await req.json()

  // 1. Get session and validate it's still active + under 10
  const { data: session } = await supabaseAdmin
    .from('tma_sessions')
    .select('*')
    .eq('id', session_id)
    .eq('status', 'active')
    .single()

  if (!session) return NextResponse.json({ error: 'Session not found or already closed' }, { status: 400 })
  if (session.question_count >= 10) return NextResponse.json({ error: 'TMA limit reached' }, { status: 400 })

  const questionNumber = session.question_count + 1

  // 2. Check question bank first (fastest)
  const { data: bankHit } = await supabaseAdmin
    .from('question_bank')
    .select('*')
    .eq('course_id', course_id)
    .ilike('question_text', `%${question.slice(0, 60)}%`)
    .limit(1)
    .single()

  if (bankHit) {
    // Increment times_asked
    await supabaseAdmin
      .from('question_bank')
      .update({ times_asked: bankHit.times_asked + 1 })
      .eq('id', bankHit.id)

    const qa = await saveQA(session_id, session.user_id, course_id, question, bankHit.answer_text, 'question_bank', questionNumber)
    await incrementSession(session_id, questionNumber)
    return NextResponse.json({ qa })
  }

  // 3. Search course material via Claude
const { data: courseData } = await supabaseAdmin
  .from('courses')
  .select('course_title, course_code, material_text')
  .eq('id', course_id)
  .single() as { data: { course_title: string, course_code: string, material_text: string } | null }

if (!courseData) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

  
// Build prompt — use material text if available
const materialContext = courseData?.material_text
  ? `Here is the course material to answer from:\n\n${courseData.material_text.slice(0, 12000)}\n\n`
  : ''

const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
const prompt = `You are a NOUN (National Open University of Nigeria) academic assistant.
Course: ${courseData.course_title} (${courseData.course_code})

${materialContext}
Using ONLY the course material above (if provided), answer the following TMA question accurately.
For math questions, show full step-by-step working.
If the answer is NOT in the course material or you are not sure, respond with exactly: ANSWER_NOT_FOUND

Question: ${question}`

const geminiRes = await model.generateContent(prompt)
const answer = geminiRes.response.text()
// When answer not found, return the saved QA id so frontend can update it later
if (answer === 'ANSWER_NOT_FOUND') {
  const qa = await saveQA(
    session_id, session.user_id, course_id,
    question,
    '⚠️ Answer not found in course material.',
    'course_material',
    questionNumber
  )
  await incrementSession(session_id, questionNumber)
  return NextResponse.json({ qa, needs_internet: true })
}
  const qa = await saveQA(session_id, session.user_id, course_id, question, answer, 'course_material', questionNumber)
  await incrementSession(session_id, questionNumber)
  return NextResponse.json({ qa })
}

async function saveQA(session_id: string, user_id: string, course_id: string, question: string, answer: string, source: string, questionNumber: number) {
  const { data } = await supabaseAdmin
    .from('tma_questions')
    .insert({
      session_id, user_id, course_id,
      question_text: question,
      answer_text: answer,
      source,
      question_number: questionNumber
    })
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