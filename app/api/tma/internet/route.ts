import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(req: Request) {
  const { session_id, course_id, question, question_id } = await req.json()

  // Get session to find question number
  const { data: session } = await supabaseAdmin
    .from('tma_sessions')
    .select('question_count, user_id')
    .eq('id', session_id)
    .single()

const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
const prompt = `You are an academic assistant helping a Nigerian university student answer a TMA question.
Search your knowledge and provide the most accurate academic answer possible.
Be concise but complete. Show working for math questions step by step.
This answer is sourced from general knowledge (internet equivalent).

Question: ${question}`

const geminiRes = await model.generateContent(prompt)
const answer = geminiRes.response.text()

  // Update the existing question record with internet answer
  if (question_id) {
    await supabaseAdmin
      .from('tma_questions')
      .update({ answer_text: answer, source: 'internet' })
      .eq('id', question_id)
  }

  return NextResponse.json({ answer, source: 'internet' })
}