import { useEffect, useId, useRef, useState } from 'react'
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
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const current = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
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
      {open && (
        <ul className="select-menu" id={listId} role="listbox">
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
        </ul>
      )}
    </div>
  )
}
