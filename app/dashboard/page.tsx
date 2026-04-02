'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { PDFDocument } from 'pdf-lib'

type Competency = {
  id: number
  name: string
  file_name: string
  order_index: number
}

type NurseCompetency = {
  competency_id: number
}

export default function Dashboard() {
  const router = useRouter()

  const [user, setUser] = useState<any>(null)
  const [nurse, setNurse] = useState<any>(null)
  const [competencies, setCompetencies] = useState<Competency[]>([])
  const [completedIds, setCompletedIds] = useState<number[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  // Signature state
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)

  // Competency #1 state
  const [showCanvas, setShowCanvas] = useState(false)
  const [isSigning, setIsSigning] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)

  // Competency #2+ state
  const [checked, setChecked] = useState(false)
  const [validating, setValidating] = useState(false)

  // PDF viewer
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)

  // All done
  const [allDone, setAllDone] = useState(false)

  // Download state
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  // ─── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')
      setUser(user)

      const { data: nurseData } = await supabase
        .from('nurses')
        .select('staff_name, nurse_id, department')
        .eq('nurse_id', user.user_metadata.nurse_id)
        .single()
      setNurse(nurseData)

      const { data: comps } = await supabase
        .from('competencies')
        .select('*')
        .order('order_index')
      setCompetencies(comps || [])

      const { data: nurseComps } = await supabase
        .from('nurse_competencies')
        .select('competency_id')
        .eq('nurse_id', user.user_metadata.nurse_id)
      const doneIds = (nurseComps || []).map((nc: NurseCompetency) => nc.competency_id)
      setCompletedIds(doneIds)

      // Resume from where they left off
      const nextIndex = (comps || []).findIndex((c: Competency) => !doneIds.includes(c.id))
      if (nextIndex === -1) {
        setAllDone(true)
      } else {
        setCurrentIndex(nextIndex)
      }

      // Load saved signature from Supabase Storage
      if (nurseData) {
        const sigPath = `${nurseData.nurse_id}/signature.png`
        const { data } = supabase.storage.from('signatures').getPublicUrl(sigPath)
        if (data?.publicUrl) {
          try {
            const res = await fetch(data.publicUrl, { method: 'HEAD' })
            if (res.ok) setSignatureDataUrl(data.publicUrl)
          } catch {}
        }
      }

      setLoading(false)
    }
    init()
  }, [router])

  // ─── Load PDF for current competency ─────────────────────────────────────────
  useEffect(() => {
    if (!competencies.length || currentIndex >= competencies.length) return
    const comp = competencies[currentIndex]
    const { data } = supabase.storage
      .from('competency-filled')
      .getPublicUrl(comp.file_name)
    setPdfUrl(data.publicUrl)
    setChecked(false)
  }, [currentIndex, competencies])

  // ─── Canvas drawing ───────────────────────────────────────────────────────────
  const initCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1f2937'
  }

  useEffect(() => {
    if (showCanvas) setTimeout(initCanvas, 50)
  }, [showCanvas])

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      }
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    drawingRef.current = true
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawingRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const pos = getPos(e, canvas)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }

  const stopDraw = () => { drawingRef.current = false }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
  }

  // ─── Sign competency #1 ───────────────────────────────────────────────────────
  const handleSign = async () => {
    const canvas = canvasRef.current
    if (!canvas || !nurse) return
    setIsSigning(true)

    try {
      const sigDataUrl = canvas.toDataURL('image/png')

      // 1. Save signature to Supabase Storage
      const sigBlob = await (await fetch(sigDataUrl)).blob()
      const sigPath = `${nurse.nurse_id}/signature.png`
      await supabase.storage.from('signatures').upload(sigPath, sigBlob, {
        contentType: 'image/png',
        upsert: true,
      })
      setSignatureDataUrl(sigDataUrl)

      // 2. Sign the PDF and save
      await signAndSavePdf(competencies[currentIndex], sigDataUrl)

      // 3. Mark competency as done in DB
      await markCompetencyDone(competencies[currentIndex].id, competencies[currentIndex])

      // 4. Move to next
      advance()
    } catch (err: any) {
      alert('Error signing: ' + err.message)
    }
    setIsSigning(false)
    setShowCanvas(false)
  }

  // ─── Validate competency #2+ ──────────────────────────────────────────────────
  const handleValidate = async () => {
    if (!checked || !signatureDataUrl || !nurse) return
    setValidating(true)

    try {
      await signAndSavePdf(competencies[currentIndex], signatureDataUrl)
      await markCompetencyDone(competencies[currentIndex].id, competencies[currentIndex])
      advance()
    } catch (err: any) {
      alert('Error validating: ' + err.message)
    }
    setValidating(false)
    setChecked(false)
  }

  // ─── Sign PDF with pdf-lib ────────────────────────────────────────────────────
  const signAndSavePdf = async (competency: Competency, sigUrl: string) => {
    const { data: blob, error } = await supabase.storage
      .from('competency-filled')
      .download(competency.file_name)
    if (error || !blob) throw new Error('Could not download PDF')

    const arrayBuffer = await blob.arrayBuffer()
    const pdfDoc = await PDFDocument.load(arrayBuffer)

    const sigRes = await fetch(sigUrl)
    const sigBytes = new Uint8Array(await sigRes.arrayBuffer())
    const sigImage = await pdfDoc.embedPng(sigBytes)

    const firstPage = pdfDoc.getPages()[0]
    const { width, height } = firstPage.getSize()

    firstPage.drawImage(sigImage, {
      x: width * 0.52,
      y: height * 0.043,
      width: 120,
      height: 28,
    })

    const pdfBytes = await pdfDoc.save()

    const signedPath = `${nurse.nurse_id}/${competency.file_name}`
    const { error: uploadError } = await supabase.storage
      .from('competency-signed')
      .upload(signedPath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      })
    if (uploadError) throw uploadError
  }

  // ─── Mark done in DB ──────────────────────────────────────────────────────────
  const markCompetencyDone = async (competencyId: number, competency: Competency) => {
    const signedPath = `${nurse.nurse_id}/${competency.file_name}`
    await supabase.from('nurse_competencies').upsert({
      nurse_id: nurse.nurse_id,
      competency_id: competencyId,
      signed_pdf_path: signedPath,
    })
    setCompletedIds(prev => [...prev, competencyId])
  }

  // ─── Download signed PDF ──────────────────────────────────────────────────────
  const handleDownload = async (competency: Competency) => {
    setDownloadingId(competency.id)
    try {
      const signedPath = `${nurse.nurse_id}/${competency.file_name}`
      const { data, error } = await supabase.storage
        .from('competency-signed')
        .download(signedPath)
      if (error || !data) throw new Error('Could not download file')

      // Trigger browser download
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${competency.name}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      alert('Download failed: ' + err.message)
    }
    setDownloadingId(null)
  }

  // ─── Advance to next competency ───────────────────────────────────────────────
  const advance = () => {
    const nextIndex = currentIndex + 1
    if (nextIndex >= competencies.length) {
      setAllDone(true)
    } else {
      setCurrentIndex(nextIndex)
    }
  }

  // ─── Logout ───────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ─── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-xl text-gray-600">
        Loading your competencies...
      </div>
    )
  }

  // ─── All done screen ──────────────────────────────────────────────────────────
  if (allDone) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-10 max-w-lg w-full text-center">
          <div className="text-7xl mb-4">🎉</div>
          <h1 className="text-3xl font-bold text-green-700 mb-2">All Done!</h1>
          <p className="text-gray-600 mb-1">
            You have successfully completed all {competencies.length} competencies.
          </p>
          <p className="text-gray-400 text-sm mb-8">
            Completed on {new Date().toLocaleDateString('en-GB')}
          </p>

          {/* Signed documents list */}
          <div className="bg-gray-50 rounded-2xl p-4 mb-6 text-left space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Your Signed Documents
            </p>
            {competencies.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between bg-white rounded-xl px-4 py-3 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="text-green-500 text-lg">✓</span>
                  <span className="text-sm text-gray-700 font-medium">{c.name}</span>
                </div>
                <button
                  onClick={() => handleDownload(c)}
                  disabled={downloadingId === c.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-medium rounded-lg disabled:opacity-50 transition"
                >
                  {downloadingId === c.id ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Downloading...
                    </>
                  ) : (
                    <>
                      ⬇️ Download
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={handleLogout}
            className="w-full py-3 bg-gray-800 text-white rounded-2xl font-medium hover:bg-gray-900"
          >
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  const currentComp = competencies[currentIndex]
  const isFirst = currentIndex === 0
  const progress = Math.round((completedIds.length / competencies.length) * 100)

  // ─── Main UI ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Nursing Competencies 2026</h1>
          <p className="text-sm text-gray-500">{nurse?.staff_name} · {nurse?.department}</p>
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 text-sm bg-red-50 text-red-600 rounded-xl hover:bg-red-100"
        >
          Logout
        </button>
      </div>

      {/* Progress bar */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center justify-between text-sm text-gray-500 mb-1">
          <span>Progress</span>
          <span>{completedIds.length} / {competencies.length} completed</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">

        {/* PDF Viewer */}
        <div className="bg-white rounded-3xl shadow-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full">
              {currentIndex + 1} of {competencies.length}
            </span>
            <h2 className="text-sm font-semibold text-gray-700 truncate">{currentComp?.name}</h2>
          </div>
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-[520px] md:h-[680px] border rounded-2xl"
              title="Competency PDF"
            />
          ) : (
            <div className="w-full h-96 flex items-center justify-center text-gray-400">
              Loading PDF...
            </div>
          )}
        </div>

        {/* Action Panel */}
        <div className="bg-white rounded-3xl shadow-lg p-8 flex flex-col justify-center">

          {/* COMPETENCY #1 — Draw signature */}
          {isFirst && (
            <div className="text-center">
              <div className="text-5xl mb-4">✍️</div>
              <h2 className="text-2xl font-bold mb-2">Sign this competency</h2>
              <p className="text-gray-500 mb-6 text-sm">
                Please review the document, then draw your signature below.
                Your signature will be saved and reused for all other competencies.
              </p>

              {!showCanvas ? (
                <button
                  onClick={() => setShowCanvas(true)}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white text-lg font-medium rounded-2xl"
                >
                  Draw My Signature
                </button>
              ) : (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Draw your signature below:</p>
                  <canvas
                    ref={canvasRef}
                    className="w-full border-2 border-gray-300 rounded-2xl touch-none bg-white"
                    style={{ height: '160px' }}
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={stopDraw}
                    onMouseLeave={stopDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={stopDraw}
                  />
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={clearCanvas}
                      className="flex-1 py-3 border border-gray-300 text-gray-600 rounded-2xl hover:bg-gray-50"
                    >
                      Clear
                    </button>
                    <button
                      onClick={handleSign}
                      disabled={isSigning}
                      className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-2xl disabled:opacity-50"
                    >
                      {isSigning ? 'Saving...' : 'Confirm & Sign'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* COMPETENCY #2+ — Tick & validate */}
          {!isFirst && (
            <div className="text-center">
              <div className="text-5xl mb-4">📋</div>
              <h2 className="text-2xl font-bold mb-2">Acknowledge & Sign</h2>
              <p className="text-gray-500 mb-8 text-sm">
                Please review the document carefully, then tick the box below to confirm
                your acknowledgement. Your saved signature will be applied automatically.
              </p>

              <label className="flex items-start gap-3 cursor-pointer bg-gray-50 rounded-2xl p-4 mb-6 text-left hover:bg-gray-100 transition">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={e => setChecked(e.target.checked)}
                  className="mt-1 w-5 h-5 accent-blue-600 flex-shrink-0"
                />
                <span className="text-sm text-gray-700">
                  I have reviewed this competency document and acknowledge it with my digital signature.
                </span>
              </label>

              {signatureDataUrl && (
                <div className="mb-6 border rounded-2xl p-3 bg-gray-50">
                  <p className="text-xs text-gray-400 mb-2">Your saved signature:</p>
                  <img
                    src={signatureDataUrl}
                    alt="Saved signature"
                    className="h-12 mx-auto"
                  />
                </div>
              )}

              <button
                onClick={handleValidate}
                disabled={!checked || validating || !signatureDataUrl}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white text-lg font-medium rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {validating ? 'Saving...' : 'Validate & Continue'}
              </button>

              {!signatureDataUrl && (
                <p className="text-xs text-red-400 mt-3">
                  No signature found. Please complete competency #1 first.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}