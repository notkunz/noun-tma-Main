'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AdminOverview() {
  const supabase = createClient()
  const [stats, setStats] = useState({
    users: 0, sessions: 0, courses: 0, bankEntries: 0, revenue: 0
  })

  useEffect(() => {
    const load = async () => {
      const [users, sessions, courses, bank, revenue] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact' }),
        supabase.from('tma_sessions').select('id', { count: 'exact' }),
        supabase.from('courses').select('id', { count: 'exact' }),
        supabase.from('question_bank').select('id', { count: 'exact' }),
        supabase.from('transactions').select('amount').eq('type', 'credit').eq('status', 'success')
      ])

      const totalRevenue = revenue.data?.reduce((sum, t) => sum + t.amount, 0) || 0

      setStats({
        users: users.count || 0,
        sessions: sessions.count || 0,
        courses: courses.count || 0,
        bankEntries: bank.count || 0,
        revenue: totalRevenue
      })
    }
    load()
  }, [])

  const cards = [
    { label: 'Total Users', value: stats.users, icon: '👥', color: 'bg-blue-600' },
    { label: 'TMA Sessions', value: stats.sessions, icon: '📝', color: 'bg-purple-600' },
    { label: 'Courses', value: stats.courses, icon: '📖', color: 'bg-green-600' },
    { label: 'Question Bank', value: stats.bankEntries, icon: '🏦', color: 'bg-yellow-600' },
    { label: 'Total Revenue', value: `₦${stats.revenue.toLocaleString()}`, icon: '💰', color: 'bg-red-600' },
  ]

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Overview</h2>
      <div className="grid grid-cols-3 gap-4">
        {cards.map(card => (
          <div key={card.label} className={`${card.color} rounded-xl p-6`}>
            <p className="text-3xl mb-2">{card.icon}</p>
            <p className="text-3xl font-bold">{card.value}</p>
            <p className="text-white/70 text-sm mt-1">{card.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}