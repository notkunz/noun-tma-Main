'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AnalyticsPage() {
  const supabase = createClient()
  const [topCourses, setTopCourses] = useState<any[]>([])
  const [topQuestions, setTopQuestions] = useState<any[]>([])
  const [notFoundRate, setNotFoundRate] = useState<any[]>([])
  const [dailyRevenue, setDailyRevenue] = useState<any[]>([])

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    // Most popular courses by session count
    const { data: courses } = await supabase
      .from('tma_sessions')
      .select('course_id, courses(course_code, course_title)')
      .eq('status', 'completed')

    const courseCount: Record<string, any> = {}
    courses?.forEach((s: any) => {
      const key = s.course_id
      if (!courseCount[key]) courseCount[key] = { ...s.courses, count: 0 }
      courseCount[key].count++
    })
    setTopCourses(
      Object.values(courseCount)
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 10)
    )

    // Most asked questions from bank
    const { data: questions } = await supabase
      .from('question_bank')
      .select('question_text, times_asked, courses(course_code)')
      .order('times_asked', { ascending: false })
      .limit(10)
    setTopQuestions(questions || [])

    // Courses with highest "not found" rate
    const { data: notFound } = await supabase
      .from('tma_questions')
      .select('course_id, courses(course_code)')
      .ilike('answer_text', '%not found%')
    
    const nfCount: Record<string, any> = {}
    notFound?.forEach((q: any) => {
      const key = q.course_id
      if (!nfCount[key]) nfCount[key] = { ...q.courses, count: 0 }
      nfCount[key].count++
    })
    setNotFoundRate(
      Object.values(nfCount)
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 5)
    )

    // Revenue last 7 days
    const { data: revenue } = await supabase
      .from('transactions')
      .select('amount, created_at')
      .eq('type', 'credit')
      .eq('status', 'success')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    
    const byDay: Record<string, number> = {}
    revenue?.forEach(t => {
      const day = new Date(t.created_at).toLocaleDateString('en-NG', { weekday: 'short' })
      byDay[day] = (byDay[day] || 0) + t.amount
    })
    setDailyRevenue(Object.entries(byDay).map(([day, amount]) => ({ day, amount })))
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Analytics</h2>

      <div className="grid grid-cols-2 gap-6">
        {/* Top Courses */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h3 className="font-bold mb-4">Most Popular Courses</h3>
          <div className="space-y-2">
            {topCourses.map((c: any, i) => (
              <div key={i} className="flex items-center justify-between">
                <p className="text-sm text-gray-300">{c.course_code}</p>
                <span className="bg-green-700 text-white text-xs px-2 py-0.5 rounded-full">
                  {c.count} sessions
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Questions */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h3 className="font-bold mb-4">Most Asked Questions</h3>
          <div className="space-y-2">
            {topQuestions.map((q: any, i) => (
              <div key={i} className="flex items-start justify-between gap-2">
                <p className="text-xs text-gray-300 line-clamp-2 flex-1">{q.question_text}</p>
                <span className="text-yellow-400 text-xs shrink-0">{q.times_asked}x</span>
              </div>
            ))}
          </div>
        </div>

        {/* Courses Needing Better PDFs */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h3 className="font-bold mb-2">Courses Needing Better PDFs</h3>
          <p className="text-gray-400 text-xs mb-4">High "answer not found" rate</p>
          <div className="space-y-2">
            {notFoundRate.map((c: any, i) => (
              <div key={i} className="flex items-center justify-between">
                <p className="text-sm text-gray-300">{c.course_code}</p>
                <span className="bg-red-700 text-white text-xs px-2 py-0.5 rounded-full">
                  {c.count} misses
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Revenue */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h3 className="font-bold mb-4">Revenue This Week</h3>
          <div className="space-y-2">
            {dailyRevenue.map((d, i) => (
              <div key={i} className="flex items-center justify-between">
                <p className="text-sm text-gray-300">{d.day}</p>
                <span className="text-green-400 font-semibold text-sm">
                  ₦{d.amount.toLocaleString()}
                </span>
              </div>
            ))}
            {dailyRevenue.length === 0 && (
              <p className="text-gray-500 text-sm">No revenue yet this week</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}