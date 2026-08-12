import type { GitProvider, Settings } from '../types'
import { BUILTIN_GITEE_TOKEN } from './data-credentials'

const KEY = 'weekly-progress-settings'
const DEMO_KEY = 'weekly-progress-demo'

function envToken(): string {
  const v = import.meta.env.VITE_GITEE_TOKEN
  if (typeof v === 'string' && v.trim()) return v.trim()
  return BUILTIN_GITEE_TOKEN.trim()
}

function envDefaults(): Settings {
  const provider = (import.meta.env.VITE_GIT_PROVIDER as GitProvider | undefined) || 'gitee'
  return {
    provider: provider === 'github' ? 'github' : 'gitee',
    owner: (import.meta.env.VITE_GIT_OWNER as string | undefined)?.trim() || 'space-invincible-hair',
    /** 私有数据仓：只存进度，不公开 */
    repo: (import.meta.env.VITE_GIT_REPO as string | undefined)?.trim() || 'private-database',
    token: envToken(),
    displayName: '',
    role: 'member',
  }
}

export function loadSettings(): Settings {
  const defaults = envDefaults()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...defaults }
    const saved = JSON.parse(raw) as Partial<Settings>
    return {
      ...defaults,
      ...saved,
      // 本机没填 Token 时用内置/构建期注入的
      token: (saved.token || '').trim() || defaults.token,
      owner: (saved.owner || '').trim() || defaults.owner,
      repo: (saved.repo || '').trim() || defaults.repo,
      provider: saved.provider || defaults.provider,
    }
  } catch {
    return { ...defaults }
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(settings))
}

export function settingsReady(s: Settings): boolean {
  return Boolean(s.owner && s.repo && s.token && s.displayName)
}

export function loadDemo(): boolean {
  return localStorage.getItem(DEMO_KEY) === '1'
}

export function saveDemo(on: boolean): void {
  localStorage.setItem(DEMO_KEY, on ? '1' : '0')
}
