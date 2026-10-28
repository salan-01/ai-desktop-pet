# Murasame — AI 二次元桌宠

基于 Vue 3、TypeScript 和 Tauri 2 的 Windows AI 桌面伙伴。支持聊天、角色表情、本地语音、长期记忆与主动互动，默认角色为丛雨。

## 功能

- 透明置顶窗口、原生拖拽、系统托盘。
- 兼容 OpenAI 格式的聊天接口，默认配置为 DeepSeek，支持流式回复。
- 20 种表情、多角色预设、立绘导入与多帧播放。
- 摸头、戳肚子、时间问候与分阶段空闲搭话。
- 本地 VITS / BERT-VITS2 日语语音合成、语音重播与浏览器语音输入。
- MySQL 长期记忆，可自动提取和手动管理。
- 本地保存设置和聊天记录。

## 开发环境

- Windows、Node.js / npm、Rust 工具链。
- Tauri 2 所需的 Microsoft C++ Build Tools 和 WebView2。
- 聊天功能需自行配置兼容的 API 地址、模型和 API Key。
- 语音与长期记忆为可选功能，分别需要本地 VITS 服务和 MySQL。

## 启动

```powershell
npm ci
npm run tauri:dev
```

启动后，在设置面板填写 AI 配置。默认聊天地址为 `https://api.deepseek.com/v1/chat/completions`。

仅启动前端开发服务器：

```powershell
npm run dev
```

立绘读取、设置保存、窗口操作等功能依赖 Tauri，需使用桌面开发模式验证完整功能。

## 可选服务

**语音：** 准备包含 `app.py` 和 `py310/python.exe` 的 VITS 目录，在设置中选择路径、模型类型和说话人。默认地址为 `http://localhost:23456`。语音服务、Python 环境和模型权重需单独安装，本仓库不包含这些文件。

**记忆：** 创建 MySQL 数据库后，在设置中启用长期记忆并填写连接 URL。程序会在该数据库中创建 `desktop_pet_memories` 表，按角色保存记忆。

## 构建

```powershell
npm run build
npm run tauri -- build
```

Windows 安装包输出到 `src-tauri/target/release/bundle/nsis/`。

`npm run tauri:build` 还会执行原工作站的 `patch-nsis.ps1`，用于处理 WebView2 DLL 和外置 VITS 分发。该脚本包含本机 NSIS、VITS 和 7-Zip 路径，使用前需按实际环境调整。

## 代码结构

```text
src/
  App.vue               主界面与交互编排
  components/           立绘、聊天、设置和记忆面板
  composables/          AI、表情、语音、拖拽和闲置行为
  stores/               Pinia 设置与聊天状态
  types/                TypeScript 类型
src-tauri/
  src/lib.rs            Tauri 命令、窗口、托盘与文件操作
  src/memory_store.rs   MySQL 记忆存储
  src/vits_manager.rs   VITS 服务进程管理
  resources/            内置立绘和运行资源
```

详细介绍见 [项目介绍文档](项目介绍文档.md)。Vue + Spring Boot 助手是独立项目，不包含在本仓库中。

## 数据与素材

API Key、数据库连接及聊天记录由应用在本机保存，请勿提交运行时配置与个人数据。角色立绘等第三方素材的权利归原权利人所有；语音模型由使用者自行准备。
