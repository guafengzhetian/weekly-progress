import type { GitProvider } from '../types'

const API_BASE: Record<GitProvider, string> = {
  github: 'https://api.github.com',
  gitee: 'https://gitee.com/api/v5',
}

/** 可选：仅在直连失败的环境手动配置，如 VITE_GITEE_CORS_PROXY=/api/gitee-proxy?url= */
const GITEE_CORS_PROXY = (
  import.meta.env.VITE_GITEE_CORS_PROXY as string | undefined
)?.trim()

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

/** 默认直连 Gitee（已支持 CORS）；仅在配置了代理时才转发 */
function browserUrl(provider: GitProvider, url: string): string {
  if (provider !== 'gitee' || !GITEE_CORS_PROXY) return url
  if (GITEE_CORS_PROXY.includes('://')) {
    const base = GITEE_CORS_PROXY.endsWith('/')
      ? GITEE_CORS_PROXY
      : `${GITEE_CORS_PROXY}/`
    return `${base}${url}`
  }
  const joiner = GITEE_CORS_PROXY.includes('?') ? '' : '?url='
  return `${GITEE_CORS_PROXY}${joiner}${encodeURIComponent(url)}`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function shouldRetryStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500
}

function isSafeMethod(init?: RequestInit): boolean {
  const method = (init?.method || 'GET').toUpperCase()
  return method === 'GET' || method === 'HEAD'
}

/** 首请求偶发失败（DNS/WAF/弱网）时自动重试，避免点两次才进得去 */
async function gitFetch(
  provider: GitProvider,
  url: string,
  init?: RequestInit,
  retries = 2,
): Promise<Response> {
  const target = browserUrl(provider, url)
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(target, init)
      if (
        isSafeMethod(init) &&
        shouldRetryStatus(res.status) &&
        attempt < retries
      ) {
        await sleep(300 * (attempt + 1))
        continue
      }
      return res
    } catch {
      if (attempt < retries) {
        await sleep(300 * (attempt + 1))
        continue
      }
      throw new GitApiError(
        '网络失败：无法连接数据仓（可能是跨域或网络限制）',
        0,
      )
    }
  }
  throw new GitApiError(
    '网络失败：无法连接数据仓（可能是跨域或网络限制）',
    0,
  )
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as {
      message?: string | string[]
      messages?: string[]
      error?: string
    }
    if (Array.isArray(data.messages) && data.messages.length) {
      return data.messages.join('；')
    }
    if (Array.isArray(data.message)) return data.message.join('；')
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
  const res = await gitFetch(provider, url, {
    headers: authHeaders(provider, token),
  })
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
    const raw = await gitFetch(provider, data.download_url)
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

  // Gitee：新建 POST，更新 PUT（且必须带 sha）；GitHub 一律 PUT
  const method =
    provider === 'gitee' ? (sha ? 'PUT' : 'POST') : 'PUT'

  const body: Record<string, string> = {
    message,
    content: encodeBase64(content),
  }
  if (sha) body.sha = sha
  // Gitee 部分接口更稳妥地在 body 里再带一次 token
  if (provider === 'gitee') body.access_token = token

  const res = await gitFetch(provider, url, {
    method,
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
  const body: Record<string, string> = { message, sha }
  if (provider === 'gitee') body.access_token = token
  const res = await gitFetch(provider, url, {
    method: 'DELETE',
    headers: {
      ...authHeaders(provider, token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
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
  const res = await gitFetch(provider, url, {
    headers: authHeaders(provider, token),
  })
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
  const res = await gitFetch(provider, url, {
    headers: authHeaders(provider, token),
  })
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
