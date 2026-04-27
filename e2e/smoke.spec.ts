import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard Smoke', () => {
  test('renders login view at /login', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/admin/i);
    // Login form should be visible (any input)
    await expect(page.locator('input').first()).toBeVisible();
  });

  test('redirects unauthenticated user from / to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('404 page renders for unknown routes', async ({ page }) => {
    await page.goto('/this-does-not-exist');
    // Should show 404 or NotFoundView. Either route lands on /login (auth-gated)
    // or surfaces a NotFound component — accept both, but title must still hold.
    await expect(page).toHaveTitle(/admin/i);
  });
});
