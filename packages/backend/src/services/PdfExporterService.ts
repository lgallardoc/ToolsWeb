import { chromium } from 'playwright';
import type { TutorialSession } from '@toolsweb/shared';
import { HtmlExporterService } from './HtmlExporterService.js';

/**
 * Renders a TutorialSession to PDF via Playwright page.pdf().
 */
export class PdfExporterService {
  private readonly htmlExporter = new HtmlExporterService();

  async export(session: TutorialSession): Promise<Buffer> {
    const html = this.htmlExporter.export(session);
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '16mm', right: '12mm', bottom: '16mm', left: '12mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }
}
