const DEFAULT_GLPI_URL = "http://127.0.0.1/glpi"

function glpiListUrl(baseUrl: string, page: string) {
  return `${baseUrl.replace(/\/$/, "")}/front/${page}?reset=reset`
}

export function glpiTicketsListUrl(baseUrl = DEFAULT_GLPI_URL) {
  return glpiListUrl(baseUrl, "ticket.php")
}

export function glpiComputersListUrl(baseUrl = DEFAULT_GLPI_URL) {
  return glpiListUrl(baseUrl, "computer.php")
}

async function resolveGlpiBaseUrl() {
  try {
    const response = await fetch("/api/settings")
    if (!response.ok) return DEFAULT_GLPI_URL
    const settings = (await response.json()) as { glpi_url?: string }
    return settings.glpi_url ?? DEFAULT_GLPI_URL
  } catch {
    return DEFAULT_GLPI_URL
  }
}

export async function resolveGlpiTicketsListUrl() {
  return glpiTicketsListUrl(await resolveGlpiBaseUrl())
}

export async function resolveGlpiComputersListUrl() {
  return glpiComputersListUrl(await resolveGlpiBaseUrl())
}
