import type { UserRole } from '../types'

const USERS_KEY = 'weekly-progress-auth-users'
const SESSION_KEY = 'weekly-progress-auth-session'
const SALT = 'weekly-progress-v1'

export type AuthUser = {
  username: string
  displayName: string
  role: UserRole
  /** sha-256 hex of salt:password */
  passwordHash: string
}

export type AuthSession = {
  username: string
  displayName: string
  role: UserRole
}

type UserOverride = {
  passwordHash?: string
  displayName?: string
}

/** 默认账号（密码/显示名可被本机覆盖） */
const SEED: { username: string; displayName: string; role: UserRole; password: string }[] =
  [
    { username: 'cc', displayName: 'cc', role: 'member', password: 'cc_123' },
    { username: 'hutao', displayName: '番茄', role: 'member', password: 'hutao_123' },
    { username: 'kk', displayName: 'kk', role: 'member', password: 'kk_123' },
    { username: 'admin', displayName: '管理员', role: 'admin', password: 'admin_123' },
  ]

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function hashPassword(password: string): Promise<string> {
  return sha256Hex(`${SALT}:${password}`)
}

async function buildSeedUsers(): Promise<AuthUser[]> {
  const users: AuthUser[] = []
  for (const s of SEED) {
    users.push({
      username: s.username,
      displayName: s.displayName,
      role: s.role,
      passwordHash: await hashPassword(s.password),
    })
  }
  return users
}

function readOverrides(): Record<string, UserOverride> {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, string | UserOverride>
    const out: Record<string, UserOverride> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string') out[k] = { passwordHash: v }
      else if (v && typeof v === 'object') out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

function writeOverrides(map: Record<string, UserOverride>): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(map))
}

function saveSession(session: AuthSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export async function listAuthUsers(): Promise<AuthUser[]> {
  const seed = await buildSeedUsers()
  const overrides = readOverrides()
  return seed.map((u) => {
    const o = overrides[u.username]
    if (!o) return u
    return {
      ...u,
      passwordHash: o.passwordHash || u.passwordHash,
      displayName: o.displayName?.trim() || u.displayName,
    }
  })
}

export async function login(
  username: string,
  password: string,
): Promise<AuthSession> {
  const name = username.trim().toLowerCase()
  const users = await listAuthUsers()
  const user = users.find((u) => u.username === name)
  if (!user) throw new Error('账号不存在')
  const hash = await hashPassword(password)
  if (hash !== user.passwordHash) throw new Error('密码错误')
  const session: AuthSession = {
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  }
  saveSession(session)
  return session
}

export function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as AuthSession
    if (!s.username || !s.displayName || !s.role) return null
    return s
  } catch {
    return null
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

export async function changePassword(
  username: string,
  oldPassword: string,
  newPassword: string,
): Promise<void> {
  const name = username.trim().toLowerCase()
  if (newPassword.trim().length < 6) {
    throw new Error('新密码至少 6 位')
  }
  const users = await listAuthUsers()
  const user = users.find((u) => u.username === name)
  if (!user) throw new Error('账号不存在')
  const oldHash = await hashPassword(oldPassword)
  if (oldHash !== user.passwordHash) throw new Error('当前密码错误')
  const nextHash = await hashPassword(newPassword.trim())
  const overrides = readOverrides()
  overrides[name] = { ...overrides[name], passwordHash: nextHash }
  writeOverrides(overrides)
}

export function updateDisplayName(
  username: string,
  displayName: string,
): AuthSession {
  const name = username.trim().toLowerCase()
  const nextName = displayName.trim()
  if (!nextName) throw new Error('名称不能为空')
  const overrides = readOverrides()
  overrides[name] = { ...overrides[name], displayName: nextName }
  writeOverrides(overrides)
  const prev = loadSession()
  if (!prev || prev.username !== name) {
    throw new Error('请先登录')
  }
  const session: AuthSession = { ...prev, displayName: nextName }
  saveSession(session)
  return session
}
