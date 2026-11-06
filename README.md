# Markdown 工具栏（md-toolbar）v1.0.0

VS Code 本地扩展：**在窗口最底部的状态栏放一排按钮**（参考 ESP-IDF 扩展的样式：图标 + 悬停说明 + 点击执行），
只在 Markdown 文档激活时出现，点一下就在光标处插入/包裹对应语法。

CodeLens 文字条、标签栏图标按钮作为备选形态保留（默认关闭）。

## 安装 / 更新

```bash
rm -rf ~/.vscode/extensions/smh.md-toolbar-0.*
mkdir -p ~/.vscode/extensions/youmiweidemi.md-toolbar-0.8.0
cp package.json extension.js ~/.vscode/extensions/youmiweidemi.md-toolbar-0.8.0/
```

然后 `Ctrl+Shift+P` → **Developer: Reload Window**（首次安装可自动识别，换版本需要重载）。

## 卸载

```bash
rm -rf ~/.vscode/extensions/smh.md-toolbar-0.*
```

## 两种形态（settings.json）

| 设置 | 默认 | 效果 |
|---|---|---|
| `mdToolbar.statusBar.enabled` | `true` | 状态栏一排按钮（16 项，图标+中文标签） |
| `mdToolbar.statusBar.showLabels` | `true` | 是否显示中文标签；关掉只留图标（窄屏用） |
| `mdToolbar.statusBar.maxItems` | `0` | 硬上限，0=不限 |
| `mdToolbar.statusBar.autoFit` | `true` | 按窗口宽度自动决定显示几项（wmctrl 读取窗口宽度，每 3 秒随窗口变化刷新） |
| `mdToolbar.codeLens.enabled` | `false` | 正文第一行上方一行文字按钮 |
| `mdToolbar.titleBar.enabled` | `false` | 标签栏右侧的图标按钮条 |

三者可任意组合，也可全关，只用 `Ctrl+Alt+M` 全量菜单。

## 行为说明

- 有选中文字 → 包裹它；无选中 → 插入占位符并**自动选中**，直接打字即可覆盖。
- 装了 `yzhang.markdown-all-in-one` 时，加粗/斜体/行内代码/公式**转调 MAIO 的 toggle 命令**，
  可反复点击来回切换，与快捷键行为一致；没装则用内置实现。
- 表格、代码块、mermaid、链接插入后支持 `Tab` / `Shift+Tab` 跳占位符。

## 已知边界

- 状态栏按钮在窗口底部，与编辑区滚动无关，始终可见。
- 宽度自适应依赖 `wmctrl`（Linux/X11）：每 0.7 秒读一次窗口宽度（优先匹配标题含当前工作区名的那个窗口），
  按"带标签 74px/项、纯图标 32px/项、扣除右侧状态项 820px"估算能放几项。
- 放得下 → 15 个动作全部显示，**没有「更多」**；放不下 → 尾部收起并出现「更多」，
  点开时**未显示的命令排在最前面**（下面用分隔线隔开已在状态栏的命令）。
- 读不到宽度（无 DISPLAY / Wayland）时退回"全部显示"，不会变成 0 个。
- CodeLens 形态锚定在文档第一行，向下滚动会消失（VS Code 没有"编辑器内悬浮层"的公开 API）。
- CodeLens 样式是灰色小字，不是按钮块；可用 `editor.codeLensFontSize` 调大小。
- 若 `"editor.codeLens": false`，工具条不会显示。

## v0.9.x 新增（全部在插件内，不改项目配置）

内置预览的排版由插件自带的 `media/preview.css` 注入（`markdown.previewStyles`），**全局生效**：
图片默认块级居中、表格整体居中、紧跟图片下方的那一段自动显示为居中灰色小字（图注）。

### 表格按钮（改造，不是新命令）

点「表格」先弹选项：

- `2 × 2（默认）` —— 带 Tab 跳位
- `自定义行列…` —— 手动输入行数（1–50）、列数（1–20）

### 图片按钮（改造，不是新命令）

点「图片」直接插入一段完整 HTML，参数自己手改：

```html
<img src="assets/" alt="图注" style="width:50%" class="md-center">
```

四个 Tab 位依次是：路径 → 图注(alt) → 尺寸 → 对齐。之后想调就改这几个值：

| 属性 | 可改的值 |
|---|---|
| `style="width:50%"` | `25%` / `50%` / `75%` / `100%` / `300px` / `auto` |
| `class="md-center"` | `md-center`（默认居中）/ `md-left` / `md-right` |
| `alt="图注"` | 任意说明文字（不显示，供检索与无障碍） |

> 用 `style` 而非 `width` 属性：HTML 规范里 `<img width>` 只接受整数像素，百分比会被忽略。

可见图注仍写成图片下一行的独立段落（如 `图：架构示意`），预览会自动居中变灰。

### SVG 按钮（替代原 mermaid）

点「SVG」插入一个空的 drawio 代码块：

````
```drawio width=800
<mxfile>
  <diagram id="default" name="Page-1">
    <mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```
````

这段内容与 `hediet.vscode-drawio` 的 `drawio-inline-editor.insertDiagram` 生成的完全一致
（`createEmptyDiagram()` + `buildDiagramBlock(..., locked=false, width=800)`）。
**渲染、编辑、锁定都由 drawio 扩展负责**（`markdown.codeBlockEditorProviders`），
本插件只负责插入这段围栏代码块。

- 想锁定：把 info string 改成 ```` ```drawio locked width=800 ````，或在代码块上方的按钮里点锁
- 想调整高度：加 `height=400`

### 内置预览的排版规则（media/preview.css）

由 `markdown.previewStyles` 注入，**全局生效**，只定义布局、不定义颜色（浅色/深色主题都不会被破坏）：

| 规则 | 作用 |
|---|---|
| `.markdown-body p > img` | 图片块级居中、`max-width:100%` |
| `img.md-left` / `md-center` / `md-right` | 三档对齐（由「图片」按钮写入 class） |
| `.markdown-body table` | 表格整体居中 |
| `p:has(> img) + p` | 图片下一行的段落自动显示为居中灰色小字（图注） |
| `.markdown-body .mxgraph` | drawio 图居中，并抹掉容器多余空白 |

#### `.mxgraph` 那几条规则的来历（别删）

drawio 预览脚本把 ```drawio 代码块替换成 `<div class="mxgraph">`，这个容器实测有三处多余空白：

| 现象（实测） | 原因 | 修法 |
|---|---|---|
| div 257×280，svg 202×202 | 容器被撑大 | `width/height: auto !important` |
| svg 顶部比容器低 50px | 容器内边距 | `padding: 0 !important` |
| svg 顶部比容器低 22px | 容器里有个高度 0 的空 div，行高撑出一行 | `> div:empty { display:none }` + `font-size/line-height: 0` |
| 整块贴左 | 容器是块元素 | `margin: .6em auto !important` |

最终验证：`div.getBoundingClientRect()` 与 `svg.getBoundingClientRect()` 的 top 和 height 必须**分别相等**。

## v1.0.0：跨设备友好化

### 可调参数（设置里改，不用动源码）

| 设置 | 默认 | 说明 |
|---|---|---|
| `mdToolbar.statusBar.reservePx` | 820 | 宽度自适应时为右侧状态项 + 左侧 Git 分支预留的像素 |
| `mdToolbar.statusBar.itemWidthPx` | 74 | 带标签时每个按钮的估算宽度 |
| `mdToolbar.statusBar.iconWidthPx` | 32 | 只显示图标时每个按钮的估算宽度 |
| `mdToolbar.statusBar.manualWidth` | 0 | 手动指定窗口宽度；0 = 自动探测 |
| `mdToolbar.preview.theme` | `auto` | 预览主题：`auto` 跟随编辑器 / `light` 白底 + GitHub Light 代码配色 / `dark` 同 auto |

### 窗口宽度探测（多平台）

| 平台 | 方式 | 轮询 |
|---|---|---|
| Linux / X11 | `wmctrl -lG` | 1 秒 |
| Windows | PowerShell + `GetWindowRect` | 3 秒 |
| macOS | `osascript` 取 Code 前窗尺寸（需辅助功能权限） | 3 秒 |

探测失败或平台不支持时自动退回“全部显示”，不会报错；也可以用 `manualWidth` 直接写死。

### 预览主题

主题不再是项目里的 `.vscode/markdown-light.css`，而是插件自带的：

```
media/theme-light.css   ← 浅色主题的全部规则（可直接改）
media/theme.css         ← 由插件按设置自动改写，被 previewStyles 引用
```

插件激活时按 `mdToolbar.preview.theme` 把 `theme-light.css` 的内容拷进 `theme.css`（选 auto/dark 则写入一行注释）。**切换设置后需要重开预览面板**才生效。
