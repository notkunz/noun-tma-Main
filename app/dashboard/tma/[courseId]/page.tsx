'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import MathText from '@/components/MathText'

export default function TMAPage() {
  const supabase = createClient()
  const router = useRouter()
  const { courseId } = useParams()

  const [course, setCourse] = useState<any>(null)
  const [session, setSession] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [showScoreModal, setShowScoreModal] = useState(false)
  const [finalScore, setFinalScore] = useState('')
  const [closing, setClosing] = useState(false)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [internetPending, setInternetPending] = useState<{questionId: string, question: string} | null>(null)
  const [internetLoading, setInternetLoading] = useState(false)

  useEffect(() => { loadCourse() }, [])

const loadCourse = async () => {
  const { data: courseData } = await supabase
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .single()
  setCourse(courseData)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single() as { data: { id: string } | null }

  if (!profile) return

  // Check for ANY active session for this course — resumes on refresh
  const { data: existing } = await supabase
    .from('tma_sessions')
    .select('*')
    .eq('user_id', profile.id)
    .eq('course_id', courseId)
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .single() as { data: any }

  if (existing) {
    setSession(existing)
    loadQuestions(existing.id)
  }
}

  const loadQuestions = async (sessionId: string) => {
    const { data } = await supabase
      .from('tma_questions')
      .select('*')
      .eq('session_id', sessionId)
      .order('question_number')
    setQuestions(data || [])
  }

const startSession = async () => {
  setStarting(true)
  setError('')

  // Check if active session already exists — resume it for free
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single() as { data: { id: string } | null }

  if (profile) {
    const { data: existing } = await supabase
      .from('tma_sessions')
      .select('*')
      .eq('user_id', profile.id)
      .eq('course_id', courseId)
      .eq('status', 'active')
      .single() as { data: any }

    if (existing) {
      // Resume existing session — no charge
      setSession(existing)
      loadQuestions(existing.id)
      setStarting(false)
      return
    }
  }

  // No existing session — charge wallet and create new one
  const res = await fetch('/api/wallet/deduct', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ course_id: courseId })
  })
  const data = await res.json()
  setStarting(false)

  if (data.error) return setError(data.error)
  setSession({ id: data.session_id, question_count: 0 })
}

  const askQuestion = async () => {
    if (!input.trim() || loading) return
    setLoading(true)
    setError('')

    const res = await fetch('/api/tma/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: session.id,
        course_id: courseId,
        question: input.trim()
      })
    })
  const data = await res.json()
setLoading(false)

if (data.error) return setError(data.error)

const newCount = (session.question_count || 0) + 1
setSession((s: any) => ({ ...s, question_count: newCount }))
setQuestions(prev => [...prev, data.qa])
setInput('')

// Check if internet fallback needed
if (data.needs_internet) {
  setInternetPending({ questionId: data.qa.id, question: data.qa.question_text })
}

if (newCount >= 10 && !data.needs_internet) setShowScoreModal(true)
}
  const closeSession = async () => {
    if (!finalScore.trim()) return
    setClosing(true)

    await fetch('/api/tma/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: session.id,
        score: finalScore
      })
    })

    setClosing(false)
    router.push('/dashboard/my-tmas')
  }

  // Not started yet
  if (!session) return (
    <div className="max-w-xl mx-auto mt-20 text-center">
      <div className="bg-white rounded-2xl shadow-sm border p-10">
        <p className="text-4xl mb-4">📖</p>
        <h2 className="text-xl font-bold text-gray-800 mb-1">{course?.course_title}</h2>
        <p className="text-gray-500 text-sm mb-2">{course?.course_code} • {course?.level} Level</p>
        <p className="text-green-700 font-bold text-lg mb-6">₦{course?.tma_cost} per session</p>

        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 text-left">
          <p className="text-yellow-800 text-sm font-semibold mb-1">⚠️ Before you start:</p>
          <ul className="text-yellow-700 text-xs space-y-1 list-disc list-inside">
            <li>You get 10 questions per TMA session</li>
            <li>₦{course?.tma_cost} will be deducted from your wallet</li>
            <li>You cannot pause — complete all 10 questions</li>
            <li>Score 10/10? Your answers help future students!</li>
          </ul>
        </div>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <button onClick={startSession} disabled={starting}
          className="w-full bg-green-600 text-white rounded-xl py-4 font-bold hover:bg-green-700 disabled:opacity-50">
          {starting ? 'Starting...' : 'Start TMA Session'}
        </button>
        <button onClick={() => router.back()}
          className="w-full mt-3 text-gray-400 text-sm hover:text-gray-600">
          Go back
        </button>
      </div>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
<div className="flex items-center justify-between mb-6">
  <div className="flex items-center gap-3">
    <button
      onClick={() => setShowLeaveModal(true)}
      className="text-gray-400 hover:text-gray-600 transition">
      ← Back
    </button>
    <div>
      <h2 className="text-xl font-bold text-gray-800">{course?.course_code} TMA</h2>
      <p className="text-gray-500 text-sm">{course?.course_title}</p>
    </div>
  </div>
  <div className="flex items-center gap-4">
    <div className="text-right">
      <p className="text-2xl font-bold text-green-700">{session.question_count}/10</p>
      <p className="text-xs text-gray-400">questions asked</p>
    </div>
    {session.question_count > 0 && (
      <button
        onClick={() => setShowScoreModal(true)}
        className="bg-green-100 text-green-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-green-200 transition">
        Done ✓
      </button>
    )}
  </div>
</div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-100 rounded-full h-2 mb-6">
        <div
          className="bg-green-500 h-2 rounded-full transition-all"
          style={{ width: `${(session.question_count / 10) * 100}%` }}
        />
      </div>

      {/* Q&A History */}
      <div className="space-y-4 mb-6">
        {questions.map((q, i) => (
          <div key={q.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
            {/* Question */}
            <div className="bg-gray-50 p-4 border-b">
              <div className="flex items-start gap-3">
                <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full shrink-0">
                  Q{i + 1}
                </span>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{q.question_text}</p>
              </div>
            </div>
            {/* Answer */}
            <div className="p-4">
              <div className="flex items-start gap-3">
                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full shrink-0">
                  AI
                </span>
                <div className="flex-1">
                  <MathText text={q.answer_text} />
                  <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full ${
                    q.source === 'question_bank'
                      ? 'bg-purple-100 text-purple-600'
                      : q.source === 'course_material'
                      ? 'bg-green-100 text-green-600'
                      : 'bg-orange-100 text-orange-600'
                  }`}>
                    {q.source === 'question_bank' && '⚡ From question bank'}
                    {q.source === 'course_material' && '📖 From course material'}
                    {q.source === 'internet' && '🌐 From internet'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Internet Fallback Prompt */}
{internetPending && (
  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
    <p className="text-orange-800 text-sm font-semibold mb-1">
      ⚠️ Answer not found in course material
    </p>
    <p className="text-orange-700 text-xs mb-3">
      Would you like to search the internet for this answer?
      Internet answers are labelled separately.
    </p>
    <div className="flex gap-3">
      <button
        onClick={async () => {
          setInternetLoading(true)
          const res = await fetch('/api/tma/internet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: session.id,
              course_id: courseId,
              question: internetPending.question,
              question_id: internetPending.questionId
            })
          })
          const data = await res.json()
          setInternetLoading(false)
          setInternetPending(null)
          // Update the answer in the displayed list
          setQuestions(prev => prev.map(q =>
            q.id === internetPending.questionId
              ? { ...q, answer_text: data.answer, source: 'internet' }
              : q
          ))
          if ((session.question_count || 0) >= 10) setShowScoreModal(true)
        }}
        disabled={internetLoading}
        className="flex-1 bg-orange-500 text-white rounded-lg py-2 text-sm font-semibold hover:bg-orange-600 disabled:opacity-50">
        {internetLoading ? 'Searching...' : '🌐 Yes, search internet'}
      </button>
      <button
        onClick={() => setInternetPending(null)}
        className="flex-1 border border-orange-300 text-orange-700 rounded-lg py-2 text-sm font-semibold hover:bg-orange-50">
        No, skip this
      </button>
    </div>
  </div>
)}

      {/* Input Area */}
      {session.question_count < 10 && (
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-2">
            Question {session.question_count + 1} of 10 — paste your TMA question below
          </p>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Paste your TMA question here... (text, equations, anything)"
            rows={4}
            className="w-full border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-400"
          />
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          <button
            onClick={askQuestion}
            disabled={loading || !input.trim()}
            className="mt-3 w-full bg-green-600 text-white rounded-xl py-3 font-bold hover:bg-green-700 disabled:opacity-50">
            {loading ? 'Thinking...' : 'Get Answer →'}
          </button>
        </div>
      )}

      {/* Leave Warning Modal */}
{showLeaveModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
      <p className="text-5xl mb-4">⚠️</p>
      <h3 className="text-xl font-bold text-gray-800 mb-2">Leave Session?</h3>
      <p className="text-gray-500 text-sm mb-6">
        If you leave now your session stays open but you won't get your answers back.
        You've used <strong>{session.question_count}</strong> of your 10 questions.
        Your wallet won't be refunded.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => setShowLeaveModal(false)}
          className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-3 font-semibold hover:bg-gray-50">
          Stay
        </button>
        <button
          onClick={() => router.push('/dashboard')}
          className="flex-1 bg-red-500 text-white rounded-xl py-3 font-semibold hover:bg-red-600">
          Leave Anyway
        </button>
      </div>
    </div>
  </div>
)}

      {/* Score Modal */}
      {showScoreModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
            <p className="text-5xl mb-4">🎉</p>
            <h3 className="text-xl font-bold text-gray-800 mb-2">TMA Complete!</h3>
            <p className="text-gray-500 text-sm mb-6">
  You answered {session.question_count} question{session.question_count !== 1 ? 's' : ''}. 
  What was your final TMA score?
</p>
            <input
              type="text"
              placeholder="e.g. 8/10 or 10/10"
              value={finalScore}
              onChange={e => setFinalScore(e.target.value)}
              className="w-full border-2 border-green-300 rounded-xl p-3 text-center text-lg font-bold mb-4 focus:outline-none focus:border-green-500"
            />
            <p className="text-xs text-gray-400 mb-4">
              If you scored 10/10, your Q&As will be saved to help other students!
            </p>
            <button
              onClick={closeSession}
              disabled={!finalScore.trim() || closing}
              className="w-full bg-green-600 text-white rounded-xl py-3 font-bold hover:bg-green-700 disabled:opacity-50">
              {closing ? 'Saving...' : 'Submit Score & Finish'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}