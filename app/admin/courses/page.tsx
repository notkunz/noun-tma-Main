'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function CoursesAdminPage() {
  const supabase = createClient()
  const [courses, setCourses] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [sharedMaterials, setSharedMaterials] = useState<any[]>([])
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    department_id: '', course_code: '', course_title: '',
    level: '', semester: 'first', tma_cost: '200', shared_material_code: ''
  })

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    const [c, d, sm] = await Promise.all([
      supabase.from('courses')
        .select('*, departments(name, faculties(name))')
        .order('course_code'),
      supabase.from('departments')
        .select('*, faculties(name)')
        .order('name'),
      supabase.from('shared_materials')
        .select('*')
        .eq('material_indexed', true)
        .order('course_code')
    ])
    setCourses(c.data || [])
    setDepartments(d.data || [])
    setSharedMaterials(sm.data || [])
  }

  const addCourse = async () => {
    if (!form.course_code || !form.course_title || !form.department_id) return
    const { error } = await supabase.from('courses').insert({
      department_id: form.department_id,
      course_code: form.course_code,
      course_title: form.course_title,
      level: form.level,
      semester: form.semester,
      tma_cost: parseFloat(form.tma_cost),
      shared_material_code: form.shared_material_code || null
    })
    if (error) return setMessage('Error: ' + error.message)
    setMessage('Course added!')
    setForm({ department_id: '', course_code: '', course_title: '', level: '', semester: 'first', tma_cost: '200', shared_material_code: '' })
    loadAll()
  }

  const linkMaterial = async (courseId: string, code: string) => {
    await supabase.from('courses')
      .update({ shared_material_code: code || null })
      .eq('id', courseId)
    setMessage(`Material linked!`)
    loadAll()
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Courses</h2>

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
          <input placeholder="Course Code (e.g. GST 101)"
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

          {/* Link shared material on creation */}
          <select value={form.shared_material_code}
            onChange={e => setForm({ ...form, shared_material_code: e.target.value })}
            className="bg-gray-700 rounded-lg px-4 py-2 text-sm text-white">
            <option value="">No material yet</option>
            {sharedMaterials.map(sm => (
              <option key={sm.id} value={sm.course_code}>
                {sm.course_code} (indexed ✅)
              </option>
            ))}
          </select>

          <button onClick={addCourse}
            className="bg-green-600 rounded-lg py-2 text-sm font-semibold hover:bg-green-700 text-white col-span-2">
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
                  {c.departments?.faculties?.name} → {c.departments?.name} | {c.level} Level | {c.semester === 'first' ? '1st' : '2nd'} Sem | ₦{c.tma_cost}
                </p>

                {/* Material status */}
                {c.shared_material_code ? (
                  <p className="text-green-400 text-xs mt-1">
                    ✅ Using shared material: <strong>{c.shared_material_code}</strong>
                  </p>
                ) : (
                  <p className="text-yellow-400 text-xs mt-1">⚠️ No material linked</p>
                )}

                {/* Link material dropdown */}
                <div className="flex items-center gap-2 mt-2">
                  <select
                    defaultValue={c.shared_material_code || ''}
                    onChange={e => linkMaterial(c.id, e.target.value)}
                    className="bg-gray-700 rounded-lg px-3 py-1.5 text-xs text-white">
                    <option value="">— Link shared material —</option>
                    {sharedMaterials.map(sm => (
                      <option key={sm.id} value={sm.course_code}>
                        {sm.course_code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={async () => {
                  if (!confirm('Delete this course?')) return
                  await supabase.from('courses').delete().eq('id', c.id)
                  loadAll()
                }}
                className="text-xs text-red-400 hover:text-red-300 ml-4 shrink-0">
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}