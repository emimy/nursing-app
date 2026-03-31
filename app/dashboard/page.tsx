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

      // Load document
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(DOCUMENT_NAME)

      setDocumentUrl(publicUrl)
      setLoading(false)

      // Setup canvas for drawing
      if (canvasRef.current) {
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.lineWidth = 4
          ctx.lineCap = 'round'
          ctx.strokeStyle = '#000'
          ctxRef.current = ctx
        }
      }
    }

    init()
  }, [router])

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

    let x = e.clientX - rect.left
    let y = e.clientY - rect.top

    if (e.touches) {
      x = e.touches[0].clientX - rect.left
      y = e.touches[0].clientY - rect.top
    }

    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const clearSignature = () => {
    if (ctxRef.current && canvasRef.current) {
      ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    }
  }

  const handleSign = () => {
    alert(`✅ Document signed successfully by ${user?.email || 'User'}!`)
    clearSignature()
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-xl">Loading your document...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-4xl font-bold">Nursing General Competencies 2026</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">{user?.email}</span>
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                router.push('/login')
              }}
              className="px-6 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Document Preview */}
          <div className="bg-white rounded-3xl shadow-lg p-8">
            <h2 className="text-2xl font-semibold mb-6">Document Preview</h2>
            {documentUrl ? (
              <iframe
                src={documentUrl}
                className="w-full h-[680px] border rounded-2xl"
                title="Nursing Competencies"
              />
            ) : (
              <p className="text-red-500">Could not load document</p>
            )}
          </div>

          {/* Signature Area */}
          <div className="bg-white rounded-3xl shadow-lg p-8">
            <h2 className="text-2xl font-semibold mb-6">Draw Your Signature</h2>
            
            <canvas
              ref={canvasRef}
              width={620}
              height={300}
              className="border border-gray-300 rounded-2xl bg-white touch-none"
              onMouseDown={startDrawing}
              onMouseUp={stopDrawing}
              onMouseMove={draw}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchEnd={stopDrawing}
              onTouchMove={draw}
            />

            <div className="flex gap-4 mt-6">
              <button
                onClick={clearSignature}
                className="flex-1 py-3.5 border border-gray-400 rounded-2xl hover:bg-gray-100 font-medium"
              >
                Clear Signature
              </button>
              <button
                onClick={handleSign}
                className="flex-1 py-3.5 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-medium"
              >
                Sign Document
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}