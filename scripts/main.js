#!/usr/bin/env node
/**
 * wechat-ai-writer 主入口
 * 完整工作流：研究→分析→封面→写作→发布
 */

const fs = require('fs');
const path = require('path');

const { research } = require('./research');
const { analyze } = require('./analyze');
const { generateCover } = require('./generate-cover');
const { write } = require('./write');
const { publish } = require('./publish');

async function main(topic, options = {}) {
  console.log('╔════════════════════════════════════════╗');
  console.log('║     ✍️ 微信公众号AI写作助手            ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  const startTime = Date.now();
  
  try {
    // 步骤1：广度搜集
    console.log('\n📚 步骤 1/6：广度搜集');
    console.log('─────────────────');
    const researchResult = await research(topic);
    
    // 步骤2：洞见提炼
    console.log('\n🧠 步骤 2/6：洞见提炼');
    console.log('─────────────────');
    const analyzeResult = await analyze(topic);
    
    // 步骤3：生成封面
    console.log('\n🎨 步骤 3/6：生成封面');
    console.log('─────────────────');
    const coverPath = await generateCover(topic, analyzeResult.insights);
    
    // 步骤4：沉浸创作
    console.log('\n✍️ 步骤 4/6：沉浸创作');
    console.log('─────────────────');
    const articlePath = await write(topic);
    
    // 步骤5：添加Frontmatter（已在write中完成）
    console.log('\n📝 步骤 5/6：添加Frontmatter');
    console.log('─────────────────');
    console.log('✅ Frontmatter已添加');
    
    // 步骤6：交付确认
    console.log('\n📤 步骤 6/6：交付确认');
    console.log('─────────────────');
    const publishResult = await publish(articlePath, { 
      dryRun: options.dryRun,
      waitForConfirm: !options.autoConfirm,
      theme: options.theme
    });
    
    // 总结
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║           ✅ 处理完成                  ║');
    console.log('╚════════════════════════════════════════╝');
    console.log(`⏱️  耗时：${duration}秒`);
    console.log(`📄 文章：${articlePath}`);
    console.log(`🖼️  封面：${coverPath}`);
    console.log(`📊 状态：${publishResult.status}`);
    
    if (publishResult.status === 'waiting_for_confirm') {
      console.log('\n⚠️  请查看文章后回复"确认发布"以推送到公众号');
    }
    
    return {
      topic,
      articlePath,
      coverPath,
      status: publishResult.status,
      duration
    };
    
  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const topic = args.find(arg => !arg.startsWith('--'));
  
  const dryRun = args.includes('--dry-run');
  const autoConfirm = args.includes('--auto-confirm');
  
  // 解析主题参数 --theme=xxx
  const themeArg = args.find(arg => arg.startsWith('--theme='));
  const theme = themeArg ? themeArg.split('=')[1] : undefined;
  
  if (!topic) {
    console.log('╔════════════════════════════════════════╗');
    console.log('║     ✍️ 微信公众号AI写作助手            ║');
    console.log('╚════════════════════════════════════════╝\n');
    console.log('用法：');
    console.log('  node main.js "话题关键词" [选项]\n');
    console.log('选项：');
    console.log('  --dry-run            仅生成，不发布');
    console.log('  --auto-confirm       自动确认（不等待用户）');
    console.log('  --theme=<主题>       指定发布主题（默认：pie）\n');
    console.log('可用主题：');
    console.log('  pie, lapis, orangeheart, rainbow, maize, purple, phycat');
    console.log('  aurora, newsroom, sage, ember\n');
    console.log('示例：');
    console.log('  node main.js "职场PUA"');
    console.log('  node main.js "职场PUA" --dry-run');
    console.log('  node main.js "职场PUA" --theme=newsroom');
    process.exit(1);
  }
  
  main(topic, { dryRun, autoConfirm, theme });
}

module.exports = { main };
