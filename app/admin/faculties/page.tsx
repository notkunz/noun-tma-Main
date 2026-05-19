'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function FacultiesPage() {
  const supabase = createClient()
  const [faculties, setFaculties] = useState<any[]>([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => { loadFaculties() }, [])

  const loadFaculties = async () => {
    const { data } = await supabase
      .from('faculties').select('*').order('name')
    setFaculties(data || [])
  }

  const addFaculty = async () => {
    if (!name.trim()) return
    setLoading(true)
    const { error } = await supabase.from('faculties').insert({ name })
    setLoading(false)
    if (error) return setMessage('Error: ' + error.message)
    setName('')
    setMessage('Faculty added!')
    loadFaculties()
  }

  const deleteFaculty = async (id: string) => {
    if (!confirm('Delete this faculty? All departments and courses under it will also be deleted.')) return
    await supabase.from('faculties').delete().eq('id', id)
    loadFaculties()
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Faculties</h2>

      <div className="bg-gray-800 rounded-xl p-6 mb-6">
        <h3 className="font-semibold mb-4">Add New Faculty</h3>
        {message && <p className="text-green-400 text-sm mb-3">{message}</p>}
        <div className="flex gap-3">
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Science & Technology"
            className="flex-1 bg-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-400" />
          <button onClick={addFaculty} disabled={loading}
            className="bg-green-600 px-6 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
            {loading ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {faculties.map(f => (
          <div key={f.id} className="bg-gray-800 rounded-xl p-4 flex items-center justify-between">
            <p className="font-medium">🏛️ {f.name}</p>
            <button onClick={() => deleteFaculty(f.id)}
              className="text-red-400 hover:text-red-300 text-sm">
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}