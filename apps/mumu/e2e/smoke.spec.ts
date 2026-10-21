import { expect, test, type Page } from '@playwright/test'

// One end-to-end pass over Phase 1 on a phone-sized screen: company ->
// person (two numbers) -> "If I go back" note -> it shows on both pages ->
// delete, undo via Trash -> survives a reload.

async function resetEmulators() {
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-mumu/databases/(default)/documents', { method: 'DELETE' })
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-mumu/accounts', { method: 'DELETE' })
}

async function signIn(page: Page) {
  await page.goto('/')
  await expect(page.getByText('Sign in with Google')).toBeVisible()
  await page.evaluate(() => (window as unknown as { __mumuTestSignIn: () => Promise<unknown> }).__mumuTestSignIn())
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible()
}

test.beforeEach(resetEmulators)

test('companies, people and notes work together', async ({ page }) => {
  await signIn(page)

  await page.getByRole('link', { name: /Company/ }).first().click()
  await page.getByLabel('Name').fill('Munster Rail Services')
  await page.getByRole('radio', { name: 'Client' }).click()
  await page.getByLabel('Website').fill('munsterrail.ie')
  await page.getByRole('button', { name: 'Add company' }).click()
  await expect(page.getByRole('heading', { name: 'Munster Rail Services' })).toBeVisible()
  await expect(page.getByRole('link', { name: /munsterrail\.ie/ })).toHaveAttribute('href', 'https://munsterrail.ie')

  await page.getByRole('link', { name: '＋ Person' }).click()
  await page.getByLabel('First name').fill('Siobhán')
  await page.getByLabel('Last name').fill("O'Riordan")
  await page.getByLabel('Number', { exact: true }).first().fill('07700 900123')
  await page.getByRole('button', { name: '＋ Add number' }).click()
  await page.getByLabel('Number', { exact: true }).nth(1).fill('021 456 7890')
  await page.getByLabel('Role', { exact: true }).fill('Bookings manager')
  await page.getByRole('button', { name: 'Add person' }).click()
  await expect(page.getByRole('heading', { name: "Siobhán O'Riordan" })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Call 07700 900123' })).toHaveAttribute('href', 'tel:07700900123')
  await expect(page.getByRole('link', { name: 'Call 021 456 7890' })).toHaveAttribute('href', 'tel:0214567890')

  await page.getByRole('link', { name: '＋ Note' }).click()
  await page.getByRole('radio', { name: /If I go back/ }).click()
  await page.locator('textarea').fill('Ring 021 456 7890 and ask for Siobhán in bookings.')
  await page.getByPlaceholder('Link a company').fill('munster')
  await page.getByRole('button', { name: /Munster Rail Services/ }).click()
  await page.getByRole('button', { name: 'Add note' }).click()
  await expect(page.getByRole('region', { name: 'If I go back' })).toContainText('ask for Siobhán')

  // Accent-insensitive search, then the same note on the company page.
  await page.goto('/people')
  await page.getByPlaceholder(/Search people/).fill('siobhan bookings')
  await page.getByText("Siobhán O'Riordan").click()
  await page.getByRole('link', { name: 'Munster Rail Services' }).click()
  await expect(page.getByRole('region', { name: 'If I go back' })).toContainText('ask for Siobhán')

  // Delete, restore from Trash, and it survives a reload.
  await page.goto('/people')
  await page.getByText("Siobhán O'Riordan").click()
  await page.getByRole('link', { name: 'Edit person' }).click()
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Delete person' }).click()
  await expect(page.getByText('No one here yet')).toBeVisible()
  await page.goto('/trash')
  await page.getByRole('button', { name: 'Restore' }).click()
  await expect(page.getByText('Nothing in the trash.')).toBeVisible()
  await page.goto('/people')
  await page.reload()
  await expect(page.getByText("Siobhán O'Riordan")).toBeVisible()
})

test('a pinned note shows on Home', async ({ page }) => {
  await signIn(page)
  await page.goto('/notes/new')
  await page.locator('textarea').fill('Tender for Limerick Junction due in spring')
  await page.getByLabel(/Pin to Home/).check()
  await page.getByRole('button', { name: 'Add note' }).click()
  // The saved note is on screen only once Firestore has it in the local
  // cache; wait for that before moving on, as a person would.
  await expect(page.getByText('Tender for Limerick Junction')).toBeVisible()
  await page.getByRole('navigation', { name: 'Main' }).last().getByRole('link', { name: 'Home' }).click()
  await expect(page.getByRole('heading', { name: /Pinned/ })).toBeVisible()
  await expect(page.getByText('Tender for Limerick Junction')).toBeVisible()
})
