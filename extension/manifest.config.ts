import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: 'Tab Piles',
  description: pkg.description,
  version: pkg.version,
  action: {
    default_title: 'Save this window to a pile',
    default_popup: 'src/popup/popup.html',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  side_panel: {
    default_path: 'src/sidepanel/sidepanel.html',
  },
  permissions: ['tabs', 'storage', 'sidePanel', 'unlimitedStorage', 'alarms'],
  commands: {
    'save-current-window': {
      suggested_key: { default: 'Ctrl+Shift+S', mac: 'Command+Shift+S' },
      description: 'Save the current window to a new pile',
    },
    'open-side-panel': {
      suggested_key: { default: 'Alt+Shift+P', mac: 'Alt+Shift+P' },
      description: 'Open the Tab Piles side panel',
    },
    _execute_action: {
      suggested_key: { default: 'Ctrl+Shift+L', mac: 'Command+Shift+L' },
    },
  },
})
