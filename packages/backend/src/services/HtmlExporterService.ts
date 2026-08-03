import Handlebars from 'handlebars';
import { sanitizeTutorialSession, type TutorialSession } from '@toolsweb/shared';

const TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{{title}}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @media print {
      .step { break-inside: avoid; page-break-inside: avoid; }
    }
  </style>
</head>
<body class="bg-slate-50 text-slate-900">
  <main class="mx-auto max-w-3xl px-4 py-10">
    <header class="mb-10 border-b border-slate-200 pb-6">
      <h1 class="text-3xl font-bold tracking-tight">{{title}}</h1>
      <p class="mt-2 text-sm text-slate-500">Created {{createdAt}} · {{steps.length}} steps</p>
    </header>
    <ol class="space-y-10">
      {{#each steps}}
      <li class="step rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div class="mb-3 flex items-baseline gap-3">
          <span class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">{{stepNumber}}</span>
          <div>
            <h2 class="text-lg font-semibold">{{description}}</h2>
            <p class="text-xs text-slate-500">{{action}} · {{url}}</p>
          </div>
        </div>
        {{#if imageBase64}}
        <img class="mt-4 w-full rounded-lg border border-slate-200" src="data:image/png;base64,{{imageBase64}}" alt="Step {{stepNumber}}" />
        {{/if}}
        {{#if target.selector}}
        <p class="mt-3 font-mono text-xs text-slate-600">{{target.tagName}} → {{target.selector}}</p>
        {{/if}}
      </li>
      {{/each}}
    </ol>
  </main>
</body>
</html>`;

/**
 * Compiles a TutorialSession into a single standalone HTML5 document.
 */
export class HtmlExporterService {
  private readonly template = Handlebars.compile(TEMPLATE);

  export(session: TutorialSession): string {
    const safe = sanitizeTutorialSession(session);
    return this.template({
      title: safe.title,
      createdAt: safe.createdAt,
      steps: safe.steps,
    });
  }
}
