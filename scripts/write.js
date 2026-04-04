#!/usr/bin/env node
/**
 * 沉浸式文章创作
 * 输入：insights.json + memes/ + Tavily图片
 * 输出：article.md（带Frontmatter，含图片）
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { generateArticle } = require('./llm-client');
const { execSync } = require('child_process');
const yaml = require('js-yaml');

// 兼容 path.expanduser
path.expanduser = function(filepath) {
  if (filepath.startsWith('~/')) {
    return path.join(os.homedir(), filepath.slice(2));
  }
  return filepath;
};

// 加载配置
function loadConfig() {
  const configPath = path.join(__dirname, '../config/default.yaml');
  if (fs.existsSync(configPath)) {
    return yaml.load(fs.readFileSync(configPath, 'utf8'));
  }
  return {};
}

async function write(topic) {
  console.log(`✍️ 开始创作文章：${topic}`);
  
  const outputDir = path.join(__dirname, '../output');
  
  // 1. 读取分析结果
  const insightsPath = path.join(outputDir, 'insights.json');
  if (!fs.existsSync(insightsPath)) {
    console.error('❌ 请先运行 analyze.js 提炼洞见');
    process.exit(1);
  }
  
  const insightsData = JSON.parse(fs.readFileSync(insightsPath, 'utf8'));
  const insights = insightsData.insights;
  const emotionCurve = insightsData.emotionCurve;
  
  // 2. 生成文章（移除图片搜索和插入环节）
  const config = loadConfig();
  const article = await generateArticleContent(topic, insights, emotionCurve, {
    style: config.style?.tone || '口语化',
    length: config.style?.length || 'medium'
  });
  
  // 3. 去AI痕迹（在添加Frontmatter之前）
  const humanizedArticle = await humanize(article);
  
  // 4. 添加Frontmatter
  const coverPath = path.join(outputDir, 'cover.jpg');
  const articleWithFrontmatter = addFrontmatter(humanizedArticle, topic, coverPath);
  
  // 9. 保存
  const articlePath = path.join(outputDir, 'article.md');
  fs.writeFileSync(articlePath, articleWithFrontmatter);
  
  console.log(`✅ 文章创作完成：${articlePath}`);
  console.log(`📊 字数：${articleWithFrontmatter.length} 字符`);
  
  return articlePath;
}

async function generateArticleContent(topic, insights, emotionCurve, options = {}) {
  console.log('   调用 LLM 生成文章...');
  try {
    const article = await generateArticle(topic, insights, emotionCurve, options);
    console.log('   ✅ 文章生成完成');
    return article;
  } catch (e) {
    console.error('   ❌ 生成文章失败:', e.message);
    // 返回默认文章结构
    return `# ${topic}：那些没人敢说的真相

说实话，看到${topic}这个话题，我第一反应是——这说的不就是我吗？

## 洞见一：${insights[0]?.title || '表象之下'}

${insights[0]?.content || '深入分析...'}

**金句**：真相往往藏在表象之下。

## 洞见二：${insights[1]?.title || '被忽视的视角'}

${insights[1]?.content || '换个角度...'}

**金句**：换个角度看，世界完全不同。

## 洞见三：${insights[2]?.title || '矛盾中的机会'}

${insights[2]?.content || '矛盾分析...'}

**金句**：转机往往藏在矛盾中。
`;
  }
}

function addFrontmatter(article, topic, coverPath) {
  const title = generateTitle(topic);
  const frontmatter = `---
title: "${title}"
cover: "${coverPath}"
author: "主语说"
date: "${new Date().toISOString().split('T')[0]}"
tags: ["${topic}"]
---

`;
  
  return frontmatter + article;
}

function generateTitle(topic) {
  // 根据话题生成吸引人的标题
  const templates = [
    `${topic}：那些没人敢说的真相`,
    `关于${topic}，90%的人都想错了`,
    `${topic}的真相，看完我沉默了`,
    `为什么${topic}总是让你焦虑？`,
    `${topic}：一篇文章说透本质`
  ];
  
  return templates[Math.floor(Math.random() * templates.length)];
}

async function humanize(article) {
  // 本地规则替换，快速去除AI痕迹（避免LLM重写耗时）
  console.log('🎭 去除AI痕迹（本地规则）...');
  
  let humanized = article;
  
  // 规则1: 删除AI高频词
  const aiWords = ['赋能', '闭环', '底层逻辑', '抓手', '沉淀', '对齐', '颗粒度', '组合拳'];
  aiWords.forEach(word => {
    humanized = humanized.replace(new RegExp(word, 'g'), '');
  });
  
  // 规则2: 替换过于正式的表达
  const replacements = [
    { from: /然而/g, to: '但是' },
    { from: /因此/g, to: '所以' },
    { from: /此外/g, to: '还有' },
    { from: /综上所述/g, to: '说白了' },
    { from: /值得注意的是/g, to: '说实话' },
    { from: /不难发现/g, to: '你会发现' },
    { from: /总而言之/g, to: '总之' },
  ];
  
  replacements.forEach(({ from, to }) => {
    humanized = humanized.replace(from, to);
  });
  
  // 规则3: 减少破折号滥用（保留部分）
  humanized = humanized.replace(/——/g, '，');
  
  // 规则4: 删除空洞结尾
  humanized = humanized.replace(/未来可期[。！]?\s*$/g, '');
  humanized = humanized.replace(/值得期待[。！]?\s*$/g, '');
  
  console.log('   ✅ 润色完成');
  return humanized;
}

// CLI
if (require.main === module) {
  const topic = process.argv[2] || '未指定话题';
  write(topic).catch(console.error);
}

module.exports = { write };
