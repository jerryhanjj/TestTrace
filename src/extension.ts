import path from 'node:path';

import * as vscode from 'vscode';

import { detectFramework } from './parsing/detect';
import { parseCUnit } from './parsing/cunit';
import { parseGTest } from './parsing/gtest';
import { generateLabels, LabelStore } from './labels';
import { resolveScope } from './scope';
import type {
  ConflictPolicy,
  Framework,
  GenerationSession,
  PathMappingRule,
  ReviewSession,
  SelectionMode
} from './types';
import { renderResultHtml, renderReviewHtml } from './webview/panel';
import { computeRelativePath, getFileName } from './utils';

let currentPanel: vscode.WebviewPanel | undefined;
let lastReviewSession: ReviewSession | undefined;
let lastGenerationSession: GenerationSession | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const store = new LabelStore(context.workspaceState);

  context.subscriptions.push(
    vscode.commands.registerCommand('testTrace.generateFromCurrentFile', async () => {
      await runGenerateCommand(context, store, 'current_file');
    }),
    vscode.commands.registerCommand('testTrace.generateFromSelection', async () => {
      await runGenerateCommand(context, store, 'selection');
    }),
    vscode.commands.registerCommand('testTrace.reviewLastParseResult', async () => {
      if (lastGenerationSession) {
        showResultPanel(context, lastGenerationSession);
        return;
      }
      if (lastReviewSession) {
        showReviewPanel(context, lastReviewSession, store);
        return;
      }
      void vscode.window.showInformationMessage('No previous TestTrace session is available yet.');
    }),
    vscode.commands.registerCommand('testTrace.configurePathMapping', async () => {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'testTrace.pathMappings');
    })
  );
}

export function deactivate(): void {
  currentPanel?.dispose();
}

async function runGenerateCommand(
  context: vscode.ExtensionContext,
  store: LabelStore,
  selectionMode: SelectionMode
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showErrorMessage('Open a C or C++ test file before running TestTrace.');
    return;
  }

  if (!['c', 'cpp'].includes(editor.document.languageId)) {
    void vscode.window.showErrorMessage('TestTrace currently supports only C and C++ editors.');
    return;
  }

  try {
    const review = await buildReviewSession(editor, selectionMode);
    lastReviewSession = review;
    lastGenerationSession = undefined;
    showReviewPanel(context, review, store);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to prepare the TestTrace session.';
    void vscode.window.showErrorMessage(message);
  }
}

async function buildReviewSession(editor: vscode.TextEditor, requestedMode: SelectionMode): Promise<ReviewSession> {
  const document = editor.document;
  const fullFileText = document.getText();
  if (!fullFileText.trim()) {
    throw new Error('The current file is empty.');
  }

  const selectionStart = document.offsetAt(editor.selection.start);
  const selectionEnd = document.offsetAt(editor.selection.end);
  const selectedText = requestedMode === 'selection' && !editor.selection.isEmpty ? document.getText(editor.selection) : undefined;
  if (requestedMode === 'selection' && !selectedText?.trim()) {
    throw new Error('No text is selected. Use Generate Labels from Current File or select a test block first.');
  }

  const detection = detectFramework(fullFileText, selectedText);
  let framework = detection.framework;
  if (!framework) {
    framework = await askForFramework();
  }

  let selectionMode = requestedMode;
  if (framework === 'cunit' && requestedMode === 'selection') {
    const choice = await vscode.window.showInformationMessage(
      'CUnit parsing relies on whole-file registration context. Switch to current-file parsing?',
      'Use Current File',
      'Cancel'
    );
    if (choice !== 'Use Current File') {
      throw new Error('CUnit selection parsing was cancelled.');
    }
    selectionMode = 'current_file';
  }

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  const sourceRelativePath = computeRelativePath(document.uri.fsPath, workspaceFolder?.uri.fsPath);
  const fileName = getFileName(document.uri.fsPath || document.fileName || path.basename(document.fileName));
  const configuration = vscode.workspace.getConfiguration('testTrace', document.uri);
  const rules = configuration.get<PathMappingRule[]>('pathMappings', []);
  const autoDetectScope = configuration.get<boolean>('autoDetectScope', true);
  const scope = resolveScope(sourceRelativePath, rules, autoDetectScope);

  const parsedCases = framework === 'gtest'
    ? parseGTest(fullFileText, fileName, sourceRelativePath)
    : parseCUnit(fullFileText, fileName, sourceRelativePath);

  let cases = parsedCases;
  const warnings = [...detection.warnings, ...scope.warnings];
  if (selectionMode === 'selection') {
    cases = parsedCases.filter((item) => overlaps(item.startOffset, item.endOffset, selectionStart, selectionEnd));
    if (cases.length === 0) {
      throw new Error('The current selection does not overlap a full gtest case. Expand the selection or use current-file parsing.');
    }
    warnings.push('selection_filtered_cases');
  }

  if (cases.length === 0) {
    throw new Error(`No ${framework} test cases were detected in the current input.`);
  }

  return {
    documentUri: document.uri.toString(),
    selectionMode,
    selectionStart,
    selectionEnd,
    fileName,
    sourceRelativePath,
    framework,
    team: scope.team?.code ?? '',
    component: scope.component?.code ?? '',
    teamConfidence: scope.team?.confidence,
    componentConfidence: scope.component?.confidence,
    teamSource: scope.team?.source,
    componentSource: scope.component?.source,
    warnings,
    cases,
    fullFileText
  };
}

async function askForFramework(): Promise<Framework> {
  const choice = await vscode.window.showQuickPick(
    [
      { label: 'gtest', description: 'GoogleTest macro-based tests' },
      { label: 'cunit', description: 'CUnit suite and test registration' }
    ],
    { placeHolder: 'Select the test framework for the current file.' }
  );
  if (!choice) {
    throw new Error('Framework selection was cancelled.');
  }
  return choice.label as Framework;
}

function showReviewPanel(context: vscode.ExtensionContext, review: ReviewSession, store: LabelStore): void {
  const panel = ensurePanel(context);
  panel.title = `TestTrace Review · ${review.fileName}`;
  panel.webview.html = renderReviewHtml(review);
  panel.webview.onDidReceiveMessage(async (message) => {
    switch (message.type) {
      case 'close':
        panel.dispose();
        return;
      case 'reparse': {
        try {
          const refreshed = await rebuildReviewSession(review);
          lastReviewSession = refreshed;
          showReviewPanel(context, refreshed, store);
        } catch (error) {
          const detail = error instanceof Error ? error.message : 'Reparse failed.';
          void vscode.window.showErrorMessage(detail);
        }
        return;
      }
      case 'generate': {
        if (!lastReviewSession) {
          void vscode.window.showErrorMessage('No active review session is available.');
          return;
        }
        const team = String(message.team ?? '').trim();
        const component = String(message.component ?? '').trim();
        const selectedIds = Array.isArray(message.selectedIds) ? message.selectedIds.map(String) : [];
        if (!team || !component) {
          void vscode.window.showErrorMessage('Team and component are required before generating labels.');
          return;
        }
        if (selectedIds.length === 0) {
          void vscode.window.showErrorMessage('Select at least one parsed test case before generating labels.');
          return;
        }
        try {
          const configuration = vscode.workspace.getConfiguration('testTrace');
          const conflictPolicy = configuration.get<ConflictPolicy>('conflictPolicy', 'default');
          const session = await generateLabels(lastReviewSession, selectedIds, team, component, conflictPolicy, store);
          lastGenerationSession = session;
          lastReviewSession = session.review;
          showResultPanel(context, session);
        } catch (error) {
          const detail = error instanceof Error ? error.message : 'Label generation failed.';
          void vscode.window.showErrorMessage(detail);
        }
        return;
      }
      default:
        return;
    }
  }, undefined, context.subscriptions);
}

function showResultPanel(context: vscode.ExtensionContext, session: GenerationSession): void {
  const panel = ensurePanel(context);
  panel.title = `TestTrace Results · ${session.review.fileName}`;
  panel.webview.html = renderResultHtml(session);
  panel.webview.onDidReceiveMessage(async (message) => {
    switch (message.type) {
      case 'close':
        panel.dispose();
        return;
      case 'back':
        if (lastReviewSession) {
          showReviewPanel(context, lastReviewSession, new LabelStore(context.workspaceState));
        }
        return;
      case 'copyAll':
        await vscode.env.clipboard.writeText(String(message.labels ?? ''));
        void vscode.window.showInformationMessage('Copied generated labels to the clipboard.');
        return;
      case 'exportJson':
        await exportResult(session);
        return;
      default:
        return;
    }
  }, undefined, context.subscriptions);
}

function ensurePanel(context: vscode.ExtensionContext): vscode.WebviewPanel {
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
  currentPanel.onDidDispose(() => {
    currentPanel = undefined;
  }, undefined, context.subscriptions);
  return currentPanel;
}

async function rebuildReviewSession(previous: ReviewSession): Promise<ReviewSession> {
  const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(previous.documentUri));
  const editor = await vscode.window.showTextDocument(document, { preview: false, preserveFocus: true });
  if (previous.selectionMode === 'selection') {
    editor.selection = new vscode.Selection(document.positionAt(previous.selectionStart), document.positionAt(previous.selectionEnd));
  }
  return buildReviewSession(editor, previous.selectionMode);
}

async function exportResult(session: GenerationSession): Promise<void> {
  const target = await vscode.window.showSaveDialog({
    filters: {
      JSON: ['json']
    },
    saveLabel: 'Export TestTrace Results',
    defaultUri: vscode.Uri.file(path.join(path.dirname(vscode.window.activeTextEditor?.document.uri.fsPath ?? ''), 'testtrace-results.json'))
  });
  if (!target) {
    return;
  }
  const payload = JSON.stringify(session, null, 2);
  await vscode.workspace.fs.writeFile(target, Buffer.from(payload, 'utf8'));
  void vscode.window.showInformationMessage(`Exported TestTrace results to ${target.fsPath}.`);
}

function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA <= endB && startB <= endA;
}