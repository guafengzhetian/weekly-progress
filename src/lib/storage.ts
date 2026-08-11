import type { Settings } from '../types'

const KEY = 'weekly-progress-settings'
const DEMO_KEY = 'weekly-progress-demo'

const defaults: Settings = {
  provider: 'gitee',
  owner: 'space-invincible-hair',
  repo: 'weekly-progress',
  token: '',
  displayName: '',
  role: 'member',
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...defaults }
    return { ...defaults, ...(JSON.parse(raw) as Settings) }
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
