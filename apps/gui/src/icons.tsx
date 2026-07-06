/**
 * Inline SVG icon set (stroke: currentColor) matching the mockups' outline
 * iconography. No icon-font or dependency; every icon is aria-hidden and
 * always paired with a visible or sr-only text label at the call site.
 */

import type { ReactElement } from 'react'

function svg(paths: ReactElement, size = 20, strokeWidth = 1.6) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths}
    </svg>
  )
}

export const Icon = {
  logo: (size = 22) => svg(
    <>
      <path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7L12 2.5Z" />
      <path d="M3.5 7 12 11.5 20.5 7" />
      <path d="M12 11.5V21.5" />
    </>, size, 1.5),
  home: (size = 20) => svg(
    <>
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9v10.5h13V9" />
      <path d="M10 19.5v-5h4v5" />
    </>, size),
  grid: (size = 20) => svg(
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </>, size),
  box: (size = 20) => svg(
    <>
      <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="M4 7.5 12 12l8-4.5" />
      <path d="M12 12v9" />
    </>, size),
  folder: (size = 20) => svg(
    <path d="M3.5 6.5a2 2 0 0 1 2-2h3.6l2 2.4h7.4a2 2 0 0 1 2 2v8.6a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-11Z" />, size),
  gear: (size = 20) => svg(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.8v2M12 18.2v2M20.2 12h-2M5.8 12h-2M17.8 6.2l-1.4 1.4M7.6 16.4l-1.4 1.4M17.8 17.8l-1.4-1.4M7.6 7.6 6.2 6.2" />
    </>, size),
  search: (size = 16) => svg(
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.4-4.4" />
    </>, size),
  plus: (size = 18) => svg(<path d="M12 5v14M5 12h14" />, size),
  help: (size = 18) => svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.2a2.5 2.5 0 0 1 4.9.7c0 1.6-2.4 2-2.4 3.4" />
      <path d="M12 16.8h.01" />
    </>, size),
  doc: (size = 20) => svg(
    <>
      <path d="M6.5 3.5h7l4 4v13h-11v-17Z" />
      <path d="M13.5 3.5v4h4" />
      <path d="M9 12h6M9 15.5h6" />
    </>, size),
  filePlus: (size = 28) => svg(
    <>
      <path d="M6.5 3.5h7l4 4v13h-11v-17Z" />
      <path d="M13.5 3.5v4h4" />
      <path d="M12 10.5v5M9.5 13h5" />
    </>, size),
  folderBig: (size = 28) => svg(
    <path d="M3.5 6.5a2 2 0 0 1 2-2h3.6l2 2.4h7.4a2 2 0 0 1 2 2v8.6a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-11Z" />, size),
  cloudUp: (size = 28) => svg(
    <>
      <path d="M7 17.5a4.3 4.3 0 0 1-.6-8.6 5.6 5.6 0 0 1 10.9 1.2A3.8 3.8 0 0 1 17 17.5" />
      <path d="M12 12.5v7M9 15l3-2.8L15 15" />
    </>, size),
  downloadTray: (size = 28) => svg(
    <>
      <path d="M12 3.5v10M8.6 10.2l3.4 3.3 3.4-3.3" />
      <path d="M4 15.5v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </>, size),
  shieldCheck: (size = 28) => svg(
    <>
      <path d="M12 3.5 19 6v6c0 4.4-3 7.6-7 9.5-4-1.9-7-5.1-7-9.5V6l7-2.5Z" />
      <path d="m8.8 12 2.2 2.2 4.2-4.4" />
    </>, size),
  check: (size = 16) => svg(<path d="m5 12.5 4.5 4.5L19 7.5" />, size, 2),
  chevronRight: (size = 16) => svg(<path d="m9 5.5 6.5 6.5L9 18.5" />, size),
  lightbulb: (size = 18) => svg(
    <>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3.5a6 6 0 0 1 3.7 10.7c-.7.6-1.2 1.4-1.2 2.3h-5c0-.9-.5-1.7-1.2-2.3A6 6 0 0 1 12 3.5Z" />
    </>, size),
  external: (size = 16) => svg(
    <>
      <path d="M10 5H5.5A1.5 1.5 0 0 0 4 6.5v12A1.5 1.5 0 0 0 5.5 20h12a1.5 1.5 0 0 0 1.5-1.5V14" />
      <path d="M14 4h6v6M20 4l-8.5 8.5" />
    </>, size),
  copy: (size = 16) => svg(
    <>
      <rect x="9" y="9" width="11" height="11" rx="1.5" />
      <path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" />
    </>, size),
  pencil: (size = 16) => svg(
    <path d="m4 20 .8-3.2L16.6 5a1.9 1.9 0 0 1 2.7 0l-.3-.3a1.9 1.9 0 0 1 0 2.7L7.2 19.2 4 20Z" />, size),
  sparkle: (size = 16) => svg(
    <path d="M12 4.5 13.6 10 19 11.5 13.6 13 12 18.5 10.4 13 5 11.5 10.4 10 12 4.5Z" />, size),
  play: (size = 16) => svg(<path d="M7.5 5.5v13l10-6.5-10-6.5Z" />, size),
  refresh: (size = 16) => svg(
    <>
      <path d="M4.5 12a7.5 7.5 0 0 1 12.8-5.3L20 9.5" />
      <path d="M20 4.5v5h-5" />
      <path d="M19.5 12a7.5 7.5 0 0 1-12.8 5.3L4 14.5" />
      <path d="M4 19.5v-5h5" />
    </>, size),
}
