import { chromium, firefox, webkit } from '@playwright/test';

// CI calls this under Xvfb so Firefox has a display-backed WebGL context.
// Fail explicitly rather than silently skipping flight checks without WebGL 2.
for (const [name, browserType] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await browserType.launch({ headless: false });
  try {
    const page = await browser.newPage();
    const graphics = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      let problem = '';
      canvas.addEventListener('webglcontextcreationerror', (event) => {
        problem = event.statusMessage;
      });
      const gl = canvas.getContext('webgl2');
      if (!gl) return { supported: false, problem };
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        supported: true,
        renderer: debug
          ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
          : gl.getParameter(gl.RENDERER),
      };
    });
    console.log(JSON.stringify({ browser: name, ...graphics }));
    if (!graphics.supported) throw new Error(`${name}: WebGL 2 unavailable: ${graphics.problem}`);
  } finally {
    await browser.close();
  }
}
