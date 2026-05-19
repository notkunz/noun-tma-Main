import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Uses service role to bypass RLS for user creation
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { email, password, full_name, matric_number, phone, faculty, department, level } = await req.json()

  // 1. Check matric number not already taken
  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('matric_number', matric_number)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Matric number already registered' }, { status: 400 })
  }

  // 2. Create auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true // skip email verification for now
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  // 3. Insert into users table (wallet auto-created by DB trigger)
  const { error: profileError } = await supabaseAdmin
    .from('users')
    .insert({
      auth_id: authData.user.id,
      full_name,
      email,
      matric_number: matric_number.toUpperCase(),
      phone,
      faculty,
      department,
      level
    })

  if (profileError) {
    // Rollback: delete auth user if profile fails
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}