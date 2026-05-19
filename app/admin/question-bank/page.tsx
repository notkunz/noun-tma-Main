'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function QuestionBankPage() {
  const supabase = createClient()
  const [questions, setQuestions] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => { loadBank() }, [])

  const loadBank = async () => {
    const { data } = await supabase
      .from('question_bank')
      .select('*, courses(course_code, course_title)')
      .order('times_asked', { ascending: false })
    setQuestions(data || [])
  }

  const deleteEntry = async (id: string) => {
    if (!confirm('Delete this entry from the question bank?')) return
    await supabase.from('question_bank').delete().eq('id', id)
    loadBank()
  }

  const filtered = questions.filter(q => {
    const matchSearch = !search ||
      q.question_text.toLowerCase().includes(search.toLowerCase()) ||
      q.courses?.course_code.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || q.source === filter
    return matchSearch && matchFilter
  })

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Question Bank</h2>
      <p className="text-gray-400 text-sm mb-6">{questions.length} entries total</p>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Search questions..."
          className="flex-1 bg-gray-800 rounded-xl px-4 py-2 text-sm text-white placeholder-gray-400" />
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="bg-gray-800 rounded-xl px-4 py-2 text-sm text-white">
          <option value="all">All Sources</option>
          <option value="course_material">Course Material</option>
          <option value="internet">Internet</option>
        </select>
      </div>

      <div className="space-y-3">
        {filtered.map(q => (
          <div key={q.id} className="bg-gray-800 rounded-xl overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === q.id ? null : q.id)}
              className="w-full p-4 text-left hover:bg-gray-700 transition">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium line-clamp-2">{q.question_text}</p>
                  <div className="flex gap-3 mt-1">
                    <span className="text-gray-400 text-xs">
                      {q.courses?.course_code}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      q.source === 'course_material'
                        ? 'bg-green-900 text-green-300'
                        : 'bg-orange-900 text-orange-300'
                    }`}>
                      {q.source === 'course_material' ? '📖 Material' : '🌐 Internet'}
                    </span>
                    <span className="text-gray-500 text-xs">
                      Asked {q.times_asked}x
                    </span>
                  </div>
                </div>
                <span className="text-gray-400">{expanded === q.id ? '▲' : '▼'}</span>
              </div>
            </button>

            {expanded === q.id && (
              <div className="border-t border-gray-700 p-4">
                <p className="text-xs text-gray-400 mb-2 font-semibold">ANSWER:</p>
                <p className="text-sm text-gray-200 whitespace-pre-wrap">{q.answer_text}</p>
                <button onClick={() => deleteEntry(q.id)}
                  className="mt-4 text-xs text-red-400 hover:text-red-300">
                  🗑️ Delete from bank
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}