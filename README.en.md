# Shanbay AI Word Bridge

English | [简体中文](README.md)

Capture the current word or selected text on Shanbay and deliver a structured Chinese-learning prompt to an AI web app you already have open. The first release supports Gemini, ChatGPT, Doubao, and Kimi.

## Highlights

- Enable, authorize, and prioritize providers independently.
- Choose verified auto-send or fill-only mode per provider.
- Optionally prefer one conversation URL, then fall back to the most recently used tab for that provider.
- Never opens AI sites automatically and never treats a synthetic Enter event as proof of success.
- Reroutes only after a confirmed non-submission. An uncertain result is copied instead to prevent duplicate messages.
- Keeps settings and the last operation locally. No word history, analytics, server, cookies, or private Shanbay APIs.

## Install

1. Download and extract the ZIP from [Releases](https://github.com/ddbbiii/shanbay-ai-word-bridge/releases).
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable Developer mode and load the extracted directory as an unpacked extension.
4. Grant only the AI sites you intend to use on the settings page.
5. Disable the previous Gemini-only extension to avoid duplicate shortcut listeners.

To build from source:

```powershell
npm ci
npm run check
```

Load the generated `dist` directory.

## Use

- Press the backquote key <kbd>`</kbd> on Shanbay for the original quick workflow.
- Or use <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Y</kbd>, configurable from the browser's extension shortcut page.
- Selected text wins over page detection.
- If no authorized provider tab is open, the complete prompt is copied for use in Codex or any other AI.

See [PRIVACY.md](PRIVACY.md), [CONTRIBUTING.md](CONTRIBUTING.md), and [adapter maintenance](docs/adapter-maintenance.md).

## License

[MIT](LICENSE)
