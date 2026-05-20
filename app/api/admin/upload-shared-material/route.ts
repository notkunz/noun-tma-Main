import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const courseCode = formData.get('course_code') as string

    if (!file || !courseCode) {
      return NextResponse.json({ error: 'Missing file or course code' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const path = `shared/${courseCode.replace(/\s+/g, '_')}/${file.name}`

    // Upload using service role — bypasses RLS
    const { error: uploadError } = await supabaseAdmin.storage
      .from('course-materials')
      .upload(path, buffer, { upsert: true, contentType: 'application/pdf' })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: urlData } = supabaseAdmin.storage
      .from('course-materials')
      .getPublicUrl(path)

    // Upsert shared material record
    const { error: dbError } = await supabaseAdmin
      .from('shared_materials')
      .upsert({
        course_code: courseCode.toUpperCase(),
        material_url: urlData.publicUrl,
        material_indexed: false
      }, { onConflict: 'course_code' })

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, url: urlData.publicUrl })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}