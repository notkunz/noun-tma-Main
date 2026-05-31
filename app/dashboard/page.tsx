'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function DashboardHome() {
  const supabase = createClient()
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [recentSessions, setRecentSessions] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profileData } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', user.id)
        .single()
      setProfile(profileData)

const { data: sessions } = await supabase
  .from('tma_sessions')
  .select('*, courses(course_code, course_title)')
  .eq('user_id', profileData.id)
  .order('started_at', { ascending: false })

// Keep only the most recent session per course
const seen = new Set()
const uniqueSessions = (sessions || []).filter((s: any) => {
  if (seen.has(s.course_id)) return false
  seen.add(s.course_id)
  return true
}).slice(0, 5)

setRecentSessions(uniqueSessions)
    }
    load()
  }, [])

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-1">
        Welcome back, {profile?.full_name?.split(' ')[0]} 👋
      </h2>
      <p className="text-gray-500 text-sm mb-8">
        Matric: {profile?.matric_number} &nbsp;|&nbsp;
        {profile?.department} &nbsp;|&nbsp; {profile?.level} Level
      </p>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-4 mb-8">
{[
  { label: 'Browse Courses', icon: '📖', href: '/dashboard/courses' },
  { label: 'Top Up Wallet', icon: '💰', href: '/dashboard/wallet' },
  { label: 'My TMAs', icon: '📝', href: '/dashboard/my-tmas' },
].map(action => (
  <button key={action.href}
    onClick={() => router.push(action.href)}
    className="bg-white rounded-xl p-6 shadow-sm border hover:shadow-md transition text-left">
    <p className="text-3xl mb-2">{action.icon}</p>
    <p className="font-semibold text-gray-700">{action.label}</p>
  </button>
))}
      </div>

      {/* Recent TMA Sessions */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="font-bold text-gray-700 mb-4">Recent TMA Sessions</h3>
        {recentSessions.length === 0 ? (
          <p className="text-gray-400 text-sm">No TMA sessions yet. Browse courses to get started.</p>
        ) : (
          <div className="space-y-3">
            {recentSessions.map(session => (
              <div key={session.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-sm text-gray-800">
                    {session.courses?.course_code} — {session.courses?.course_title}
                  </p>
                  <p className="text-xs text-gray-400">
                    {session.question_count}/10 questions &nbsp;|&nbsp;
                    {new Date(session.started_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  session.status === 'completed' ? 'bg-green-100 text-green-700' :
                  session.status === 'active' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {session.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}