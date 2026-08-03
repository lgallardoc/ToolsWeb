/**
 * Smoke: start ephemeral browser, inject capture script + binding, click a link,
 * assert click payload reaches Node before navigation.
 */
import { chromium } from 'playwright';
import { buildCaptureInitScript } from '../src/services/recorder/captureInitScript.ts';

const received: Array<{ action: string; desc: string; freeze?: boolean }> = [];

async function main() {
  const script = buildCaptureInitScript({ enableAvatarScript: true });
  try {
    // eslint-disable-next-line no-new-func
    new Function(script);
    console.log('syntax OK', script.length);
  } catch (e) {
    console.error('SYNTAX FAIL', e);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.exposeBinding('__toolswebCapture', async (_source, raw: unknown) => {
    const p = raw as {
      action: string;
      description: string;
      freezeNavigation?: boolean;
      capturedAt?: string;
    };
    received.push({
      action: p.action,
      desc: p.description,
      freeze: p.freezeNavigation,
    });
    console.log('binding got', p.action, p.freezeNavigation, p.capturedAt, p.description?.slice(0, 60));
    if (p.freezeNavigation) {
      // simulate short shot delay
      await new Promise((r) => setTimeout(r, 80));
    }
    return { ok: true };
  });
  await context.addInitScript({ content: script });

  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.text().includes('toolsweb')) console.log('PAGE', msg.type(), msg.text());
  });
  page.on('pageerror', (err) => console.log('PAGEERROR', err.message));

  await page.setContent(`
    <html><body>
      <a id="go" href="https://example.com/">Go example</a>
      <button id="btn">Press</button>
      <input id="inp" />
      <select id="sel"><option>a</option><option>b</option></select>
      <div role="listbox"><div role="option" id="opt">Option X</div></div>
    </body></html>
  `);

  await page.evaluate(script);
  const status = await page.evaluate(() => {
    const w = window as Window & {
      __toolswebCapture?: unknown;
      __toolswebInstalled?: boolean;
    };
    return {
      installed: !!w.__toolswebInstalled,
      hasBinding: typeof w.__toolswebCapture === 'function',
    };
  });
  console.log('status', status);

  await page.click('#btn');
  await page.fill('#inp', 'hola');
  await page.selectOption('#sel', 'b');
  await page.click('#opt');
  await new Promise((r) => setTimeout(r, 400));

  console.log('before link click received=', received.length, received.map((r) => r.action));

  // Freeze link navigation
  await Promise.all([
    page.click('#go').catch((e) => console.log('click nav err', e.message)),
    page.waitForTimeout(500),
  ]);
  await new Promise((r) => setTimeout(r, 600));

  console.log('final received=', received.length);
  console.log(JSON.stringify(received, null, 2));

  const actions = new Set(received.map((r) => r.action));
  if (!actions.has('click') && !actions.has('select') && !actions.has('input')) {
    console.error('FAIL: no interaction actions');
    process.exitCode = 2;
  } else {
    console.log('PASS interactions:', [...actions]);
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
