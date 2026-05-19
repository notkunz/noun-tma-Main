import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
// pdf-parse may not have a static default export in some setups, import dynamically

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CHUNK_SIZE = 3000 // characters per chunk
const OVERLAP = 200    // overlap between chunks so answers aren't cut off

function chunkText(text: string): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    const end = start + CHUNK_SIZE
    chunks.push(text.slice(start, end))
    start = end - OVERLAP
  }
  return chunks
}

export async function POST(req: Request) {
  const { course_id } = await req.json()

  const { data: course } = await supabaseAdmin
    .from('courses')
    .select('material_url, course_code')
    .eq('id', course_id)
    .single() as { data: any }

  if (!course?.material_url) {
    return NextResponse.json({ error: 'No material uploaded' }, { status: 400 })
  }

  // Download and extract PDF text
  const response = await fetch(course.material_url)
  const buffer = Buffer.from(await response.arrayBuffer())
  const pdfModule = (await import('pdf-parse')) as any
  const pdf = pdfModule.default ?? pdfModule
  const pdfData = await pdf(buffer)
  const chunks = chunkText(pdfData.text)

  // Delete old chunks first
  await supabaseAdmin
    .from('course_material_chunks')
    .delete()
    .eq('course_id', course_id)

  // Insert new chunks
  await supabaseAdmin.from('course_material_chunks').insert(
    chunks.map((chunk, i) => ({
      course_id,
      chunk_index: i,
      chunk_text: chunk
    }))
  )

  await supabaseAdmin
    .from('courses')
    .update({ material_indexed: true })
    .eq('id', course_id)

  return NextResponse.json({ success: true, chunks: chunks.length, pages: pdfData.numpages })
}