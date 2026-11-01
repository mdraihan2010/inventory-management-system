const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ||
  'http://localhost:5000/api/v1'

const TOKEN_KEY = 'inventory_token'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.sessionStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  window.sessionStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  window.sessionStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH'
  body?: unknown
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const token = getToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
  } catch {
    throw new ApiError('Cannot reach the server. Please check your connection and try again.', 0)
  }

  const data = await response.json().catch(() => null)

  // If the token has expired or is invalid, the saved token is removed
  if (response.status === 401 && token) {
    clearToken()
  }

  if (!response.ok) {
    const message = data?.message || `Request failed with status ${response.status}`
    throw new ApiError(message, response.status)
  }

  return data as T
}

// Loads every page of a list endpoint (products, sales, purchases) and joins them together.
// The server returns at most 100 records per request, so each page is requested in turn
export async function apiRequestAll<T>(path: string): Promise<T[]> {
  const separator = path.includes('?') ? '&' : '?'
  const rows: T[] = []
  let page = 1
  let totalPages = 1

  do {
    const response = await apiRequest<{ data: T[]; totalPages?: number }>(
      `${path}${separator}page=${page}&limit=100`
    )
    rows.push(...response.data)
    totalPages = response.totalPages ?? 1
    page += 1
  } while (page <= totalPages)

  return rows
}
