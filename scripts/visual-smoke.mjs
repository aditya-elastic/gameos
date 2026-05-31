import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const baseUrl = process.env.GAME_OS_BASE_URL || "http://localhost:3000";
const chromePath = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const outputDir = path.join(process.cwd(), "tmp", "visual-smoke");

if (!fs.existsSync(chromePath)) {
  console.log(
    JSON.stringify(
      {
        skipped: true,
        reason: `Chrome executable not found at ${chromePath}`
      },
      null,
      2
    )
  );
  process.exit(0);
}

fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true
});

const problems = [];

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  collectProblems(desktop, problems);
  await desktop.goto(baseUrl, { waitUntil: "networkidle" });
  await assertNoHorizontalOverflow(desktop, "desktop");
  await desktop.locator("button.artifact-row", { hasText: "First Playtest Script" }).click();
  await desktop.locator(".artifact-preview", { hasText: "First Playtest Script" }).waitFor({ state: "visible", timeout: 5000 });
  await desktop.screenshot({ path: path.join(outputDir, "desktop.png"), fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  collectProblems(mobile, problems);
  await mobile.goto(baseUrl, { waitUntil: "networkidle" });
  await assertNoHorizontalOverflow(mobile, "mobile");
  await mobile.screenshot({ path: path.join(outputDir, "mobile.png"), fullPage: true });

  if (problems.length > 0) {
    throw new Error(problems.join("\n"));
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        screenshots: [path.join(outputDir, "desktop.png"), path.join(outputDir, "mobile.png")]
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
}

function collectProblems(page, problems) {
  page.on("console", (message) => {
    if (message.type() === "error") {
      problems.push(`console error: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    problems.push(`page error: ${error.message}`);
  });
}

async function assertNoHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));

  if (metrics.scrollWidth > metrics.clientWidth + 1) {
    throw new Error(`${label} horizontal overflow: ${metrics.scrollWidth}px > ${metrics.clientWidth}px`);
  }
}
