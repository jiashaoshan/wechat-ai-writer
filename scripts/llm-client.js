#!/usr/bin/env node
/**
 * LLM客户端 - 使用OpenClaw配置的模型
 * 默认使用 bailian/kimi-k2.5
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 读取OpenClaw配置
function loadOpenClawConfig() {
  const configPath = path.join(os.homedir(), '.openclaw/openclaw.json');
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
  return null;
}

// 获取默认模型配置
function getDefaultModelConfig() {
  const config = loadOpenClawConfig();
  if (!config || !config.models || !config.models.providers) {
    throw new Error('无法读取OpenClaw配置');
  }
  
  // 优先使用 moonshot/kimi-k2.5
  const moonshotProvider = config.models.providers.moonshot;
  if (moonshotProvider) {
    // 使用提供的 API Key
    const apiKey = 'sk-YZW2kDozSfvQW5CqsiaCTSex4Kdw3RbyMPMnbJrWiDRhFgpH';
    return {
      baseUrl: moonshotProvider.baseUrl,
      apiKey: apiKey,
      model: 'kimi-k2.5',
      maxTokens: 8192,
      contextWindow: 256000
    };
  }
  
  // 备选：使用 deepseek
  const deepseekProvider = config.models.providers.deepseek;
  if (deepseekProvider && deepseekProvider.apiKey) {
    return {
      baseUrl: deepseekProvider.baseUrl,
      apiKey: deepseekProvider.apiKey,
      model: 'deepseek-chat',
      maxTokens: 8192,
      contextWindow: 200000
    };
  }
  
  throw new Error('未找到可用的LLM配置');
}

// 调用LLM API
async function callLLM(messages, options = {}) {
  const config = getDefaultModelConfig();
  const maxTokens = options.maxTokens || 4096;
  
  // Moonshot kimi-k2.5 只支持 temperature=1
  const isMoonshot = config.baseUrl.includes('moonshot');
  const temperature = isMoonshot ? 1 : (options.temperature || 0.7);
  
  const requestBody = {
    model: config.model,
    messages: messages,
    max_tokens: maxTokens,
    temperature: temperature
  };
  
  return new Promise((resolve, reject) => {
    const url = new URL(config.baseUrl + '/chat/completions');
    
    const reqOptions = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      }
    };
    
    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.choices && response.choices[0]) {
            resolve(response.choices[0].message.content);
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

// 生成洞见
async function generateInsights(articles, topic) {
  const messages = [
    {
      role: 'system',
      content: '你是一位资深内容策划，擅长从文章中提炼独到洞见。输出必须是纯JSON格式，不要添加Markdown代码块标记。'
    },
    {
      role: 'user',
      content: `基于以下关于"${topic}"的文章，提炼3-5个独到洞见。

【文章列表】
${articles.slice(0, 5).map((a, i) => `标题：${a.title}\n摘要：${(a.summary || '').substring(0, 100)}`).join('\n\n')}

【分析框架】
1. 找矛盾：哪些观点相互冲突？
2. 找本质：表面现象背后的底层逻辑？
3. 找盲区：大多数人忽略的角度？

【输出要求】
- 格式：纯JSON数组，不要Markdown代码块
- 数量：3-5个洞见
- 每个洞见字段：title（15字内）、type（矛盾/本质/盲区）、content（100字内）、evidence（50字内）、emotional_hook（20字内）
- 只输出JSON，不要任何其他文字

【示例格式】
[{"title":"示例标题","type":"本质","content":"示例内容","evidence":"示例论据","emotional_hook":"示例钩子"}]`
    }
  ];
  
  const response = await callLLM(messages, { maxTokens: 2048 });
  
  // 解析JSON - 智能提取，处理各种格式
  try {
    // 步骤1: 找到 JSON 数组的开始和结束
    const startIdx = response.indexOf('[');
    const endIdx = response.lastIndexOf(']');
    
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
      console.error('未找到JSON数组标记');
      return [];
    }
    
    // 提取 JSON 部分
    let jsonStr = response.substring(startIdx, endIdx + 1);
    
    // 步骤2: 清理 Markdown 代码块标记
    jsonStr = jsonStr
      .replace(/```json\s*/g, '')
      .replace(/```\s*$/g, '')
      .trim();
    
    // 步骤3: 标准化引号
    jsonStr = jsonStr
      .replace(/[\u201C\u201D]/g, '"')   // 中文双引号
      .replace(/[\u2018\u2019]/g, "'")   // 中文单引号
      .replace(/\n/g, '\\n')             // 转义换行
      .replace(/\r/g, '\\r')             // 转义回车
      .replace(/\t/g, '\\t');            // 转义制表符
    
    // 步骤4: 尝试解析
    try {
      const result = JSON.parse(jsonStr);
      console.log(`   ✅ 成功解析 ${result.length} 个洞见`);
      return result;
    } catch (parseError) {
      console.log('   第一次解析失败，尝试修复...');
      
      // 修复多余的逗号
      jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');
      
      // 修复属性名缺失引号
      jsonStr = jsonStr.replace(/(\{|,\s*)(\w+):/g, '$1"$2":');
      
      const result = JSON.parse(jsonStr);
      console.log(`   ✅ 修复后成功解析 ${result.length} 个洞见`);
      return result;
    }
  } catch (e) {
    console.error('解析洞见失败:', e.message);
    console.error('原始响应前500字符:', response.substring(0, 500));
    return [];
  }
}

// 生成文章
async function generateArticle(topic, insights, emotionCurve, options = {}) {
  const style = options.style || '口语化';
  const length = options.length || 'medium';
  
  const lengthMap = {
    short: '800字左右',
    medium: '1500字左右',
    long: '2500字左右'
  };
  
  const messages = [
    {
      role: 'system',
      content: `你是一位资深公众号写手，擅长用${style}、有活人感的风格写作。`
    },
    {
      role: 'user',
      content: `话题：${topic}

核心洞见：
${insights.map((insight, i) => `${i + 1}. [${insight.type}] ${insight.title}\n   ${insight.content}\n   论据：${insight.evidence}`).join('\n\n')}

情感曲线设计：
${emotionCurve.structure.map(s => `- ${s.section}: ${s.emotion}（${s.purpose}）`).join('\n')}

写作要求：
1. **开头**（痛点共鸣）：
   - 用一个扎心的场景或数据开头
   - 让读者感觉"这说的就是我"
   - 避免说教，用故事引入

2. **正文**（洞见展开）：
   - 每个洞见一个小节
   - 用口语化表达，像跟朋友聊天
   - 插入具体案例或数据支撑

3. **金句**（原创刺痛）：
   - 每个洞见配1-2个金句
   - 金句要简短、有冲击力、易传播
   - 避免陈词滥调

4. **结尾**（温暖升华）：
   - 给读者"心理按摩"
   - 提供希望或行动建议
   - 避免空洞的"未来可期"

5. **风格要求**：
   - 绝对避免AI腔调
   - 多用短句、口语化词汇
   - 适当使用"说实话"、"你可能没想到"等口语表达
   - 删除"赋能"、"闭环"、"底层逻辑"等AI高频词

字数要求：${lengthMap[length]}

输出格式：Markdown，包含各级标题。只输出文章内容，不要其他说明。`
    }
  ];
  
  return await callLLM(messages, { maxTokens: 4096, temperature: 0.8 });
}

// 生成封面图Prompt
async function generateCoverPrompt(topic, insights) {
  // 确保有有效的洞见
  const keyInsight = insights && insights.length > 0 && insights[0]?.title 
    ? insights[0].title 
    : `${topic}的真相`;
  
  const messages = [
    {
      role: 'system',
      content: '你是一位专业的视觉设计师，擅长为公众号文章设计封面图。只输出英文Prompt，不要其他文字。'
    },
    {
      role: 'user',
      content: `为话题"${topic}"设计一张公众号封面图。

核心主题：${keyInsight}

要求：
- 风格：photorealistic, professional photography, cinematic realism
- 比例：21:9 wide cinematic banner (1920x823)
- 元素：realistic human subjects, natural lighting, authentic textures, shallow depth of field
- 氛围：editorial photography, sophisticated, emotionally resonant, suitable for WeChat
- 语言：英文Prompt

请直接输出英文图像生成Prompt，不要解释，不要Markdown。字数控制在300词以内。`
    }
  ];
  
  const prompt = await callLLM(messages, { maxTokens: 512 });
  
  // 确保返回的Prompt不为空
  if (!prompt || prompt.trim().length < 50) {
    // 返回默认Prompt（照片写实风格）
    return `A photorealistic banner image about "${topic}", professional photography style, cinematic lighting with soft bokeh, natural color grading, realistic details, shallow depth of field, 21:9 wide cinematic banner, editorial photography look, suitable for WeChat public account cover, high-quality aesthetic`;
  }
  
  return prompt.trim();
}

module.exports = {
  callLLM,
  generateInsights,
  generateArticle,
  generateCoverPrompt,
  getDefaultModelConfig
};
