import { test, expect } from '@playwright/test'

test('Quick capture: add, persists, newest first, and deletes with Undo', async ({ page }) => {
  await page.goto('/')

  const input = page.getByPlaceholder('Quick capture — a word, a thought, anything…')
  const addBtn = page.getByRole('button', { name: 'Add', exact: true })
  await expect(addBtn).toBeDisabled()

  await input.fill('Buy stamps')
  await addBtn.click()
  await expect(input).toHaveValue('')
  await expect(page.getByText('Buy stamps', { exact: true })).toBeVisible()

  // Enter submits too, not just the button.
  await input.fill('Call the dentist')
  await input.press('Enter')
  await expect(page.getByText('Call the dentist', { exact: true })).toBeVisible()

  // Newest first.
  await expect(page.locator('.quick-capture-text')).toHaveText(['Call the dentist', 'Buy stamps'])

  // A real write, not just local state — survives a reload.
  await page.reload()
  await expect(page.locator('.quick-capture-text')).toHaveText(['Call the dentist', 'Buy stamps'])

  // Delete shows an Undo toast and restores on click, matching every other
  // delete flow in the app.
  await page.locator('.quick-capture-row', { hasText: 'Buy stamps' }).locator('.chip-remove').click()
  await expect(page.getByText('Buy stamps', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Deleted "Buy stamps"')).toBeVisible()
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByText('Buy stamps', { exact: true })).toBeVisible()

  // Whitespace-only isn't a capture.
  await input.fill('   ')
  await expect(addBtn).toBeDisabled()
})
