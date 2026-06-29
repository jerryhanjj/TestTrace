import type { GenerationSession, ReviewSession } from '../types';
import { escapeHtml } from '../utils';

function nonce(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function renderWarnings(warnings: string[]): string {
  if (warnings.length === 0) {
    return '<p class="muted">无解析警告。</p>';
  }
  return `<ul class="warnings">${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')}</ul>`;
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
    html, body {
      width: 100%;
      margin: 0;
      color: var(--tt-fg);
      background: radial-gradient(circle at top left, color-mix(in srgb, var(--tt-accent) 22%, transparent), transparent 35%), var(--tt-bg);
    }
    main {
      width: 100%;
      max-width: 1100px;
      margin: 0 auto;
      padding: 24px;
      box-sizing: border-box;
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

function renderReviewContent(review: ReviewSession): string {
  const cases = review.cases.map((item) => `
    <section class="card case-row">
      <input class="case-check" type="checkbox" value="${escapeHtml(item.id)}" checked>
      <div>
        <div class="case-header">
          <div>
            <h3>${escapeHtml(item.suiteName || '(缺少套件名)')} :: ${escapeHtml(item.caseName)}</h3>
            <p class="muted">第 ${item.lineStart}-${item.lineEnd} 行 · ${item.parseStrategy}</p>
          </div>
          <span class="pill">${escapeHtml(item.framework)}</span>
        </div>
        ${item.warnings.length > 0 ? renderWarnings(item.warnings) : ''}
        <details>
          <summary>查看解析代码片段</summary>
          <pre>${escapeHtml(item.sourceSnippet)}</pre>
        </details>
      </div>
    </section>
  `).join('');

  return `
    <section class="hero">
      <div class="card">
        <h2>审查解析的测试用例</h2>
        <p class="muted">确认组件和检测到的用例，然后生成标签。</p>
        <div class="context-grid">
          <div><strong>模式</strong><p>${escapeHtml(review.selectionMode)}</p></div>
          <div><strong>框架</strong><p>${escapeHtml(review.framework)}</p></div>
        </div>
      </div>
      <div class="card">
        <h2>范围</h2>
        <input id="team" type="hidden" value="${escapeHtml(review.team)}">
        <div class="field">
          <label for="component">组件</label>
          <input id="component" type="text" value="${escapeHtml(review.component)}" placeholder="PAYMENT">
        </div>
      </div>
    </section>

    <section class="card">
      <h2>解析摘要</h2>
      <p class="muted">检测到 ${review.cases.length} 个候选测试用例。</p>
      ${renderWarnings(review.warnings)}
    </section>

    <div class="toolbar">
      <button id="reparse" class="secondary">重新解析</button>
      <button id="selectAll" class="secondary">全选</button>
      <button id="selectNone" class="secondary">取消全选</button>
      <button id="generate">生成标签</button>
      <button id="close" class="secondary">关闭</button>
    </div>

    <section class="case-list">${cases}</section>
  `;
}

function renderResultContent(session: GenerationSession): string {
  const generated = session.results.filter((item) => item.conflictStatus === 'none').length;
  const duplicates = session.results.filter((item) => item.isDuplicate).length;
  const revisions = session.results.filter((item) => item.isNewRevision).length;
  const conflicts = session.results.filter((item) => item.conflictStatus === 'path_collision').length;

  const rows = session.results.map((item) => `
    <div class="label-row status-${escapeHtml(item.conflictStatus)}">
      <div class="case-header">
        <div>
          <h3>${escapeHtml(item.suiteName)} :: ${escapeHtml(item.caseName)}</h3>
          <p class="muted">${escapeHtml(item.conflictStatus)}${item.conflictReason ? ` · ${escapeHtml(item.conflictReason)}` : ''}</p>
        </div>
        <span class="pill">${item.isDuplicate ? '重复' : item.isNewRevision ? '新版本' : item.conflictStatus}</span>
      </div>
      <code>${escapeHtml(item.label)}</code>
      <p class="muted">CASE_HASH16B ${escapeHtml(item.caseHash16B)} · CONTENT_HASH16B ${escapeHtml(item.contentHash16B)}</p>
    </div>
  `).join('');

  return `
    <section class="card">
      <h2>生成结果</h2>
      <p class="muted">关闭前请检查生成的标签、重复用例和路径冲突。</p>
    </section>
    <section class="summary-grid">
      <div class="summary-box"><span class="muted">已生成</span><strong>${generated}</strong></div>
      <div class="summary-box"><span class="muted">重复</span><strong>${duplicates}</strong></div>
      <div class="summary-box"><span class="muted">新版本</span><strong>${revisions}</strong></div>
      <div class="summary-box"><span class="muted">冲突</span><strong>${conflicts}</strong></div>
    </section>
    <div class="toolbar">
      <button id="copyAll">复制全部标签</button>
      <button id="exportJson" class="secondary">导出 JSON</button>
      <button id="back" class="secondary">返回审查</button>
      <button id="done" class="secondary">完成</button>
    </div>
    <section>${rows}</section>
  `;
}

/**
 * Render the shell page once. Subsequent view transitions happen via postMessage,
 * keeping the DOM alive so the panel width never jumps.
 */
export function renderShellHtml(): string {
  const pageNonce = nonce();
  return `<!DOCTYPE html>
  <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${pageNonce}';">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>TestTrace</title>
      <style>${renderStyles()}</style>
    </head>
    <body>
      <main id="tt-main"></main>
      <script nonce="${pageNonce}">
        const vscode = acquireVsCodeApi();

        function setContent(html) {
          document.getElementById('tt-main').innerHTML = html;
        }

        function bindReviewEvents() {
          document.getElementById('selectAll').addEventListener('click', () => {
            document.querySelectorAll('.case-check').forEach((item) => item.checked = true);
          });
          document.getElementById('selectNone').addEventListener('click', () => {
            document.querySelectorAll('.case-check').forEach((item) => item.checked = false);
          });
          document.getElementById('reparse').addEventListener('click', () => {
            vscode.postMessage({ type: 'reparse' });
          });
          document.getElementById('close').addEventListener('click', () => {
            vscode.postMessage({ type: 'close' });
          });
          document.getElementById('generate').addEventListener('click', () => {
            const selectedIds = Array.from(document.querySelectorAll('.case-check:checked')).map((item) => item.value);
            vscode.postMessage({
              type: 'generate',
              team: document.getElementById('team').value,
              component: document.getElementById('component').value,
              selectedIds
            });
          });
        }

        function bindResultEvents(labels) {
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
        }

        window.addEventListener('message', (event) => {
          const msg = event.data;
          switch (msg.type) {
            case 'renderReview':
              setContent(msg.content);
              bindReviewEvents();
              break;
            case 'renderResult':
              setContent(msg.content);
              bindResultEvents(msg.labels);
              break;
          }
        });

        // Signal that the shell is ready
        vscode.postMessage({ type: 'shellReady' });
      </script>
    </body>
  </html>`;
}

/**
 * Build the review HTML content string (sent via postMessage to the shell).
 */
export function buildReviewContent(review: ReviewSession): string {
  return renderReviewContent(review);
}

/**
 * Build the result HTML content string (sent via postMessage to the shell).
 */
export function buildResultContent(session: GenerationSession): { content: string; labels: string } {
  return {
    content: renderResultContent(session),
    labels: session.results.map((item) => item.label).join('\n')
  };
}
