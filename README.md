# Markdown 工具栏（md-toolbar）

在 VS Code **状态栏**放一排 Markdown 按钮，点一下就在光标处插入或包裹对应语法。
只在 Markdown 文档激活时出现，按窗口宽度自动增减，放不下的收进「更多」。

## 依赖的插件

本插件自身零依赖——只用 VS Code API 和 Node 内置模块，不需要 `npm install`，也不需要构建。

以下插件是功能依赖，其中 `markdown-all-in-one` 为**必需**：

| 插件 | 作用 | 必需性 |
|---|---|---|
| `yzhang.markdown-all-in-one` | 加粗 / 斜体 / 行内代码 / 公式转调它的 toggle 命令；「目录」命令直接调用它的 TOC；预览里的 KaTeX 公式与 GitHub Alerts 样式也由它提供 | **必需**（缺失时上述功能不可用或严重退化） |
| `hediet.vscode-drawio` | 「SVG」按钮插入的 ```` ```drawio ```` 代码块的渲染、编辑、锁定 | 用到 SVG 按钮时需要 |
| `bierner.markdown-mermaid` | 文档里已有 ```` ```mermaid ```` 代码块时由它渲染 | 按需 |

## 安装

要求 VS Code **≥ 1.80**。

**方式一：VSIX**

```bash
code --install-extension youmiweidemi.md-toolbar-1.0.0.vsix
```

**方式二：扩展面板**

扩展面板右上角 `...` → **从 VSIX 安装**，选上面的 vsix 文件。

**方式三：直接放目录**

```bash
mkdir -p ~/.vscode/extensions/youmiweidemi.md-toolbar-1.0.0
cp -r package.json extension.js media README.md LICENSE \
      ~/.vscode/extensions/youmiweidemi.md-toolbar-1.0.0/
```

装完 **完全退出 VS Code 再启动**（仅 Reload Window 有时不会重新扫描新扩展）。

## 卸载

```bash
rm -rf ~/.vscode/extensions/youmiweidemi.md-toolbar-*
```

或在扩展面板里点「卸载」。

## 使用方法

打开任意 `.md` 文件，状态栏左侧会出现一排按钮：

| 按钮 | 行为 |
|---|---|
| 加粗 / 斜体 / 行内代码 / 公式 | 有选中文字则包裹它；没有则插入占位符并**自动选中**，直接打字覆盖 |
| 标题 | 弹选项选 `#` ~ `####`，作用于当前行或选中行 |
| 列表 | 弹选项选 `-` / `*` / `1.` / `1)` |
| 任务 / 引用 | 给当前行（或选中行）加 `- [ ] ` / `> ` 前缀 |
| 表格 | 先弹选项：`2 × 2（默认）`（带 Tab 跳位）或 `自定义行列…`（输入行数 1–50、列数 1–20） |
| 图片 | 插入完整 HTML 模板，见下节 |
| 链接 | 有选中文字则变成 `[文字](url)` |
| 代码块 / 分割线 / 目录 / 格式 | 插入围栏代码块 / 水平线 / 生成目录 / 调用当前格式化器 |
| SVG | 插入一个空的 drawio 画布，见下节 |
| 更多（`⋯`） | 窗口放不下时出现，点开是全部命令（未显示的排最前） |

**快捷键**：`Ctrl+Alt+M` 随时呼出全量命令菜单。

## 图片

点「图片」插入一段完整 HTML，参数按需手改：

```html
<img src="assets/" alt="图注" style="width:50%" class="md-center">
```

四个 Tab 位依次是：**路径 → 图注(alt) → 尺寸 → 对齐**。

| 属性 | 可改的值 |
|---|---|
| `style="width:50%"` | `25%` / `50%` / `75%` / `100%` / `300px` / `auto` |
| `class="md-center"` | `md-center`（默认居中）/ `md-left` / `md-right` |
| `alt="图注"` | 说明文字（不显示，供检索与无障碍） |

可见图注写在图片**下一行的独立段落**，例如 `图：架构示意`，预览会自动把它显示为居中灰色小字。

## 表格

点「表格」→ `2 × 2（默认）` 直接插入（保留 Tab 跳位手感）；选 `自定义行列…` 则依次输入数据行数与列数，生成后光标停在第一个表头单元格。

## SVG（drawio 画布）

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

这段内容与 `hediet.vscode-drawio` 的 `drawio-inline-editor.insertDiagram` 生成的完全一致。
**渲染、编辑、锁定都由 drawio 扩展负责**，本插件只负责插入这段围栏代码块。

- 想锁定：把 info string 改成 ```` ```drawio locked width=800 ````，或点代码块上方的锁按钮
- 想调高度：加 `height=400`

## 预览排版与主题

插件通过 `markdown.previewStyles` 往 VS Code **内置 Markdown 预览**注入两份样式，全局生效：

- `media/preview.css` —— 图片与表格居中、图片下方段落自动变图注样式、drawio 图居中并收紧多余空白
- `media/theme.css` —— 由插件按 `mdToolbar.preview.theme` 自动写入（选 `light` 时取其内容于 `media/theme-light.css`）

```jsonc
"mdToolbar.preview.theme": "light"   // auto（跟随编辑器）| light（白底）| dark
```

切换主题后需要**重开预览面板**才生效。

## 设置

| 设置 | 默认 | 说明 |
|---|---|---|
| `mdToolbar.statusBar.enabled` | `true` | 是否显示状态栏按钮 |
| `mdToolbar.statusBar.showLabels` | `true` | 显示中文标签（图标 + 文字）；关掉只剩图标，同宽度能放更多 |
| `mdToolbar.statusBar.autoFit` | `true` | 按窗口宽度自动决定显示几项 |
| `mdToolbar.statusBar.maxItems` | `0` | 显示数量硬上限，0 = 不限 |
| `mdToolbar.statusBar.reservePx` | `820` | 自适应时为右侧状态项与左侧 Git 分支预留的像素 |
| `mdToolbar.statusBar.itemWidthPx` | `74` | 带标签时每个按钮的估算宽度 |
| `mdToolbar.statusBar.iconWidthPx` | `32` | 只显示图标时每个按钮的估算宽度 |
| `mdToolbar.statusBar.manualWidth` | `0` | 手动指定窗口宽度；0 = 自动探测 |
| `mdToolbar.preview.theme` | `auto` | 预览主题：`auto` / `light` / `dark` |
| `mdToolbar.codeLens.enabled` | `false` | 备选形态：在正文第一行上方显示一行文字按钮 |
| `mdToolbar.titleBar.enabled` | `false` | 备选形态：在标签栏右侧显示图标按钮 |

窗口宽度的自动探测：Linux/X11 用 `wmctrl`，Windows 用 PowerShell，macOS 用 `osascript`；探测不到时退回「全部显示」，也可以用 `manualWidth` 直接写死。

## 许可证

MIT
