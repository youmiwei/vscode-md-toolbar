// Markdown 工具栏 v0.6.0
// 主形态：状态栏按钮条（ESP-IDF 风格）。按窗口宽度自适应：放得下就全显示，放不下就收起尾部并出现「更多」。
// 备选形态：CodeLens 文字条 / 标签栏图标按钮（默认关闭）
const vscode = require('vscode');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const CFG = 'mdToolbar';

/** 取当前活动的 Markdown 文本编辑器 */
function md() {
  const ed = vscode.window.activeTextEditor;
  if (!ed || ed.document.languageId !== 'markdown') {
    vscode.window.showWarningMessage('Markdown 工具栏：请先把光标放到一个 Markdown 文档里');
    return undefined;
  }
  return ed;
}

/** 有选中则包裹；没选中则插入占位符并选中，直接打字即可覆盖 */
async function wrap(before, after, placeholder) {
  const ed = md();
  if (!ed) return;
  const sel = ed.selection;
  const picked = ed.document.getText(sel);
  if (picked) {
    await ed.edit((b) => b.replace(sel, before + picked + after));
  } else {
    await ed.insertSnippet(new vscode.SnippetString(`${before}\${1:${placeholder}}${after}`), sel);
  }
}

/** 给选中行（或当前行）行首加前缀，先剥掉已有的同类标记 */
async function prefixLines(prefix) {
  const ed = md();
  if (!ed) return;
  const doc = ed.document;
  const edits = [];
  for (let i = ed.selection.start.line; i <= ed.selection.end.line; i++) {
    const line = doc.lineAt(i);
    if (!line.text.trim()) continue;
    const m = /^(\s*)(.*)$/.exec(line.text);
    const body = m[2].replace(/^(#{1,6}\s+|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+|>\s*)/, '');
    edits.push({ range: line.range, text: m[1] + prefix + body });
  }
  if (edits.length) await ed.edit((b) => edits.forEach((e) => b.replace(e.range, e.text)));
}

/** 优先转调 Markdown All in One 的命令，没有就退回本地实现 */
async function maio(cmd, fallback) {
  const all = await vscode.commands.getCommands(true);
  return all.includes(cmd) ? vscode.commands.executeCommand(cmd) : fallback();
}

// ---------------------------------------------------------------------------
// 状态栏按钮条
// ---------------------------------------------------------------------------
/** 身份项：最左边，点击 = 全部命令 */
const ANCHOR = {
  icon: '$(markdown)',
  label: 'Markdown',
  cmd: 'mdToolbar.more',
  tip: '**Markdown 工具栏**\n\n点击查看全部命令（也可按 `Ctrl+Alt+M`）',
};

/** 溢出时出现的「更多」 */
const MORE = {
  icon: '$(ellipsis)',
  label: '更多',
  cmd: 'mdToolbar.more',
  tip: '**更多命令**　`Ctrl+Alt+M`\n\n窗口放不下的按钮都收在这里',
};

/** 可放进状态栏的动作（顺序即显示顺序，前几个最重要） */
const ACTIONS = [
  { icon: '$(bold)', label: '加粗', cmd: 'mdToolbar.bold',
    tip: '**加粗**　`Ctrl+B`\n\n选中文字 → 包裹成 `**文字**`；未选中 → 插入 `**文本**` 并选中占位符' },
  { icon: '$(italic)', label: '斜体', cmd: 'mdToolbar.italic',
    tip: '**斜体**　`Ctrl+I`\n\n选中文字 → 包裹成 `*文字*`' },
  { icon: '$(code)', label: '代码', cmd: 'mdToolbar.code',
    tip: '**行内代码**\n\n选中文字 → 包裹成 `` `code` ``' },
  { icon: '$(symbol-number)', label: '标题', cmd: 'mdToolbar.heading',
    tip: '**标题级别**　`Ctrl+Shift+]` / `Ctrl+Shift+[`\n\n点击后用 QuickPick 选 # ~ ####' },
  { icon: '$(list-unordered)', label: '列表', cmd: 'mdToolbar.list',
    tip: '**列表**\n\n点击后选择 `-` / `*` / `1.` / `1)`' },
  { icon: '$(checklist)', label: '任务', cmd: 'mdToolbar.checklist',
    tip: '**任务列表**　`Alt+C`\n\n切换当前行/选中行的 `- [ ]` 标记' },
  { icon: '$(quote)', label: '引用', cmd: 'mdToolbar.quote',
    tip: '**引用**\n\n给当前行/选中行加 `> ` 前缀' },
  { icon: '$(table)', label: '表格', cmd: 'mdToolbar.table',
    tip: '**插入表格**\n\n插入 2×2 表格骨架，用 `Tab` 在单元格之间跳' },
  { icon: '$(symbol-operator)', label: '公式', cmd: 'mdToolbar.math',
    tip: '**行内公式**　`Ctrl+M`\n\n插入 `$公式$`' },
  { icon: '$(link)', label: '链接', cmd: 'mdToolbar.link',
    tip: '**插入链接**\n\n把选中的文字变成 `[文字](url)`' },
  { icon: '$(file-media)', label: '图片', cmd: 'mdToolbar.image',
    tip: '**插入图片**\n\n插入 `<img src="assets/路径" alt="">`（HTML，便于后续调尺寸/对齐）' },
  { icon: '$(file-code)', label: '代码块', cmd: 'mdToolbar.codeblock',
    tip: '**代码块**\n\n插入带语言标记的围栏代码块' },
  { icon: '$(graph)', label: 'SVG', cmd: 'mdToolbar.svg',
    tip: '**drawio 画布（SVG）**\n\n插入一个空的 ```drawio 代码块；\n渲染、编辑、锁定由 hediet.vscode-drawio 扩展提供（代码块上方有 Preview / Unlock）' },
  { icon: '$(dash)', label: '分割线', cmd: 'mdToolbar.hr',
    tip: '**分割线**\n\n插入 `---`' },
  { icon: '$(list-tree)', label: '目录', cmd: 'mdToolbar.toc',
    tip: '**创建/更新目录**\n\n调用 Markdown All in One 的 TOC 命令' },
  { icon: '$(wand)', label: '格式', cmd: 'mdToolbar.format',
    tip: '**格式化文档**　`Shift+Alt+F`\n\n调用当前 Markdown 默认格式化器整理整篇：\n表格列宽对齐、列表缩进、块之间空行、代码块围栏…\n\n（用哪个格式化器由 settings 的 `\"[markdown]\" → editor.defaultFormatter` 决定）\n只格式化一部分：选中后按 `Ctrl+K Ctrl+F`' },
];

/** 跑一条命令，失败返回空串（不抛错） */
function runCmd(cmd, args, timeout = 1500) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout, windowsHide: true }, (err, stdout) => resolve(err ? '' : String(stdout || '')));
  });
}

/** Linux/X11：wmctrl -lG */
async function probeLinux() {
  const out = await runCmd('wmctrl', ['-lG']);
  if (!out) return 0;
  const wsName = vscode.workspace.name || '';
  let best = 0;
  let exact = 0;
  for (const line of out.split('\n')) {
    const t = line.trim();
    if (!t || !/Visual Studio Code\s*$/.test(t)) continue;
    const f = t.split(/\s+/);
    const w = parseInt(f[4], 10);
    if (!Number.isFinite(w)) continue;
    if (w > best) best = w;
    if (wsName && f.slice(7).join(' ').includes(wsName) && w > exact) exact = w;
  }
  return exact || best;
}

/** Windows：PowerShell 取 VS Code 主窗口的 GetWindowRect 宽度 */
async function probeWindows() {
  const ps = [
    '$ErrorActionPreference = "SilentlyContinue";',
    'Add-Type -AssemblyName System.Windows.Forms | Out-Null;',
    'Add-Type @"',
    'using System;',
    'using System.Runtime.InteropServices;',
    'public struct RECT { public int Left, Top, Right, Bottom; }',
    'public class MdTbWin {',
    '  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);',
    '}',
    '"@;',
    '$proc = Get-Process -Name Code | Where-Object { $_.MainWindowHandle -ne 0 } |',
    '  Sort-Object -Property @{Expression={ if ($_.MainWindowTitle -like "*Visual Studio Code*") {0} else {1} }} |',
    '  Select-Object -First 1;',
    'if ($proc) { $r = New-Object RECT; [MdTbWin]::GetWindowRect($proc.MainWindowHandle, [ref]$r) | Out-Null;',
    '  Write-Output ($r.Right - $r.Left) }',
  ].join('\n');
  const out = await runCmd('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], 4000);
  const n = parseInt(String(out).trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** macOS：osascript 取 Code 进程前窗尺寸（需要辅助功能权限） */
async function probeMac() {
  const out = await runCmd(
    'osascript',
    ['-e', 'tell application "System Events" to tell process "Code" to get size of front window'],
    4000
  );
  const n = parseInt(String(out).trim().split(',')[0], 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** 读取 VS Code 窗口宽度（像素）；读不到返回 0 */
async function probeWindowWidth() {
  const manual = Number(vscode.workspace.getConfiguration(CFG).get('statusBar.manualWidth', 0)) || 0;
  if (manual > 0) return manual;
  try {
    if (process.platform === 'linux') return await probeLinux();
    if (process.platform === 'win32') return await probeWindows();
    if (process.platform === 'darwin') return await probeMac();
  } catch (e) {
    console.warn('[md-toolbar] 探测窗口宽度失败：', e && e.message);
  }
  return 0;
}

/** 估算这一宽度能放几个按钮（留白与单项宽度都可在设置里调） */
function fitCount(width, showLabels) {
  const cfg = vscode.workspace.getConfiguration(CFG);
  const reserve = Number(cfg.get('statusBar.reservePx', 820)) || 0;
  const perItem = showLabels
    ? Number(cfg.get('statusBar.itemWidthPx', 74)) || 74
    : Number(cfg.get('statusBar.iconWidthPx', 32)) || 32;
  const avail = width - reserve;
  if (avail <= 0) return 2;
  return Math.max(2, Math.floor(avail / Math.max(10, perItem)));
}

/** 按设置把主题写入 media/theme.css（预览通过 markdown.previewStyles 引用它） */
function applyPreviewTheme(context) {
  const theme = vscode.workspace.getConfiguration(CFG).get('preview.theme', 'auto');
  const target = path.join(context.extensionPath, 'media', 'theme.css');
  const src = path.join(context.extensionPath, 'media', 'theme-light.css');
  let content = '/* md-toolbar: preview.theme = ' + theme + '，不注入主题覆盖（跟随编辑器） */\n';
  if (theme === 'light') {
    try {
      content = fs.readFileSync(src, 'utf8');
    } catch (e) {
      console.warn('[md-toolbar] 读取 theme-light.css 失败：', e && e.message);
      return;
    }
  }
  try {
    let old = '';
    try { old = fs.readFileSync(target, 'utf8'); } catch (e) { /* 文件不存在时按空处理 */ }
    if (old !== content) fs.writeFileSync(target, content, 'utf8');
  } catch (e) {
    console.warn('[md-toolbar] 写入 media/theme.css 失败（扩展目录只读？）：', e && e.message);
  }
}

let visibleActionsCount = ACTIONS.length;

function createStatusBar(context) {
  const make = (it, prio) => {
    const bar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, prio);
    bar.name = it.label;
    bar.command = it.cmd;
    bar.tooltip = new vscode.MarkdownString(it.tip);
    context.subscriptions.push(bar);
    return bar;
  };

  const anchor = make(ANCHOR, 1000);
  const actionBars = ACTIONS.map((a, i) => make(a, 990 - i));
  const moreBar = make(MORE, 990 - ACTIONS.length);

  let windowWidth = 0;
  let probeFailed = false;
  let probing = false;
  visibleActionsCount = ACTIONS.length;

  const isMd = () => vscode.window.activeTextEditor?.document.languageId === 'markdown';

  const refresh = () => {
    const c = vscode.workspace.getConfiguration(CFG);
    const enabled = c.get('statusBar.enabled', true);
    const showLabels = c.get('statusBar.showLabels', true);
    const cap = c.get('statusBar.maxItems', 0);
    const autoFit = c.get('statusBar.autoFit', true);

    // 槽位：身份项 1 + 动作 + (溢出时再多 1 个「更多」)
    let slots = autoFit && windowWidth > 0 ? fitCount(windowWidth, showLabels) : Infinity;
    if (cap > 0) slots = Math.min(slots, cap);

    const roomForAll = slots >= 1 + ACTIONS.length;
    const visibleActions = roomForAll ? ACTIONS.length : Math.max(0, Math.min(ACTIONS.length, slots - 2));
    const showMore = !roomForAll;

    const on = enabled && isMd();
    const text = (it) => (showLabels ? `${it.icon} ${it.label}` : it.icon);

    anchor.text = text(ANCHOR);
    on ? anchor.show() : anchor.hide();

    actionBars.forEach((bar, i) => {
      bar.text = text(ACTIONS[i]);
      on && i < visibleActions ? bar.show() : bar.hide();
    });

    visibleActionsCount = on ? visibleActions : 0;
    moreBar.text = text(MORE);
    on && showMore ? moreBar.show() : moreBar.hide();
  };

  const probe = async () => {
    if (probing || probeFailed || !isMd()) return;
    // 窗口没焦点时用户看不到状态栏，先不探测，等 onDidChangeWindowState 再补
    if (vscode.window.state && vscode.window.state.focused === false) return;
    probing = true;
    try {
      const w = await probeWindowWidth();
      if (w > 0) {
        if (w !== windowWidth) {
          windowWidth = w;
          refresh();
        }
      } else {
        probeFailed = true;
        windowWidth = 0;
        refresh();
      }
    } finally {
      probing = false;
    }
  };

  refresh();
  probe();
  // Windows/macOS 每次探测都要起一个进程，放宽到 3 秒
  const intervalMs = process.platform === 'linux' ? 1000 : 3000;
  const timer = setInterval(probe, intervalMs);
  context.subscriptions.push({ dispose: () => clearInterval(timer) });

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      refresh();
      probe();
    })
  );
  context.subscriptions.push(
    vscode.window.onDidChangeWindowState(() => probe())
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(CFG)) refresh();
    })
  );
}

// ---------------------------------------------------------------------------
// CodeLens 文字条（备选，默认关闭）
// ---------------------------------------------------------------------------
const LENS_ITEMS = [
  ['加粗', 'mdToolbar.bold'],
  ['斜体', 'mdToolbar.italic'],
  ['行内代码', 'mdToolbar.code'],
  ['标题', 'mdToolbar.heading'],
  ['列表', 'mdToolbar.list'],
  ['任务', 'mdToolbar.checklist'],
  ['表格', 'mdToolbar.table'],
  ['公式', 'mdToolbar.math'],
  ['图片', 'mdToolbar.image'],
  ['全部…', 'mdToolbar.more'],
];

const lensEmitter = new vscode.EventEmitter();

class MdToolbarLensProvider {
  provideCodeLenses(document) {
    const cfg = vscode.workspace.getConfiguration(CFG);
    if (!cfg.get('codeLens.enabled', false)) return [];
    if (document.lineCount < 1) return [];
    const range = new vscode.Range(0, 0, 0, 0);
    return LENS_ITEMS.map(
      ([title, command]) =>
        new vscode.CodeLens(range, { title, command, tooltip: `Markdown 工具栏：${title}` })
    );
  }
}


// ---------------------------------------------------------------------------
// 表格 / 图片 辅助
// ---------------------------------------------------------------------------

function buildTable(rows, cols) {
  const header = '| ' + Array.from({ length: cols }, (_, i) => '列 ' + (i + 1)).join(' | ') + ' |';
  const delim = '| ' + Array(cols).fill('---').join(' | ') + ' |';
  const body = Array.from({ length: rows }, () => '| ' + Array(cols).fill('  ').join(' | ') + ' |');
  return [header, delim, ...body].join('\n') + '\n';
}

function activate(context) {
  // 换 publisher / 换版本时，旧实例可能还占着同名命令（内存里还没卸载），
  // 这里跳过重复注册，避免整个 activate 抛错导致工具栏消失。
  const reg = (id, fn) => {
    try {
      context.subscriptions.push(vscode.commands.registerCommand(id, fn));
    } catch (e) {
      console.warn(`[md-toolbar] 命令 ${id} 已由其它实例注册，跳过：${e && e.message}`);
    }
  };

  // —— 包裹类：直接复用 MAIO 的 toggle 语义 ——
  reg('mdToolbar.bold', () => maio('markdown.extension.editing.toggleBold', () => wrap('**', '**', '文本')));
  reg('mdToolbar.italic', () => maio('markdown.extension.editing.toggleItalic', () => wrap('*', '*', '斜体')));
  reg('mdToolbar.code', () => maio('markdown.extension.editing.toggleCodeSpan', () => wrap('`', '`', 'code')));
  reg('mdToolbar.math', () => maio('markdown.extension.editing.toggleMath', () => wrap('$', '$', 'x')));

  // —— 行前缀类 ——
  reg('mdToolbar.heading', async () => {
    const items = [
      { label: '一级标题  #', prefix: '# ' },
      { label: '二级标题  ##', prefix: '## ' },
      { label: '三级标题  ###', prefix: '### ' },
      { label: '四级标题  ####', prefix: '#### ' },
    ];
    const picked = await vscode.window.showQuickPick(items, { placeHolder: '标题级别' });
    if (picked) await prefixLines(picked.prefix);
  });

  reg('mdToolbar.list', async () => {
    const items = [
      { label: '无序列表  -', prefix: '- ' },
      { label: '无序列表  *', prefix: '* ' },
      { label: '有序列表  1.', prefix: '1. ' },
      { label: '有序列表  1)', prefix: '1) ' },
    ];
    const picked = await vscode.window.showQuickPick(items, { placeHolder: '列表标记' });
    if (picked) await prefixLines(picked.prefix);
  });

  reg('mdToolbar.checklist', () => prefixLines('- [ ] '));
  reg('mdToolbar.quote', () => prefixLines('> '));

  // —— 片段类：带 Tab 跳位 ——
  reg('mdToolbar.link', async () => {
    const ed = md();
    if (!ed) return;
    const picked = ed.document.getText(ed.selection);
    await ed.insertSnippet(
      new vscode.SnippetString(`[\${1:${picked || '文字'}}](\${2:https://})`),
      ed.selection
    );
  });

  reg('mdToolbar.image', async () => {
    const ed = md();
    if (!ed) return;
    // 一次插入完整模板：路径 / 图注(alt) / 尺寸 / 对齐
    // 之后想调就直接改这行 HTML 的属性值
    await ed.insertSnippet(
      new vscode.SnippetString(
        '<img src="${1:assets/}" alt="${2:图注}" style="width:${3:50%}" class="md-${4:center}">'
      ),
      ed.selection
    );
  });

  reg('mdToolbar.table', async () => {
    const choice = await vscode.window.showQuickPick(
      [
        { label: '2 × 2（默认）', rows: 2, cols: 2, def: true },
        { label: '自定义行列…', custom: true },
      ],
      { placeHolder: '插入表格（行 = 数据行，不含表头）' }
    );
    if (!choice) return;
    const ed = md();
    if (!ed) return;

    if (choice.def) {
      // 默认档保留原来的 Tab 跳位手感
      await ed.insertSnippet(
        new vscode.SnippetString('| ${1:列 1} | ${2:列 2} |\n| --- | --- |\n| ${3:} | ${4:} |\n'),
        ed.selection
      );
      return;
    }

    const r = await vscode.window.showInputBox({
      prompt: '数据行数（1–50）', value: '2',
      validateInput: (v) => (/^\d+$/.test(v) && +v >= 1 && +v <= 50 ? undefined : '请输入 1–50 的整数'),
    });
    if (r === undefined) return;
    const c = await vscode.window.showInputBox({
      prompt: '列数（1–20）', value: '3',
      validateInput: (v) => (/^\d+$/.test(v) && +v >= 1 && +v <= 20 ? undefined : '请输入 1–20 的整数'),
    });
    if (c === undefined) return;

    const text = buildTable(+r, +c);
    const at = ed.selection.start;
    await ed.edit((b) => b.replace(ed.selection, text));
    const caret = new vscode.Position(at.line, text.indexOf('列 1'));
    ed.selection = new vscode.Selection(caret, caret.translate(0, '列 1'.length));
    ed.revealRange(new vscode.Range(caret, caret), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  });

  reg('mdToolbar.codeblock', async () => {
    const ed = md();
    if (!ed) return;
    await ed.insertSnippet(new vscode.SnippetString('```${1:python}\n${2:}\n```\n'), ed.selection);
  });

  reg('mdToolbar.svg', async () => {
    const ed = md();
    if (!ed) return;
    // 与 hediet.vscode-drawio 的 drawio-inline-editor.insertDiagram 生成的块保持完全一致：
    // createEmptyDiagram() + buildDiagramBlock(..., locked=false, width=800)
    const block = [
      '```drawio width=800',
      '<mxfile>',
      '  <diagram id="default" name="Page-1">',
      '    <mxGraphModel>',
      '      <root>',
      '        <mxCell id="0"/>',
      '        <mxCell id="1" parent="0"/>',
      '      </root>',
      '    </mxGraphModel>',
      '  </diagram>',
      '</mxfile>',
      '```',
      '',
    ].join('\n');
    // 光标前若已有内容，先补一个换行，避免代码块粘在正文后面
    const line = ed.document.lineAt(ed.selection.active.line);
    const before = line.text.slice(0, ed.selection.active.character);
    const prefix = before.trim() ? '\n' : '';
    await ed.edit((b) => b.replace(ed.selection, prefix + block));
  });

  reg('mdToolbar.hr', async () => {
    const ed = md();
    if (!ed) return;
    await ed.insertSnippet(new vscode.SnippetString('\n---\n'), ed.selection);
  });

  reg('mdToolbar.toc', async () => {
    const all = await vscode.commands.getCommands(true);
    if (!all.includes('markdown.extension.toc.create')) {
      const pick = await vscode.window.showWarningMessage(
        '创建/更新目录需要 Markdown All in One 扩展', '打开扩展页'
      );
      if (pick) await vscode.commands.executeCommand('extension.open', 'yzhang.markdown-all-in-one');
      return;
    }
    return vscode.commands.executeCommand('markdown.extension.toc.create');
  });
  reg('mdToolbar.format', () => vscode.commands.executeCommand('editor.action.formatDocument'));

  // —— 全量菜单（Ctrl+Alt+M），与状态栏共用同一份 ACTIONS ——
  reg('mdToolbar.more', async () => {
    const toItem = (a) => ({ label: `${a.icon} ${a.label}`, cmd: a.cmd, detail: a.tip ? a.tip.split('\n')[0] : undefined });
    const hidden = ACTIONS.slice(visibleActionsCount);
    const shown = ACTIONS.slice(0, visibleActionsCount);
    const items = [
      ...hidden.map(toItem),
      ...(hidden.length && shown.length
        ? [{ label: '状态栏上已有的命令', kind: vscode.QuickPickItemKind.Separator }]
        : []),
      ...shown.map(toItem),
    ];
    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: hidden.length ? `Markdown：${hidden.length} 个命令未显示在状态栏` : 'Markdown：选择要插入的内容',
    });
    if (picked) await vscode.commands.executeCommand(picked.cmd);
  });





  applyPreviewTheme(context);
  createStatusBar(context);
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider({ language: 'markdown' }, new MdToolbarLensProvider())
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration(CFG)) return;
      lensEmitter.fire();
      if (e.affectsConfiguration(CFG + '.preview.theme')) applyPreviewTheme(context);
    })
  );
}

function deactivate() {
  lensEmitter.dispose();
}

module.exports = { activate, deactivate };
