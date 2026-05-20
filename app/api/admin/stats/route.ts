import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Uses service role to bypass RLS — only accessible to admins
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  try {
    const [users, sessions, courses, bank, revenue] = await Promise.all([
      supabaseAdmin.from('users').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('tma_sessions').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('courses').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('question_bank').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('transactions').select('amount').eq('type', 'credit').eq('status', 'success')
    ])

    const totalRevenue = revenue.data?.reduce((sum, t) => sum + t.amount, 0) || 0

    return NextResponse.json({
      users: users.count || 0,
      sessions: sessions.count || 0,
      courses: courses.count || 0,
      bankEntries: bank.count || 0,
      revenue: totalRevenue
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}