import { saveCurrentWindowAsPile } from '../lib/capture'
import { archiveStalePiles } from '../db/db'
import { validateLicense } from '../license/validate'
import { runSync } from '../sync/sync'

const AUTO_ARCHIVE_ALARM = 'tab-piles:auto-archive'
const SYNC_ALARM = 'tab-piles:sync'

function ensureAlarms() {
  chrome.alarms.get(AUTO_ARCHIVE_ALARM, (existing) => {
    if (!existing) {
      chrome.alarms.create(AUTO_ARCHIVE_ALARM, {
        delayInMinutes: 1,
        periodInMinutes: 24 * 60,
      })
    }
  })
  chrome.alarms.get(SYNC_ALARM, (existing) => {
    if (!existing) {
      chrome.alarms.create(SYNC_ALARM, {
        delayInMinutes: 5,
        periodInMinutes: 60,
      })
    }
  })
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {})
  ensureAlarms()
})

chrome.runtime.onStartup.addListener(() => {
  ensureAlarms()
})

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === AUTO_ARCHIVE_ALARM) {
    try {
      const n = await archiveStalePiles()
      if (n > 0) console.info(`[tab-piles] auto-archived ${n} stale pile(s)`)
    } catch (err) {
      console.error('[tab-piles] auto-archive failed', err)
    }
    return
  }

  if (alarm.name === SYNC_ALARM) {
    try {
      const license = await validateLicense()
      const result = await runSync(license)
      if (result.ok && (result.pushed || result.pulled || result.tombstoned)) {
        console.info(
          `[tab-piles] sync ok — pushed ${result.pushed}, pulled ${result.pulled}, tombstoned ${result.tombstoned}`,
        )
      } else if (!result.ok && result.error !== 'pro license required' && result.error !== 'sync already in progress') {
        console.warn('[tab-piles] sync failed', result.error)
      }
    } catch (err) {
      console.error('[tab-piles] sync alarm error', err)
    }
    return
  }
})

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'save-current-window') {
    try {
      const result = await saveCurrentWindowAsPile()
      await chrome.action.setBadgeText({ text: String(result.tabCount) })
      setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2000)
    } catch (err) {
      console.error('[tab-piles] save failed', err)
    }
  }

  if (command === 'open-side-panel') {
    const win = await chrome.windows.getCurrent()
    if (win.id !== undefined) await chrome.sidePanel.open({ windowId: win.id })
  }
})

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'save-current-window') {
    saveCurrentWindowAsPile(msg.name)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }))
    return true
  }
  return false
})
