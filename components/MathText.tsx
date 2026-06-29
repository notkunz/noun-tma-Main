'use client'
import { useEffect, useRef } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

export default function MathText({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    
    let html = text
      // Handle markdown FIRST (before KaTeX, so math isn't affected)
      .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')  // **bold**
      .replace(/\*([^*]+?)\*/g, '<em>$1</em>')              // *italics*
      .replace(/^### (.*?)$/gm, '<h3 class="font-bold text-base mt-3 mb-1">$1</h3>')  // ### heading
      .replace(/^## (.*?)$/gm, '<h2 class="font-bold text-lg mt-4 mb-2">$2</h2>')     // ## heading
      .replace(/\n/g, '<br/>')                               // line breaks
      
      // Then handle KaTeX math
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

  return <div ref={ref} className="prose prose-sm max-w-none text-gray-700" />
}