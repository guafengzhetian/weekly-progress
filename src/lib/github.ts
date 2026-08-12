import type { GitProvider } from '../types'

const API_BASE: Record<GitProvider, string> = {
  github: 'https://api.github.com',
  gitee: 'https://gitee.com/api/v5',
}

export class GitApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function authHeaders(provider: GitProvider, token: string): HeadersInit {
  if (provider === 'github') {
    return {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    }
  }
  return { Accept: 'application/json' }
}

function withToken(
  provider: GitProvider,
  url: string,
  token: string,
): string {
  if (provider === 'gitee') {
    const u = new URL(url)
    u.searchParams.set('access_token', token)
    return u.toString()
  }
  return url
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string; error?: string }
    return data.message || data.error || res.statusText
  } catch {
    return res.statusText || `HTTP ${res.status}`
  }
}

export interface RemoteFile {
  content: string
  sha: string
  path: string
}

export async function getFile(
  provider: GitProvider,
  owner: string,
  repo: string,
  path: string,
  token: string,
): Promise<RemoteFile | null> {
  const base = API_BASE[provider]
  const url = withToken(
    provider,
    `${base}/repos/${owner}/${repo}/contents/${path}`,
    token,
  )
  const res = await fetch(url, { headers: authHeaders(provider, token) })
  if (res.status === 404) return null
  if (!res.ok) throw new GitApiError(await parseError(res), res.status)
  const data = (await res.json()) as {
    content?: string
    encoding?: string
    sha: string
    path: string
    download_url?: string
  }

  let content = ''
  if (data.encoding === 'base64' && data.content) {
    content = decodeBase64(data.content.replace(/\n/g, ''))
  } else if (data.download_url) {
    const raw = await fetch(data.download_url)
    content = await raw.text()
  } else if (typeof data.content === 'string') {
    content = data.content
  }

  return { content, sha: data.sha, path: data.path }
}

export async function putFile(
  provider: GitProvider,
  owner: string,
  repo: string,
  path: string,
  token: string,
  message: string,
  content: string,
  sha?: string,
): Promise<void> {
  const base = API_BASE[provider]
  const url = withToken(
    provider,
    `${base}/repos/${owner}/${repo}/contents/${path}`,
    token,
  )

  const body: Record<string, string> = {
    message,
    content: encodeBase64(content),
  }
  if (sha) body.sha = sha

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      ...authHeaders(provider, token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new GitApiError(await parseError(res), res.status)
}

export async function deleteFile(
  provider: GitProvider,
  owner: string,
  repo: string,
  path: string,
  token: string,
  message: string,
  sha: string,
): Promise<void> {
  const base = API_BASE[provider]
  const url = withToken(
    provider,
    `${base}/repos/${owner}/${repo}/contents/${path}`,
    token,
  )
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      ...authHeaders(provider, token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, sha }),
  })
  if (!res.ok) throw new GitApiError(await parseError(res), res.status)
}

export async function listDir(
  provider: GitProvider,
  owner: string,
  repo: string,
  path: string,
  token: string,
): Promise<{ name: string; path: string; type: string }[]> {
  const base = API_BASE[provider]
  const url = withToken(
    provider,
    `${base}/repos/${owner}/${repo}/contents/${path}`,
    token,
  )
  const res = await fetch(url, { headers: authHeaders(provider, token) })
  if (res.status === 404) return []
  if (!res.ok) throw new GitApiError(await parseError(res), res.status)
  const data = await res.json()
  if (!Array.isArray(data)) return []
  return data.map((item: { name: string; path: string; type: string }) => ({
    name: item.name,
    path: item.path,
    type: item.type,
  }))
}

export async function testConnection(
  provider: GitProvider,
  owner: string,
  repo: string,
  token: string,
): Promise<string> {
  const base = API_BASE[provider]
  const url = withToken(provider, `${base}/repos/${owner}/${repo}`, token)
  const res = await fetch(url, { headers: authHeaders(provider, token) })
  if (!res.ok) throw new GitApiError(await parseError(res), res.status)
  const data = (await res.json()) as { full_name?: string; human_name?: string }
  return data.full_name || data.human_name || `${owner}/${repo}`
}

function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary)
}

function decodeBase64(b64: string): string {
  const binary = atob(b64)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}
