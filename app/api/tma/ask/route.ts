import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'

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

    // 2. Check question bank first
    const searchQuery = question.split(' ').filter((w: string) => w.length > 3).slice(0, 6).join(' | ')
    
    let bankHit = null
    if (searchQuery) {
      const { data } = await supabaseAdmin
        .from('question_bank')
        .select('*')
        .eq('course_id', course_id)
        .ilike('question_text', `%${question.slice(0, 50)}%`)
        .limit(1)
        .single() as { data: any }
      bankHit = data
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

    // 3. Get course data
    const { data: courseData } = await supabaseAdmin
      .from('courses')
      .select('course_title, course_code, material_text')
      .eq('id', course_id)
      .single() as { data: any }

    if (!courseData) return NextResponse.json({ error: 'Course not found.' }, { status: 404 })

    // 4. Search chunks if available
    let materialContext = ''
    const { data: chunks } = await supabaseAdmin
      .from('course_material_chunks')
      .select('chunk_text')
      .eq('course_id', course_id)
      .limit(3) as { data: any[] | null }

    if (chunks && chunks.length > 0) {
      materialContext = `Relevant course material:\n\n${chunks.map(c => c.chunk_text).join('\n\n---\n\n')}`
    } else if (courseData.material_text) {
      materialContext = `Course material:\n\n${courseData.material_text.slice(0, 8000)}`
    }

    // 5. Call Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `You are an academic assistant for NOUN (National Open University of Nigeria).
Course: ${courseData.course_title} (${courseData.course_code})

${materialContext ? materialContext + '\n\n' : ''}Using the course material above (if provided), answer this TMA question accurately and concisely.
For math questions, show full step-by-step working.
If the answer is absolutely not found anywhere, respond with exactly: ANSWER_NOT_FOUND

Question: ${question}`

    const result = await model.generateContent(prompt)
    const answer = result.response.text()

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