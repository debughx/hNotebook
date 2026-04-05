export const THEME_PRESET_IDS = [
  'white-gray',
  'dark-gray',
  'light-green',
  'light-pink',
  'deep-purple',
] as const

export type ThemePresetId = (typeof THEME_PRESET_IDS)[number]

export const THEME_PRESET_LABELS: Record<ThemePresetId, string> = {
  'white-gray': '白灰渐变',
  'dark-gray': '深灰',
  'light-green': '浅绿',
  'light-pink': '浅粉',
  'deep-purple': '深紫',
}

export function isThemePresetId(s: string | undefined | null): s is ThemePresetId {
  return !!s && (THEME_PRESET_IDS as readonly string[]).includes(s)
}
