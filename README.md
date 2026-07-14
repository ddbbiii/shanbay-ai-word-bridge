# Shanbay AI Word Bridge

[English](README.en.md) | 简体中文

在扇贝网页中捕获当前单词或选中文本，把一份结构化的中文解释请求发送到你已经打开的 AI 网页。首版支持 Gemini、ChatGPT、豆包和 Kimi。

## 特性

- 站点可启用、排序和单独授权，默认优先级为 Gemini、ChatGPT、豆包、Kimi。
- 每个站点可选择“自动发送”或“仅填入”，并可指定一个优先会话 URL。
- 扇贝页面快捷键可在设置页直接录入，默认是键盘左上角的 <kbd>` / ·</kbd> 键。
- 只选择已启用、已授权、已打开的站点；不会擅自打开网页。
- 自动发送后验证输入框清空或用户消息出现，不把模拟回车当成成功。
- 只有确认未提交时才允许切换站点；结果不确定时只复制完整提问，避免重复发送。
- 选中文本优先，其次使用扇贝稳定选择器，最后才做受限的可见文本评分。
- 配置和最后一次结果仅保存在浏览器本机，不保存单词历史，不使用统计或服务端 API。

## 安装

### GitHub Release

1. 从 [Releases](https://github.com/ddbbiii/shanbay-ai-word-bridge/releases) 下载 ZIP 并解压。
2. 打开 `chrome://extensions` 或 `edge://extensions`。
3. 开启“开发者模式”，选择“加载已解压的扩展程序”，指向解压目录。
4. 首次安装会打开设置页。按需授权 AI 站点并保存。
5. 停用旧的 Gemini 专用扩展，避免两个扩展同时监听快捷键。

### 从源码构建

```powershell
npm ci
npm run check
```

然后在浏览器中加载 `dist` 目录。

## 使用

- 在扇贝页面按默认的反引号/间隔号键 <kbd>` / ·</kbd> 触发。
- 在设置页的“扇贝页面快捷键”中点击“录入新快捷键”，按下目标按键或组合键并保存即可修改。
- 如果页面上有选中文本，扩展优先使用选中内容；否则识别当前单词。
- 没有可用站点时，完整模板提问会复制到剪贴板，可粘贴到 Codex 或其他 AI。

## 安全语义

| 状态 | 含义 | 是否自动改投 |
| --- | --- | --- |
| `sent` | 已看到新用户消息或输入框清空 | 否 |
| `filled` | 仅填入模式完成 | 否 |
| `not_ready` | 页面无可用编辑器或适配器无法启动 | 可由用户确认后改投 |
| `not_submitted` | 内容仍在输入框或按钮明确不可用 | 可由用户确认后改投 |
| `submission_unknown` | 页面变化但无法确认是否提交 | 禁止，复制提问 |
| `permission_missing` | 用户尚未授权该站点 | 不选择该站点 |
| `failed` | 其他适配错误 | 禁止，复制提问 |

## 权限

- 必需站点权限只有 `https://web.shanbay.com/*`，用于捕获当前单词和显示反馈。
- 四个 AI 域名都属于可选权限，只有用户点击授权后才会注册对应内容脚本。
- 不读取扇贝 Cookie，不调用扇贝私有 API，不加载远程代码。

完整说明见 [PRIVACY.md](PRIVACY.md)。适配站点 DOM 的维护方法见 [docs/adapter-maintenance.md](docs/adapter-maintenance.md)。

## 开发

```powershell
npm run typecheck
npm test
npm run build
```

项目使用 TypeScript、Vite、Manifest V3、Vitest 和 jsdom。提交站点选择器变更时，必须同步更新 DOM fixture 测试。

## 许可证

[MIT](LICENSE)
