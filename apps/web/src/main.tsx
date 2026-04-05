import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { isThemePresetId, type ThemePresetId } from './themePresets'

function resolveInitialThemePreset(): ThemePresetId {
  const saved = localStorage.getItem('hnotebook_theme_preset')
  if (isThemePresetId(saved)) return saved

  const legacy = localStorage.getItem('hnotebook_theme')
  if (legacy === 'dark') return 'dark-gray'
  if (legacy === 'light') return 'white-gray'

  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark-gray'
  }
  return 'white-gray'
}

{
  const preset = resolveInitialThemePreset()
  document.documentElement.dataset.themePreset = preset
  localStorage.setItem('hnotebook_theme_preset', preset)
  localStorage.removeItem('hnotebook_theme')
  delete document.documentElement.dataset.theme
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
