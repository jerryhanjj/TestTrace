import type { GenerationSession, ReviewSession } from '../types';
import { escapeHtml } from '../utils';

function nonce(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function renderWarnings(warnings: string[]): string {
  if (warnings.length === 0) {
    return '<p class="muted">No parser warnings.</p>';
  }
  return `<ul class="warnings">${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')}</ul>`;
}

function renderScopeHint(review: ReviewSession): string {
  const scopeMissing = !review.team || !review.component;
  const scopeWarning = review.warnings.includes('scope_not_detected');
  if (!scopeMissing && !scopeWarning) {
    return '';
  }

  return `
    <div class="callout callout-warning">
      <strong>Scope was not auto-detected.</strong>
      <p>
        The backend scope rules did not match <code>${escapeHtml(review.sourceRelativePath)}</code>.
        Fill team and component manually for this run, or update the backend mapping rules.
      </p>
    </div>
  `;
}

function renderStyles(): string {
  return `
    :root {
      color-scheme: light dark;
      --tt-bg: var(--vscode-editor-background);
      --tt-fg: var(--vscode-editor-foreground);
      --tt-muted: var(--vscode-descriptionForeground);
      --tt-border: var(--vscode-panel-border);
      --tt-accent: var(--vscode-button-background);
      --tt-accent-fg: var(--vscode-button-foreground);
      --tt-card: color-mix(in srgb, var(--tt-bg) 92%, var(--tt-accent) 8%);
      --tt-danger: #d9534f;
      font-family: var(--vscode-font-family);
    }
    body {
      margin: 0;
      color: var(--tt-fg);
      background: radial-gradient(circle at top left, color-mix(in srgb, var(--tt-accent) 22%, transparent), transparent 35%), var(--tt-bg);
    }
    main {
      max-width: 1100px;
      margin: 0 auto;
      padding: 24px;
    }
    .hero {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    }
    .card {
      background: var(--tt-card);
      border: 1px solid var(--tt-border);
      border-radius: 14px;
      padding: 16px;
      box-sizing: border-box;
    }
    .card h2, .card h3, .card p {
      margin-top: 0;
    }
    .muted {
      color: var(--tt-muted);
    }
    .context-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .field {
      display: grid;
      gap: 6px;
    }
    .field label {
      font-weight: 600;
    }
    input[type="text"] {
      width: 100%;
      box-sizing: border-box;
      padding: 10px 12px;
      border: 1px solid var(--tt-border);
      border-radius: 10px;
      background: var(--tt-bg);
      color: var(--tt-fg);
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 20px 0;
    }
    button {
      border: 0;
      border-radius: 999px;
      padding: 10px 16px;
      cursor: pointer;
      background: color-mix(in srgb, var(--tt-accent) 88%, var(--tt-bg) 12%);
      color: var(--tt-accent-fg);
      font-weight: 600;
    }
    button.secondary {
      background: transparent;
      border: 1px solid var(--tt-border);
      color: var(--tt-fg);
    }
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .case-list {
      display: grid;
      gap: 12px;
    }
    .case-row {
      display: grid;
      gap: 12px;
      grid-template-columns: auto 1fr;
      align-items: start;
    }
    .case-header {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: baseline;
    }
    .pill {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 999px;
      border: 1px solid var(--tt-border);
      color: var(--tt-muted);
      font-size: 12px;
    }
    details pre {
      white-space: pre-wrap;
      word-break: break-word;
      overflow: auto;
      border-radius: 10px;
      padding: 12px;
      background: color-mix(in srgb, var(--tt-bg) 84%, black 16%);
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }
    .summary-box {
      border: 1px solid var(--tt-border);
      border-radius: 14px;
      padding: 14px;
      background: var(--tt-card);
    }
    .summary-box strong {
      display: block;
      font-size: 28px;
      margin-top: 6px;
    }
    .label-row {
      display: grid;
      gap: 8px;
      padding: 14px;
      border: 1px solid var(--tt-border);
      border-radius: 14px;
      background: var(--tt-card);
      margin-top: 12px;
    }
    code {
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .status-none { border-left: 4px solid #58a55c; }
    .status-duplicate { border-left: 4px solid #888; }
    .status-new_revision { border-left: 4px solid #2c98f0; }
    .status-path_collision { border-left: 4px solid var(--tt-danger); }
    .warnings {
      margin: 8px 0 0;
      padding-left: 18px;
      color: var(--tt-muted);
    }
    .callout {
      margin-top: 14px;
      padding: 12px 14px;
      border-radius: 12px;
      border: 1px solid var(--tt-border);
      background: color-mix(in srgb, var(--tt-bg) 82%, var(--tt-accent) 18%);
    }
    .callout-warning {
      border-left: 4px solid #d9a441;
    }
    .callout strong {
      display: block;
      margin-bottom: 6px;
    }
    .callout p {
      margin: 0;
      color: var(--tt-muted);
      line-height: 1.45;
    }
    @media (max-width: 840px) {
      .hero, .context-grid, .summary-grid {
        grid-template-columns: 1fr;
      }
    }
  `;
}

export function renderReviewHtml(review: ReviewSession): string {
  const pageNonce = nonce();
  const cases = review.cases.map((item) => `
    <section class="card case-row">
      <input class="case-check" type="checkbox" value="${escapeHtml(item.id)}" checked>
      <div>
        <div class="case-header">
          <div>
            <h3>${escapeHtml(item.suiteName || '(suite missing)')} :: ${escapeHtml(item.caseName)}</h3>
            <p class="muted">Lines ${item.lineStart}-${item.lineEnd} · ${item.parseStrategy} · confidence ${item.parseConfidence}</p>
          </div>
          <span class="pill">${escapeHtml(item.framework)}</span>
        </div>
        ${item.warnings.length > 0 ? renderWarnings(item.warnings) : ''}
        <details>
          <summary>View parsed snippet</summary>
          <pre>${escapeHtml(item.sourceSnippet)}</pre>
        </details>
      </div>
    </section>
  `).join('');

  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${pageNonce}';">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>TestTrace Review</title>
      <style>${renderStyles()}</style>
    </head>
    <body>
      <main>
        <section class="hero">
          <div class="card">
            <h2>Review Parsed Test Cases</h2>
            <p class="muted">Confirm team, component, and the detected cases before generating labels.</p>
            <div class="context-grid">
              <div><strong>Mode</strong><p>${escapeHtml(review.selectionMode)}</p></div>
              <div><strong>Framework</strong><p>${escapeHtml(review.framework)}</p></div>
              <div><strong>File</strong><p>${escapeHtml(review.fileName)}</p></div>
              <div><strong>Path</strong><p>${escapeHtml(review.sourceRelativePath)}</p></div>
            </div>
          </div>
          <div class="card">
            <h2>Scope</h2>
            <div class="field">
              <label for="team">Team</label>
              <input id="team" type="text" value="${escapeHtml(review.team)}" placeholder="TRADE">
              <p class="muted">${escapeHtml(review.teamSource ?? 'manual')} · confidence ${review.teamConfidence ?? 0}</p>
            </div>
            <div class="field">
              <label for="component">Component</label>
              <input id="component" type="text" value="${escapeHtml(review.component)}" placeholder="PAYMENT">
              <p class="muted">${escapeHtml(review.componentSource ?? 'manual')} · confidence ${review.componentConfidence ?? 0}</p>
            </div>
            ${renderScopeHint(review)}
          </div>
        </section>

        <section class="card">
          <h2>Parser Summary</h2>
          <p class="muted">Detected ${review.cases.length} candidate test case(s).</p>
          ${renderWarnings(review.warnings)}
        </section>

        <div class="toolbar">
          <button id="reparse" class="secondary">Reparse</button>
          <button id="selectAll" class="secondary">Select All</button>
          <button id="selectNone" class="secondary">Select None</button>
          <button id="generate">Generate Labels</button>
          <button id="close" class="secondary">Close</button>
        </div>

        <section class="case-list">${cases}</section>
      </main>

      <script nonce="${pageNonce}">
        const vscode = acquireVsCodeApi();
        const byId = (id) => document.getElementById(id);
        byId('selectAll').addEventListener('click', () => {
          document.querySelectorAll('.case-check').forEach((item) => item.checked = true);
        });
        byId('selectNone').addEventListener('click', () => {
          document.querySelectorAll('.case-check').forEach((item) => item.checked = false);
        });
        byId('reparse').addEventListener('click', () => {
          vscode.postMessage({ type: 'reparse' });
        });
        byId('close').addEventListener('click', () => {
          vscode.postMessage({ type: 'close' });
        });
        byId('generate').addEventListener('click', () => {
          const selectedIds = Array.from(document.querySelectorAll('.case-check:checked')).map((item) => item.value);
          vscode.postMessage({
            type: 'generate',
            team: byId('team').value,
            component: byId('component').value,
            selectedIds
          });
        });
      </script>
    </body>
  </html>`;
}

export function renderResultHtml(session: GenerationSession): string {
  const pageNonce = nonce();
  const generated = session.results.filter((item) => item.conflictStatus === 'none').length;
  const duplicates = session.results.filter((item) => item.isDuplicate).length;
  const revisions = session.results.filter((item) => item.isNewRevision).length;
  const conflicts = session.results.filter((item) => item.conflictStatus === 'path_collision').length;
  const labels = session.results.map((item) => item.label).join('\n');

  const rows = session.results.map((item) => `
    <div class="label-row status-${escapeHtml(item.conflictStatus)}">
      <div class="case-header">
        <div>
          <h3>${escapeHtml(item.suiteName)} :: ${escapeHtml(item.caseName)}</h3>
          <p class="muted">${escapeHtml(item.conflictStatus)}${item.conflictReason ? ` · ${escapeHtml(item.conflictReason)}` : ''}</p>
        </div>
        <span class="pill">${item.isDuplicate ? 'duplicate' : item.isNewRevision ? 'new revision' : item.conflictStatus}</span>
      </div>
      <code>${escapeHtml(item.label)}</code>
      <p class="muted">CASE_HASH16B ${escapeHtml(item.caseHash16B)} · CONTENT_HASH16B ${escapeHtml(item.contentHash16B)}</p>
    </div>
  `).join('');

  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${pageNonce}';">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>TestTrace Results</title>
      <style>${renderStyles()}</style>
    </head>
    <body>
      <main>
        <section class="card">
          <h2>Generation Results</h2>
          <p class="muted">Review generated labels, duplicate cases, and path collisions before closing.</p>
        </section>
        <section class="summary-grid">
          <div class="summary-box"><span class="muted">Generated</span><strong>${generated}</strong></div>
          <div class="summary-box"><span class="muted">Duplicates</span><strong>${duplicates}</strong></div>
          <div class="summary-box"><span class="muted">New Revisions</span><strong>${revisions}</strong></div>
          <div class="summary-box"><span class="muted">Conflicts</span><strong>${conflicts}</strong></div>
        </section>
        <div class="toolbar">
          <button id="copyAll">Copy All Labels</button>
          <button id="exportJson" class="secondary">Export JSON</button>
          <button id="back" class="secondary">Back to Review</button>
          <button id="done" class="secondary">Done</button>
        </div>
        <section>${rows}</section>
      </main>
      <script nonce="${pageNonce}">
        const vscode = acquireVsCodeApi();
        const labels = ${JSON.stringify(labels)};
        document.getElementById('copyAll').addEventListener('click', () => {
          vscode.postMessage({ type: 'copyAll', labels });
        });
        document.getElementById('exportJson').addEventListener('click', () => {
          vscode.postMessage({ type: 'exportJson' });
        });
        document.getElementById('back').addEventListener('click', () => {
          vscode.postMessage({ type: 'back' });
        });
        document.getElementById('done').addEventListener('click', () => {
          vscode.postMessage({ type: 'close' });
        });
      </script>
    </body>
  </html>`;
}