export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  let response: Response
  try {
    response = await fetch(path, { ...options, headers, credentials: 'same-origin' })
  } catch {
    throw new ApiError('Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.', 0)
  }

  const contentType = response.headers.get('content-type') || ''
  const data: unknown = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : null

  if (!response.ok) {
    const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
      ? data.error
      : response.status === 401
        ? 'Sesi Anda telah berakhir. Silakan masuk kembali.'
        : 'Permintaan gagal. Silakan coba lagi.'
    throw new ApiError(message, response.status)
  }

  return data as T
}
