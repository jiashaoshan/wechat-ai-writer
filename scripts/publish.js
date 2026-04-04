#!/usr/bin/env node
/**
 * 发布到公众号草稿箱
 * 输入：article.md
 * 输出：发布成功/等待确认
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
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

async function publish(articlePath, options = {}) {
  console.log('📤 准备发布文章...');
  
  if (!fs.existsSync(articlePath)) {
    console.error('❌ 文章文件不存在:', articlePath);
    process.exit(1);
  }
  
  const article = fs.readFileSync(articlePath, 'utf8');
  
  // 1. 检查 Frontmatter
  if (!article.includes('---')) {
    console.error('❌ 文章缺少 Frontmatter');
    process.exit(1);
  }
  
  // 2. 如果是 dry-run 模式，只预览
  if (options.dryRun) {
    console.log('\n📄 文章预览（dry-run模式）：\n');
    console.log(article.substring(0, 500) + '...\n');
    console.log('✅ 预览完成，未发布');
    return { status: 'preview', path: articlePath };
  }
  
  // 3. 等待用户确认
  if (options.waitForConfirm !== false) {
    console.log('\n📄 文章已生成，请查看：', articlePath);
    console.log('\n⚠️ 请确认文章内容无误后，回复"确认发布"以推送到公众号草稿箱。');
    console.log('💡 或告诉我修改意见，我会调整后再发布。\n');
    
    return { 
      status: 'waiting_for_confirm', 
      path: articlePath,
      message: '等待用户确认"确认发布"'
    };
  }
  
  // 4. 发布到公众号
  return await doPublish(articlePath);
}

async function doPublish(articlePath, options = {}) {
  console.log('🚀 正在推送到公众号草稿箱...');
  
  // 加载配置获取主题
  const config = loadConfig();
  const theme = options.theme || config.publish?.theme || 'pie';
  const highlight = options.highlight || config.publish?.highlight || 'github';
  
  console.log(`   使用主题: ${theme}, 代码高亮: ${highlight}`);
  
  // 检查 wechat-mp-publisher skill（优先使用）
  const wechatPublisherPath = path.expanduser('~/.openclaw/workspace/skills/wechat-mp-publisher');
  const wechatToolkitPath = path.expanduser('~/.openclaw/workspace/skills/wechat-toolkit');
  
  let publishScript = null;
  let usePublisher = false;
  let isShellScript = false;
  
  if (fs.existsSync(wechatPublisherPath)) {
    // wechat-mp-publisher 使用 shell 脚本
    const shellScript = path.join(wechatPublisherPath, 'scripts/publish.sh');
    if (fs.existsSync(shellScript)) {
      publishScript = shellScript;
      usePublisher = true;
      isShellScript = true;
      console.log('   使用 wechat-mp-publisher 发布');
    }
  }
  
  if (!publishScript && fs.existsSync(wechatToolkitPath)) {
    // wechat-toolkit 使用 node 脚本
    const nodeScript = path.join(wechatToolkitPath, 'scripts/publisher/publish.js');
    if (fs.existsSync(nodeScript)) {
      publishScript = nodeScript;
      console.log('   使用 wechat-toolkit 发布');
    }
  }
  
  if (!publishScript) {
    console.error('❌ 未找到发布技能');
    console.log('💡 请先安装：clawhub install wechat-mp-publisher');
    return { status: 'error', error: 'publisher not installed' };
  }
  
  if (!fs.existsSync(publishScript)) {
    console.error('❌ 发布脚本不存在:', publishScript);
    return { status: 'error', error: 'publish script not found' };
  }
  
  try {
    const { execSync } = require('child_process');
    
    // 构建发布命令
    let cmd;
    if (isShellScript) {
      // wechat-mp-publisher shell 脚本
      cmd = `bash "${publishScript}" "${articlePath}"`;
    } else {
      // wechat-toolkit node 脚本
      cmd = `node "${publishScript}" "${articlePath}" ${theme}`;
    }
    
    // 执行发布
    const result = execSync(cmd, { 
      encoding: 'utf8',
      timeout: 60000,
      env: { ...process.env }
    });
    
    console.log('✅ 发布成功！');
    console.log('📱 请在公众号后台查看草稿箱');
    
    return { 
      status: 'published', 
      path: articlePath,
      theme: theme,
      output: result 
    };
    
  } catch (e) {
    console.error('❌ 发布失败:', e.message);
    
    // 常见错误处理
    if (e.message.includes('IP')) {
      console.log('💡 提示：IP不在白名单，请先将当前IP添加到公众号后台');
    }
    if (e.message.includes('token')) {
      console.log('💡 提示：Token失效，请检查 WECHAT_APP_ID 和 WECHAT_APP_SECRET');
    }
    if (e.message.includes('环境变量')) {
      console.log('💡 提示：请先设置环境变量：');
      console.log('   export WECHAT_APP_ID="your_app_id"');
      console.log('   export WECHAT_APP_SECRET="your_app_secret"');
    }
    
    return { status: 'error', error: e.message };
  }
}

// CLI
if (require.main === module) {
  const articlePath = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');
  const autoConfirm = process.argv.includes('--auto-confirm');
  
  if (!articlePath) {
    console.log('Usage: node publish.js <article.md> [--dry-run] [--auto-confirm]');
    process.exit(1);
  }
  
  publish(articlePath, { 
    dryRun, 
    waitForConfirm: !autoConfirm 
  }).catch(console.error);
}

module.exports = { publish };
