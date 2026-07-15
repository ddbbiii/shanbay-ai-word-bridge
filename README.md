# Shanbay AI Word Bridge

[English](README.en.md) | 简体中文

> 在扇贝网页按一次快捷键，把当前单词或选中文本发送到你已经打开的 Gemini、ChatGPT、豆包或 Kimi。

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)
![Manifest](https://img.shields.io/badge/Manifest-V3-0c7669)
![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-19a98e)

![Shanbay AI Word Bridge 工作流程](docs/readme-overview.svg)

## 它解决什么问题

普通的“复制单词 → 切换 AI → 粘贴提示词 → 回车”会频繁打断背词节奏。本扩展把这条链路压缩成一个快捷键，同时保留三个安全原则：

- 只使用用户已经打开并启用的 AI 网页，不擅自打开新站点。
- 自动发送后必须验证提交结果，不把一次模拟回车直接当作成功。
- 无法确认是否已发送时禁止改投其他站点，避免同一个问题被重复发送。

扩展不调用开发者 API，不需要单独购买模型额度；它只自动操作你已登录的 AI 网页。

## 支持站点

| 站点 | 默认优先级 | 模式 | 可指定会话 |
| --- | ---: | --- | --- |
| Google Gemini | 1 | 自动发送 / 仅填入 | 是 |
| OpenAI ChatGPT | 2 | 自动发送 / 仅填入 | 是 |
| 豆包 | 3 | 自动发送 / 仅填入 | 是 |
| Kimi | 4 | 自动发送 / 仅填入 | 是 |

站点可以独立启停和排序。目标会话未打开时，扩展会选择该站最近使用的已打开标签页。

## 安装

### GitHub Release

1. 从 [Releases](https://github.com/ddbbiii/shanbay-ai-word-bridge/releases) 下载 ZIP 并解压。
2. 打开 `chrome://extensions` 或 `edge://extensions`。
3. 开启“开发者模式”，选择“加载已解压的扩展程序”。
4. 指向解压目录，接受扇贝及四个内置 AI 站点的权限。
5. 打开扩展设置页，调整站点顺序、发送模式和快捷键。
6. 停用旧的 Gemini 专用脚本，避免两个扩展同时响应。

### 从源码构建

```powershell
git clone https://github.com/ddbbiii/shanbay-ai-word-bridge.git
cd shanbay-ai-word-bridge
npm ci
npm run check
```

随后在扩展管理页加载生成的 `dist` 目录。

## 使用方法

1. 登录扇贝网页，并至少打开一个已启用的 AI 网站。
2. 在扇贝单词页按默认的 <kbd>` / ·</kbd> 键。
3. 扩展优先读取选中文本；没有选择时识别当前学习单词。
4. 调度器按优先级寻找可用站点，写入结构化解释模板并发送。
5. 发送成功后保持在扇贝页面继续学习；结果可在扩展弹窗查看。

在设置页点击“录入新快捷键”即可使用单键或组合键。长按重复事件和短时间内的重复触发会被过滤。

如果四个站点都没有打开，扩展不会自动打开网页，而是把完整提问复制到剪贴板，方便粘贴到 Codex 或其他 AI。

## 默认解释模板

默认提示词要求 AI 用中文给出词性、英美音标、可靠词源线索、常用义项、记忆链、衍生词和自然例句，并明确禁止捏造词根。模板可以在设置页整体修改或恢复默认。

每次发送的都是“模板 + 当前单词”，不依赖目标会话的历史上下文，因此换会话后结果仍然可理解。

## 发送结果与失败处理

| 状态 | 含义 | 后续行为 |
| --- | --- | --- |
| `sent` | 已看到新用户消息或输入框清空 | 结束本次操作 |
| `filled` | 仅填入模式完成 | 保留内容，由用户发送 |
| `not_ready` | 页面没有可用编辑器 | 允许用户调整优先级后改投 |
| `not_submitted` | 内容仍在输入框或发送按钮不可用 | 允许用户确认后改投 |
| `submission_unknown` | 页面发生变化，但无法证明是否已提交 | 禁止改投并复制提问 |
| `permission_missing` | 站点没有浏览器权限 | 跳过该站点 |
| `failed` | 适配器发生其他错误 | 停止自动投递并复制提问 |

这套状态机优先避免重复消息，而不是追求“无论如何都自动发出去”。

## 权限与隐私

- 站点权限只覆盖扇贝、Gemini、ChatGPT、豆包和 Kimi。
- 不读取扇贝 Cookie，不调用扇贝私有 API，不注入远程脚本。
- 设置和最后一次操作状态只保存在浏览器本机。
- 不保存单词历史，不接入统计服务，也没有开发者服务器。

完整说明见 [PRIVACY.md](PRIVACY.md)。

## 开发与适配维护

项目使用 TypeScript、Vite、Manifest V3、Vitest 和 jsdom。四个站点通过统一接口实现：页面识别、编辑器定位、内容写入、提交和结果验证。

```powershell
npm run typecheck
npm test
npm run build
```

AI 网页 DOM 可能随时变化。修改选择器时应优先使用语义属性和编辑器结构，并同步补充 DOM fixture 测试。维护流程见 [docs/adapter-maintenance.md](docs/adapter-maintenance.md)。

## 贡献

欢迎提交可复现的站点适配问题。请提供站点、页面类型、扩展结果状态和脱敏 DOM 结构，不要提交登录凭据、Cookie 或私人会话内容。详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

[MIT](LICENSE)
