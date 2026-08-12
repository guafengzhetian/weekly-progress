import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import './Select.css'

export interface SelectOption {
  value: string
  label: string
}

export default function Select({
  label,
  value,
  options,
  onChange,
  placeholder = '请选择',
  variant = 'default',
}: {
  label?: string
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  variant?: 'default' | 'pill'
}) {
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const listId = useId()
  const current = options.find((o) => o.value === value)

  const placeMenu = () => {
    const trigger = rootRef.current?.querySelector('button.select-trigger')
    if (!(trigger instanceof HTMLElement)) return
    const rect = trigger.getBoundingClientRect()
    const menuWidth = Math.max(rect.width, variant === 'pill' ? 160 : rect.width)
    const spaceBelow = window.innerHeight - rect.bottom - 12
    const openUp = spaceBelow < 160 && rect.top > spaceBelow
    const top = openUp ? undefined : rect.bottom + 6
    const bottom = openUp ? window.innerHeight - rect.top + 6 : undefined
    let left = rect.left
    if (variant === 'pill') {
      left = Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8)
      left = Math.max(8, left)
    }
    setMenuStyle({
      position: 'fixed',
      top,
      bottom,
      left,
      width: menuWidth,
      right: 'auto',
      zIndex: 4000,
    })
  }

  useLayoutEffect(() => {
    if (!open) return
    placeMenu()
    const onWin = () => placeMenu()
    window.addEventListener('resize', onWin)
    window.addEventListener('scroll', onWin, true)
    return () => {
      window.removeEventListener('resize', onWin)
      window.removeEventListener('scroll', onWin, true)
    }
  }, [open, variant, options.length])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (rootRef.current?.contains(t)) return
      if (menuRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div
      className={`field custom-select ${variant === 'pill' ? 'select-pill' : ''} ${open ? 'is-open' : ''}`}
      ref={rootRef}
    >
      {label && variant !== 'pill' && <span>{label}</span>}
      <button
        type="button"
        className={`select-trigger${variant === 'pill' ? ' select-trigger-pill' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <em>{current?.label || placeholder}</em>
        <svg width="12" height="8" viewBox="0 0 12 8" aria-hidden>
          <path
            d="M1 1.5L6 6.5L11 1.5"
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {open &&
        createPortal(
          <ul
            className={`select-menu select-menu-portal${variant === 'pill' ? ' select-menu-pill' : ''}`}
            id={listId}
            role="listbox"
            ref={menuRef}
            style={menuStyle}
          >
            {options.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  className={o.value === value ? 'is-active' : ''}
                  onClick={() => {
                    onChange(o.value)
                    setOpen(false)
                  }}
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  )
}
