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

async function slidingWindowSearch(
  question: string,
  materialCode: string,
  courseId: string
): Promise<any[]> {
  const words = question
    .replace(/[^a-zA-Z\s]/g, ' ')
    .split(' ')
    .filter((w: string) => w.length > 3)

  const searchPhrases: string[] = []
  words.forEach((w: string) => searchPhrases.push(w))
  for (let i = 0; i < words.length - 1; i++) {
    searchPhrases.push(`${words[i]} ${words[i + 1]}`)
  }
  for (let i = 0; i < words.length - 2; i++) {
    searchPhrases.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`)
  }

  // Cap at 15 phrases to avoid hammering DB
  const limitedPhrases = searchPhrases.slice(0, 15)
  const chunkMap = new Map<string, string>()
  let foundChunks: any[] = []

  // Search shared chunks
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

  // Try course-specific chunks if shared gave nothing
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

  // Last resort — first 8 chunks
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
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Not logged in' }, { status: 401, headers: corsHeaders })

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error } = await supabaseAuth.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401, headers: corsHeaders })

    const { question, session_id, course_id, detected_course_code, options } = await req.json()

    // Validate session
    const { data: session } = await supabaseAdmin
      .from('tma_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('status', 'active')
      .single() as { data: any }

    if (!session) return NextResponse.json({ error: 'No active session found' }, { status: 400, headers: corsHeaders })
    if (session.question_count >= 10) return NextResponse.json({ error: 'TMA limit of 10 questions reached' }, { status: 400, headers: corsHeaders })

    // Validate course matches page
    if (detected_course_code) {
      const { data: sessionCourse } = await supabaseAdmin
        .from('courses')
        .select('course_code')
        .eq('id', session.course_id)
        .single() as { data: any }

      const sessionCode = sessionCourse?.course_code?.replace(/\s+/g, '').toUpperCase()
      const pageCode = detected_course_code.replace(/\s+/g, '').toUpperCase()

      if (sessionCode !== pageCode) {
        const { data: correctCourse } = await supabaseAdmin
          .from('courses')
          .select('id')
          .ilike('course_code', `%${pageCode}%`)
          .limit(1)
          .single() as { data: any }

        const { data: correctSession } = await supabaseAdmin
          .from('tma_sessions')
          .select('*')
          .eq('user_id', session.user_id)
          .eq('course_id', correctCourse?.id)
          .eq('status', 'active')
          .single() as { data: any }

        if (!correctSession) {
          return NextResponse.json({
            error: `You're on ${pageCode} but your active session is for ${sessionCode}. Start a ${pageCode} session on the app first.`
          }, { status: 400, headers: corsHeaders })
        }

        session.id = correctSession.id
        session.course_id = correctSession.course_id
        session.question_count = correctSession.question_count
        session.user_id = correctSession.user_id
      }
    }

    const questionNumber = session.question_count + 1

    // Check question bank first — skip Groq call if bank is empty
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
      await supabaseAdmin
        .from('question_bank')
        .update({ times_asked: (bankHit.times_asked || 0) + 1 })
        .eq('id', bankHit.id)
    } else {
      const { data: courseData } = await supabaseAdmin
        .from('courses')
        .select('course_title, course_code, material_text, shared_material_code')
        .eq('id', course_id)
        .single() as { data: any }

      if (!courseData) return NextResponse.json({ error: 'Course not found.' }, { status: 404, headers: corsHeaders })

      const materialCode = courseData.shared_material_code || courseData.course_code
      const foundChunks = await slidingWindowSearch(question, materialCode, course_id)

      let materialContext = ''
      if (foundChunks.length > 0) {
        materialContext = foundChunks.map((c: any) => c.chunk_text).join('\n\n---\n\n')
      } else if (courseData.material_text) {
        materialContext = courseData.material_text.slice(0, 10000)
      }

      const hasMaterial = materialContext.length > 0

      const optionsText = options && options.length > 0
        ? options.map((o: string, i: number) => `${String.fromCharCode(65 + i)}. ${o}`).join('\n')
        : ''

      const result = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{
          role: 'user',
          content: `You are a NOUN TMA assistant helping a student answer a multiple choice question.
${hasMaterial ? `COURSE MATERIAL:\n${materialContext}\n\n` : ''}
QUESTION: "${question}"
${optionsText ? `\nOPTIONS:\n${optionsText}` : ''}

STRICT RULES:
1. ${hasMaterial ? 'Read the course material above carefully' : 'Use your academic knowledge'}
2. Find the sentence or paragraph that directly answers the question
3. Match that answer to one of the options by meaning — not by position
4. If two options look similar, pick the one whose FULL TEXT matches the material exactly
5. Reply with ONLY the letter and option text e.g: "B. Success"
6. ${hasMaterial ? 'If the answer is truly not in the material, reply with exactly: ANSWER_NOT_FOUND' : 'Pick the most accurate option'}`
        }],
        max_tokens: 512
      })

      answerText = result.choices[0]?.message?.content || 'Could not generate answer.'
      if (answerText.trim() === 'ANSWER_NOT_FOUND') {
        answerText = '⚠️ Answer not found in course material.'
      }
    }

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single() as { data: any }

    const { data: qa } = await supabaseAdmin
      .from('tma_questions')
      .insert({
        session_id: session.id,
        user_id: profile.id,
        course_id: session.course_id,
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
      .eq('id', session.id)

    return NextResponse.json({ qa }, { headers: corsHeaders })

  } catch (err: any) {
    console.error('Extension ask error:', err)
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders })
  }
}