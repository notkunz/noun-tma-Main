import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { session_id, score } = await req.json()

  const isPerfect = score === '10/10' || score === '10'

  // Get all questions from this session
  const { data: questions } = await supabaseAdmin
    .from('tma_questions')
    .select('*')
    .eq('session_id', session_id)

  // Close the session
  await supabaseAdmin
    .from('tma_sessions')
    .update({
      status: 'completed',
      score: parseInt(score),
      completed_at: new Date().toISOString()
    })
    .eq('id', session_id)

  if (questions && questions.length > 0) {
    let toSave: any[] = []

    if (isPerfect) {
      // 10/10 → save everything regardless of source
      toSave = questions
    } else {
      // Not 10/10 → save only course_material answers
      toSave = questions.filter(q => q.source === 'course_material')
    }

    if (toSave.length > 0) {
      // Avoid duplicates — check if question already exists in bank
      for (const q of toSave) {
        const { data: existing } = await supabaseAdmin
          .from('question_bank')
          .select('id')
          .eq('course_id', q.course_id)
          .ilike('question_text', `%${q.question_text.slice(0, 80)}%`)
          .single()

        if (!existing) {
          await supabaseAdmin.from('question_bank').insert({
            course_id: q.course_id,
            question_text: q.question_text,
            answer_text: q.answer_text,
            source: q.source,
            contributed_by: q.user_id
          })
        } else {
          // Already exists, just increment times_asked
          await supabaseAdmin
            .from('question_bank')
            .update({ times_asked: existing.times_asked + 1 })
            .eq('id', existing.id)
        }
      }
    }
  }

  return NextResponse.json({ success: true })
}