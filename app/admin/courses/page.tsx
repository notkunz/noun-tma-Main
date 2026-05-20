'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function CoursesAdminPage() {
  const supabase = createClient()
  const [courses, setCourses] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [uploading, setUploading] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    department_id: '', course_code: '', course_title: '',
    level: '', semester: 'first', tma_cost: '200'
  })

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    const [c, d] = await Promise.all([
      supabase.from('courses')
        .select('*, departments(name, faculties(name))')
        .order('course_code'),
      supabase.from('departments')
        .select('*, faculties(name)')
        .order('name')
    ])
    setCourses(c.data || [])
    setDepartments(d.data || [])
  }

  const addCourse = async () => {
    if (!form.course_code || !form.course_title || !form.department_id) return
    const { error } = await supabase.from('courses').insert({
      ...form,
      tma_cost: parseFloat(form.tma_cost)
    })
    if (error) return setMessage('Error: ' + error.message)
    setMessage('Course added!')
    setForm({ department_id: '', course_code: '', course_title: '', level: '', semester: 'first', tma_cost: '200' })
    loadAll()
  }

  const uploadMaterial = async (courseId: string, file: File) => {
    setUploading(courseId)
    const path = `materials/${courseId}/${file.name}`

    const { error: uploadError } = await supabase.storage
      .from('course-materials')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      setUploading(null)
      return setMessage('Upload error: ' + uploadError.message)
    }

    const { data: urlData } = supabase.storage
      .from('course-materials')
      .getPublicUrl(path)

    await supabase.from('courses')
      .update({ material_url: urlData.publicUrl, material_indexed: false })
      .eq('id', courseId)

    setUploading(null)
    setMessage('Material uploaded successfully!')
    loadAll()
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Courses</h2>

      {/* Add Course Form */}
      <div className="bg-gray-800 rounded-xl p-6 mb-6">
        <h3 className="font-semibold mb-4">Add New Course</h3>
        {message && <p className="text-green-400 text-sm mb-3">{message}</p>}

        <div className="grid grid-cols-2 gap-3">
          <select value={form.department_id}
            onChange={e => setForm({ ...form, department_id: e.target.value })}
            className="bg-gray-700 rounded-lg px-4 py-2 text-sm text-white col-span-2">
            <option value="">Select Department</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>
                {d.faculties?.name} → {d.name}
              </option>
            ))}
          </select>
          <input placeholder="Course Code (e.g. CIT 101)"
            value={form.course_code}
            onChange={e => setForm({ ...form, course_code: e.target.value })}
            className="bg-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-400" />
          <input placeholder="Course Title"
            value={form.course_title}
            onChange={e => setForm({ ...form, course_title: e.target.value })}
            className="bg-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-400" />
          <select value={form.level}
            onChange={e => setForm({ ...form, level: e.target.value })}
            className="bg-gray-700 rounded-lg px-4 py-2 text-sm text-white">
            <option value="">Select Level</option>
            {['100','200','300','400'].map(l => (
              <option key={l} value={l}>{l} Level</option>
            ))}
          </select>
          <select value={form.semester}
            onChange={e => setForm({ ...form, semester: e.target.value })}
            className="bg-gray-700 rounded-lg px-4 py-2 text-sm text-white">
            <option value="first">First Semester</option>
            <option value="second">Second Semester</option>
          </select>
          <input placeholder="TMA Cost (₦)"
            value={form.tma_cost}
            onChange={e => setForm({ ...form, tma_cost: e.target.value })}
            className="bg-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-400" />
          <button onClick={addCourse}
            className="bg-green-600 rounded-lg py-2 text-sm font-semibold hover:bg-green-700">
            Add Course
          </button>
        </div>
      </div>

      {/* Course List */}
      <div className="space-y-3">
{courses.map(c => (
  <div key={c.id} className="bg-gray-800 rounded-xl p-4">
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="font-bold">{c.course_code} — {c.course_title}</p>
        <p className="text-gray-400 text-xs mt-0.5">
          {c.departments?.faculties?.name} → {c.departments?.name} &nbsp;|&nbsp;
          {c.level} Level &nbsp;|&nbsp;
          {c.semester === 'first' ? '1st' : '2nd'} Semester &nbsp;|&nbsp;
          ₦{c.tma_cost}
        </p>
        <p className={`text-xs mt-1 ${c.material_url ? 'text-green-400' : 'text-yellow-400'}`}>
          {c.material_url ? '✅ Material uploaded' : '⚠️ No material uploaded yet'}
        </p>
        {c.material_url && (
          <a href={c.material_url} target="_blank"
            className="text-xs text-blue-400 hover:text-blue-300 underline mt-0.5 block">
            View current PDF
          </a>
        )}
      </div>

      <div className="flex flex-col gap-2 ml-4 shrink-0">
        {/* Upload Button */}
        <label className={`cursor-pointer text-center text-xs px-4 py-2 rounded-lg font-semibold transition ${
          uploading === c.id
            ? 'bg-gray-600 text-gray-400'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}>
          {uploading === c.id ? 'Uploading...' : '📤 Upload PDF'}
          <input type="file" accept=".pdf" className="hidden"
            disabled={uploading === c.id}
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) uploadMaterial(c.id, file)
            }} />
        </label>

        {/* Delete Material Button */}
        {c.material_url && (
          <button
            onClick={async () => {
              if (!confirm('Delete this course material?')) return
              // Extract path from URL
              const path = c.material_url.split('/course-materials/')[1]
              await supabase.storage.from('course-materials').remove([path])
              await supabase.from('courses')
                .update({ material_url: null, material_indexed: false, material_text: null })
                .eq('id', c.id)
              // Delete chunks too
              await supabase.from('course_material_chunks').delete().eq('course_id', c.id)
              setMessage('Material deleted.')
              loadAll()
            }}
            className="text-xs bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-semibold">
            🗑️ Delete PDF
          </button>
        )}

        {/* Index Button */}
        {c.material_url && !c.material_indexed && (
          <button
            onClick={async () => {
              setMessage('Indexing...')
              const res = await fetch('/api/admin/index-material', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ course_id: c.id })
              })
              const data = await res.json()
              if (data.success) setMessage(`✅ Indexed! ${data.chunks} chunks from ${data.pages} pages.`)
              else setMessage('Error: ' + data.error)
              loadAll()
            }}
            className="text-xs bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg font-semibold">
            ⚡ Index Material
          </button>
        )}

        {/* Delete Course */}
        <button
          onClick={async () => {
            if (!confirm('Delete this entire course? This cannot be undone.')) return
            await supabase.from('courses').delete().eq('id', c.id)
            loadAll()
          }}
          className="text-xs text-red-400 hover:text-red-300 text-center py-1">
          Remove Course
        </button>
      </div>
    </div>
  </div>
))}
      </div>
    </div>
  )
}