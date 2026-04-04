#!/usr/bin/env node
/**
 * Tavily搜索客户端 - 使用OpenClaw配置的Tavily MCP
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 读取Tavily配置（优先环境变量，其次OpenClaw配置）
function getTavilyConfig() {
  // 优先从环境变量读取
  if (process.env.TAVILY_API_KEY) {
    return {
      apiKey: process.env.TAVILY_API_KEY,
      baseUrl: 'https://api.tavily.com'
    };
  }
  
  // 从OpenClaw配置读取
  const configPath = path.join(os.homedir(), '.openclaw/openclaw.json');
  if (!fs.existsSync(configPath)) {
    return null;
  }
  
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  
  // 从MCP配置中提取Tavily URL
  const mcpConfig = config.plugins?.entries?.['mcp-adapter']?.config;
  if (!mcpConfig || !mcpConfig.servers) {
    return null;
  }
  
  const tavilyServer = mcpConfig.servers.find(s => s.name === 'tavily-search');
  if (!tavilyServer) {
    return null;
  }
  
  // 提取API Key
  const urlMatch = tavilyServer.url.match(/tavilyApiKey=([^&]+)/);
  if (!urlMatch) {
    return null;
  }
  
  return {
    apiKey: urlMatch[1],
    baseUrl: 'https://api.tavily.com'
  };
}

// Tavily搜索
async function tavilySearch(query, options = {}) {
  const config = getTavilyConfig();
  if (!config) {
    throw new Error('Tavily配置未找到');
  }
  
  const requestBody = {
    api_key: config.apiKey,
    query: query,
    search_depth: options.depth || 'basic', // basic or comprehensive
    max_results: options.maxResults || 5,
    include_answer: options.includeAnswer || false,
    include_images: options.includeImages || false,
    include_raw_content: options.includeRawContent || false
  };
  
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: 'api.tavily.com',
      path: '/search',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (e) {
          reject(new Error('Parse error: ' + e.message));
        }
      });
    });
    
    req.on('error', reject);
    req.write(JSON.stringify(requestBody));
    req.end();
  });
}

// 搜索知乎文章
async function searchZhihu(query, maxResults = 3) {
  try {
    console.log('   调用 Tavily 搜索知乎...');
    const result = await tavilySearch(`${query} site:zhihu.com`, {
      maxResults,
      includeRawContent: true
    });
    
    const articles = (result.results || []).map(r => ({
      platform: 'zhihu',
      title: r.title,
      url: r.url,
      summary: r.content,
      source: '知乎'
    }));
    
    console.log(`   ✅ 找到 ${articles.length} 篇知乎文章`);
    return articles;
  } catch (e) {
    console.log('⚠️ 知乎搜索失败:', e.message);
    return [];
  }
}

// 搜索小红书
async function searchXiaohongshu(query, maxResults = 3) {
  try {
    console.log('   调用 Tavily 搜索小红书...');
    const result = await tavilySearch(`${query} site:xiaohongshu.com`, {
      maxResults,
      includeRawContent: true
    });
    
    const articles = (result.results || []).map(r => ({
      platform: 'xiaohongshu',
      title: r.title,
      url: r.url,
      summary: r.content,
      source: '小红书'
    }));
    
    console.log(`   ✅ 找到 ${articles.length} 篇小红书文章`);
    return articles;
  } catch (e) {
    console.log('⚠️ 小红书搜索失败:', e.message);
    return [];
  }
}

// 搜索图片
async function searchImages(query, maxResults = 5) {
  try {
    console.log('   调用 Tavily 搜索图片...');
    const result = await tavilySearch(query, {
      maxResults: maxResults * 2,
      includeImages: true
    });
    
    // 处理图片结果
    const images = [];
    if (result.images && Array.isArray(result.images)) {
      for (const img of result.images.slice(0, maxResults)) {
        // Tavily 可能返回字符串或对象
        if (typeof img === 'string') {
          images.push({
            url: img,
            description: query,
            source: 'tavily'
          });
        } else if (img && typeof img === 'object') {
          images.push({
            url: img.url || img,
            description: img.description || img.title || query,
            source: img.source || 'tavily'
          });
        }
      }
    }
    
    console.log(`   ✅ 找到 ${images.length} 张图片`);
    return images;
  } catch (e) {
    console.log('⚠️ 图片搜索失败:', e.message);
    return [];
  }
}

// 搜索梗图（别名）
async function searchMemes(query, maxResults = 5) {
  return searchImages(`${query} 表情包 OR 梗图 OR meme`, maxResults);
}

module.exports = {
  tavilySearch,
  searchZhihu,
  searchXiaohongshu,
  searchImages,
  searchMemes,
  getTavilyConfig
};
