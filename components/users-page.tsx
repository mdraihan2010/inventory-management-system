'use client'
import { rowAction } from '@/components/ui/row-action'

import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { Plus, X } from 'lucide-react'
import { ApiError, apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { EditProfileModal, ResetPasswordModal } from '@/components/user-admin-modals'

type Role = 'ADMINISTRATOR' | 'MANAGER' | 'STAFF'

type AppUser = {
  _id: string
  name: string
  email: string
  role: Role
  isActive: boolean
  mustChangePassword: boolean
}

type UsersResponse = { success: boolean; count: number; data: AppUser[] }
type MeResponse = { success: boolean; user: { _id: string } }

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'ADMINISTRATOR', label: 'প্রশাসক (Administrator)' },
  { value: 'MANAGER', label: 'ম্যানেজার (Manager)' },
  { value: 'STAFF', label: 'স্টাফ (Staff)' },
]

const ROLE_LABEL: Record<Role, string> = {
  ADMINISTRATOR: 'প্রশাসক',
  MANAGER: 'ম্যানেজার',
  STAFF: 'স্টাফ',
}

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900'

const buttonClass =
  'rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-40'

export function UsersPage({ isAdmin }: { isAdmin: boolean }) {
  if (!isAdmin) {
    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">Workspace / User Management</p>
            <h1>ব্যবহারকারী ব্যবস্থাপনা</h1>
          </div>
        </div>
        <section className="panel table-panel">
          <p className="p-6 text-sm text-gray-600">ব্যবহারকারী ব্যবস্থাপনা শুধু Administrator করতে পারবেন।</p>
        </section>
      </>
    )
  }

  return <UsersManager />
}

function UsersManager() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [myId, setMyId] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<AppUser | null>(null)
  const [resetting, setResetting] = useState<AppUser | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await apiRequest<UsersResponse>('/users')
      setUsers(response.data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ব্যবহারকারীর তালিকা আনা যায়নি।')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUsers()
    apiRequest<MeResponse>('/auth/me')
      .then((response) => setMyId(response.user._id))
      .catch(() => setMyId(''))
  }, [loadUsers])

  const query = search.trim().toLowerCase()
  const visible = query
    ? users.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(query))
    : users

  const activeCount = users.filter((user) => user.isActive).length
  const adminCount = users.filter((user) => user.role === 'ADMINISTRATOR').length

  async function changeRole(user: AppUser, role: Role) {
    if (role === user.role) return
    if (!window.confirm(`"${user.name}"-এর ভূমিকা "${ROLE_LABEL[role]}" করতে চান?`)) return

    setError('')
    setNotice('')
    setBusyId(user._id)

    try {
      await apiRequest(`/users/${user._id}`, { method: 'PATCH', body: { role } })
      setNotice(`${user.name}-এর ভূমিকা "${ROLE_LABEL[role]}" করা হয়েছে।`)
      loadUsers()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ভূমিকা বদলানো যায়নি।')
    } finally {
      setBusyId(null)
    }
  }

  async function toggleActive(user: AppUser) {
    const action = user.isActive ? 'বন্ধ' : 'চালু'
    const extra = user.isActive ? ' বন্ধ করলে সে আর প্রবেশ করতে পারবে না।' : ''
    if (!window.confirm(`"${user.name}"-কে ${action} করতে চান?${extra}`)) return

    setError('')
    setNotice('')
    setBusyId(user._id)

    try {
      await apiRequest(`/users/${user._id}`, {
        method: 'PATCH',
        body: { isActive: !user.isActive },
      })
      setNotice(`${user.name} ${action} করা হয়েছে।`)
      loadUsers()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'পরিবর্তন সংরক্ষণ করা যায়নি।')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Workspace / User Management</p>
          <h1>ব্যবহারকারী ব্যবস্থাপনা</h1>
          <p className="subheading">ব্যবহারকারী যোগ, ভূমিকা নির্ধারণ ও প্রবেশাধিকার নিয়ন্ত্রণ।</p>
        </div>
        <button className="primary-button" onClick={() => setCreating(true)}>
          <Plus /> নতুন ব্যবহারকারী
        </button>
      </div>

      <div className="section-stat-row">
        <div className="small-stat">
          <span>মোট ব্যবহারকারী</span>
          <strong>{users.length}</strong>
          <small>সব ভূমিকা মিলিয়ে</small>
        </div>
        <div className="small-stat">
          <span>সক্রিয়</span>
          <strong>{activeCount}</strong>
          <small>এখন প্রবেশ করতে পারবে</small>
        </div>
        <div className="small-stat">
          <span>প্রশাসক</span>
          <strong>{adminCount}</strong>
          <small>সর্বোচ্চ অনুমতি</small>
        </div>
      </div>

      {notice && <p className="px-1 text-sm text-green-700">{notice}</p>}

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="table-title">
            <h2>ব্যবহারকারীর তালিকা</h2>
            <span>{visible.length} জন</span>
          </div>
          <div className="toolbar-actions">
            <input
              className={inputClass + ' max-w-xs'}
              placeholder="নাম বা email খুঁজুন..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        {error && <p className="px-4 pb-2 text-sm text-red-600">{error}</p>}

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>নাম</th>
                <th>Email</th>
                <th>ভূমিকা</th>
                <th>অবস্থা</th>
                <th>কাজ</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5}>লোড হচ্ছে...</td></tr>}
              {!loading && visible.length === 0 && <tr><td colSpan={5}>কোনো ব্যবহারকারী পাওয়া যায়নি।</td></tr>}
              {!loading && visible.map((user) => {
                const isSelf = user._id === myId
                return (
                  <tr key={user._id}>
                    <td>
                      <strong>{user.name}</strong>
                      {isSelf && <span className="ml-2 text-xs text-gray-500">(আপনি)</span>}
                    </td>
                    <td>{user.email}</td>
                    <td>
                      {isSelf ? (
                        <span>{ROLE_LABEL[user.role]}</span>
                      ) : (
                        <select
                          className={inputClass + ' max-w-[12rem] bg-white'}
                          value={user.role}
                          disabled={busyId === user._id}
                          onChange={(event) => changeRole(user, event.target.value as Role)}
                        >
                          {ROLE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td>
                      <span className={`status ${user.isActive ? 'in-stock' : 'out-of-stock'}`}>
                        {user.isActive ? 'সক্রিয়' : 'বন্ধ'}
                      </span>
                      {user.mustChangePassword && (
                        <p className="mt-1 text-xs text-gray-500">প্রথম প্রবেশে password বদলাবে</p>
                      )}
                    </td>
                    <td>
                      {isSelf ? (
                        <span className="text-xs text-gray-400">—</span>
                      ) : (
<div className="flex flex-wrap gap-1">
<button className={rowAction.edit} onClick={() => setEditing(user)}>সম্পাদনা</button>
<button className={rowAction.history} onClick={() => setResetting(user)}>পাসওয়ার্ড রিসেট</button>
<button className={user.isActive ? rowAction.danger : rowAction.success}
                          disabled={busyId === user._id}
                          onClick={() => toggleActive(user)}
                        >
                          {user.isActive ? 'বন্ধ করুন' : 'চালু করুন'}
                        </button>
</div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <EditProfileModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null)
            setNotice(message)
            loadUsers()
          }}
        />
      )}
      {resetting && (
        <ResetPasswordModal
          user={resetting}
          onClose={() => setResetting(null)}
          onSaved={(message) => {
            setResetting(null)
            setNotice(message)
          }}
        />
      )}

      {creating && (
        <NewUserModal
          onClose={() => setCreating(false)}
          onCreated={(name) => {
            setCreating(false)
            setNotice(`${name} যোগ করা হয়েছে। সে প্রথম প্রবেশে password বদলাবে।`)
            loadUsers()
          }}
        />
      )}
    </>
  )
}

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

function NewUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: (name: string) => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('STAFF')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')

    if (!name.trim()) {
      setFormError('নাম লিখুন।')
      return
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setFormError('ইমেইল সঠিক ফরম্যাটে লিখুন, যেমন name@example.com।')
      return
    }
    if (password.length < 8) {
      setFormError('Password কমপক্ষে ৮ অক্ষরের হতে হবে।')
      return
    }

    setSaving(true)
    try {
      await apiRequest('/users', {
        method: 'POST',
        body: { name: name.trim(), email: email.trim(), password, role },
      })
      onCreated(name.trim())
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFormError('এই email দিয়ে আগে একজন ব্যবহারকারী আছে।')
      } else {
        setFormError(err instanceof ApiError ? err.message : 'ব্যবহারকারী যোগ করা যায়নি।')
      }
      setSaving(false)
    }
  }

  return (
    <ModalShell title="নতুন ব্যবহারকারী" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">নাম *</span>
          <input className={inputClass} value={name} onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)} />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Email *</span>
          <input type="email" className={inputClass} value={email} onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)} />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">প্রাথমিক Password *</span>
          <input type="password" className={inputClass} value={password} onChange={(event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)} />
          <span className="text-xs text-gray-500">নতুন ব্যবহারকারী প্রথম প্রবেশের সময় নিজের password বদলাতে বাধ্য হবে।</span>
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">ভূমিকা *</span>
          <select className={inputClass + ' bg-white'} value={role} onChange={(event) => setRole(event.target.value as Role)}>
            {ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm">
            বাতিল
          </button>
          <Button type="submit" disabled={saving}>
            {saving ? 'যোগ করা হচ্ছে...' : 'ব্যবহারকারী যোগ করুন'}
          </Button>
        </div>
      </form>
    </ModalShell>
  )
}
