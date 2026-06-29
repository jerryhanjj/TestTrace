import path from 'node:path';

import * as vscode from 'vscode';

import { detectFramework } from './parsing/detect';
import { TestTraceServiceClient } from './service/client';
import type {
  Framework,
  GenerateLabelsResponse,
  GenerationSession,
  ParsePreviewRequest,
  ReviewSession,
  SelectionMode
} from './types';
import { buildResultContent, buildReviewContent, renderShellHtml } from './webview/panel';
import { computeRelativePath, getFileName } from './utils';

let currentPanel: vscode.WebviewPanel | undefined;
let lastReviewSession: ReviewSession | undefined;
let lastGenerationSession: GenerationSession | undefined;
let shellReady = false;

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('testTrace.generateFromCurrentFile', async () => {
      await runGenerateCommand(context, 'current_file');
    }),
    vscode.commands.registerCommand('testTrace.generateFromSelection', async () => {
      await runGenerateCommand(context, 'selection');
    }),
    vscode.commands.registerCommand('testTrace.reviewLastParseResult', async () => {
      if (lastGenerationSession) {
        showResultPanel(context, lastGenerationSession);
        return;
      }
      if (lastReviewSession) {
        showReviewPanel(context, lastReviewSession);
        return;
      }
      void vscode.window.showInformationMessage('暂无 TestTrace 会话记录。');
    })
  );
}

export function deactivate(): void {
  currentPanel?.dispose();
}

async function runGenerateCommand(
  context: vscode.ExtensionContext,
  selectionMode: SelectionMode
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showErrorMessage('请先打开 C 或 C++ 测试文件再运行 TestTrace。');
    return;
  }

  if (!['c', 'cpp'].includes(editor.document.languageId)) {
    void vscode.window.showErrorMessage('TestTrace 目前仅支持 C 和 C++ 编辑器。');
    return;
  }

  try {
    const review = await buildReviewSession(editor, selectionMode);
    lastReviewSession = review;
    lastGenerationSession = undefined;
    showReviewPanel(context, review);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TestTrace 会话准备失败。';
    void vscode.window.showErrorMessage(message);
  }
}

async function buildReviewSession(editor: vscode.TextEditor, requestedMode: SelectionMode): Promise<ReviewSession> {
  const document = editor.document;
  const fullFileText = document.getText();
  if (!fullFileText.trim()) {
    throw new Error('当前文件为空。');
  }

  const selectionStart = document.offsetAt(editor.selection.start);
  const selectionEnd = document.offsetAt(editor.selection.end);
  const selectedText = requestedMode === 'selection' && !editor.selection.isEmpty ? document.getText(editor.selection) : undefined;
  if (requestedMode === 'selection' && !selectedText?.trim()) {
    throw new Error('未选中任何文本。请使用"从当前文件生成标签"或先选中一个测试代码块。');
  }

  const detection = detectFramework(fullFileText, selectedText);
  let framework = detection.framework;
  if (!framework) {
    framework = await askForFramework();
  }

  let selectionMode = requestedMode;
  if (framework === 'cunit' && requestedMode === 'selection') {
    const choice = await vscode.window.showInformationMessage(
      'CUnit 解析依赖整个文件的注册上下文。是否切换到当前文件解析？',
      '使用当前文件',
      '取消'
    );
    if (choice !== '使用当前文件') {
      throw new Error('CUnit 选择区域解析已取消。');
    }
    selectionMode = 'current_file';
  }

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  const sourceRelativePath = computeRelativePath(document.uri.fsPath, workspaceFolder?.uri.fsPath);
  const fileName = getFileName(document.uri.fsPath || document.fileName || path.basename(document.fileName));
  const client = getServiceClient();
  const previewRequest: ParsePreviewRequest = {
    sourceRelativePath,
    fileName,
    language: document.languageId,
    frameworkHint: framework,
    selectionMode,
    selectionStart,
    selectionEnd,
    selectedText,
    fullFileText
  };
  const preview = await client.parsePreview(previewRequest);

  return {
    documentUri: document.uri.toString(),
    selectionMode,
    selectionStart,
    selectionEnd,
    fileName,
    sourceRelativePath,
    framework: preview.framework,
    team: preview.team?.code ?? '',
    component: preview.component?.code ?? '',
    teamConfidence: preview.team?.confidence,
    componentConfidence: preview.component?.confidence,
    teamSource: preview.team?.source,
    componentSource: preview.component?.source,
    warnings: preview.warnings,
    cases: preview.cases,
    fullFileText
  };
}

async function askForFramework(): Promise<Framework> {
  const choice = await vscode.window.showQuickPick(
    [
      { label: 'gtest', description: 'GoogleTest macro-based tests' },
      { label: 'cunit', description: 'CUnit suite and test registration' }
    ],
    { placeHolder: '请选择当前文件的测试框架。' }
  );
  if (!choice) {
    throw new Error('框架选择已取消。');
  }
  return choice.label as Framework;
}

function ensureShellPanel(context: vscode.ExtensionContext): vscode.WebviewPanel {
  if (currentPanel) {
    currentPanel.reveal(vscode.ViewColumn.Beside);
    return currentPanel;
  }

  currentPanel = vscode.window.createWebviewPanel(
    'testTraceReview',
    'TestTrace',
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true
    }
  );

  // Load the shell HTML once — all view transitions happen via postMessage.
  currentPanel.webview.html = renderShellHtml();

  currentPanel.webview.onDidReceiveMessage(async (message) => {
    switch (message.type) {
      case 'shellReady':
        shellReady = true;
        // If there's a pending review to show, render it now.
        if (lastReviewSession && !lastGenerationSession) {
          sendReviewToPanel(lastReviewSession);
        } else if (lastGenerationSession) {
          sendResultToPanel(lastGenerationSession);
        }
        return;
      case 'close':
        currentPanel?.dispose();
        return;
      case 'reparse': {
        if (!lastReviewSession) {
          return;
        }
        try {
          const refreshed = await rebuildReviewSession(lastReviewSession);
          lastReviewSession = refreshed;
          sendReviewToPanel(refreshed);
        } catch (error) {
          const detail = error instanceof Error ? error.message : '重新解析失败。';
          void vscode.window.showErrorMessage(detail);
        }
        return;
      }
      case 'generate': {
        if (!lastReviewSession) {
          void vscode.window.showErrorMessage('没有可用的审查会话。');
          return;
        }
        const team = String(message.team ?? '').trim();
        const component = String(message.component ?? '').trim();
        const selectedIds = Array.isArray(message.selectedIds) ? message.selectedIds.map(String) : [];
        if (!team || !component) {
          void vscode.window.showErrorMessage('范围自动检测失败，请检查后端路径映射规则。');
          return;
        }
        if (selectedIds.length === 0) {
          void vscode.window.showErrorMessage('请至少选中一个解析后的测试用例再生成标签。');
          return;
        }
        try {
          const response = await getServiceClient().generateLabels({
            sourceRelativePath: lastReviewSession.sourceRelativePath,
            fileName: lastReviewSession.fileName,
            framework: lastReviewSession.framework,
            team,
            component,
            selectedIds,
            cases: lastReviewSession.cases
          });
          const session = mergeGenerationSession(lastReviewSession, response);
          lastGenerationSession = session;
          lastReviewSession = session.review;
          sendResultToPanel(session);
        } catch (error) {
          const detail = error instanceof Error ? error.message : '标签生成失败。';
          void vscode.window.showErrorMessage(detail);
        }
        return;
      }
      case 'back': {
        if (lastReviewSession) {
          lastGenerationSession = undefined;
          sendReviewToPanel(lastReviewSession);
        }
        return;
      }
      case 'copyAll':
        await vscode.env.clipboard.writeText(String(message.labels ?? ''));
        void vscode.window.showInformationMessage('已将生成的标签复制到剪贴板。');
        return;
      case 'exportJson':
        if (lastGenerationSession) {
          await exportResult(lastGenerationSession);
        }
        return;
      default:
        return;
    }
  }, undefined, context.subscriptions);

  currentPanel.onDidDispose(() => {
    currentPanel = undefined;
    shellReady = false;
  }, undefined, context.subscriptions);

  return currentPanel;
}

function sendReviewToPanel(review: ReviewSession): void {
  if (!currentPanel || !shellReady) {
    return;
  }
  currentPanel.title = `TestTrace 审查 · ${review.fileName}`;
  currentPanel.webview.postMessage({
    type: 'renderReview',
    content: buildReviewContent(review)
  });
}

function sendResultToPanel(session: GenerationSession): void {
  if (!currentPanel || !shellReady) {
    return;
  }
  const { content, labels } = buildResultContent(session);
  currentPanel.title = `TestTrace 结果 · ${session.review.fileName}`;
  currentPanel.webview.postMessage({
    type: 'renderResult',
    content,
    labels
  });
}

function showReviewPanel(context: vscode.ExtensionContext, review: ReviewSession): void {
  ensureShellPanel(context);
  if (shellReady) {
    sendReviewToPanel(review);
  }
  // If shell is not yet ready, the shellReady handler will pick up lastReviewSession.
}

function showResultPanel(context: vscode.ExtensionContext, session: GenerationSession): void {
  ensureShellPanel(context);
  if (shellReady) {
    sendResultToPanel(session);
  }
  // If shell is not yet ready, the shellReady handler will pick up lastGenerationSession.
}

async function rebuildReviewSession(previous: ReviewSession): Promise<ReviewSession> {
  const uri = vscode.Uri.parse(previous.documentUri);

  // Reuse an already-visible editor so we never open a new tab.
  const existingEditor = vscode.window.visibleTextEditors.find(
    (e) => e.document.uri.toString() === previous.documentUri
  );

  if (existingEditor) {
    return buildReviewSession(existingEditor, previous.selectionMode);
  }

  // The file tab was closed — read from disk without showing any editor.
  const document = await vscode.workspace.openTextDocument(uri);
  const fullFileText = document.getText();
  if (!fullFileText.trim()) {
    throw new Error('当前文件为空。');
  }

  const detection = detectFramework(fullFileText, undefined);
  let framework = detection.framework;
  if (!framework) {
    framework = await askForFramework();
  }

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
  const sourceRelativePath = computeRelativePath(uri.fsPath, workspaceFolder?.uri.fsPath);
  const fileName = getFileName(uri.fsPath || document.fileName || path.basename(document.fileName));
  const client = getServiceClient();

  const preview = await client.parsePreview({
    sourceRelativePath,
    fileName,
    language: document.languageId,
    frameworkHint: framework,
    selectionMode: previous.selectionMode,
    selectionStart: previous.selectionStart,
    selectionEnd: previous.selectionEnd,
    selectedText: previous.selectionMode === 'selection'
      ? fullFileText.substring(previous.selectionStart, previous.selectionEnd)
      : undefined,
    fullFileText
  });

  return {
    ...previous,
    fileName,
    sourceRelativePath,
    framework: preview.framework,
    team: preview.team?.code ?? '',
    component: preview.component?.code ?? '',
    teamConfidence: preview.team?.confidence,
    componentConfidence: preview.component?.confidence,
    teamSource: preview.team?.source,
    componentSource: preview.component?.source,
    warnings: preview.warnings,
    cases: preview.cases,
    fullFileText
  };
}

async function exportResult(session: GenerationSession): Promise<void> {
  const target = await vscode.window.showSaveDialog({
    filters: {
      JSON: ['json']
    },
    saveLabel: '导出 TestTrace 结果',
    defaultUri: vscode.Uri.file(path.join(path.dirname(vscode.window.activeTextEditor?.document.uri.fsPath ?? ''), 'testtrace-results.json'))
  });
  if (!target) {
    return;
  }
  const payload = JSON.stringify(session, null, 2);
  await vscode.workspace.fs.writeFile(target, Buffer.from(payload, 'utf8'));
  void vscode.window.showInformationMessage(`已将 TestTrace 结果导出到 ${target.fsPath}。`);
}

function getServiceClient(): TestTraceServiceClient {
  const configuration = vscode.workspace.getConfiguration('testTrace');
  const baseUrl = configuration.get<string>('serviceBaseUrl', 'http://127.0.0.1:43125');
  return new TestTraceServiceClient(baseUrl);
}

function mergeGenerationSession(review: ReviewSession, response: GenerateLabelsResponse): GenerationSession {
  return {
    review: {
      ...review,
      team: response.team,
      component: response.component
    },
    results: response.results,
    warnings: response.warnings,
    conflicts: response.conflicts
  };
}
