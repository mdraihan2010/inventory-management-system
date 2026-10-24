'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { ApiError, apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'

type AccountSettingsModalProps = {
  currentEmail: string
  onClose: () => void
  onEmailChanged: (email: string) => void
}

type Message = { tone: 'ok' | 'error'; text: string }

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900'

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/

function errorText(err: unknown): string {
  return err instanceof ApiError ? err.message : 'কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন।'
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  )
}

function MessageBox({ message }: { message: Message | null }) {
  if (!message) return null
  return (
    <p
      className={`rounded-md px-3 py-2 text-sm ${
        message.tone === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
      }`}
    >
      {message.text}
    </p>
  )
}

export function AccountSettingsModal({ currentEmail, onClose, onEmailChanged }: AccountSettingsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg space-y-6 overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">আমার অ্যাকাউন্ট</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-500">
            <X />
          </button>
        </div>

        <EmailSection currentEmail={currentEmail} onChanged={onEmailChanged} />

        <div className="border-t border-gray-200" />

        <PasswordSection />
      </div>
    </div>
  )
}

function EmailSection({ currentEmail, onChanged }: { currentEmail: string; onChanged: (email: string) => void }) {
  const [newEmail, setNewEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)

    const email = newEmail.trim().toLowerCase()

    if (!EMAIL_PATTERN.test(email)) {
      setMessage({ tone: 'error', text: 'ইমেইল সঠিক ফরম্যাটে লিখুন, যেমন name@example.com।' })
      return
    }
    if (email === currentEmail.toLowerCase()) {
      setMessage({ tone: 'error', text: 'এটি আপনার বর্তমান ইমেইল।' })
      return
    }
    if (!currentPassword) {
      setMessage({ tone: 'error', text: 'বর্তমান password দিন।' })
      return
    }

    setSaving(true)
    try {
      await apiRequest('/accounts/change-email', {
        method: 'POST',
        body: { currentPassword, newEmail: email },
      })
      onChanged(email)
      setNewEmail('')
      setCurrentPassword('')
      setMessage({ tone: 'ok', text: 'ইমেইল বদলানো হয়েছে। পরের login এই নতুন ইমেইল দিয়ে করুন।' })
    } catch (err) {
      setMessage({ tone: 'error', text: errorText(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900">ইমেইল বদলান</h3>
        <p className="text-sm text-gray-500">বর্তমান ইমেইল: {currentEmail || '—'}</p>
      </div>

      <Field label="নতুন ইমেইল">
        <input
          type="email"
          className={inputClass}
          value={newEmail}
          onChange={(event) => setNewEmail(event.target.value)}
        />
      </Field>

      <Field label="বর্তমান password">
        <input
          type="password"
          className={inputClass}
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
      </Field>

      <MessageBox message={message} />

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? 'সংরক্ষণ হচ্ছে...' : 'ইমেইল বদলান'}
        </Button>
      </div>
    </form>
  )
}

function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)

    if (!currentPassword) {
      setMessage({ tone: 'error', text: 'বর্তমান password দিন।' })
      return
    }
    if (newPassword.length < 8) {
      setMessage({ tone: 'error', text: 'নতুন password কমপক্ষে ৮ অক্ষরের হতে হবে।' })
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage({ tone: 'error', text: 'দুটো নতুন password মিলছে না।' })
      return
    }
    if (newPassword === currentPassword) {
      setMessage({ tone: 'error', text: 'নতুন password বর্তমানটির থেকে আলাদা হতে হবে।' })
      return
    }

    setSaving(true)
    try {
      await apiRequest('/users/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setMessage({ tone: 'ok', text: 'Password বদলানো হয়েছে।' })
    } catch (err) {
      setMessage({ tone: 'error', text: errorText(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900">Password বদলান</h3>
        <p className="text-sm text-gray-500">নতুন password কমপক্ষে ৮ অক্ষরের হতে হবে।</p>
      </div>

      <Field label="বর্তমান password">
        <input
          type="password"
          className={inputClass}
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
      </Field>

      <Field label="নতুন password">
        <input
          type="password"
          className={inputClass}
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
      </Field>

      <Field label="নতুন password আবার লিখুন">
        <input
          type="password"
          className={inputClass}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      </Field>

      <MessageBox message={message} />

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? 'সংরক্ষণ হচ্ছে...' : 'Password বদলান'}
        </Button>
      </div>
    </form>
  )
}
