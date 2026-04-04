#!/usr/bin/env node
/**
 * 生成21:9封面图
 * 输入：话题 + 洞见
 * 输出：cover.jpg
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { generateCoverPrompt } = require('./llm-client');
const { generateCoverImage } = require('./doubao-image');

// 兼容 path.expanduser
path.expanduser = function(filepath) {
  if (filepath.startsWith('~/')) {
    return path.join(os.homedir(), filepath.slice(2));
  }
  return filepath;
};

async function generateCover(topic, insights) {
  console.log(`🎨 开始生成封面图：${topic}`);
  
  const outputDir = path.join(__dirname, '../output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // 1. 检查洞见，如果没有则使用默认
  const effectiveInsights = insights && insights.length > 0 ? insights : [
    { title: `${topic}的真相`, type: '本质', content: '表面现象背后的深层逻辑' }
  ];
  
  // 2. 生成封面Prompt
  console.log('   生成封面Prompt...');
  const coverPrompt = await generateCoverPrompt(topic, effectiveInsights);
  console.log('📝 封面Prompt:', coverPrompt.substring(0, 100) + '...');
  
  // 3. 生成图片
  const coverPath = await callImageGen(coverPrompt, outputDir);
  
  console.log(`✅ 封面图生成完成：${coverPath}`);
  return coverPath;
}

async function callImageGen(prompt, outputDir) {
  try {
    // 使用豆包生成封面图
    const coverPath = await generateCoverImage(prompt, outputDir);
    return coverPath;
  } catch (e) {
    console.log('   ⚠️ 豆包生成失败，使用默认封面图:', e.message);
    
    // 保存Prompt供手动生成
    fs.writeFileSync(
      path.join(outputDir, 'cover_prompt.txt'),
      `封面Prompt:\n${prompt}\n\n尺寸: 1920x823 (21:9)\n\n错误: ${e.message}`
    );
    
    // 使用默认封面图
    const defaultCoverPath = path.join(__dirname, '../../wechat-prompt-context/assets/default-cover.jpg');
    const outputCoverPath = path.join(outputDir, 'cover.jpg');
    
    if (fs.existsSync(defaultCoverPath)) {
      fs.copyFileSync(defaultCoverPath, outputCoverPath);
      console.log('   ✅ 已复制默认封面图');
      return outputCoverPath;
    } else {
      console.log('   ⚠️ 默认封面图不存在，请手动放置图片到:', outputCoverPath);
      return outputCoverPath;
    }
  }
}

// CLI
if (require.main === module) {
  const topic = process.argv[2];
  if (!topic) {
    console.log('Usage: node generate-cover.js "话题"');
    process.exit(1);
  }
  
  // 读取洞见
  const insightsPath = path.join(__dirname, '../output/insights.json');
  let insights = [];
  if (fs.existsSync(insightsPath)) {
    const data = JSON.parse(fs.readFileSync(insightsPath, 'utf8'));
    insights = data.insights || [];
  }
  
  generateCover(topic, insights).catch(console.error);
}

module.exports = { generateCover };
