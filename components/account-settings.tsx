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
  return err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'
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
          <h2 className="text-lg font-semibold text-gray-900">My account</h2>
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
      setMessage({ tone: 'error', text: 'Enter the email in a valid format, for example name@example.com.' })
      return
    }
    if (email === currentEmail.toLowerCase()) {
      setMessage({ tone: 'error', text: 'This is already your current email.' })
      return
    }
    if (!currentPassword) {
      setMessage({ tone: 'error', text: 'Enter your current password.' })
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
      setMessage({ tone: 'ok', text: 'Email changed. Use the new email for your next sign-in.' })
    } catch (err) {
      setMessage({ tone: 'error', text: errorText(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900">Change email</h3>
        <p className="text-sm text-gray-500">Current email: {currentEmail || '—'}</p>
      </div>

      <Field label="New email">
        <input
          type="email"
          className={inputClass}
          value={newEmail}
          onChange={(event) => setNewEmail(event.target.value)}
        />
      </Field>

      <Field label="Current password">
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
          {saving ? 'Saving...' : 'Change email'}
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
      setMessage({ tone: 'error', text: 'Enter your current password.' })
      return
    }
    if (newPassword.length < 8) {
      setMessage({ tone: 'error', text: 'The new password must be at least 8 characters.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage({ tone: 'error', text: 'The two new passwords do not match.' })
      return
    }
    if (newPassword === currentPassword) {
      setMessage({ tone: 'error', text: 'The new password must be different from the current one.' })
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
      setMessage({ tone: 'ok', text: 'Password changed.' })
    } catch (err) {
      setMessage({ tone: 'error', text: errorText(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900">Change password</h3>
        <p className="text-sm text-gray-500">The new password must be at least 8 characters.</p>
      </div>

      <Field label="Current password">
        <input
          type="password"
          className={inputClass}
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
      </Field>

      <Field label="New password">
        <input
          type="password"
          className={inputClass}
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
      </Field>

      <Field label="Confirm new password">
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
          {saving ? 'Saving...' : 'Change password'}
        </Button>
      </div>
    </form>
  )
}
