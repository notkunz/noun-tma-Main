'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function CoursesPage() {
  const supabase = createClient()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [faculties, setFaculties] = useState<any[]>([])
  const [allCourses, setAllCourses] = useState<any[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [expandedDept, setExpandedDept] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: facultyData } = await supabase
        .from('faculties')
        .select(`
          id, name,
          departments (
            id, name,
            courses (
              id, course_code, course_title, level, semester, tma_cost
            )
          )
        `)
      setFaculties(facultyData || [])

      // Flat list for search
      const flat: any[] = []
      facultyData?.forEach((f: any) =>
        f.departments?.forEach((d: any) =>
          d.courses?.forEach((c: any) =>
            flat.push({ ...c, department: d.name, faculty: f.name })
          )
        )
      )
      setAllCourses(flat)
    }
    load()
  }, [])

  const filtered = search.trim()
    ? allCourses.filter(c =>
        c.course_code.toLowerCase().includes(search.toLowerCase()) ||
        c.course_title.toLowerCase().includes(search.toLowerCase()) ||
        c.department.toLowerCase().includes(search.toLowerCase())
      )
    : null

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-1">All Courses</h2>
      <p className="text-gray-500 text-sm mb-6">Browse by faculty or search for a specific course</p>

      {/* Search Bar */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="🔍 Search by course code, title or department..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full border border-gray-200 rounded-xl p-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-400"
        />
      </div>

      {/* Search Results */}
      {filtered && (
        <div className="mb-8 bg-white rounded-xl border shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-3">{filtered.length} result(s) found</p>
          {filtered.length === 0 ? (
            <p className="text-gray-400 text-sm">No courses match your search.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map(course => (
                <CourseCard key={course.id} course={course} router={router} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Faculty Browser */}
      {!filtered && (
        <div className="space-y-4">
          {faculties.map((faculty: any) => (
            <div key={faculty.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
              {/* Faculty Header */}
              <button
                onClick={() => setExpanded(expanded === faculty.id ? null : faculty.id)}
                className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition">
                <span className="font-bold text-gray-800">🏛️ {faculty.name}</span>
                <span className="text-gray-400">{expanded === faculty.id ? '▲' : '▼'}</span>
              </button>

              {/* Departments */}
              {expanded === faculty.id && (
                <div className="border-t">
                  {faculty.departments?.map((dept: any) => (
                    <div key={dept.id} className="border-b last:border-0">
                      <button
                        onClick={() => setExpandedDept(expandedDept === dept.id ? null : dept.id)}
                        className="w-full flex items-center justify-between px-6 py-3 hover:bg-green-50 transition">
                        <span className="text-sm font-medium text-gray-700">📂 {dept.name}</span>
                        <span className="text-gray-400 text-xs">{expandedDept === dept.id ? '▲' : '▼'}</span>
                      </button>

                      {/* Courses */}
                      {expandedDept === dept.id && (
                        <div className="px-6 pb-4 space-y-2">
                          {dept.courses?.map((course: any) => (
                            <CourseCard key={course.id} course={course} router={router} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Reusable Course Card
function CourseCard({ course, router }: { course: any; router: any }) {
  return (
    <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4 border">
      <div>
        <p className="font-semibold text-sm text-gray-800">
          {course.course_code} — {course.course_title}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {course.level} Level &nbsp;|&nbsp;
          {course.semester === 'first' ? '1st' : '2nd'} Semester
          {course.department ? ` | ${course.department}` : ''}
        </p>
      </div>
      <div className="text-right ml-4 shrink-0">
        <p className="text-green-700 font-bold text-sm">₦{course.tma_cost}</p>
        <button
          onClick={() => router.push(`/dashboard/tma/${course.id}`)}
          className="mt-1 text-xs bg-green-600 text-white px-4 py-1.5 rounded-full hover:bg-green-700 transition">
          Start TMA
        </button>
      </div>
    </div>
  )
}