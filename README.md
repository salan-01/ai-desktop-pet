<div align="center">

# Murasame · 丛雨 AI 桌宠

**让陪伴，留在桌面。**

一个会聊天、会换表情、会说话，也会主动问候你的 Windows 桌面伙伴。

`Vue 3` · `TypeScript` · `Pinia` · `Tauri 2` · `Rust` · `VITS` · `MySQL`

[快速开始](#快速开始) · [素材下载](#素材下载) · [使用与配置](#使用与配置) · [常见问题](#常见问题) · [架构与实现](项目介绍文档.md)

![Murasame 桌宠总览](docs/images/overview.png)

</div>

## 项目介绍

Murasame 是一款以角色陪伴为核心的 AI 二次元桌宠。角色通过透明、无边框、置顶的窗口显示在桌面上，你可以和她聊天、摸摸头，或者让她安静地陪着你。

它把大模型对话、角色人设、情绪立绘、本地语音和长期记忆连接在一起：AI 的回复既显示为文字气泡，也可以驱动表情变化，并交给本地 VITS 服务合成日语语音。用户一段时间没有互动时，角色还会结合时段和闲置阶段主动搭话。

默认角色为《千恋＊万花》的丛雨，支持创建自己的角色预设、编写人设、导入立绘和选择说话人。主仓库提供桌宠源码、应用图标和界面预览图；角色原始立绘已拆分为独立素材包，需单独下载并导入。语音服务、模型权重以及 MySQL 需要自行准备。

## 界面预览

下图使用项目真实 Vue 组件和内置立绘渲染；对话与配置均为示例数据，渐变背景用于展示透明界面的视觉效果。它们不代表已连接真实 AI、语音或数据库服务。

| 桌面欢迎界面 | 对话与输入 | 设置与配置 |
| :---: | :---: | :---: |
| ![欢迎界面](docs/images/welcome.png) | ![对话界面](docs/images/chat.png) | ![设置界面](docs/images/settings.png) |

<details>
<summary>查看角色预设界面与情绪立绘</summary>

<img src="docs/images/characters.png" alt="角色预设管理界面" width="420">

![部分内置情绪立绘](docs/images/expressions.png)

</details>

## 素材下载

**[下载独立角色素材包 Murasame-assets-v1.zip](https://github.com/salan-01/Murasame/releases/download/assets-v1/Murasame-assets-v1.zip)** · [素材包发布页](https://github.com/salan-01/Murasame/releases/tag/assets-v1)

素材包约 52 MiB，包含丛雨 20 张立绘、夏目 20 张立绘、素材映射文件、导入说明及 SHA-256 校验清单。原始角色图片不再随当前源码树和标准安装包分发。

```text
Murasame-assets-v1.zip
├─ sprites/                  丛雨，20 种情绪
├─ natsume_sprites/          夏目，20 种情绪与映射 JSON
├─ README.md                 导入说明
└─ SHA256SUMS.txt            原始素材校验清单
```

1. 将素材包解压到本机固定目录，例如 `D:\Murasame-assets`。
2. 启动桌宠，从托盘打开设置，或点击空角色占位提示。
3. 在「立绘管理 → 从文件夹导入」中选择 `sprites` 或 `natsume_sprites` 文件夹。
4. 需要多个角色时，在「角色预设」中分别创建或编辑角色并导入对应素材。

导入功能保存本机文件路径，请在导入后保留素材目录。首次启动尚未配置立绘时会显示占位提示。应用图标与 README 预览图继续由主仓库维护。

角色素材仍适用原权利人的使用条件。此次拆分没有改写 Git 历史，旧提交中仍保留原始素材。

## 核心功能

| 模块 | 已实现的能力 | 使用条件 |
| --- | --- | --- |
| AI 对话 | SSE 流式显示、角色人设、近期聊天上下文 | 兼容 OpenAI 格式且支持流式输出的聊天 API |
| 情绪表达 | 20 种情绪、标签解析、动作与文本关键词回退识别 | 为角色配置对应立绘 |
| 桌面互动 | 摸头、戳肚子、点击打开聊天、原生拖拽 | Tauri 桌面运行环境 |
| 主动陪伴 | 轻微表情变化、按时段问候、分阶段闲置搭话 | AI 配置可用；闲置计时未暂停 |
| 本地语音 | VITS / BERT-VITS2 日语合成、长文本分段、回复重播 | 单独部署语音服务并安装模型 |
| 语音输入 | 中文语音识别，识别内容填入输入框 | 当前 WebView 支持 Web Speech API |
| 长期记忆 | 自动提取、手动新增、搜索、删除，按角色隔离 | 开启记忆并配置 MySQL |
| 多角色 | 独立人设、立绘和说话人 ID，创建与切换预设 | 在设置面板中配置 |
| 本地持久化 | 设置和聊天记录保存到应用数据目录 | Tauri 桌面运行环境 |
| 系统托盘 | 显示 / 隐藏、打开设置、退出 | Windows 系统托盘 |

### 对话、表情与声音如何配合

AI 的回复约定包含中文正文、日语语音标签和情绪标签，例如：

```text
辛苦了，主人。忙完便歇一会儿吧，我辈会在这里陪着你。
[voice:ja]お疲れさま。少し休んでね。[/voice][emotion:smile]
```

正文显示在气泡里，`smile` 用于选择立绘，日语内容交给本地语音服务。如果没有有效的日语标签，程序会尝试调用聊天 API 翻译正文，因此可能产生额外请求。

### 主动搭话的节奏

| 未交互时间 | 行为 |
| --- | --- |
| 30 秒 | 短暂切换好奇、思考、微笑或害羞表情 |
| 5 分钟 | 结合清晨、午间、下午、夜晚或深夜场景主动问候 |
| 8 分钟 | 轻声搭话、提醒休息 |
| 12 分钟 | 更主动地寻求关注 |
| 17 分钟 | 表达担心、再次呼唤 |
| 23 分钟及以后 | 进入后续闲置阶段，每 6 分钟轮换一次 |

聊天面板打开、AI 正在回复或正在播放语音时，闲置计时暂停。这些阶段主要影响对话内容与情绪，不代表角色会实际绕鼠标移动。

## 快速开始

### 1. 准备开发环境

当前仓库主要面向 Windows 桌面端，安装包目标为 NSIS。

- Git、Node.js 与 npm。
- Rust 工具链及适用的 Windows 构建工具。
- Microsoft C++ Build Tools（使用 MSVC 工具链时）和 Microsoft Edge WebView2。

完整的系统依赖说明见 [Tauri 官方前置条件](https://v2.tauri.app/start/prerequisites/)。首次构建可能需要下载 npm、Cargo 依赖和打包所需组件。

### 2. 获取项目并启动

```powershell
git clone https://github.com/salan-01/Murasame.git
cd Murasame
npm ci
npm run tauri:dev
```

### 3. 下载并导入角色素材

按上方[素材下载](#素材下载)说明导入至少一组角色立绘。没有立绘时，可以点击占位提示或通过托盘进入设置。

### 4. 配置 AI

右键角色或从托盘打开「设置」，进入「API 设置」：

| 配置项 | 示例 | 说明 |
| --- | --- | --- |
| API Key | 你的服务商密钥 | 自行申请并填写 |
| API 地址 | `https://api.deepseek.com/v1/chat/completions` | 填写完整的聊天请求地址 |
| 模型名称 | `deepseek-chat` | 必须是服务商提供且账号可用的模型 |

设置会自动保存。配置完成后，点击欢迎面板的「开始聊天」，或点击角色下部打开输入框。

**最小运行组合：桌宠 + 可用的聊天 API。** 不启用 MySQL 记忆也可以聊天；不部署 VITS 也可以使用文字功能。没有语音服务时，可将 VITS 服务地址清空并关闭自启动。

## 使用与配置

### 日常操作

| 操作 | 效果 |
| --- | --- |
| 点击角色上部约 35% 区域 | 摸头互动 |
| 点击角色中部约 35%–65% 区域 | 戳肚子互动 |
| 点击角色下部 | 打开 / 收起聊天输入 |
| 按住角色并移动 | 拖动桌宠窗口 |
| 右键角色 | 打开设置 |
| 输入文字后按 Enter | 发送消息 |
| 输入框中按 Escape | 关闭聊天 |
| 点击聊天记录按钮 | 查看近期记录或清空记录 |
| 点击记忆按钮 | 打开当前角色的记忆管理面板 |
| 点击最新回复旁的扬声器按钮 | 重新合成并播放回复 |
| 点击托盘图标 | 显示 / 隐藏窗口 |
| 托盘菜单选择「退出」 | 退出程序，并停止由程序管理的语音服务 |

### 自定义角色与立绘

在「角色预设」中创建角色，设置名称、人设 Prompt、立绘和 VITS 说话人 ID，再切换为当前角色。

- 可以逐张添加立绘，也可以从文件夹批量导入。
- 建议用情绪英文名命名图片，例如 `normal.png`、`happy.png`、`shy.png`。
- 单个情绪可配置多张图片，前端按帧轮播；没有配置的情绪会回退到 `normal`。
- 切换或删除角色会清空当前聊天列表；MySQL 长期记忆按角色 ID 保存。
- 自定义人设时保留语音和情绪标签约定，才能让回复稳定驱动表情与配音。

支持的 20 种情绪：

```text
normal happy smile shy veryshy embarrassed excited curious thinking question
sigh helpless serious angry eyeroll grin weird doubt shocked frightened
```

### 配置本地语音（可选）

程序管理器适配包含 `app.py` 与 `py310/python.exe` 的 [vits-simple-api](https://github.com/Artrajz/vits-simple-api) 目录结构：

```text
vits/
├─ app.py
├─ py310/
│  └─ python.exe
└─ data/
   └─ models/
```

1. 按语音项目自身说明安装服务、依赖和支持日语的模型。
2. 在桌宠设置中选择「VITS 文件夹路径」与模型存放路径。
3. 启动服务，填写服务基础地址，例如 `http://localhost:23456`。
4. 刷新模型组和说话人，选择正确的角色 ID 与模型类型。
5. 发送一条消息，检查合成与播放是否正常。

前端按模型类型请求 `/voice/vits` 或 `/voice/bert-vits2`。服务地址填写基础 URL，不要重复附加 `/voice`。

目前进程管理器固定探测本机 `127.0.0.1:23456`。如果使用远程服务或其他端口，前端可以按配置的地址请求音频，但内置状态提示可能不准确。`Style-Bert-VITS2` 独立服务并非此管理器的直接替代品。

### 配置 MySQL 记忆（可选）

先在 MySQL 中创建数据库：

```sql
CREATE DATABASE desktop_pet
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

在「API 设置 → 长期记忆」中启用存储并填写连接 URL：

```text
mysql://YOUR_USER:YOUR_PASSWORD@127.0.0.1:3306/desktop_pet
```

使用自己的数据库账号和密码，点击「测试」。应用会自动创建 `desktop_pet_memories` 表，因此账号需要建表、读写和删除权限。

启用自动保存后，「我喜欢……」「我叫……」「记住……」等陈述会通过规则提取为记忆；对话前按关键词与近期记录检索，再注入人设上下文。也可以在记忆面板中手动新增、搜索和删除。这是规则提取与 SQL 文本检索，没有接入向量数据库。

## 数据保存与网络请求

| 内容 | 保存或处理位置 |
| --- | --- |
| API 配置、角色预设、立绘路径 | Tauri 应用数据目录内的 `settings.json` |
| 近期聊天记录 | 同目录的 `chat_history.json`，最多保留 200 条消息 |
| AI 对话上下文 | 最多取近期 40 条历史消息 |
| 长期记忆 | 你配置的 MySQL 数据库，按角色 ID 区分 |
| 语音合成 | 你配置的 VITS HTTP 服务 |
| AI 对话与日语翻译 | 你配置的聊天 API 服务商 |

Windows 的应用数据目录由 Tauri 按应用标识 `com.desktop-pet.app` 解析，通常位于 `%APPDATA%\com.desktop-pet.app`。请勿将运行时设置、密钥、数据库密码或个人聊天数据提交到仓库。

## 开发与构建

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动前端 Vite 开发服务器，默认端口 5173 |
| `npm run tauri:dev` | 启动完整的 Tauri 桌面开发环境 |
| `npm run build` | TypeScript 类型检查与前端生产构建 |
| `npm run preview` | 预览已构建的前端资源 |
| `npm run tauri -- build` | 使用标准 Tauri 流程构建 NSIS 安装包 |
| `npm run tauri:build` | Tauri 构建后执行原工作站的额外打包脚本 |

浏览器中的纯前端模式没有 Tauri 原生能力；立绘文件读取、设置保存、窗口操作和记忆访问应在桌面模式中验证。README 里的预览图使用示例数据渲染，不是公开在线演示服务。

标准构建：

```powershell
npm ci
npm run tauri -- build
```

Windows 安装包输出到 `src-tauri/target/release/bundle/nsis/`。当前配置使用 WebView2 离线安装模式，构建时可能需要下载相关组件；详见 [Tauri Windows 打包说明](https://v2.tauri.app/distribute/windows-installer/)。

`patch-nsis.ps1` 还处理 WebView2 DLL、外置 VITS 目录和可选 7-Zip 自解压分发，包含原工作站的绝对路径。需要这种分发方式时，请先按实际环境调整脚本；直接执行 `npm run tauri -- build` 不会调用它。

## 项目结构

```text
Murasame/
├─ src/
│  ├─ App.vue                    主界面、互动与状态编排
│  ├─ components/                立绘、气泡、输入、设置、聊天和记忆面板
│  ├─ composables/               AI、情绪、语音、拖拽、问候和闲置行为
│  ├─ stores/                    Pinia 设置与聊天状态
│  └─ types/                     类型定义
├─ src-tauri/
│  ├─ src/lib.rs                 Tauri 命令、窗口、托盘与文件操作
│  ├─ src/memory_store.rs        MySQL 记忆存储
│  ├─ src/vits_manager.rs        VITS 子进程管理
│  ├─ resources/                 素材导入说明与运行资源
│  ├─ capabilities/              Tauri 权限配置
│  └─ tauri.conf.json            窗口、资源和安装包配置
├─ docs/images/                  README 预览图
├─ patch-nsis.ps1                原工作站的额外打包脚本
└─ 项目介绍文档.md                架构、数据流与模块说明
```

详细实现见 [架构与模块说明](项目介绍文档.md)。Vue + Spring Boot 助手是另外一套项目，不包含在此仓库中。

## 常见问题

**启动后没有角色图片？**

首次运行不附带原始立绘。请先下载[独立素材包](#素材下载)，解压并从设置导入；检查 `normal` 是否有有效图片，且解压目录未被移动或删除。

**提示没有配置 API Key 或无法连接 API？**

检查 Key、完整请求地址、模型名称和网络；所选接口还需要支持 OpenAI 风格的流式聊天响应。

**有文字但没有声音？**

确认 VITS 服务可访问、已加载支持日语的模型、说话人 ID 与模型类型匹配。仅填写地址不会自动安装服务或下载权重。

**麦克风按钮不可用？**

语音输入依赖当前 WebView 对 Web Speech API 的支持和麦克风权限。无法使用时仍可正常输入文字。

**重启后记不住之前的信息？**

聊天 JSON 与长期记忆是两套存储。跨会话事实记忆需要启用 MySQL、连接测试通过，并确认记忆面板里已经存在记录。

**窗口不见了？**

点击系统托盘中的 Murasame 图标，或右键托盘选择「显示/隐藏」。

## 第三方素材与依赖

项目使用 Vue、Tauri、Pinia、Vite 等开源软件，依赖许可证以各项目自身声明为准。默认角色及独立素材包中的立绘等第三方素材的权利归原权利人所有；语音模型需自行获取并遵守对应的使用条件。仓库公开不代表获得这些素材的再授权。
