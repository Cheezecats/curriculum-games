import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';

const baseUrl = process.env.BENCHMARK_URL ?? 'http://127.0.0.1:4173';
const positions = [];
for (let x = -3; x <= 3; x++)
  for (let y = -1; y <= 1; y++) for (let z = -3; z <= 3; z++) positions.push({ x, y, z });
positions.sort(
  (a, b) =>
    Math.abs(a.x) + Math.abs(a.y) + Math.abs(a.z) - Math.abs(b.x) - Math.abs(b.y) - Math.abs(b.z),
);
const parts = positions.slice(0, 128).map((position, index) => ({
  id: `stress-${index}`,
  kind: index === 0 ? 'cockpit' : position.y === 0 && position.z !== 0 ? 'wing' : 'structure',
  ...position,
  rotation: 0,
}));
const blueprint = { version: 1, name: '128-part rendering stress fixture', parts };
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const report = {
  date: new Date().toISOString(),
  cpu: os.cpus()[0]?.model,
  memoryGiB: os.totalmem() / 1024 ** 3,
  platform: `${os.platform()} ${os.arch()}`,
  node: process.version,
  browser: browser.version(),
  viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
  baseUrl,
};
try {
  await page.goto(`${baseUrl}/#/flight`);
  const launch = page.getByRole('button', { name: 'Launch aircraft ↗' });
  await launch.waitFor();
  await page.getByText('Aircraft files', { exact: true }).click();
  await page.getByLabel('Import aircraft JSON').setInputFiles({
    name: 'stress-aircraft.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(blueprint)),
  });
  await page.getByRole('status').filter({ hasText: 'Imported aircraft' }).waitFor();
  await launch.click();
  report.flight = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const deltas = [];
        const start = performance.now();
        let last = start;
        function frame(now) {
          const airborne = document
            .querySelector('.flight-status')
            ?.textContent?.includes('AIRBORNE');
          if (airborne && now - start > 400) deltas.push(now - last);
          last = now;
          if (now - start < 6000) {
            requestAnimationFrame(frame);
            return;
          }
          const sorted = [...deltas].sort((a, b) => a - b);
          const canvas = document.querySelector('canvas');
          resolve({
            parts: 128,
            windowMs: now - start,
            airborneSamples: deltas.length,
            meanFps: deltas.length
              ? (1000 * deltas.length) / deltas.reduce((a, b) => a + b, 0)
              : null,
            p95FrameMs: sorted[Math.floor(sorted.length * 0.95)] ?? null,
            drawingBuffer: canvas ? { width: canvas.width, height: canvas.height } : null,
            instruments: document.querySelector('.flight-instruments')?.textContent,
            finalState: document.querySelector('.flight-status')?.textContent,
          });
        }
        requestAnimationFrame(frame);
      }),
  );
  await page.goto(`${baseUrl}/#/vision`);
  const deploy = page.getByRole('button', { name: '▶ Deploy robot · 24 parts' });
  await deploy.waitFor();
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('button')].some(
        (button) => button.textContent.includes('Deploy robot') && !button.disabled,
      ),
    undefined,
    { timeout: 30000 },
  );
  await page.getByLabel('Input task').selectOption('image');
  await page.getByRole('button', { name: 'Next · configure brain →' }).click();
  const start = performance.now();
  await page.getByRole('button', { name: '↻ Train robot' }).click();
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('button')].some(
        (button) => button.textContent.includes('Deploy robot') && !button.disabled,
      ),
    undefined,
    { timeout: 60000 },
  );
  const learningText = await page.locator('.vision-learning').innerText();
  const match = learningText.match(/([\d.]+)s last training/);
  report.vision = {
    wallMs: performance.now() - start,
    workerTrainingSeconds: match ? Number(match[1]) : null,
    actualLearningText: learningText,
  };
  const session = await page.context().newCDPSession(page);
  const before = await session.send('Target.getTargets');
  await page.getByRole('button', { name: '← Workshop hub' }).click();
  await page.waitForTimeout(500);
  const after = await session.send('Target.getTargets');
  report.workerCleanup = {
    duringVision: before.targetInfos.filter((target) => target.type === 'worker').length,
    afterExit: after.targetInfos.filter((target) => target.type === 'worker').length,
  };
  report.pageErrors = errors;
  await mkdir('output', { recursive: true });
  await writeFile('output/benchmark.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
