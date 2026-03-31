// app/dashboard/page.tsx
'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const DOCUMENT_NAME = "Nursing General Competencies 2026-compressed.pdf"

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [documentUrl, setDocumentUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSignModal, setShowSignModal] = useState(false)
  const [signed, setSigned] = useState(false)

  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const isDrawing = useRef(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(DOCUMENT_NAME)

      setDocumentUrl(publicUrl)
      setLoading(false)
    }
    init()
  }, [router])

  // Setup canvas when modal opens
  useEffect(() => {
    if (showSignModal && canvasRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (ctx) {
        const width = Math.min(620, window.innerWidth - 40)
        canvas.width = width
        canvas.height = 300

        ctx.lineWidth = 6
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.strokeStyle = '#1f2937'
        ctxRef.current = ctx
      }
    }
  }, [showSignModal])

  const startDrawing = (e: any) => {
    isDrawing.current = true
    draw(e)
  }

  const stopDrawing = () => {
    isDrawing.current = false
  }

  const draw = (e: any) => {
    if (!isDrawing.current || !ctxRef.current || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = ctxRef.current
    const rect = canvas.getBoundingClientRect()

    let x, y
    if (e.touches) {
      x = e.touches[0].clientX - rect.left
      y = e.touches[0].clientY - rect.top
    } else {
      x = e.clientX - rect.left
      y = e.clientY - rect.top
    }

    ctx.lineTo(x, y)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const clearSignature = () => {
    if (ctxRef.current && canvasRef.current) {
      ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    }
  }

  const handleCompleteSign = () => {
    setSigned(true)
    setShowSignModal(false)
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-xl">Loading document...</div>
  }

  if (signed) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md text-center">
          <div className="text-7xl mb-6">✅</div>
          <h1 className="text-3xl font-bold text-green-700 mb-4">Document Signed!</h1>
          <p className="text-gray-600 mb-8">
            You have successfully signed the Nursing General Competencies 2026 document.<br />
            Signed on {new Date().toLocaleDateString()}
          </p>
          <button
            onClick={() => {
              setSigned(false)
              clearSignature()
            }}
            className="w-full py-4 bg-green-600 text-white rounded-2xl font-medium hover:bg-green-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Nursing General Competencies 2026</h1>
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              router.push('/login')
            }}
            className="px-5 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700"
          >
            Logout
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Document Preview */}
          <div className="bg-white rounded-3xl shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Review Document</h2>
            {documentUrl ? (
              <iframe
                src={documentUrl}
                className="w-full h-[520px] md:h-[680px] border rounded-2xl"
                title="Document"
              />
            ) : (
              <p className="text-red-500 p-8 text-center">Could not load document</p>
            )}
          </div>

          {/* Sign Button Area */}
          <div className="bg-white rounded-3xl shadow-lg p-10 flex flex-col items-center justify-center min-h-[400px]">
            <div className="text-center mb-10">
              <div className="text-6xl mb-6">✍️</div>
              <h2 className="text-2xl font-semibold mb-3">Ready to Sign?</h2>
              <p className="text-gray-600 max-w-xs">Click below to open the signature pad in a clean area</p>
            </div>

            <button
              onClick={() => setShowSignModal(true)}
              className="w-full max-w-xs py-4 bg-blue-600 hover:bg-blue-700 text-white text-lg font-medium rounded-2xl transition active:scale-95"
            >
              Sign Document
            </button>
          </div>
        </div>
      </div>

      {/* Signature Modal - Static & Clean */}
      {showSignModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-xl font-semibold">Draw Your Signature</h3>
              <button 
                onClick={() => setShowSignModal(false)}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                ✕
              </button>
            </div>

            <div className="p-6 bg-gray-50">
              <canvas
                ref={canvasRef}
                className="w-full border border-gray-300 rounded-2xl bg-white touch-none shadow-inner"
                onMouseDown={startDrawing}
                onMouseUp={stopDrawing}
                onMouseMove={draw}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchEnd={stopDrawing}
                onTouchMove={draw}
              />
            </div>

            <div className="p-6 flex gap-3 border-t">
              <button
                onClick={clearSignature}
                className="flex-1 py-3.5 border border-gray-400 rounded-2xl font-medium active:bg-gray-100"
              >
                Clear
              </button>
              <button
                onClick={handleCompleteSign}
                className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-medium active:bg-blue-700"
              >
                Complete Signing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}