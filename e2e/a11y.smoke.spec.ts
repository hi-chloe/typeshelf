import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Smoke a11y checks for the two gaps that source review can't close:
 * skip-link CSS cascade visibility, and axe at paint-time for light + dark.
 */

async function seedTheme(page: Page, mode: "light" | "dark") {
  await page.addInitScript(
    ({ mode: nextMode }) => {
      const prefs = {
        version: 2,
        favorites: [],
        customCategories: [],
        categoryOverrides: {},
        theme: {
          scheme: "ember",
          mode: nextMode,
          customSeed: "#4f7fd4",
        },
        previewColor: null,
        previewBgColor: null,
      };
      window.localStorage.setItem("typeshelf:prefs:v2", JSON.stringify(prefs));
    },
    { mode },
  );
}

async function gotoApp(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Typeshelf" })).toBeVisible();
}

test.describe("skip links", () => {
  test.beforeEach(async ({ page }) => {
    await seedTheme(page, "light");
    await gotoApp(page);
  });

  test("Skip to preview paints on focus and moves focus to #preview-pane", async ({
    page,
  }) => {
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to preview" });
    await expect(skip).toBeFocused();

    const box = await skip.boundingBox();
    expect(box, "skip link should paint when focused").toBeTruthy();
    expect(box!.width).toBeGreaterThan(40);
    expect(box!.height).toBeGreaterThan(16);

    await skip.press("Enter");
    await expect(page.locator("#preview-pane")).toBeFocused();
  });

  test("Skip to settings paints on focus and moves focus to #library-settings", async ({
    page,
  }) => {
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to settings" });
    await expect(skip).toBeFocused();

    const box = await skip.boundingBox();
    expect(box, "skip link should paint when focused").toBeTruthy();
    expect(box!.width).toBeGreaterThan(40);
    expect(box!.height).toBeGreaterThan(16);

    await skip.press("Enter");
    await expect(page.locator("#library-settings")).toBeFocused();
  });
});

test.describe("axe smoke", () => {
  for (const mode of ["light", "dark"] as const) {
    test(`no critical/serious violations in ember ${mode}`, async ({
      page,
    }) => {
      await seedTheme(page, mode);
      await gotoApp(page);

      await expect(page.locator("html")).toHaveAttribute("data-mode", mode);
      await expect(page.locator("html")).toHaveAttribute(
        "data-scheme",
        "ember",
      );

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();

      const blocking = results.violations.filter((v) =>
        ["critical", "serious"].includes(v.impact ?? ""),
      );

      expect(
        blocking,
        blocking
          .map(
            (v) =>
              `${v.id} (${v.impact}): ${v.help} — ${v.nodes
                .slice(0, 3)
                .map((n) => n.target.join(" "))
                .join("; ")}`,
          )
          .join("\n"),
      ).toEqual([]);
    });
  }
});
