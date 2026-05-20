import { createClient } from '@supabase/supabase-js'
import Groq from 'groq-sdk'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

export async function POST(req: Request) {
  try {
    const { session_id, course_id, question, question_id } = await req.json()

    if (!question) {
      return NextResponse.json({ error: 'No question provided' }, { status: 400 })
    }

    const prompt = `You are an academic assistant helping a Nigerian university student answer a TMA question.
Using your knowledge, provide the most accurate academic answer possible.
Be concise but complete. Show working for math questions step by step.
This answer is sourced from general knowledge.

Question: ${question}`

    const result = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024
    })

    const answer = result.choices[0]?.message?.content || 'Could not generate an answer.'

    // Update the existing question record
    if (question_id) {
      await supabaseAdmin
        .from('tma_questions')
        .update({ answer_text: answer, source: 'internet' })
        .eq('id', question_id)
    }

    return NextResponse.json({ answer, source: 'internet' })

  } catch (err: any) {
    console.error('Internet search error:', err)
    return NextResponse.json(
      { error: 'Something went wrong: ' + err.message },
      { status: 500 }
    )
  }
}