'use client'
import { useEffect, useRef } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

export default function MathText({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    // Replace $$...$$ with rendered block math
    // Replace $...$ with rendered inline math
    const html = text
      .replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
        try {
          return katex.renderToString(math, { displayMode: true, throwOnError: false })
        } catch { return _ }
      })
      .replace(/\$([^\$]+?)\$/g, (_, math) => {
        try {
          return katex.renderToString(math, { displayMode: false, throwOnError: false })
        } catch { return _ }
      })
    ref.current.innerHTML = html
  }, [text])

  return <div ref={ref} className="whitespace-pre-wrap text-sm text-gray-700" />
}