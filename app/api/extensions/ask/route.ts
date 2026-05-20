import { createClient } from '@supabase/supabase-js'
import Groq from 'groq-sdk'
import { NextResponse } from 'next/server'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

export async function POST(req: Request) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Not logged in' }, { status: 401, headers: corsHeaders })

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error } = await supabaseAuth.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401, headers: corsHeaders })

    const { question, session_id, course_id } = await req.json()

    const { data: session } = await supabaseAdmin
      .from('tma_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('status', 'active')
      .single() as { data: any }

    if (!session) return NextResponse.json({ error: 'No active session found' }, { status: 400, headers: corsHeaders })
    if (session.question_count >= 10) return NextResponse.json({ error: 'TMA limit of 10 questions reached' }, { status: 400, headers: corsHeaders })

    const questionNumber = session.question_count + 1

    const { data: bankEntries } = await supabaseAdmin
      .from('question_bank')
      .select('id, question_text, answer_text, times_asked')
      .eq('course_id', course_id)
      .limit(50) as { data: any[] | null }

    let bankHit = null
    if (bankEntries && bankEntries.length > 0) {
      const bankList = bankEntries.map((e, i) => `[${i}] ${e.question_text}`).join('\n')
      const matchResult = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{
          role: 'user',
          content: `Does this question match any in the list? Question: "${question}"\n\nList:\n${bankList}\n\nReply MATCH:N or NO_MATCH only.`
        }],
        max_tokens: 10
      })
      const match = matchResult.choices[0]?.message?.content?.trim() || ''
      if (match.startsWith('MATCH:')) {
        const idx = parseInt(match.replace('MATCH:', '').trim())
        if (!isNaN(idx) && bankEntries[idx]) bankHit = bankEntries[idx]
      }
    }

    let answerText = ''
    let source = 'course_material'

    if (bankHit) {
      answerText = bankHit.answer_text
      source = 'question_bank'
      await supabaseAdmin.from('question_bank')
        .update({ times_asked: (bankHit.times_asked || 0) + 1 })
        .eq('id', bankHit.id)
    } else {
      const { data: courseData } = await supabaseAdmin
        .from('courses')
        .select('course_title, course_code, material_text')
        .eq('id', course_id)
        .single() as { data: any }

      if (!courseData) return NextResponse.json({ error: 'Course not found.' }, { status: 404, headers: corsHeaders })

      let materialContext = ''

      const { data: sharedChunks } = await supabaseAdmin
        .from('shared_material_chunks')
        .select('chunk_text')
        .eq('course_code', courseData.course_code)
        .limit(3) as { data: any[] | null }

      if (sharedChunks && sharedChunks.length > 0) {
        materialContext = `Course material:\n\n${sharedChunks.map(c => c.chunk_text).join('\n\n---\n\n')}`
      } else {
        const { data: chunks } = await supabaseAdmin
          .from('course_material_chunks')
          .select('chunk_text')
          .eq('course_id', course_id)
          .limit(3) as { data: any[] | null }

        if (chunks && chunks.length > 0) {
          materialContext = `Course material:\n\n${chunks.map(c => c.chunk_text).join('\n\n---\n\n')}`
        } else if (courseData.material_text) {
          materialContext = `Course material:\n\n${courseData.material_text.slice(0, 8000)}`
        }
      }

      const result = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{
          role: 'user',
          content: `You are a NOUN academic assistant for ${courseData?.course_title} (${courseData?.course_code}).
${materialContext ? materialContext + '\n\n' : ''}Answer this TMA question accurately. Show working for math.
If truly not found respond: ANSWER_NOT_FOUND

Question: ${question}`
        }],
        max_tokens: 1024
      })

      answerText = result.choices[0]?.message?.content || 'Could not generate answer.'
      if (answerText.trim() === 'ANSWER_NOT_FOUND') {
        answerText = '⚠️ Answer not found in course material. Try internet search on the app.'
      }
    }

    const { data: profile } = await supabaseAdmin
      .from('users').select('id').eq('auth_id', user.id).single() as { data: any }

    const { data: qa } = await supabaseAdmin
      .from('tma_questions')
      .insert({
        session_id,
        user_id: profile.id,
        course_id,
        question_text: question,
        answer_text: answerText,
        source,
        question_number: questionNumber
      })
      .select()
      .single()

    await supabaseAdmin
      .from('tma_sessions')
      .update({ question_count: questionNumber })
      .eq('id', session_id)

    return NextResponse.json({ qa }, { headers: corsHeaders })

  } catch (err: any) {
    console.error('Extension ask error:', err)
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders })
  }
}