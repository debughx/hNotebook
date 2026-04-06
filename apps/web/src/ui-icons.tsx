import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

const S = {
  stroke: 'currentColor' as const,
  fill: 'none' as const,
  strokeWidth: 1.65,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function IconSidebarOpen({ size = 20, className, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      className={className}
      aria-hidden
      {...p}
    >
      <rect x="3" y="4" width="7" height="16" rx="1.5" />
      <rect x="12" y="4" width="9" height="16" rx="1.5" />
    </svg>
  )
}

export function IconSidebarClosed({ size = 20, className, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      className={className}
      aria-hidden
      {...p}
    >
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M9 4v16" />
    </svg>
  )
}

export function IconSun({ size = 20, className, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      className={className}
      aria-hidden
      {...p}
    >
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

export function IconMoon({ size = 20, className, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      className={className}
      aria-hidden
      {...p}
    >
      <path d="M10.5 3.5a7 7 0 1 0 9.9 9.9 7 7 0 0 1-9.9-9.9z" />
    </svg>
  )
}

export function IconRefresh({ size = 20, className, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      className={className}
      aria-hidden
      {...p}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  )
}

export function IconDatabase({ size = 20, className, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      className={className}
      aria-hidden
      {...p}
    >
      <ellipse cx="12" cy="6" rx="7" ry="2.5" />
      <path d="M5 6v5c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5V6" />
      <path d="M5 11v5c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5v-5" />
    </svg>
  )
}

export function IconLogOut({ size = 20, className, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      className={className}
      aria-hidden
      {...p}
    >
      <path d="M10 17H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4" />
      <path d="M14 12h8" />
      <path d="M17 9l3 3-3 3" />
    </svg>
  )
}

export function IconMessage({ size = 22, className, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      className={className}
      aria-hidden
      {...p}
    >
      <path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-3H5a8 8 0 1 1 16-8z" />
    </svg>
  )
}

export function IconFolder({ size = 16, className, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      className={className}
      aria-hidden
      {...p}
    >
      <path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h4l1.5 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6.5z" />
    </svg>
  )
}

export function IconChevronRight({ size = 14, className, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      strokeWidth={2}
      className={className}
      aria-hidden
      {...p}
    >
      <path d="M10 6l6 6-6 6" />
    </svg>
  )
}

export function IconChevronDown({ size = 14, className, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      strokeWidth={2}
      className={className}
      aria-hidden
      {...p}
    >
      <path d="M6 10l6 6 6-6" />
    </svg>
  )
}

/** Note row: folded corner + lines */
export function IconNoteGlyph({ size = 14, className, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      strokeWidth={1.5}
      className={className}
      aria-hidden
      {...p}
    >
      <path d="M8 4h8l4 4v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <path d="M16 4v4h4" />
      <path d="M8 14h8M8 18h5" />
    </svg>
  )
}

export function IconPencil({ size = 16, className, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      className={className}
      aria-hidden
      {...p}
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5l2.5 2.5L8 17l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}

export function IconTrash({ size = 16, className, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      className={className}
      aria-hidden
      {...p}
    >
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

export function IconX({ size = 18, className, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      className={className}
      aria-hidden
      {...p}
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function IconPlus({ size = 18, className, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      className={className}
      aria-hidden
      {...p}
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function IconSend({ size = 18, className, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      className={className}
      aria-hidden
      {...p}
    >
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  )
}

export function IconUser({ size = 16, className, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      className={className}
      aria-hidden
      {...p}
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20v-1a7 7 0 0 1 14 0v1" />
    </svg>
  )
}

/** Minimal brain outline */
export function IconBrain({ size = 16, className, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      className={className}
      aria-hidden
      {...p}
    >
      <path d="M12 5.5v2" />
      <path d="M12 7.5c-2.35 0-4.35 1.85-4.35 4.15 0 1.25.55 2.35 1.45 3.05-.45.45-.75 1.05-.75 1.75 0 1.45 1.15 2.65 2.65 2.8L12 19" />
      <path d="M12 7.5c2.35 0 4.35 1.85 4.35 4.15 0 1.25-.55 2.35-1.45 3.05.45.45.75 1.05.75 1.75 0 1.45-1.15 2.65-2.65 2.8L12 19" />
      <path d="M12 19v2" />
    </svg>
  )
}

/** 知识库助手 / 问答 */
export function IconRobot({ size = 20, className, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      className={className}
      aria-hidden
      {...p}
    >
      <path d="M8.5 5L10 6.5h4L15.5 5" />
      <circle cx="12" cy="4.2" r="0.95" fill="currentColor" stroke="none" />
      <rect x="5" y="7.5" width="14" height="11.5" rx="3.2" />
      <circle cx="9.25" cy="12" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="14.75" cy="12" r="1.15" fill="currentColor" stroke="none" />
      <path d="M9.2 16.2c.8.55 1.75.85 2.8.85s2-.3 2.8-.85" />
    </svg>
  )
}

export function IconInfo({ size = 16, className, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      className={className}
      aria-hidden
      {...p}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6M12 8h.01" />
    </svg>
  )
}

export function IconPalette({ size = 20, className, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      className={className}
      aria-hidden
      {...p}
    >
      <path d="M12 3a7 7 0 1 0 7 7c0 1.5-1 2.5-2.5 2.5h-1.8c-.8 0-1.2.4-1.2 1.2V17a2 2 0 0 1-2 2H9a7 7 0 0 1 0-14" />
      <circle cx="6.5" cy="10.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="9.5" cy="7.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="14" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="10" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconCheck({ size = 20, className, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      className={className}
      aria-hidden
      {...p}
    >
      <path d="M5 12.5l4.2 4.2L19 7" />
    </svg>
  )
}

/** Markdown: heading levels (toolbar) */
export function IconMdHeading({ size = 18, className, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      className={className}
      aria-hidden
      {...p}
    >
      <path d="M6 5v14M6 12h5.5M11.5 5v14" />
      <path d="M17 5v3.5M17 10.5V19M17 10.5h3.5a2 2 0 0 0 0-4H17" />
    </svg>
  )
}

export function IconMdBold({ size = 18, className, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      strokeWidth={2.35}
      className={className}
      aria-hidden
      {...p}
    >
      <path d="M8 5v14M8 12h5a3.5 3.5 0 1 0 0-7H8" />
      <path d="M8 12h5.5a3.5 3.5 0 1 1 0 7H8" />
    </svg>
  )
}

export function IconMdItalic({ size = 18, className, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      className={className}
      aria-hidden
      {...p}
    >
      <path d="M10 5h6M8 19h6M14 5L10 19" />
    </svg>
  )
}

export function IconMdListBullets({ size = 18, className, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      className={className}
      aria-hidden
      {...p}
    >
      <circle cx="5.5" cy="8" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="5.5" cy="12" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="5.5" cy="16" r="1.15" fill="currentColor" stroke="none" />
      <path d="M9 8h11M9 12h11M9 16h8" />
    </svg>
  )
}

export function IconMdListOrdered({ size = 18, className, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      className={className}
      aria-hidden
      {...p}
    >
      <path d="M5 7.5h2M6 6v4M5.5 14h2l-1.2 4M10 8h9M10 12h9M10 16h7" />
    </svg>
  )
}

export function IconMdTask({ size = 18, className, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      className={className}
      aria-hidden
      {...p}
    >
      <rect x="4.5" y="6" width="4.5" height="4.5" rx="1" />
      <path d="M11 8.25h9M11 12.25h9M11 16.25h7" />
    </svg>
  )
}

export function IconMdQuote({ size = 18, className, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      className={className}
      aria-hidden
      {...p}
    >
      <path d="M7 8c-1.5 2-2 3.5-2 5h4M15 8c-1.5 2-2 3.5-2 5h4" />
    </svg>
  )
}

export function IconMdCode({ size = 18, className, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      className={className}
      aria-hidden
      {...p}
    >
      <path d="M8 9l-3 3 3 3M16 9l3 3-3 3M13.5 7l-3 10" />
    </svg>
  )
}

export function IconMdCodeBlock({ size = 18, className, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      className={className}
      aria-hidden
      {...p}
    >
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M8 9l-2 2 2 2M16 9l2 2-2 2" />
    </svg>
  )
}

export function IconMdTable({ size = 18, className, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      className={className}
      aria-hidden
      {...p}
    >
      <rect x="4" y="5" width="16" height="14" rx="1.5" />
      <path d="M4 10h16M10 5v14M16 5v14" />
    </svg>
  )
}

export function IconMdLink({ size = 18, className, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      className={className}
      aria-hidden
      {...p}
    >
      <path d="M10 14a4 4 0 0 1 0-5.5l1-1a4 4 0 0 1 5.66 5.66l-1 1M14 10a4 4 0 0 1 0 5.5l-1 1a4 4 0 0 1-5.66-5.66l1-1" />
    </svg>
  )
}

export function IconMdImage({ size = 18, className, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      className={className}
      aria-hidden
      {...p}
    >
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" fill="currentColor" stroke="none" />
      <path d="M5 18l4.5-5 3 3.5L15 12l4 6" />
    </svg>
  )
}

export function IconMdHr({ size = 18, className, ...p }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      className={className}
      aria-hidden
      {...p}
    >
      <path d="M5 12h14" />
      <path d="M9 8v8M15 8v8" opacity="0.35" />
    </svg>
  )
}

type IconColumnsProps = IconProps & { active?: boolean }

/** Split editor / preview */
export function IconColumns({ size = 18, className, active, ...p }: IconColumnsProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...S}
      className={className}
      aria-hidden
      {...p}
    >
      <rect x="3" y="4" width="7.5" height="16" rx="1.2" />
      <rect
        x="13.5"
        y="4"
        width="7.5"
        height="16"
        rx="1.2"
        fill="currentColor"
        fillOpacity={active ? 0.2 : 0}
      />
    </svg>
  )
}
