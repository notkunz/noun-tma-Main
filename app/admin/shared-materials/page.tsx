'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SharedMaterialsPage() {
  const supabase = createClient()
  const [materials, setMaterials] = useState<any[]>([])
  const [courseCode, setCourseCode] = useState('')
  const [uploading, setUploading] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => { loadMaterials() }, [])

  const loadMaterials = async () => {
    const { data } = await supabase
      .from('shared_materials')
      .select('*')
      .order('course_code')
    setMaterials(data || [])
  }

  const uploadMaterial = async (code: string, file: File) => {
    setUploading(code)
    const path = `shared/${code.replace(' ', '_')}/${file.name}`

    const { error } = await supabase.storage
      .from('course-materials')
      .upload(path, file, { upsert: true })

    if (error) {
      setUploading(null)
      return setMessage('Upload error: ' + error.message)
    }

    const { data: urlData } = supabase.storage
      .from('course-materials')
      .getPublicUrl(path)

    // Upsert — insert if new, update if exists
    await supabase.from('shared_materials').upsert({
      course_code: code.toUpperCase(),
      material_url: urlData.publicUrl,
      material_indexed: false
    }, { onConflict: 'course_code' })

    setUploading(null)
    setMessage(`✅ PDF uploaded for ${code.toUpperCase()}`)
    loadMaterials()
  }

  const indexMaterial = async (code: string) => {
    setMessage('Indexing ' + code + '...')
    const res = await fetch('/api/admin/index-shared', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ course_code: code })
    })
    const data = await res.json()
    if (data.success) setMessage(`✅ ${code} indexed! ${data.chunks} chunks from ${data.pages} pages.`)
    else setMessage('Error: ' + data.error)
    loadMaterials()
  }

  const deleteMaterial = async (code: string, url: string) => {
    if (!confirm(`Delete material for ${code}?`)) return
    const path = url.split('/course-materials/')[1]
    await supabase.storage.from('course-materials').remove([path])
    await supabase.from('shared_materials')
      .update({ material_url: null, material_indexed: false, material_text: null })
      .eq('course_code', code)
    await supabase.from('shared_material_chunks').delete().eq('course_code', code)
    setMessage(`Deleted material for ${code}`)
    loadMaterials()
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Shared Course Materials</h2>
      <p className="text-gray-400 text-sm mb-6">
        Upload once per course code — all departments sharing that course use the same material automatically.
      </p>

      {message && <p className="text-green-400 text-sm mb-4">{message}</p>}

      {/* Add New */}
      <div className="bg-gray-800 rounded-xl p-6 mb-6">
        <h3 className="font-semibold mb-4">Upload Material for a Course Code</h3>
        <div className="flex gap-3">
          <input
            value={courseCode}
            onChange={e => setCourseCode(e.target.value.toUpperCase())}
            placeholder="Course code e.g. GST101"
            className="flex-1 bg-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-400"
          />
          <label className={`cursor-pointer text-xs px-4 py-2 rounded-lg font-semibold flex items-center ${
            !courseCode.trim() ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}>
            {uploading === courseCode ? 'Uploading...' : '📤 Upload PDF'}
            <input type="file" accept=".pdf" className="hidden"
              disabled={!courseCode.trim() || uploading === courseCode}
              onChange={e => {
                const file = e.target.files?.[0]
                if (file && courseCode.trim()) uploadMaterial(courseCode.trim(), file)
              }} />
          </label>
        </div>
      </div>

      {/* Materials List */}
      <div className="space-y-3">
        {materials.length === 0 && (
          <p className="text-gray-500 text-sm">No shared materials yet.</p>
        )}
{materials.map(m => (
  <div key={m.id} className="bg-gray-800 rounded-xl p-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="font-bold text-xl">{m.course_code}</p>
        <div className="flex items-center gap-2 mt-1">
          {m.material_url ? (
            <span className="text-xs bg-blue-800 text-blue-300 px-2 py-0.5 rounded-full">
              📄 PDF uploaded
            </span>
          ) : (
            <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">
              No PDF yet
            </span>
          )}
          {m.material_indexed ? (
            <span className="text-xs bg-green-800 text-green-300 px-2 py-0.5 rounded-full">
              ✅ Indexed & Active
            </span>
          ) : (
            <span className="text-xs bg-yellow-800 text-yellow-300 px-2 py-0.5 rounded-full">
              ⚠️ Not indexed
            </span>
          )}
        </div>
        {m.material_url && (
          <a href={m.material_url} target="_blank"
            className="text-xs text-blue-400 hover:underline mt-1 block">
            View PDF ↗
          </a>
        )}
        <p className="text-gray-500 text-xs mt-1">
          All departments with {m.course_code} use this material automatically
        </p>
      </div>

      <div className="flex flex-col gap-2 ml-4 shrink-0 min-w-32">
        {/* Upload / Replace */}
        <label className="cursor-pointer text-center text-xs px-4 py-2 rounded-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white">
          {uploading === m.course_code ? 'Uploading...' : m.material_url ? '📤 Replace PDF' : '📤 Upload PDF'}
          <input type="file" accept=".pdf" className="hidden"
            disabled={uploading === m.course_code}
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) uploadMaterial(m.course_code, file)
            }} />
        </label>

        {/* Index button — always show if PDF exists */}
        {m.material_url && (
          <button
            onClick={() => indexMaterial(m.course_code)}
            className={`text-xs px-4 py-2 rounded-lg font-semibold text-white ${
              m.material_indexed
                ? 'bg-gray-600 hover:bg-gray-500'
                : 'bg-yellow-500 hover:bg-yellow-600'
            }`}>
            {m.material_indexed ? '🔄 Re-index' : '⚡ Index Now'}
          </button>
        )}

        {/* Delete */}
        {m.material_url && (
          <button
            onClick={() => deleteMaterial(m.course_code, m.material_url)}
            className="text-xs bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-semibold">
            🗑️ Delete PDF
          </button>
        )}
      </div>
    </div>
  </div>
))}
      </div>
    </div>
  )
}