'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { ApiError, apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'

type ManagedUser = { _id: string; name: string; email: string }

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900'

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-500">
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function EditProfileModal({
  user,
  onClose,
  onSaved,
}: {
  user: ManagedUser
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    const cleanName = name.trim()
    const cleanEmail = email.trim().toLowerCase()

    if (!cleanName) {
      setError('Enter the name.')
      return
    }
    if (!EMAIL_PATTERN.test(cleanEmail)) {
      setError('Enter the email in a valid format, for example name@example.com.')
      return
    }

    const body: { name?: string; email?: string } = {}
    if (cleanName !== user.name) body.name = cleanName
    if (cleanEmail !== user.email) body.email = cleanEmail

    if (Object.keys(body).length === 0) {
      onClose()
      return
    }

    setSaving(true)
    try {
      await apiRequest(`/accounts/${user._id}/profile`, { method: 'PATCH', body })
      onSaved(`${cleanName}'s details have been updated.`)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('This email belongs to another user.')
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not save the details.')
      }
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Edit user details" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Name *</span>
          <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Email *</span>
          <input
            type="email"
            className={inputClass}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm">
            Cancel
          </button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </form>
    </ModalShell>
  )
}

export function ResetPasswordModal({
  user,
  onClose,
  onSaved,
}: {
  user: ManagedUser
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (temporaryPassword.length < 8) {
      setError('Temporary password must be at least 8 characters.')
      return
    }

    setSaving(true)
    try {
      await apiRequest(`/accounts/${user._id}/reset-password`, {
        method: 'POST',
        body: { temporaryPassword },
      })
      onSaved(`A temporary password has been set for ${user.name}. They must change it at next sign-in.`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reset the password.')
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Reset password" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-600">
          Set a temporary password for <strong>{user.name}</strong> ({user.email}). They will be asked to change it at their next sign-in.
        </p>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Temporary password *</span>
          <input
            type="text"
            className={inputClass}
            value={temporaryPassword}
            onChange={(event) => setTemporaryPassword(event.target.value)}
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm">
            Cancel
          </button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Set temporary password'}
          </Button>
        </div>
      </form>
    </ModalShell>
  )
}
