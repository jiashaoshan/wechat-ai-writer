#!/usr/bin/env node
/**
 * 豆包图片生成客户端
 * 使用豆包Seedream 5.0模型生成图片
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_CONFIG = {
  baseUrl: 'ark.cn-beijing.volces.com',
  apiKey: '2f1b5a5c-3f74-416e-83ba-4e8d4369b0f1',
  model: 'doubao-seedream-5-0-260128'
};

/**
 * 生成图片
 * @param {string} prompt - 图片生成提示词
 * @param {Object} options - 可选参数
 * @returns {Promise<string>} - 图片URL
 */
async function generateImage(prompt, options = {}) {
  const requestBody = {
    model: API_CONFIG.model,
    prompt: prompt,
    sequential_image_generation: options.sequential || 'disabled',
    response_format: options.responseFormat || 'url',
    size: options.size || '2K',
    stream: options.stream || false,
    watermark: options.watermark !== false // 默认开启水印
  };

  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: API_CONFIG.baseUrl,
      path: '/api/v3/images/generations',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_CONFIG.apiKey}`
      }
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.data && response.data[0] && response.data[0].url) {
            resolve(response.data[0].url);
          } else if (response.error) {
            reject(new Error(`API Error: ${response.error.message}`));
          } else {
            reject(new Error('Invalid response: ' + data));
          }
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

/**
 * 下载图片到本地
 * @param {string} imageUrl - 图片URL
 * @param {string} outputPath - 保存路径
 */
async function downloadImage(imageUrl, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    https.get(imageUrl, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Status ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(outputPath);
      });
    }).on('error', reject);
  });
}

/**
 * 生成封面图（21:9）
 * @param {string} prompt - 封面提示词
 * @param {string} outputDir - 输出目录
 * @returns {Promise<string>} - 本地文件路径
 */
async function generateCoverImage(prompt, outputDir) {
  console.log('   调用豆包生成封面图...');
  console.log('   Prompt:', prompt.substring(0, 80) + '...');
  
  try {
    // 生成图片
    const imageUrl = await generateImage(prompt, {
      size: '2K', // 2K分辨率适合封面
      watermark: true
    });
    
    console.log('   ✅ 图片生成成功');
    console.log('   URL:', imageUrl.substring(0, 60) + '...');
    
    // 下载到本地
    const outputPath = path.join(outputDir, 'cover.jpg');
    await downloadImage(imageUrl, outputPath);
    
    console.log('   ✅ 图片下载完成:', outputPath);
    return outputPath;
    
  } catch (e) {
    console.error('   ❌ 生成失败:', e.message);
    throw e;
  }
}

module.exports = {
  generateImage,
  downloadImage,
  generateCoverImage
};

// CLI测试
if (require.main === module) {
  const prompt = process.argv[2];
  if (!prompt) {
    console.log('Usage: node doubao-image.js "提示词"');
    process.exit(1);
  }
  
  const outputDir = path.join(__dirname, '../output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  generateCoverImage(prompt, outputDir)
    .then(path => console.log('✅ 完成:', path))
    .catch(err => {
      console.error('❌ 失败:', err.message);
      process.exit(1);
    });
}
