'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function DepartmentsPage() {
  const supabase = createClient()
  const [departments, setDepartments] = useState<any[]>([])
  const [faculties, setFaculties] = useState<any[]>([])
  const [form, setForm] = useState({ name: '', faculty_id: '' })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    const [depts, facs] = await Promise.all([
      supabase.from('departments').select('*, faculties(name)').order('name'),
      supabase.from('faculties').select('*').order('name')
    ])
    setDepartments(depts.data || [])
    setFaculties(facs.data || [])
  }

  const addDept = async () => {
    if (!form.name.trim() || !form.faculty_id) return
    setLoading(true)
    const { error } = await supabase.from('departments').insert(form)
    setLoading(false)
    if (error) return setMessage('Error: ' + error.message)
    setForm({ name: '', faculty_id: '' })
    setMessage('Department added!')
    loadAll()
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Departments</h2>

      <div className="bg-gray-800 rounded-xl p-6 mb-6">
        <h3 className="font-semibold mb-4">Add New Department</h3>
        {message && <p className="text-green-400 text-sm mb-3">{message}</p>}
        <div className="flex gap-3">
          <select value={form.faculty_id}
            onChange={e => setForm({ ...form, faculty_id: e.target.value })}
            className="bg-gray-700 rounded-lg px-4 py-2 text-sm text-white">
            <option value="">Select Faculty</option>
            {faculties.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <input value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Department name"
            className="flex-1 bg-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-400" />
          <button onClick={addDept} disabled={loading}
            className="bg-green-600 px-6 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
            {loading ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {departments.map(d => (
          <div key={d.id} className="bg-gray-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">📂 {d.name}</p>
              <p className="text-gray-400 text-xs mt-0.5">{d.faculties?.name}</p>
            </div>
            <button onClick={async () => {
              if (!confirm('Delete this department?')) return
              await supabase.from('departments').delete().eq('id', d.id)
              loadAll()
            }} className="text-red-400 hover:text-red-300 text-sm">
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}