import { createClient } from '@supabase/supabase-js'
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

export async function GET(req: Request) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401, headers: corsHeaders })

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error } = await supabaseAuth.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders })

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('id, full_name, matric_number')
      .eq('auth_id', user.id)
      .single() as { data: any }

    if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404, headers: corsHeaders })

    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('balance')
      .eq('user_id', profile.id)
      .single() as { data: any }

    const { data: session } = await supabaseAdmin
      .from('tma_sessions')
      .select('*, courses(course_code)')
      .eq('user_id', profile.id)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .single() as { data: any }

    return NextResponse.json({
      user: profile,
      wallet: wallet?.balance || 0,
      session: session || null
    }, { headers: corsHeaders })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders })
  }
}