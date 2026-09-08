import { test, expect } from '@playwright/test'

test('Today dashboard surfaces an overdue task and opens it for editing', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  await expect(page.getByText('Nothing overdue, due, or coming up this week.')).toBeVisible()

  await page.locator('nav.app-nav').getByRole('button', { name: 'Log', exact: true }).click()
  await page.getByRole('button', { name: /^\+ Task$/ }).click()
  await page.locator('input[type="text"]').first().fill('Overdue task test')
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  await page.locator('input[type="date"]').first().fill(yesterday)
  await page.getByRole('button', { name: /^Add /i }).click()
  await page.waitForTimeout(300)

  await page.locator('nav.app-nav').getByRole('button', { name: 'Today', exact: true }).click()
  await expect(page.locator('h2.today-section-title-overdue')).toHaveText('Overdue · 1')
  await expect(page.getByText('Overdue task test')).toBeVisible()

  await page.getByText('Overdue task test').first().click()
  await expect(page.locator('.item-editor')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
})

test('Deleting an item shows an Undo toast; Undo restores it, letting it expire deletes for real', async ({ page }) => {
  await page.goto('/')
  await page.locator('nav.app-nav').getByRole('button', { name: 'Log', exact: true }).click()
  await page.getByRole('button', { name: /^\+ Task$/ }).click()
  await page.locator('input[type="text"]').first().fill('Delete me')
  await page.getByRole('button', { name: /^Add /i }).click()
  await page.waitForTimeout(300)

  await page.getByText('Delete me').first().click()
  await page.getByRole('button', { name: 'Delete' }).click()

  // Gone immediately from the list, even though the real delete is still staged.
  // (exact: true — the "Undo" toast text itself contains "Delete me" as a substring.)
  await expect(page.getByText('Delete me', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Deleted "Delete me"')).toBeVisible()

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByText('Delete me', { exact: true })).toBeVisible()

  // Delete again and let the grace window elapse — the real delete should land.
  await page.getByText('Delete me', { exact: true }).first().click()
  await page.getByRole('button', { name: 'Delete' }).click()
  await page.waitForTimeout(5500)
  await expect(page.getByText('Delete me', { exact: true })).toHaveCount(0)
})
