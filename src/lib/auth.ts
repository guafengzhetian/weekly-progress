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

/** 默认账号（密码可被本机改密覆盖） */
const SEED: { username: string; displayName: string; role: UserRole; password: string }[] =
  [
    { username: 'cc', displayName: 'cc', role: 'member', password: 'cc_123' },
    { username: 'hutao', displayName: '番茄', role: 'member', password: 'hutao_123' },
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

function readOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, string>
  } catch {
    return {}
  }
}

function writeOverrides(map: Record<string, string>): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(map))
}

export async function listAuthUsers(): Promise<AuthUser[]> {
  const seed = await buildSeedUsers()
  const overrides = readOverrides()
  return seed.map((u) =>
    overrides[u.username]
      ? { ...u, passwordHash: overrides[u.username] }
      : u,
  )
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
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
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
  overrides[name] = nextHash
  writeOverrides(overrides)
}
