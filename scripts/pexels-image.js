#!/usr/bin/env node
/**
 * 从 Pexels 获取图片
 * 输入：搜索关键词
 * 输出：下载的图片路径
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Pexels API Key（需要用户配置）
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || '';

/**
 * 从 Pexels 搜索并下载图片
 * @param {string} query - 搜索关键词
 * @param {string} outputDir - 输出目录
 * @returns {Promise<string>} - 下载的图片路径
 */
async function getImageFromPexels(query, outputDir) {
  console.log(`🔍 从 Pexels 搜索图片: ${query}`);
  
  if (!PEXELS_API_KEY) {
    throw new Error('未配置 PEXELS_API_KEY 环境变量');
  }
  
  // 清理搜索词，移除特殊字符
  const cleanQuery = query
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, ' ')
    .trim()
    .substring(0, 50);
  
  // 如果清理后为空，使用默认词
  const searchQuery = cleanQuery || 'nature landscape';
  
  // 构建搜索 URL
  const searchUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQuery)}&per_page=10&orientation=landscape`;
  
  return new Promise((resolve, reject) => {
    const req = https.get(searchUrl, {
      headers: {
        'Authorization': PEXELS_API_KEY
      }
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', async () => {
        try {
          const response = JSON.parse(data);
          
          if (!response.photos || response.photos.length === 0) {
            reject(new Error('Pexels 未找到相关图片'));
            return;
          }
          
          // 随机选择一张图片（避免总是用同一张）
          const randomIndex = Math.floor(Math.random() * Math.min(response.photos.length, 5));
          const photo = response.photos[randomIndex];
          
          // 使用大尺寸图片 (1280x720 或 1920x1080)
          const imageUrl = photo.src.landscape || photo.src.large || photo.src.original;
          
          console.log(`   ✅ 找到图片: ${photo.photographer}`);
          
          // 下载图片
          const imagePath = await downloadImage(imageUrl, outputDir);
          resolve(imagePath);
          
        } catch (e) {
          reject(new Error(`解析 Pexels 响应失败: ${e.message}`));
        }
      });
    });
    
    req.on('error', (err) => {
      reject(new Error(`Pexels API 请求失败: ${err.message}`));
    });
    
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Pexels API 请求超时'));
    });
  });
}

/**
 * 下载图片到本地
 * @param {string} url - 图片 URL
 * @param {string} outputDir - 输出目录
 * @returns {Promise<string>} - 本地图片路径
 */
function downloadImage(url, outputDir) {
  return new Promise((resolve, reject) => {
    const filename = `cover_pexels_${Date.now()}.jpg`;
    const outputPath = path.join(outputDir, filename);
    
    const file = fs.createWriteStream(outputPath);
    
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`下载失败，状态码: ${res.statusCode}`));
        return;
      }
      
      res.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`   ✅ 图片下载完成: ${filename}`);
        resolve(outputPath);
      });
      
      file.on('error', (err) => {
        fs.unlink(outputPath, () => {});
        reject(new Error(`保存图片失败: ${err.message}`));
      });
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {});
      reject(new Error(`下载图片失败: ${err.message}`));
    });
  });
}

// CLI
if (require.main === module) {
  const query = process.argv[2];
  const outputDir = process.argv[3] || path.join(__dirname, '../output');
  
  if (!query) {
    console.log('Usage: node pexels-image.js "搜索关键词" [输出目录]');
    process.exit(1);
  }
  
  getImageFromPexels(query, outputDir)
    .then((imagePath) => {
      console.log(`✅ 图片已保存: ${imagePath}`);
    })
    .catch((err) => {
      console.error('❌ 失败:', err.message);
      process.exit(1);
    });
}

module.exports = { getImageFromPexels };
