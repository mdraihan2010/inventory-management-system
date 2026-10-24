'use client'

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Boxes, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react'
import { ApiError, apiRequest, getToken, setToken } from '@/lib/api'
import { Button } from '@/components/ui/button'

type LoginResponse = {
  success: boolean
  token: string
  user: { mustChangePassword?: boolean }
}

type Screen = 'checking' | 'login' | 'change-password' | 'app'

const WAKE_UP_MESSAGE = 'সার্ভার জাগানো হচ্ছে। প্রথমবার ২-৩ মিনিট পর্যন্ত লাগতে পারে, অনুগ্রহ করে অপেক্ষা করুন।'

const inputClass =
  'block w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15'

export function AuthGate({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<Screen>('checking')
  const [slowCheck, setSlowCheck] = useState(false)

  useEffect(() => {
    let cancelled = false

    // তিন সেকেন্ডের বেশি লাগলে ব্যবহারকারীকে জানানো হয় যে সার্ভার জাগছে
    const slowTimer = setTimeout(() => {
      if (!cancelled) setSlowCheck(true)
    }, 3000)

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
      clearTimeout(slowTimer)
    }
  }, [])

  if (screen === 'checking') {
    return (
      <AuthShell title="যাচাই করা হচ্ছে" subtitle="আপনার সেশন দেখা হচ্ছে">
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <Loader2 className="size-5 animate-spin text-blue-600" />
          <span>{slowCheck ? WAKE_UP_MESSAGE : 'সার্ভার যাচাই করা হচ্ছে...'}</span>
        </div>
      </AuthShell>
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

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-100 p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30">
            <Boxes className="size-7" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900">StockPilot</h1>
          <p className="text-sm text-gray-500">Inventory Suite</p>
        </div>

        <div className="rounded-2xl border border-white bg-white p-8 shadow-xl shadow-slate-300/40">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
          </div>
          {children}
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">ইনভেন্টরি ও বিক্রি ব্যবস্থাপনা</p>
      </div>
    </div>
  )
}

function Field({ id, label, icon, children }: { id: string; label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">{icon}</span>
        {children}
      </div>
    </div>
  )
}

function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  placeholder,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  autoComplete: string
  placeholder?: string
}) {
  const [visible, setVisible] = useState(false)

  return (
    <>
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        required
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass + ' pr-10'}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Password লুকান' : 'Password দেখুন'}
        className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{message}</div>
  )
}

function LoginForm({ onSuccess }: { onSuccess: (mustChangePassword: boolean) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [slow, setSlow] = useState(false)

  // অনুরোধ তিন সেকেন্ডের বেশি চললে সার্ভার জাগার বার্তা দেখানো হয়
  useEffect(() => {
    if (!submitting) {
      setSlow(false)
      return
    }
    const timer = setTimeout(() => setSlow(true), 3000)
    return () => clearTimeout(timer)
  }, [submitting])

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
    <AuthShell title="স্বাগতম" subtitle="আপনার email ও password দিয়ে প্রবেশ করুন">
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field id="email" label="Email" icon={<Mail className="size-4" />}>
          <input
            id="email"
            type="email"
            required
            value={email}
            autoComplete="email"
            placeholder="name@example.com"
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
          />
        </Field>

        <Field id="password" label="Password" icon={<Lock className="size-4" />}>
          <PasswordInput
            id="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            placeholder="••••••••"
          />
        </Field>

        {error && <ErrorBox message={error} />}

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              প্রবেশ করা হচ্ছে...
            </>
          ) : (
            'প্রবেশ করুন'
          )}
        </Button>

        {submitting && slow && (
          <p className="rounded-lg bg-blue-50 px-3 py-2.5 text-xs text-blue-800">{WAKE_UP_MESSAGE}</p>
        )}
      </form>
    </AuthShell>
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
    <AuthShell title="Password বদলান" subtitle="প্রথমবার প্রবেশের জন্য নতুন password ঠিক করা প্রয়োজন">
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field id="current" label="বর্তমান password" icon={<Lock className="size-4" />}>
          <PasswordInput
            id="current"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
          />
        </Field>

        <Field id="new" label="নতুন password" icon={<Lock className="size-4" />}>
          <PasswordInput
            id="new"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
          />
        </Field>

        <Field id="confirm" label="নতুন password আবার লিখুন" icon={<Lock className="size-4" />}>
          <PasswordInput
            id="confirm"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
          />
        </Field>

        {error && <ErrorBox message={error} />}

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              সংরক্ষণ করা হচ্ছে...
            </>
          ) : (
            'Password সংরক্ষণ করুন'
          )}
        </Button>
      </form>
    </AuthShell>
  )
}
