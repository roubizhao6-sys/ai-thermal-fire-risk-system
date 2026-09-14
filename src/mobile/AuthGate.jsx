import { createContext, useContext, useMemo, useState } from 'react'
import { Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react'

const ACCOUNT_KEY = 'thermalGuardAuthAccount'
const SESSION_KEY = 'thermalGuardAuthSession'
const AuthContext = createContext(null)

async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function readAccount() {
  try { return JSON.parse(localStorage.getItem(ACCOUNT_KEY) || 'null') } catch { return null }
}

function readSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null') } catch { return null }
}

export function useAuth() {
  return useContext(AuthContext) || { user: null, logout: () => {} }
}

export default function AuthGate({ children }) {
  const [account, setAccount] = useState(readAccount)
  const [session, setSession] = useState(readSession)
  const [mode, setMode] = useState(account ? 'login' : 'register')
  const [username, setUsername] = useState(account?.username || '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const authenticated = Boolean(account && session?.username === account.username)
  const strength = useMemo(() => Math.min(4, (password.length >= 6 ? 1 : 0) + (/[A-Z]/.test(password) ? 1 : 0) + (/[0-9]/.test(password) ? 1 : 0) + (/[^A-Za-z0-9]/.test(password) ? 1 : 0)), [password])

  const finishLogin = () => {
    const nextSession = { username: account.username, issuedAt: Date.now() }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextSession))
    setSession(nextSession)
  }

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (!username.trim()) { setError('请输入账号'); return }
    if (password.length < 6) { setError('密码至少需要6位'); return }
    setBusy(true)
    try {
      if (mode === 'register') {
        if (password !== confirm) { setError('两次输入的密码不一致'); return }
        const salt = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`
        const nextAccount = { username: username.trim(), salt, passwordHash: await hashPassword(password, salt), createdAt: Date.now() }
        localStorage.setItem(ACCOUNT_KEY, JSON.stringify(nextAccount))
        setAccount(nextAccount)
        const nextSession = { username: nextAccount.username, issuedAt: Date.now() }
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextSession))
        setSession(nextSession)
      } else {
        const passwordHash = await hashPassword(password, account?.salt || '')
        if (!account || username.trim() !== account.username || passwordHash !== account.passwordHash) {
          setError('账号或密码不正确')
          return
        }
        finishLogin()
      }
    } finally {
      setBusy(false)
      setPassword('')
      setConfirm('')
    }
  }

  const resetAccount = () => {
    if (!window.confirm('确定清除本机账号吗？清除后需要重新创建账号。')) return
    localStorage.removeItem(ACCOUNT_KEY)
    sessionStorage.removeItem(SESSION_KEY)
    setAccount(null)
    setSession(null)
    setMode('register')
    setUsername('')
    setPassword('')
    setConfirm('')
    setError('')
  }

  const logout = () => {
    sessionStorage.removeItem(SESSION_KEY)
    setSession(null)
    setMode('login')
    setPassword('')
    setConfirm('')
    setError('')
  }

  if (authenticated) {
    return <AuthContext.Provider value={{ user: account, logout }}>{children}</AuthContext.Provider>
  }

  return (
    <div className="auth-shell">
      <div className="auth-grid" />
      <main className="auth-card">
        <div className="auth-brand"><span><ShieldCheck size={25} /></span><div><strong>热感哨兵</strong><small>AI火警网警安全登录</small></div></div>
        <div className="auth-heading">
          <span><LockKeyhole size={15} />{mode === 'login' ? '欢迎回来' : '首次使用'}</span>
          <h1>{mode === 'login' ? '登录系统' : '创建本机账号'}</h1>
          <p>{mode === 'login' ? '使用手机端设置的账号和密码登录。' : '账号和密码只保存在本机浏览器，用于演示登录流程。'}</p>
        </div>
        <form className="auth-form" onSubmit={submit}>
          <label><span><UserRound size={14} />账号</span><input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="请输入账号" autoComplete="username" /></label>
          <label><span><KeyRound size={14} />密码</span><div className="auth-password"><input type={visible ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少6位密码" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /><button type="button" onClick={() => setVisible((value) => !value)}>{visible ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
          {mode === 'register' && <label><span><KeyRound size={14} />确认密码</span><input type={visible ? 'text' : 'password'} value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="再次输入密码" autoComplete="new-password" /></label>}
          {mode === 'register' && <div className="auth-strength"><span>密码强度</span><i>{[1, 2, 3, 4].map((value) => <b className={strength >= value ? 'active' : ''} key={value} />)}</i><em>{['较弱', '一般', '良好', '较强'][Math.max(0, strength - 1)]}</em></div>}
          {error && <div className="auth-error">{error}</div>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? '正在安全处理…' : mode === 'login' ? '登录' : '创建账号并登录'}</button>
        </form>
        <div className="auth-footer">
          {account ? <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setPassword(''); setConfirm('') }}>{mode === 'login' ? '重新设置账号' : '返回登录'}</button> : <span>首次使用请先创建本机账号</span>}
          {account && <button type="button" onClick={resetAccount}>清除本机账号</button>}
        </div>
        <p className="auth-note">本机演示认证不会把账号上传到服务器；跨设备登录需要连接正式账号服务。</p>
      </main>
    </div>
  )
}
