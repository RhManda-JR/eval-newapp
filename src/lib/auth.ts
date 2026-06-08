const STORAGE_KEY = "newapp_backoffice_code"

export function getBackofficeCode(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

export function setBackofficeCode(code: string) {
  localStorage.setItem(STORAGE_KEY, code)
}

export function clearBackofficeCode() {
  localStorage.removeItem(STORAGE_KEY)
}

export function authHeaders(): HeadersInit {
  const code = getBackofficeCode()
  return code ? { "X-Backoffice-Code": code } : {}
}
