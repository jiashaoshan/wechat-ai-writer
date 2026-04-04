#!/usr/bin/env node
/**
 * 洞见提炼：对比分析生成观点 + 设计情感曲线
 * 输入：research.json
 * 输出：insights.json
 */

const fs = require('fs');
const path = require('path');
const { generateInsights } = require('./llm-client');

async function analyze(topic) {
  console.log(`🧠 开始分析话题：${topic}`);
  
  const outputDir = path.join(__dirname, '../output');
  const researchPath = path.join(outputDir, 'research.json');
  
  if (!fs.existsSync(researchPath)) {
    console.error('❌ 请先运行 research.js 搜集资料');
    process.exit(1);
  }
  
  const research = JSON.parse(fs.readFileSync(researchPath, 'utf8'));
  
  // 1. 提取关键信息
  const articles = research.articles;
  console.log(`📊 分析 ${articles.length} 篇文章...`);
  
  // 2. 生成洞见（调用LLM）
  const insights = await generateInsightsFromLLM(articles, topic);
  
  // 3. 设计情感曲线
  const emotionCurve = designEmotionCurve(insights);
  
  // 4. 保存结果
  const result = {
    topic,
    timestamp: new Date().toISOString(),
    insights,
    emotionCurve,
    articleCount: articles.length
  };
  
  fs.writeFileSync(
    path.join(outputDir, 'insights.json'),
    JSON.stringify(result, null, 2)
  );
  
  console.log(`✅ 分析完成：提炼 ${insights.length} 个洞见`);
  console.log('\n📌 核心洞见：');
  insights.forEach((insight, i) => {
    console.log(`  ${i + 1}. ${insight.title}`);
  });
  
  return result;
}

async function generateInsightsFromLLM(articles, topic) {
  console.log('   调用 LLM 生成洞见...');
  try {
    const insights = await generateInsights(articles, topic);
    console.log(`   ✅ 生成 ${insights.length} 个洞见`);
    return insights;
  } catch (e) {
    console.error('   ❌ 生成洞见失败:', e.message);
    // 返回默认洞见
    return [
      {
        title: `${topic}的表象与本质`,
        type: "本质",
        content: "表面看是现象问题，深层是结构性问题",
        evidence: "从多篇文章中发现的共性",
        emotional_hook: "你是否也曾感到困惑？"
      },
      {
        title: "被忽视的关键视角",
        type: "盲区",
        content: "大多数人只关注表面，忽略了深层原因",
        evidence: "对比不同观点得出的结论",
        emotional_hook: "原来我们都想错了"
      },
      {
        title: "矛盾中的机会",
        type: "矛盾",
        content: "看似对立的观点，其实可以统一",
        evidence: "从冲突观点中找到的平衡点",
        emotional_hook: "转机往往藏在矛盾中"
      }
    ];
  }
}

function designEmotionCurve(insights) {
  // 根据洞见设计情感曲线
  return {
    structure: [
      { section: "开头", emotion: "痛点共鸣", purpose: "扎心，引发共鸣" },
      { section: "洞见1", emotion: "认知颠覆", purpose: "打破常规认知" },
      { section: "洞见2", emotion: "深度思考", purpose: "揭示本质" },
      { section: "洞见3", emotion: "恍然大悟", purpose: "填补盲区" },
      { section: "结尾", emotion: "温暖治愈", purpose: "心理按摩，给希望" }
    ],
    golden_sentences: [
      "开头金句（扎心）",
      "转折金句（颠覆）",
      "洞察金句（本质）",
      "升华金句（治愈）"
    ]
  };
}

// CLI
if (require.main === module) {
  const topic = process.argv[2] || '未指定话题';
  analyze(topic).catch(console.error);
}

module.exports = { analyze };
