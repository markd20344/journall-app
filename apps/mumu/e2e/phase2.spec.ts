import { expect, test, type Page } from '@playwright/test'

// Phase 2: important dates on Home, engagements with key contacts, and an
// engagement's "If I go back" note surfacing on its company's page.

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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function inDays(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() }
}

test.beforeEach(resetEmulators)

test('a birthday shows on Home with the countdown and age', async ({ page }) => {
  await signIn(page)
  await page.goto('/people/new')
  await page.getByLabel('First name').fill('Nora')
  await page.getByLabel('Last name').fill('Byrne')
  await page.getByRole('radio', { name: 'Personal' }).click()
  await page.getByRole('button', { name: 'Add person' }).click()
  await expect(page.getByRole('heading', { name: 'Nora Byrne' })).toBeVisible()

  const when = inDays(5)
  await page.getByRole('link', { name: '＋ Date' }).click()
  await page.getByLabel('Day').selectOption(String(when.day))
  await page.getByLabel('Month').selectOption(String(when.month))
  await page.getByLabel('Year (optional)').fill(String(when.year - 40))
  await page.getByRole('button', { name: 'Add date' }).click()
  await expect(page.getByRole('link', { name: /birthday, In 5 days/ })).toContainText('turns 40')

  await page.getByRole('navigation', { name: 'Main' }).last().getByRole('link', { name: 'Home' }).click()
  const comingUp = page.getByRole('region', { name: /Coming up/ })
  await expect(comingUp).toContainText('Nora Byrne')
  await expect(comingUp).toContainText('Birthday ·')
  await expect(comingUp).toContainText(`${when.day} ${MONTHS[when.month - 1]}`)
  await expect(comingUp).toContainText('In 5 days')
  // Recently viewed remembers the person.
  await expect(page.getByRole('heading', { name: /Recently viewed/ })).toBeVisible()
})

test('an engagement records the work and its contacts', async ({ page }) => {
  await signIn(page)
  await page.goto('/companies/new')
  await page.getByLabel('Name').fill('Irish Rail')
  await page.getByRole('button', { name: 'Add company' }).click()
  await expect(page.getByRole('heading', { name: 'Irish Rail' })).toBeVisible()

  await page.getByRole('link', { name: '＋ Engagement' }).click()
  await page.getByLabel('Job / project name').fill('Mallow resignalling')
  await page.getByLabel('My role').fill('Site supervisor')
  await page.getByLabel('Started').fill('2023-03-06')
  await page.getByLabel('Still going').uncheck()
  await page.getByLabel('Finished').fill('2024-06-28')
  await page.getByLabel('What I did').fill('Night possessions, signalling cut-over.')
  await page.getByPlaceholder('People you dealt with').fill('Ciarán Walsh')
  await page.getByRole('button', { name: /Add “Ciarán Walsh”/ }).click()
  await page.getByRole('button', { name: 'Add engagement' }).click()

  await expect(page.getByRole('heading', { name: 'Mallow resignalling' })).toBeVisible()
  await expect(page.getByText('Mar 2023 – Jun 2024 · 1 yr 3 mos')).toBeVisible()
  await expect(page.getByRole('link', { name: /Ciarán Walsh/ })).toBeVisible()

  await page.getByRole('link', { name: '＋ Note' }).click()
  await page.getByRole('radio', { name: /If I go back/ }).click()
  await page.locator('textarea').fill('Ask for Ciarán at Mallow depot; he runs the possession rota.')
  await page.getByRole('button', { name: 'Add note' }).click()
  await expect(page.getByRole('region', { name: 'If I go back' })).toContainText('possession rota')

  // The company page shows the engagement and its "If I go back" note.
  await page.getByRole('link', { name: /Irish Rail/ }).first().click()
  await expect(page.getByRole('region', { name: 'If I go back' })).toContainText('possession rota')
  await expect(page.getByRole('link', { name: /Mallow resignalling/ })).toBeVisible()

  // And the contact's page lists the work they were part of.
  await page.goto('/people')
  await page.getByText('Ciarán Walsh').click()
  await expect(page.getByRole('heading', { name: 'Worked together' })).toBeVisible()
})
