'use client'

import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { Pencil, Plus, Power, X } from 'lucide-react'
import { ApiError, apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { rowAction } from '@/components/ui/row-action'
import { CustomerDetailModal, type Customer } from '@/components/customers-modals'

type CustomersResponse = {
  success: boolean
  total?: number
  totalPages?: number
  data: Customer[]
}

type FormState = {
  name: string
  phone: string
  email: string
  address: string
  notes: string
}

const EMPTY_FORM: FormState = {
  name: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
}

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900'

export function CustomersPage({ canManage }: { canManage: boolean }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState<{ customer: Customer | null } | null>(null)
  const [details, setDetails] = useState<Customer | null>(null)

  // Start searching 300 milliseconds after the user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const loadCustomers = useCallback(async () => {
    setLoading(true)
    setError('')

    const params = new URLSearchParams({ page: String(page), limit: '10' })
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim())

    try {
      const response = await apiRequest<CustomersResponse>(`/customers?${params.toString()}`)
      setCustomers(response.data)
      setTotal(response.total ?? response.data.length)
      setTotalPages(Math.max(response.totalPages ?? 1, 1))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the customer list.')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch])

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  async function toggleActive(customer: Customer) {
    const action = customer.isActive ? 'deactivate' : 'activate'
    if (!window.confirm(`Are you sure you want to ${action} customer "${customer.name}"?`)) return

    setError('')
    setNotice('')
    setBusyId(customer._id)

    try {
      await apiRequest(`/customers/${customer._id}`, {
        method: 'PATCH',
        body: { isActive: !customer.isActive },
      })
      setNotice(customer.isActive ? 'Customer deactivated.' : 'Customer activated.')
      loadCustomers()
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
          <p className="eyebrow">Workspace / Customers</p>
          <h1>Customers</h1>
          <p className="subheading">Customer list, contact details and outstanding balances.</p>
        </div>
        <button className="primary-button" onClick={() => setForm({ customer: null })}>
          <Plus /> New customer
        </button>
      </div>

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="table-title">
            <h2>Customer list</h2>
            <span>Total {total}</span>
          </div>
          <div className="toolbar-actions">
            <input
              className={inputClass + ' max-w-xs'}
              placeholder="Search by name, phone or email..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        {notice && <p className="px-4 pb-2 text-sm text-green-700">{notice}</p>}
        {error && <p className="px-4 pb-2 text-sm text-red-600">{error}</p>}

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5}>Loading...</td></tr>}
              {!loading && customers.length === 0 && <tr><td colSpan={5}>No customers found.</td></tr>}
              {!loading && customers.map((customer) => (
                <tr key={customer._id}>
                  <td><strong>{customer.name}</strong></td>
                  <td>{customer.phone || '—'}</td>
                  <td>{customer.email || '—'}</td>
                  <td>
                    <span className={`status ${customer.isActive ? 'in-stock' : 'out-of-stock'}`}>
                      {customer.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <button className={rowAction.view} onClick={() => setDetails(customer)}>Details</button>
                      {canManage && (
                        <>
                          <button className={rowAction.edit} onClick={() => setForm({ customer })}>
                            <Pencil className="inline size-3" /> Edit
                          </button>
                          <button
                            className={customer.isActive ? rowAction.danger : rowAction.success}
                            disabled={busyId === customer._id}
                            onClick={() => toggleActive(customer)}
                          >
                            <Power className="inline size-3" /> {customer.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span>Page {page} / {totalPages}</span>
          <div className="flex gap-2">
            <button className="rounded-md border border-gray-300 px-3 py-1 disabled:opacity-40" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>
              Previous
            </button>
            <button className="rounded-md border border-gray-300 px-3 py-1 disabled:opacity-40" disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)}>
              Next
            </button>
          </div>
        </div>
      </section>

      {form && (
        <CustomerModal
          customer={form.customer}
          onClose={() => setForm(null)}
          onSaved={(message) => {
            setForm(null)
            setNotice(message)
            loadCustomers()
          }}
        />
      )}

      {details && (
        <CustomerDetailModal
          customer={details}
          canManage={canManage}
          onClose={() => setDetails(null)}
          onEdit={() => {
            setForm({ customer: details })
            setDetails(null)
          }}
        />
      )}
    </>
  )
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  )
}

function CustomerModal({
  customer,
  onClose,
  onSaved,
}: {
  customer: Customer | null
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [form, setForm] = useState<FormState>(() =>
    customer
      ? {
          name: customer.name,
          phone: customer.phone ?? '',
          email: customer.email ?? '',
          address: customer.address ?? '',
          notes: customer.notes ?? '',
        }
      : EMPTY_FORM
  )
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  function setField(field: keyof FormState) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value
      setForm((previous) => ({ ...previous, [field]: value }))
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')

    if (!form.name.trim()) {
      setFormError('Enter the customer name.')
      return
    }

    const email = form.email.trim()
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      setFormError('Enter the email in a valid format, for example name@example.com.')
      return
    }

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email,
      address: form.address.trim(),
      notes: form.notes.trim(),
    }

    setSaving(true)
    try {
      if (customer) {
        await apiRequest(`/customers/${customer._id}`, { method: 'PATCH', body: payload })
        onSaved('Customer updated.')
      } else {
        await apiRequest('/customers', { method: 'POST', body: payload })
        onSaved('New customer added.')
      }
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save. Please try again.')
      setSaving(false)
    }
  }

  return (
    <ModalShell title={customer ? 'Edit customer' : 'New customer'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Name *">
          <input className={inputClass} value={form.name} onChange={setField('name')} />
        </Field>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Phone">
            <input className={inputClass} value={form.phone} onChange={setField('phone')} />
          </Field>
          <Field label="Email (optional)">
            <input type="email" className={inputClass} value={form.email} onChange={setField('email')} />
          </Field>
        </div>
        <Field label="Address (optional)">
          <input className={inputClass} value={form.address} onChange={setField('address')} />
        </Field>
        <Field label="Notes (optional)">
          <textarea className={inputClass} rows={2} value={form.notes} onChange={setField('notes')} />
        </Field>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

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
