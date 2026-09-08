import { test, expect } from '@playwright/test'

async function createTask(page: import('@playwright/test').Page, title: string) {
  await page.locator('nav.app-nav').getByRole('button', { name: 'Log', exact: true }).click()
  await page.getByRole('button', { name: /^\+ Task$/ }).click()
  await page.locator('input[type="text"]').first().fill(title)
  await page.getByRole('button', { name: /^Add /i }).click()
  await page.waitForTimeout(300)
}

test('Task subtasks: add, toggle, delete, and reflect a ballpark % complete', async ({ page }) => {
  await page.goto('/')
  await createTask(page, 'Ship the release')
  await page.getByText('Ship the release').first().click()

  await expect(page.getByText('Subtasks', { exact: true })).toBeVisible()

  const subtaskInput = page.getByPlaceholder('Add a subtask…')
  for (const title of ['Write changelog', 'Tag release', 'Deploy to prod']) {
    await subtaskInput.fill(title)
    await page.getByRole('button', { name: 'Add subtask' }).click()
    await page.waitForTimeout(200)
  }
  await expect(page.locator('.subtask-row')).toHaveCount(3)

  await page.locator('.subtask-row').nth(0).locator('input[type="checkbox"]').check()
  await expect(page.locator('.subtask-count')).toHaveText('1/3 · 33%')

  await page.locator('.subtask-row').nth(1).locator('input[type="checkbox"]').check()
  await expect(page.locator('.subtask-count')).toHaveText('2/3 · 67%')

  await page.locator('.subtask-row').nth(2).locator('.chip-remove').click()
  await expect(page.locator('.subtask-row')).toHaveCount(2)
  await expect(page.locator('.subtask-count')).toHaveText('2/2 · 100%')

  // The card list should reflect the same progress once we back out.
  await page.getByRole('button', { name: 'Cancel' }).click()
  await page.locator('nav.app-nav').getByRole('button', { name: 'Log', exact: true }).click()
  const card = page.locator('.item-card', { hasText: 'Ship the release' })
  await expect(card.locator('.linked-badge', { hasText: 'subtasks' })).toHaveText('2/2 subtasks · 100%')
  await expect(card.locator('.subtask-progress-track.card-progress')).toBeVisible()
})

test('Subtasks are scoped to Tasks only, not other item kinds', async ({ page }) => {
  await page.goto('/')
  await page.locator('nav.app-nav').getByRole('button', { name: 'Log', exact: true }).click()
  await page.getByRole('button', { name: /^\+ Story$/ }).click()
  await page.locator('input[type="text"]').first().fill('Some story')
  await page.getByRole('button', { name: /^Add /i }).click()
  await page.waitForTimeout(300)
  await page.getByText('Some story').first().click()

  await expect(page.getByText('Subtasks', { exact: true })).toHaveCount(0)
})
