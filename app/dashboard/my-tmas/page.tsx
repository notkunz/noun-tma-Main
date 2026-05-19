'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function MyTMAsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase
  .from('users').select('id').eq('auth_id', user!.id).single() as { data: { id: string } | null }

if (!profile) return

      const { data } = await supabase
        .from('tma_sessions')
        .select('*, courses(course_code, course_title, level)')
        .eq('user_id', profile.id)
        .order('started_at', { ascending: false })

      setSessions(data || [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-1">My TMA Sessions</h2>
      <p className="text-gray-500 text-sm mb-6">All your past and active TMA sessions</p>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : sessions.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-4">📭</p>
          <p className="text-gray-500">No TMA sessions yet.</p>
          <button onClick={() => router.push('/dashboard/courses')}
            className="mt-4 bg-green-600 text-white px-6 py-2 rounded-xl text-sm font-semibold">
            Browse Courses
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map(s => (
            <div key={s.id} className="bg-white rounded-xl border shadow-sm p-5 flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-800">
                  {s.courses?.course_code} — {s.courses?.course_title}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {s.courses?.level} Level &nbsp;|&nbsp;
                  {s.question_count}/10 questions &nbsp;|&nbsp;
                  {new Date(s.started_at).toLocaleDateString()}
                </p>
                {s.score !== null && (
                  <p className="text-xs text-green-600 font-semibold mt-1">
                    Final Score: {s.score}/10
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
                  s.status === 'completed' ? 'bg-green-100 text-green-700' :
                  s.status === 'active' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {s.status}
                </span>
                {s.status === 'active' && (
                  <button
                    onClick={() => router.push(`/dashboard/tma/${s.course_id}`)}
                    className="text-xs bg-green-600 text-white px-3 py-1 rounded-full hover:bg-green-700">
                    Continue →
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}