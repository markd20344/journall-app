import { test, expect } from '@playwright/test'

// Regression test for a real production incident: an item record synced
// from another device (or an older JSON export) can predate a field the UI
// now assumes is always present. That silently blanked the whole app once
// (item.subtasks.filter() throwing with no error boundary and no
// normalization on the Firestore-sync/import write paths). This simulates
// the exact shape of that failure directly against IndexedDB and asserts
// the app survives it.
test('a record missing a newer field (e.g. subtasks) does not crash the app', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (err) => pageErrors.push(String(err)))

  await page.goto('/')
  await page.locator('nav.app-nav').getByRole('button', { name: 'Log', exact: true }).click()
  await page.getByRole('button', { name: /^\+ Task$/ }).click()
  await page.locator('input[type="text"]').first().fill('Legacy record simulation')
  await page.getByRole('button', { name: /^Add /i }).click()
  await page.waitForTimeout(300)

  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('journall-db')
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('items', 'readwrite')
        const store = tx.objectStore('items')
        const cursorReq = store.openCursor()
        cursorReq.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result
          if (cursor) {
            if (cursor.value.title === 'Legacy record simulation') {
              const legacy = { ...cursor.value }
              delete legacy.subtasks
              cursor.update(legacy)
            }
            cursor.continue()
          } else {
            resolve()
          }
        }
        cursorReq.onerror = () => reject(cursorReq.error)
      }
      req.onerror = () => reject(req.error)
    })
  })

  await page.reload()
  await page.waitForTimeout(500)

  await expect(page.locator('nav.app-nav')).toBeVisible()
  await page.locator('nav.app-nav').getByRole('button', { name: 'Log', exact: true }).click()
  await expect(page.getByText('Legacy record simulation')).toBeVisible()
  expect(pageErrors).toEqual([])
})
