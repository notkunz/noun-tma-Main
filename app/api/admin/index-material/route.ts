import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { course_id } = await req.json()

  // Get course material URL
  const { data: course } = await supabaseAdmin
    .from('courses')
    .select('material_url, course_code, course_title')
    .eq('id', course_id)
    .single() as { data: { material_url: string, course_code: string, course_title: string } | null }

  if (!course?.material_url) {
    return NextResponse.json({ error: 'No material uploaded for this course' }, { status: 400 })
  }

  // Download the PDF from Supabase Storage
  const response = await fetch(course.material_url)
  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Extract text from PDF
  const pdfLib = await import('pdf-parse')
  const pdf = (pdfLib as any).default ?? pdfLib
  const pdfData = await pdf(buffer)
  const extractedText = pdfData.text

  // Store extracted text in DB
  await supabaseAdmin
    .from('courses')
    .update({
      material_text: extractedText,
      material_indexed: true
    })
    .eq('id', course_id)

  return NextResponse.json({
    success: true,
    pages: pdfData.numpages,
    characters: extractedText.length
  })
}