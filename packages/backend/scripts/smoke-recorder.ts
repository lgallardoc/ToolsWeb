import { RecorderService } from '../src/services/RecorderService.ts';

async function main() {
  const recorder = new RecorderService();
  const session = await recorder.start({
    url: 'https://example.com',
    title: 'Smoke test',
    headless: true,
  });
  console.log('started', session.id, 'steps', session.steps.length);

  const runtime = (recorder as unknown as { runtime?: { page: import('playwright').Page } }).runtime;
  if (runtime?.page) {
    await runtime.page.evaluate(() => {
      const a = document.querySelector('a');
      a?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    });
    await new Promise((r) => setTimeout(r, 1000));
  }

  const final = await recorder.stop(session.id);
  console.log('stopped steps', final.steps.length);
  console.log(
    final.steps.map((s) => ({
      n: s.stepNumber,
      action: s.action,
      desc: s.description,
      hasImg: Boolean(s.imageBase64),
    }))
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
