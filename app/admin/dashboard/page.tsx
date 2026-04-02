'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Nurse = {
  nurse_id: string
  staff_name: string
  department: string
}

type Competency = {
  id: number
  name: string
  file_name: string
  order_index: number
}

type NurseCompetency = {
  nurse_id: string
  competency_id: number
  signed_at: string
  signed_pdf_path: string
}

type NurseWithProgress = Nurse & {
  completed: number
  total: number
  percentage: number
  status: 'completed' | 'in_progress' | 'not_started'
}

const DEPARTMENTS = [
  'All Departments',
  'PICU', 'NICU', 'OBW', 'L&D', 'ER', 'ICU',
  'OPD', 'MSPU', 'RDU', 'Radiology', 'OR', 'MSWs', 'PHC'
]

const STATUS_FILTERS = ['All', 'Completed', 'In Progress', 'Not Started']

export default function AdminDashboard() {
  const router = useRouter()
  const [admin, setAdmin] = useState<any>(null)
  const [nurses, setNurses] = useState<NurseWithProgress[]>([])
  const [competencies, setCompetencies] = useState<Competency[]>([])
  const [nurseCompetencies, setNurseCompetencies] = useState<NurseCompetency[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [deptFilter, setDeptFilter] = useState('All Departments')
  const [statusFilter, setStatusFilter] = useState('All')
  const [search, setSearch] = useState('')

  // Selected nurse for detail view
  const [selectedNurse, setSelectedNurse] = useState<NurseWithProgress | null>(null)
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null)

  // ─── Auth check ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const session = sessionStorage.getItem('admin_session')
    if (!session) return router.push('/admin/login')
    setAdmin(JSON.parse(session))
  }, [router])

  // ─── Load data ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!admin) return
    loadData()
  }, [admin])

  const loadData = async () => {
    setLoading(true)

    const [nursesRes, compsRes, nurseCompsRes] = await Promise.all([
      supabase.from('nurses').select('nurse_id, staff_name, department').order('staff_name'),
      supabase.from('competencies').select('*').order('order_index'),
      supabase.from('nurse_competencies').select('*'),
    ])

    const nursesData: Nurse[] = nursesRes.data || []
    const compsData: Competency[] = compsRes.data || []
    const nurseCompsData: NurseCompetency[] = nurseCompsRes.data || []

    setCompetencies(compsData)
    setNurseCompetencies(nurseCompsData)

    // Build progress per nurse
    const withProgress: NurseWithProgress[] = nursesData.map(nurse => {
      const completed = nurseCompsData.filter(nc => nc.nurse_id === nurse.nurse_id).length
      const total = compsData.length
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0
      const status =
        completed === 0 ? 'not_started' :
        completed === total ? 'completed' : 'in_progress'

      return { ...nurse, completed, total, percentage, status }
    })

    setNurses(withProgress)
    setLoading(false)
  }

  // ─── Filtered nurses ──────────────────────────────────────────────────────────
  const filtered = nurses.filter(n => {
    const matchDept = deptFilter === 'All Departments' || n.department === deptFilter
    const matchStatus =
      statusFilter === 'All' ||
      (statusFilter === 'Completed' && n.status === 'completed') ||
      (statusFilter === 'In Progress' && n.status === 'in_progress') ||
      (statusFilter === 'Not Started' && n.status === 'not_started')
    const matchSearch =
      n.staff_name.toLowerCase().includes(search.toLowerCase()) ||
      n.nurse_id.toLowerCase().includes(search.toLowerCase())
    return matchDept && matchStatus && matchSearch
  })

  // ─── Stats ────────────────────────────────────────────────────────────────────
  const totalNurses = nurses.length
  const completedAll = nurses.filter(n => n.status === 'completed').length
  const inProgress = nurses.filter(n => n.status === 'in_progress').length
  const notStarted = nurses.filter(n => n.status === 'not_started').length
  const overallPct = totalNurses > 0
    ? Math.round(nurses.reduce((sum, n) => sum + n.percentage, 0) / totalNurses)
    : 0

  // ─── Download signed PDF ──────────────────────────────────────────────────────
  const handleDownload = async (nurseCompetency: NurseCompetency, competencyName: string) => {
    setDownloadingPath(nurseCompetency.signed_pdf_path)
    try {
      const { data, error } = await supabase.storage
        .from('competency-signed')
        .download(nurseCompetency.signed_pdf_path)
      if (error || !data) throw new Error('Could not download')

      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${competencyName}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      alert('Download failed: ' + err.message)
    }
    setDownloadingPath(null)
  }

  // ─── Nurse detail: get their signed competencies ──────────────────────────────
  const getNurseCompetencies = (nurseId: string) => {
    return nurseCompetencies.filter(nc => nc.nurse_id === nurseId)
  }

  const getCompetencyById = (id: number) => competencies.find(c => c.id === id)

  // ─── Status badge ─────────────────────────────────────────────────────────────
  const StatusBadge = ({ status }: { status: string }) => {
    const styles = {
      completed: 'bg-green-100 text-green-700',
      in_progress: 'bg-yellow-100 text-yellow-700',
      not_started: 'bg-gray-100 text-gray-500',
    }[status] || 'bg-gray-100 text-gray-500'

    const label = {
      completed: '✓ Completed',
      in_progress: '⏳ In Progress',
      not_started: '— Not Started',
    }[status] || status

    return (
      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${styles}`}>
        {label}
      </span>
    )
  }

  const handleLogout = () => {
    sessionStorage.removeItem('admin_session')
    router.push('/admin/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading dashboard...
      </div>
    )
  }

  // ─── Nurse detail modal ───────────────────────────────────────────────────────
  if (selectedNurse) {
    const signed = getNurseCompetencies(selectedNurse.nurse_id)
    const unsignedComps = competencies.filter(
      c => !signed.find(s => s.competency_id === c.id)
    )

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedNurse(null)}
              className="text-sm text-blue-600 hover:underline"
            >
              ← Back to Dashboard
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{selectedNurse.staff_name}</h1>
              <p className="text-sm text-gray-500">
                ID: {selectedNurse.nurse_id} · {selectedNurse.department}
              </p>
            </div>
          </div>
          <StatusBadge status={selectedNurse.status} />
        </div>

        <div className="max-w-4xl mx-auto p-6">
          {/* Progress */}
          <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
            <div className="flex justify-between text-sm text-gray-500 mb-2">
              <span>Progress</span>
              <span>{selectedNurse.completed} / {selectedNurse.total} competencies</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all"
                style={{ width: `${selectedNurse.percentage}%` }}
              />
            </div>
            <p className="text-right text-xs text-gray-400 mt-1">{selectedNurse.percentage}%</p>
          </div>

          {/* Signed competencies */}
          {signed.length > 0 && (
            <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">
                ✅ Signed Competencies ({signed.length})
              </h2>
              <div className="space-y-3">
                {signed.map(nc => {
                  const comp = getCompetencyById(nc.competency_id)
                  if (!comp) return null
                  return (
                    <div
                      key={nc.competency_id}
                      className="flex items-center justify-between bg-green-50 rounded-2xl px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800">{comp.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Signed on {new Date(nc.signed_at).toLocaleDateString('en-GB')}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDownload(nc, comp.name)}
                        disabled={downloadingPath === nc.signed_pdf_path}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-green-200 hover:bg-green-100 text-green-700 text-xs font-medium rounded-lg disabled:opacity-50 transition"
                      >
                        {downloadingPath === nc.signed_pdf_path ? '⏳' : '⬇️'} Download
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Unsigned competencies */}
          {unsignedComps.length > 0 && (
            <div className="bg-white rounded-3xl shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">
                ⏳ Pending Competencies ({unsignedComps.length})
              </h2>
              <div className="space-y-2">
                {unsignedComps.map(comp => (
                  <div
                    key={comp.id}
                    className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3"
                  >
                    <span className="text-gray-300 text-lg">○</span>
                    <p className="text-sm text-gray-500">{comp.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── Main dashboard ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-500">Jubail Health Network — Nursing Competencies 2026</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{admin?.name}</span>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm bg-red-50 text-red-600 rounded-xl hover:bg-red-100"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">

        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl shadow-sm p-5 text-center">
            <p className="text-3xl font-bold text-gray-900">{totalNurses}</p>
            <p className="text-xs text-gray-500 mt-1">Total Nurses</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-5 text-center">
            <p className="text-3xl font-bold text-green-600">{completedAll}</p>
            <p className="text-xs text-gray-500 mt-1">Fully Completed</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-5 text-center">
            <p className="text-3xl font-bold text-yellow-500">{inProgress}</p>
            <p className="text-xs text-gray-500 mt-1">In Progress</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-5 text-center">
            <p className="text-3xl font-bold text-gray-400">{notStarted}</p>
            <p className="text-xs text-gray-500 mt-1">Not Started</p>
          </div>
        </div>

        {/* Overall progress */}
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
          <div className="flex justify-between text-sm text-gray-500 mb-2">
            <span className="font-medium">Overall Completion</span>
            <span>{overallPct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all"
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-6 flex flex-wrap gap-3">
          {/* Search */}
          <input
            type="text"
            placeholder="Search by name or ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400"
          />

          {/* Department filter */}
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 bg-white"
          >
            {DEPARTMENTS.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Status filter */}
          <div className="flex gap-2">
            {STATUS_FILTERS.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition ${
                  statusFilter === s
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={loadData}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-sm"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Nurses table */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">
              Nurses ({filtered.length})
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-6 py-3 text-left">Name</th>
                  <th className="px-6 py-3 text-left">ID</th>
                  <th className="px-6 py-3 text-left">Department</th>
                  <th className="px-6 py-3 text-left">Progress</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-left">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-gray-400 text-sm">
                      No nurses found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map(nurse => (
                    <tr key={nurse.nurse_id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {nurse.staff_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {nurse.nurse_id}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {nurse.department}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-gray-100 rounded-full h-2 min-w-[80px]">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                nurse.status === 'completed' ? 'bg-green-500' :
                                nurse.status === 'in_progress' ? 'bg-yellow-400' :
                                'bg-gray-200'
                              }`}
                              style={{ width: `${nurse.percentage}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            {nurse.completed}/{nurse.total}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={nurse.status} />
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setSelectedNurse(nurse)}
                          className="text-xs text-blue-600 hover:underline font-medium"
                        >
                          View →
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}