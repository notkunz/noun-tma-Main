'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SessionsPage() {
  const supabase = createClient()
  const [sessions, setSessions] = useState<any[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => { loadSessions() }, [])

  const loadSessions = async () => {
    const { data } = await supabase
      .from('tma_sessions')
      .select('*, courses(course_code, course_title), users(full_name, matric_number)')
      .order('started_at', { ascending: false })
    setSessions(data || [])
  }

  const filtered = sessions.filter(s =>
    !search ||
    s.users?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.users?.matric_number?.toLowerCase().includes(search.toLowerCase()) ||
    s.courses?.course_code?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">TMA Sessions</h2>
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search by name, matric or course..."
        className="w-full bg-gray-800 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-400 mb-6" />

      <div className="space-y-3">
        {filtered.map(s => (
          <div key={s.id} className="bg-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{s.users?.full_name}</p>
                <p className="text-gray-400 text-xs mt-0.5">
                  {s.users?.matric_number} | {s.courses?.course_code} — {s.courses?.course_title}
                </p>
                <p className="text-gray-400 text-xs">
                  {s.question_count}/10 questions | Started: {new Date(s.started_at).toLocaleDateString()}
                </p>
                {s.score !== null && (
                  <p className="text-green-400 text-xs mt-1">Score: {s.score}/10</p>
                )}
              </div>
              <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
                s.status === 'completed' ? 'bg-green-800 text-green-300' :
                s.status === 'active' ? 'bg-blue-800 text-blue-300' :
                'bg-gray-700 text-gray-400'
              }`}>
                {s.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}