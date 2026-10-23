'use client'

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { ApiError, apiRequest, getToken, setToken } from '@/lib/api'
import { Button } from '@/components/ui/button'

type LoginResponse = {
  success: boolean
  token: string
  user: { mustChangePassword?: boolean }
}

type Screen = 'checking' | 'login' | 'change-password' | 'app'

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900'

export function AuthGate({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<Screen>('checking')

  useEffect(() => {
    let cancelled = false

    async function verifySession() {
      if (!getToken()) {
        setScreen('login')
        return
      }

      try {
        // জমে থাকা token এখনো বৈধ কিনা সার্ভার থেকে যাচাই করা হচ্ছে
        await apiRequest('/auth/me')
        if (!cancelled) setScreen('app')
      } catch {
        if (!cancelled) setScreen('login')
      }
    }

    verifySession()

    return () => {
      cancelled = true
    }
  }, [])

  if (screen === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-sm text-gray-500">
        সার্ভার যাচাই করা হচ্ছে... প্রথমবার ৫০ সেকেন্ড পর্যন্ত লাগতে পারে।
      </div>
    )
  }

  if (screen === 'login') {
    return (
      <LoginForm
        onSuccess={(mustChangePassword) =>
          setScreen(mustChangePassword ? 'change-password' : 'app')
        }
      />
    )
  }

  if (screen === 'change-password') {
    return <ChangePasswordForm onSuccess={() => setScreen('app')} />
  }

  return <>{children}</>
}

function LoginForm({ onSuccess }: { onSuccess: (mustChangePassword: boolean) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const response = await apiRequest<LoginResponse>('/auth/login', {
        method: 'POST',
        body: { email, password },
      })
      setToken(response.token)
      onSuccess(response.user.mustChangePassword === true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন।')
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow"
      >
        <div>
          <h1 className="text-xl font-semibold text-gray-900">StockPilot-এ প্রবেশ</h1>
          <p className="text-sm text-gray-500">আপনার email ও password দিন</p>
        </div>

        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'প্রবেশ করা হচ্ছে...' : 'প্রবেশ করুন'}
        </Button>
      </form>
    </div>
  )
}

function ChangePasswordForm({ onSuccess }: { onSuccess: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (newPassword.length < 8) {
      setError('নতুন password কমপক্ষে ৮ অক্ষরের হতে হবে।')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('দুটো নতুন password মিলছে না।')
      return
    }

    setSubmitting(true)

    try {
      await apiRequest('/users/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      })
      onSuccess()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন।')
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow"
      >
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Password বদলান</h1>
          <p className="text-sm text-gray-500">
            প্রথমবার প্রবেশের জন্য নতুন password ঠিক করা প্রয়োজন।
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="current" className="text-sm font-medium text-gray-700">
            বর্তমান password
          </label>
          <input
            id="current"
            type="password"
            required
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className={inputClass}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="new" className="text-sm font-medium text-gray-700">
            নতুন password
          </label>
          <input
            id="new"
            type="password"
            required
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className={inputClass}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="confirm" className="text-sm font-medium text-gray-700">
            নতুন password আবার লিখুন
          </label>
          <input
            id="confirm"
            type="password"
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className={inputClass}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'সংরক্ষণ করা হচ্ছে...' : 'Password সংরক্ষণ করুন'}
        </Button>
      </form>
    </div>
  )
}
