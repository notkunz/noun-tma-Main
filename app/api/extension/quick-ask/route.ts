import Groq from 'groq-sdk'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

export async function POST(req: Request) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Not logged in' }, { status: 401, headers: corsHeaders })

    // Just verify the token is valid
    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user }, error } = await supabaseAuth.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders })

    const { question } = await req.json()
    if (!question) return NextResponse.json({ error: 'No question' }, { status: 400, headers: corsHeaders })

    const result = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{
        role: 'user',
        content: `You are an academic assistant helping a NOUN student. Answer this question accurately and concisely: ${question}`
      }],
      max_tokens: 512
    })

    const answer = result.choices[0]?.message?.content || 'Could not generate answer.'
    return NextResponse.json({ answer }, { headers: corsHeaders })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders })
  }
}