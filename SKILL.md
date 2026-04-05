---
name: wechat-ai-writer
description: "微信公众号AI自动写作技能。一键完成：话题研究→洞见提炼→封面生成→文章创作→发布确认。支持口语化风格、情绪曲线设计、多主题样式选择。"
metadata:
  openclaw:
    emoji: "✍️"
    requires:
      skills: ["wechat-article-search", "wechat-toolkit", "humanizer"]
      env: ["WECHAT_APP_ID", "WECHAT_APP_SECRET"]
---

# ✍️ 微信公众号AI写作助手 (wechat-ai-writer)

一键生成高质量公众号文章，从话题研究到发布确认全流程自动化。支持洞见提炼、情绪曲线设计、封面生成、去AI痕迹润色。

## 核心能力

| 步骤 | 功能 | 输出 |
|------|------|------|
| 1. 广度搜集 | 搜索5-10篇高质量文章 | 素材库 |
| 2. 洞见提炼 | 对比分析，提炼3-5个独到观点 | 观点清单+情感曲线 |
| 3. 封面生成 | Pexels免费图片（或豆包AI生成） | cover.jpg |
| 4. 沉浸创作 | 口语化写作，写金句 | article.md |
| 5. 添加Frontmatter | YAML元数据（title/cover/author） | 完整Markdown |
| 6. 交付确认 | 展示初稿，等待用户确认发布 | 预览+确认流程 |

## 技术架构

```
话题输入
    ↓
[广度搜集] → wechat-article-search + Tavily搜索
    ↓
[洞见提炼] → Moonshot kimi-k2.5 LLM生成
    ↓
[封面生成] → Pexels免费图片 → 豆包AI生成(备选)
    ↓
[沉浸创作] → Moonshot LLM + 本地humanizer润色
    ↓
[发布确认] → wechat-toolkit
```

## 依赖服务

| 服务 | 用途 | 配置位置 |
|------|------|----------|
| **Moonshot kimi-k2.5** | LLM生成洞见和文章 | `scripts/llm-client.js` |
| **Pexels** | 免费高质量图片（封面首选） | `scripts/pexels-image.js` |
| **豆包Seedream 5.0** | AI生成封面图（备选） | `scripts/doubao-image.js` |
| **Tavily Search** | 知乎/小红书搜索 | OpenClaw配置 |
| **wechat-article-search** | 公众号文章搜索 | 已安装技能 |

## 封面图片来源（更新）

**双保险策略**：
1. **优先从 Pexels 获取** - 免费、高质量、真实照片
2. **备选豆包 AI 生成** - 当 Pexels 无法获取时使用

### Pexels 配置

1. 访问 https://www.pexels.com/api/ 申请免费 API Key
2. 复制 `.env.example` 为 `.env` 并填入 Key：
   ```bash
   cd ~/.openclaw/workspace/skills/wechat-ai-writer
   cp .env.example .env
   # 编辑 .env 填入 PEXELS_API_KEY
   ```

### 豆包配置（备选）

当 Pexels 未配置或获取失败时，自动回退到豆包 AI 生成。
需配置豆包 API Key 在环境变量中。
| **wechat-toolkit** | 公众号发布 | 已安装技能 |

## 使用方法

### 基础用法

```bash
# 完整流程（推荐）
node ~/.openclaw/workspace/skills/wechat-ai-writer/scripts/main.js "话题关键词"

# 仅生成不发布（预览模式）
node ~/.openclaw/workspace/skills/wechat-ai-writer/scripts/main.js "话题关键词" --dry-run

# 自动确认发布（不等待用户输入）
node ~/.openclaw/workspace/skills/wechat-ai-writer/scripts/main.js "话题关键词" --auto-confirm
```

### 指定发布主题

```bash
# 使用pie主题（默认）
node scripts/main.js "职场PUA"

# 使用其他主题
# 可选主题：default, orangeheart, rainbow, lapis, pie, maize, purple, phycat, aurora, newsroom, sage, ember
node scripts/main.js "职场PUA" --theme=newsroom
```

在 `config/default.yaml` 中修改默认主题：

```yaml
publish:
  theme: "pie"        # 默认主题
  highlight: "github" # 代码高亮主题
```

### 分步执行

```bash
# 步骤1：广度搜集
node scripts/research.js "话题"

# 步骤2：洞见提炼
node scripts/analyze.js "话题"

# 步骤3：生成封面
node scripts/generate-cover.js "话题"

# 步骤4：沉浸创作
node scripts/write.js "话题"

# 步骤5：发布（指定主题）
node scripts/publish.js output/article.md --theme pie
```

## 配置说明

编辑 `config/default.yaml`：

```yaml
# 写作风格
style:
  tone: "口语化"        # 选项：口语化、专业、幽默、犀利、温暖
  length: "medium"      # 选项：short(800字)、medium(1500字)、long(2500字)
  emotion_curve: "痛点-反转-治愈"

# 搜索配置
search:
  article_count: 8
  platforms: ["wechat", "zhihu", "xiaohongshu"]

# 发布配置
publish:
  theme: "pie"          # 默认主题
  highlight: "github"   # 代码高亮
  wait_for_confirm: true

# 可选主题列表
# 内置主题：default, orangeheart, rainbow, lapis, pie, maize, purple, phycat
# 自定义主题：aurora, newsroom, sage, ember
# 代码高亮：atom-one-dark, atom-one-light, dracula, github, github-dark, monokai, solarized-dark, solarized-light, xcode
```

## 主题样式说明

| 主题 | 风格 | 适用场景 |
|------|------|----------|
| **pie** | 简洁优雅，阅读舒适 | 通用，默认推荐 |
| **lapis** | 深蓝配色，专业感 | 科技、商业 |
| **orangeheart** | 暖橙色调，活力感 | 生活、情感 |
| **aurora** | 极光渐变，视觉冲击 | 创意、设计 |
| **newsroom** | 报纸风格，严肃感 | 新闻、评论 |
| **sage** | 清新自然，绿色调 | 健康、环保 |
| **ember** | 暖色调，温馨感 | 故事、人文 |

## 环境变量配置

发布到公众号需要设置：

```bash
export WECHAT_APP_ID="your_wechat_app_id"
export WECHAT_APP_SECRET="your_wechat_app_secret"
```

或在 `~/.zshrc` 中添加永久配置。

## 输出结构

```
output/
├── article.md          # 完整文章（含Frontmatter）
├── cover.jpg           # 豆包生成的封面图
├── cover_prompt.txt    # 封面Prompt备份
├── insights.json       # 洞见分析结果
└── research.json       # 搜索结果
```

## 文章格式

生成的文章包含标准Frontmatter：

```markdown
---
title: "文章标题"
cover: "/path/to/cover.jpg"
author: "主语说"
date: "2026-03-21"
tags: ["话题关键词"]
---

# 正文...
```

## 工作流程详解

### 1. 广度搜集
- 搜索5篇公众号文章（wechat-article-search）
- 搜索3篇知乎文章（Tavily）
- 搜索3篇小红书文章（Tavily）

### 2. 洞见提炼
- 使用Moonshot kimi-k2.5分析文章
- 提炼3-5个洞见（矛盾/本质/盲区）
- 设计情感曲线（痛点→反转→治愈）

### 3. 封面生成
- 基于洞见生成英文Prompt
- 豆包Seedream 5.0生成21:9封面
- 自动下载到output目录

### 4. 沉浸创作
- Moonshot生成口语化文章
- 本地humanizer去除AI痕迹（快速规则替换）
- 插入金句和故事化表达

### 5. 发布
- 添加YAML Frontmatter
- 使用指定主题渲染
- 推送到公众号草稿箱

## 故障排查

| 问题 | 原因 | 解决 |
|------|------|------|
| 洞见生成失败 | JSON解析问题 | 使用默认洞见，流程继续 |
| 封面生成失败 | Prompt为空 | 使用默认Prompt重试 |
| 发布失败 | 环境变量未设置 | 设置WECHAT_APP_ID/SECRET |
| IP不在白名单 | 公众号后台限制 | 添加当前IP到白名单 |
| Token失效 | 授权过期 | 重新配置AppSecret |

## 最佳实践

1. **话题选择**：选择有争议性、有讨论度的话题，更容易产生洞见
2. **主题选择**：
   - 商业/科技 → lapis, newsroom
   - 生活/情感 → orangeheart, ember
   - 创意/设计 → aurora
   - 通用 → pie（默认）
3. **人工润色**：AI生成后建议人工检查，调整语气和个人观点
4. **封面优化**：如豆包生成不满意，可用Prompt在其他平台重新生成

## 示例

```bash
# 生成职场类文章，使用newsroom主题
node scripts/main.js "职场PUA" --theme newsroom

# 生成情感类文章，使用ember主题
node scripts/main.js "成年人的崩溃" --theme ember

# 生成科技类文章，使用lapis主题
node scripts/main.js "AI取代工作" --theme lapis
```

## 更新日志

- **v1.0** - 初始版本，支持6步工作流
- **v1.1** - 添加主题选择功能，默认使用pie主题
- **v1.2** - 优化JSON解析，支持Moonshot kimi-k2.5
- **v1.3** - humanizer改为本地规则替换，速度提升；移除图片搜索插入环节

## 注意事项

- 所有工具仅供个人学习使用，请遵守版权法规
- 搜索功能内置防封禁机制，请勿高频使用
- 生成内容建议人工审核后再发布
- 豆包生成的图片有水印，如需商用请自行处理

---

**作者**：主语说  
**版本**：v1.3  
**更新日期**：2026-03-21
