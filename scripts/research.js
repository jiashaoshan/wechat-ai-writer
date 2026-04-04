#!/usr/bin/env node
/**
 * 广度搜集：搜索文章 + 梗图
 * 输出：articles.json + memes/
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');
const { searchZhihu, searchXiaohongshu, searchMemes } = require('./tavily-search');

const CONFIG = loadConfig();

// 兼容 path.expanduser
path.expanduser = function(filepath) {
  if (filepath.startsWith('~/')) {
    return path.join(os.homedir(), filepath.slice(2));
  }
  return filepath;
};

function loadConfig() {
  const configPath = path.join(__dirname, '../config/default.yaml');
  if (fs.existsSync(configPath)) {
    const yaml = require('js-yaml');
    return yaml.load(fs.readFileSync(configPath, 'utf8'));
  }
  return {};
}

async function research(topic) {
  console.log(`🔍 开始搜索话题：${topic}`);
  
  const outputDir = path.join(__dirname, '../output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // 1. 搜索公众号文章
  console.log('📱 搜索公众号文章...');
  const wechatArticles = await searchWechatArticles(topic);
  
  // 2. 搜索知乎文章
  console.log('📚 搜索知乎文章...');
  const zhihuArticles = await searchZhihuArticles(topic);
  
  // 3. 搜索小红书
  console.log('📕 搜索小红书...');
  const xhsArticles = await searchXiaohongshuArticles(topic);
  
  // 4. 搜索梗图
  console.log('🎭 搜索梗图...');
  const memes = await searchMemeImages(topic);
  
  // 5. 合并结果
  const allArticles = [...wechatArticles, ...zhihuArticles, ...xhsArticles]
    .slice(0, CONFIG.search?.article_count || 8);
  
  // 6. 保存结果
  const result = {
    topic,
    timestamp: new Date().toISOString(),
    articles: allArticles,
    memes: memes
  };
  
  fs.writeFileSync(
    path.join(outputDir, 'research.json'),
    JSON.stringify(result, null, 2)
  );
  
  console.log(`✅ 搜集完成：${allArticles.length}篇文章，${memes.length}张梗图`);
  return result;
}

async function searchWechatArticles(topic) {
  try {
    // 使用 wechat-article-search skill
    const searchScript = path.join(process.env.HOME, '.openclaw/workspace/skills/wechat-article-search/scripts/search_wechat.js');
    if (!fs.existsSync(searchScript)) {
      console.log('⚠️ wechat-article-search 技能未安装');
      return [];
    }
    
    console.log(`   调用 wechat-article-search: "${topic}"`);
    const result = execSync(`node "${searchScript}" "${topic}" -n 5`, { 
      encoding: 'utf8',
      timeout: 30000,
      cwd: path.dirname(searchScript)
    });
    
    const data = JSON.parse(result);
    const articles = data.articles || [];
    
    console.log(`   ✅ 找到 ${articles.length} 篇文章`);
    
    return articles.map(a => ({
      platform: 'wechat',
      title: a.title,
      url: a.url,
      summary: a.summary,
      source: a.source,
      datetime: a.datetime
    }));
  } catch (e) {
    console.log('⚠️ 公众号搜索失败:', e.message);
    return [];
  }
}

async function searchZhihuArticles(topic) {
  try {
    console.log('   调用 Tavily 搜索知乎...');
    const articles = await searchZhihu(topic, 3);
    console.log(`   ✅ 找到 ${articles.length} 篇知乎文章`);
    return articles;
  } catch (e) {
    console.log('⚠️ 知乎搜索失败:', e.message);
    return [];
  }
}

async function searchXiaohongshuArticles(topic) {
  try {
    console.log('   调用 Tavily 搜索小红书...');
    const articles = await searchXiaohongshu(topic, 3);
    console.log(`   ✅ 找到 ${articles.length} 篇小红书文章`);
    return articles;
  } catch (e) {
    console.log('⚠️ 小红书搜索失败:', e.message);
    return [];
  }
}

async function searchMemeImages(topic) {
  const memesDir = path.join(__dirname, '../output/memes');
  if (!fs.existsSync(memesDir)) {
    fs.mkdirSync(memesDir, { recursive: true });
  }
  
  try {
    console.log('   调用 Tavily 搜索梗图...');
    const memes = await searchMemes(topic, 3);
    console.log(`   ✅ 找到 ${memes.length} 张梗图`);
    
    // 下载梗图到本地
    const downloadedMemes = [];
    for (let i = 0; i < memes.length; i++) {
      const meme = memes[i];
      if (!meme.url) {
        console.log(`   ⚠️ 跳过无效梗图链接`);
        continue;
      }
      try {
        console.log(`   下载梗图 ${i + 1}/${memes.length}...`);
        const ext = meme.url.match(/\.(jpg|jpeg|png|gif)/i)?.[0] || '.jpg';
        const localPath = path.join(memesDir, `meme_${i + 1}${ext}`);
        await downloadImage(meme.url, localPath);
        downloadedMemes.push({
          ...meme,
          localPath: localPath
        });
        console.log(`   ✅ 下载完成: meme_${i + 1}${ext}`);
      } catch (e) {
        console.log(`   ⚠️ 下载梗图失败: ${meme.url.substring(0, 50)}... (${e.message})`);
      }
    }
    
    return downloadedMemes;
  } catch (e) {
    console.log('⚠️ 梗图搜索失败:', e.message);
    return [];
  }
}

async function downloadImage(url, outputPath) {
  const https = require('https');
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Status ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', reject);
  });
}

// CLI
if (require.main === module) {
  const topic = process.argv[2];
  if (!topic) {
    console.log('Usage: node research.js "话题关键词"');
    process.exit(1);
  }
  
  research(topic).catch(console.error);
}

module.exports = { research };
