import Handlebars from 'handlebars';
import { sanitizeTutorialSession, type TutorialSession } from '@toolsweb/shared';

const TEMPLATE = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{{title}}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @media print {
      .step { break-inside: avoid; page-break-inside: avoid; }
      .subtitle { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body class="bg-slate-50 text-slate-900">
  <main class="mx-auto max-w-3xl px-4 py-10">
    <header class="mb-10 border-b border-slate-200 pb-6">
      <h1 class="text-3xl font-bold tracking-tight">{{title}}</h1>
      <p class="mt-2 text-sm text-slate-500">Creado {{createdAt}} · {{steps.length}} pasos</p>
      {{#if hasNarration}}
      <p class="mt-1 text-xs font-medium uppercase tracking-wider text-emerald-700">Con narración por escena</p>
      {{/if}}
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
        <div class="relative mt-4 overflow-hidden rounded-lg border border-slate-200 bg-slate-950">
          <img class="w-full" src="data:image/png;base64,{{imageBase64}}" alt="Paso {{stepNumber}}" />
          {{#if narration}}
          <div class="subtitle absolute inset-x-0 bottom-0 bg-black/75 px-4 py-3 text-center">
            <p class="text-sm font-medium leading-snug text-white sm:text-base">{{narration}}</p>
          </div>
          {{/if}}
        </div>
        {{else}}
          {{#if narration}}
          <div class="subtitle mt-4 rounded-lg bg-slate-900 px-4 py-3 text-center">
            <p class="text-sm font-medium leading-snug text-white">{{narration}}</p>
          </div>
          {{/if}}
        {{/if}}
      </li>
      {{/each}}
    </ol>
  </main>
</body>
</html>`;

/**
 * Compiles a TutorialSession into a single standalone HTML5 document.
 * Includes per-step narration captions when `avatarScript` is present (UC-0004).
 */
export class HtmlExporterService {
  private readonly template = Handlebars.compile(TEMPLATE);

  export(session: TutorialSession): string {
    const safe = sanitizeTutorialSession(session);
    const steps = safe.steps.map((step) => ({
      ...step,
      narration: step.avatarScript?.spokenText?.trim() || '',
    }));
    const hasNarration = steps.some((s) => Boolean(s.narration));
    return this.template({
      title: safe.title,
      createdAt: safe.createdAt,
      steps,
      hasNarration,
    });
  }
}
