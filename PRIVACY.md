# 隐私说明 / Privacy Notice

Shanbay AI Word Bridge 是一个完全在浏览器本机运行的扩展。

## 本机保存的数据

- 站点启用状态和优先级
- 每站发送模式和用户填写的目标会话 URL
- 全局提示词模板
- 最后一次执行的单词、完整提问和结果状态

扩展不保存完整单词历史，不进行统计，不向开发者服务器上传数据。

## 页面访问

- 扇贝权限用于读取用户选中文本或当前可见单词，并显示执行反馈。
- Gemini、ChatGPT、豆包和 Kimi 与扇贝域名均为安装时声明的站点权限，由浏览器统一展示并由用户确认。设置页停用的站点不会注册内容脚本或参与调度。
- 扩展不读取扇贝 Cookie，不调用扇贝私有 API，不读取 AI 聊天历史，不加载远程代码。

## 第三方服务

当用户选择自动发送或仅填入时，提问内容会进入用户选择的第三方 AI 网页。第三方如何处理内容由其自身隐私政策决定。本扩展没有开发者 API，也不代理这些请求。

## 删除数据

卸载扩展会由浏览器删除扩展本地存储。用户也可以在设置页恢复模板或停用任一 AI 站点。

---

This extension runs locally. It stores provider preferences, an optional conversation URL, the prompt template, and the last operation in browser storage. It requests access to Shanbay and the four built-in AI sites during installation; disabled providers do not receive a content script or participate in routing. It does not retain a vocabulary history, collect analytics, use a developer server, read cookies, call private Shanbay APIs, or load remote code.
