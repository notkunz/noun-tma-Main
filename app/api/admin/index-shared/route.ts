import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CHUNK_SIZE = 3000
const OVERLAP = 200

function chunkText(text: string): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    const end = start + CHUNK_SIZE
    chunks.push(text.slice(start, end))
    start = end - OVERLAP
    if (start >= text.length) break
  }
  return chunks
}

export async function POST(req: Request) {
  try {
    const { course_code } = await req.json()

    const { data: material } = await supabaseAdmin
      .from('shared_materials')
      .select('*')
      .eq('course_code', course_code.toUpperCase())
      .single() as { data: any }

    if (!material?.material_url) {
      return NextResponse.json({ error: 'No PDF uploaded for this course code' }, { status: 400 })
    }

    const response = await fetch(material.material_url)
    if (!response.ok) {
      return NextResponse.json({ error: 'Could not download PDF' }, { status: 400 })
    }

    const buffer = Buffer.from(await response.arrayBuffer())

    let extractedText = ''
    let numPages = 0

    try {
      const { extractText } = await import('unpdf')
      const { text, totalPages } = await extractText(new Uint8Array(buffer), { mergePages: true })
      extractedText = text
      numPages = totalPages
    } catch (err: any) {
      return NextResponse.json({ error: 'Failed to read PDF: ' + err.message }, { status: 500 })
    }

    if (!extractedText || extractedText.trim().length < 50) {
      return NextResponse.json({ error: 'PDF appears image-based or empty.' }, { status: 400 })
    }

    const chunks = chunkText(extractedText)

    // Delete old chunks
    await supabaseAdmin
      .from('shared_material_chunks')
      .delete()
      .eq('course_code', course_code.toUpperCase())

    // Insert new chunks in batches
    const batchSize = 20
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize).map((chunk, j) => ({
        course_code: course_code.toUpperCase(),
        chunk_index: i + j,
        chunk_text: chunk
      }))
      await supabaseAdmin.from('shared_material_chunks').insert(batch)
    }

    await supabaseAdmin
      .from('shared_materials')
      .update({ material_text: extractedText.slice(0, 10000), material_indexed: true })
      .eq('course_code', course_code.toUpperCase())

    return NextResponse.json({ success: true, chunks: chunks.length, pages: numPages })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}