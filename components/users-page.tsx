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
  { value: 'ADMINISTRATOR', label: 'Administrator' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'STAFF', label: 'Staff' },
]

const ROLE_LABEL: Record<Role, string> = {
  ADMINISTRATOR: 'Administrator',
  MANAGER: 'Manager',
  STAFF: 'Staff',
}

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900'

export function UsersPage({ isAdmin }: { isAdmin: boolean }) {
  if (!isAdmin) {
    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">Workspace / User Management</p>
            <h1>User Management</h1>
          </div>
        </div>
        <section className="panel table-panel">
          <p className="p-6 text-sm text-gray-600">Only administrators can manage users.</p>
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
      setError(err instanceof ApiError ? err.message : 'Could not load the user list.')
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
    if (!window.confirm(`Change the role of "${user.name}" to "${ROLE_LABEL[role]}"?`)) return

    setError('')
    setNotice('')
    setBusyId(user._id)

    try {
      await apiRequest(`/users/${user._id}`, { method: 'PATCH', body: { role } })
      setNotice(`${user.name}'s role has been changed to "${ROLE_LABEL[role]}".`)
      loadUsers()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change the role.')
    } finally {
      setBusyId(null)
    }
  }

  async function toggleActive(user: AppUser) {
    const action = user.isActive ? 'deactivate' : 'activate'
    const extra = user.isActive ? ' If deactivated, they will not be able to sign in.' : ''
    if (!window.confirm(`Do you want to ${action} "${user.name}"?${extra}`)) return

    setError('')
    setNotice('')
    setBusyId(user._id)

    try {
      await apiRequest(`/users/${user._id}`, {
        method: 'PATCH',
        body: { isActive: !user.isActive },
      })
      setNotice(`${user.name} has been ${user.isActive ? 'deactivated' : 'activated'}.`)
      loadUsers()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the change.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Workspace / User Management</p>
          <h1>User Management</h1>
          <p className="subheading">Add users, assign roles and control access.</p>
        </div>
        <button className="primary-button" onClick={() => setCreating(true)}>
          <Plus /> New user
        </button>
      </div>

      <div className="section-stat-row">
        <div className="small-stat">
          <span>Total users</span>
          <strong>{users.length}</strong>
          <small>All roles combined</small>
        </div>
        <div className="small-stat">
          <span>Active</span>
          <strong>{activeCount}</strong>
          <small>Can sign in now</small>
        </div>
        <div className="small-stat">
          <span>Administrators</span>
          <strong>{adminCount}</strong>
          <small>Highest access</small>
        </div>
      </div>

      {notice && <p className="px-1 text-sm text-green-700">{notice}</p>}

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="table-title">
            <h2>User list</h2>
            <span>{visible.length} people</span>
          </div>
          <div className="toolbar-actions">
            <input
              className={inputClass + ' max-w-xs'}
              placeholder="Search by name or email..."
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
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5}>Loading...</td></tr>}
              {!loading && visible.length === 0 && <tr><td colSpan={5}>No users found.</td></tr>}
              {!loading && visible.map((user) => {
                const isSelf = user._id === myId
                return (
                  <tr key={user._id}>
                    <td>
                      <strong>{user.name}</strong>
                      {isSelf && <span className="ml-2 text-xs text-gray-500">(you)</span>}
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
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {user.mustChangePassword && (
                        <p className="mt-1 text-xs text-gray-500">Must change password at first sign-in</p>
                      )}
                    </td>
                    <td>
                      {isSelf ? (
                        <span className="text-xs text-gray-400">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          <button className={rowAction.edit} onClick={() => setEditing(user)}>Edit</button>
                          <button className={rowAction.history} onClick={() => setResetting(user)}>Reset password</button>
                          <button
                            className={user.isActive ? rowAction.danger : rowAction.success}
                            disabled={busyId === user._id}
                            onClick={() => toggleActive(user)}
                          >
                            {user.isActive ? 'Deactivate' : 'Activate'}
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
            setNotice(`${name} added. They must change their password at first sign-in.`)
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
      setFormError('Enter the name.')
      return
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setFormError('Enter the email in a valid format, for example name@example.com.')
      return
    }
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters.')
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
        setFormError('A user with this email already exists.')
      } else {
        setFormError(err instanceof ApiError ? err.message : 'Could not add the user.')
      }
      setSaving(false)
    }
  }

  return (
    <ModalShell title="New user" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Name *</span>
          <input className={inputClass} value={name} onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)} />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Email *</span>
          <input type="email" className={inputClass} value={email} onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)} />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Initial password *</span>
          <input type="password" className={inputClass} value={password} onChange={(event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)} />
          <span className="text-xs text-gray-500">The new user must change their password at first sign-in.</span>
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Role *</span>
          <select className={inputClass + ' bg-white'} value={role} onChange={(event) => setRole(event.target.value as Role)}>
            {ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm">
            Cancel
          </button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Adding...' : 'Add user'}
          </Button>
        </div>
      </form>
    </ModalShell>
  )
}
