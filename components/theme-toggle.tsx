'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

const STORAGE_KEY = 'stockpilot-theme'

// Light ও Dark mode-এর টোগল। পছন্দ browser-এ সংরক্ষিত থাকে
export function ThemeToggle({ className = '' }: { className?: string }) {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  function toggle() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light')
    } catch {
      // localStorage না থাকলে শুধু এই পাতায় কাজ করবে
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Light mode চালু করুন' : 'Dark mode চালু করুন'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className={`flex size-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 shadow-sm transition hover:bg-gray-50 ${className}`}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  )
}
