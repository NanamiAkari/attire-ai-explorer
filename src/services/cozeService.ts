// Coze API服务
export const COZE_API_BASE = 'https://api.coze.cn';
export const COZE_API_TOKEN = 'pat_R7sAdh24rufZtr9xH5VoDsSjD1K9K2SNvepGLpGq3pFUWlhIR9D2JIycR3f9Ynxk';
const WORKFLOW_ID = '7529771322207010856';
// APP_ID需要从Coze工作流编辑页面的URL中获取，格式为：project-ide/{APP_ID}/workflow/{WORKFLOW_ID}
// 请替换为正确的APP_ID，如果没有单独的APP_ID，可以尝试使用WORKFLOW_ID
const APP_ID = '7529771322207010856'; // 请替换为正确的APP_ID

// 图片上传到Coze并获取file_id
const uploadImageToCoze = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    console.log('开始上传图片到Coze:', file.name, file.size);
    
    const response = await fetch(`${COZE_API_BASE}/v1/files/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${COZE_API_TOKEN}`,
      },
      body: formData
    });
    
    console.log('Coze文件上传响应状态:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('文件上传失败详情:', errorText);
      throw new Error(`文件上传失败: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log('🔍 Coze文件上传完整响应:', JSON.stringify(result, null, 2));
    
    // 获取file_id
    let fileId = null;
    
    // 常见的响应格式
    if (result.data) {
      fileId = result.data.id || result.data.file_id;
      console.log('📁 从result.data中查找file_id:', fileId);
    }
    
    // 直接在根级别查找
    if (!fileId) {
      fileId = result.id || result.file_id;
      console.log('📁 从根级别查找file_id:', fileId);
    }
    
    // 检查是否有files数组
    if (!fileId && result.files && Array.isArray(result.files) && result.files.length > 0) {
      const firstFile = result.files[0];
      fileId = firstFile.id || firstFile.file_id;
      console.log('📁 从files数组查找file_id:', fileId);
    }
    
    // 如果仍然没有找到file_id，打印所有可能的字段
    if (!fileId) {
      console.log('❌ 未找到file_id，响应中的所有字段:');
      console.log('- 根级别字段:', Object.keys(result));
      if (result.data) {
        console.log('- data字段内容:', Object.keys(result.data));
      }
      throw new Error('上传成功但未获得file_id - 请检查控制台日志了解响应格式');
    }
    
    console.log('获得的file_id:', fileId);
    return fileId;
  } catch (error) {
    console.error('上传图片到Coze失败:', error);
    throw error; // 直接抛出错误，不使用本地URL作为备选
  }
};

import { saveToHistory } from './historyService';
import { saveAnalysisToDatabase } from './databaseService';

export interface ClothingTags {
  样式名称: string;
  颜色: string;
  色调: string;
  领: string;
  袖: string;
  版型: string;
  长度: string;
  面料: string;
  图案: string;
  工艺: string;
  场合: string;
  季节: string;
  风格: string;
}

export interface AnalysisResult {
  imageUrl: string;
  tags: ClothingTags;
  confidence: number;
  analysisTime: number;
  similarity?: number; // 相似度百分比，用于相似度搜索结果
  error?: string; // 错误信息，当分析失败时显示
  isError?: boolean; // 是否为错误状态
  fileName?: string; // 文件名，用于重试时识别
}

// 上传图片到临时存储并获取URL（保留作为备用方法）
const uploadImageToTempStorage = async (file: File): Promise<string> => {
  // 直接返回本地 blob URL，因为Coze可能不能访问 data URL
  // 在生产环境中，这里应该上传到公开可访问的云存储服务
  return URL.createObjectURL(file);
};

// 检查是否是QPS限制错误
const isQpsLimitError = (error: any): boolean => {
  const errorMessage = error?.message || error?.toString() || '';
  const errorStatus = error?.status || error?.response?.status;
  
  // 检查常见的QPS错误标识
  const qpsKeywords = [
    'qps too high',
    'rate limit',
    'too many requests',
    'frequency limit',
    'Pro call plugin qps too high',
    '720711011', // Coze特定的QPS错误码
    '720711012', // 可能的其他QPS错误码
    'quota exceeded',
    'throttled'
  ];
  
  // 检查HTTP状态码
  const qpsStatusCodes = [429, 503];
  
  return qpsKeywords.some(keyword => 
    errorMessage.toLowerCase().includes(keyword.toLowerCase())
  ) || qpsStatusCodes.includes(errorStatus);
};

// 检查分析结果是否全是未识别
const isResultAllUnrecognized = (tags: ClothingTags): boolean => {
  const unrecognizedValues = ['未识别', '', null, undefined, 'null', 'undefined'];
  const recognizedTags = Object.values(tags).filter(value => 
    value && !unrecognizedValues.includes(value.toString().trim())
  );
  
  console.log('已识别标签数量:', recognizedTags.length, '总标签数:', Object.keys(tags).length);
  return recognizedTags.length === 0;
};

// 带重试机制的API调用
const callCozeAPIWithRetry = async (fileId: string, maxRetries: number = 5): Promise<string> => {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`API调用尝试 ${attempt}/${maxRetries}`);
      
      const requestBody = {
        workflow_id: WORKFLOW_ID,
        parameters: {
          "input": JSON.stringify({"file_id": fileId})
        }
      };
      
      console.log('🚀 发送到Coze的请求数据:', JSON.stringify(requestBody, null, 2));
      
      const response = await fetch(`${COZE_API_BASE}/v1/workflow/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${COZE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      console.log('📡 Coze API响应状态:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Coze API错误详情:', errorText);
        const error = new Error(`API请求失败: ${response.status} ${response.statusText} - ${errorText}`);
        error.status = response.status;
        throw error;
      }
      
      const result = await response.json();
      console.log('Coze工作流响应:', result);
      
      // 提取结果文本
      let resultText = '';
      if (result.data) {
        if (result.data.output) {
          resultText = result.data.output;
        } else if (result.data.result) {
          resultText = result.data.result;
        } else if (typeof result.data === 'string') {
          resultText = result.data;
        }
      } else if (result.output) {
        resultText = result.output;
      } else if (result.result) {
        resultText = result.result;
      }
      
      console.log('提取的结果文本:', resultText);
      return resultText;
      
    } catch (error) {
      console.error(`API调用尝试 ${attempt} 失败:`, error);
      lastError = error;
      
      // 检查是否是QPS限制错误
      if (isQpsLimitError(error)) {
        if (attempt < maxRetries) {
          // 指数退避策略：2^attempt * 2秒
          const waitTime = Math.pow(2, attempt) * 2000;
          console.log(`检测到QPS限制，等待 ${waitTime}ms 后重试...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        } else {
          throw new Error('API调用频率过高，请稍后重试');
        }
      }
      
      // 对于其他错误，根据错误类型决定是否重试
      if (error?.status === 500 || error?.status === 502 || error?.status === 503) {
        // 服务器错误，可以重试
        if (attempt < maxRetries) {
          const waitTime = 1000 * attempt; // 线性退避
          console.log(`服务器错误，等待 ${waitTime}ms 后重试...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }
      
      // 其他错误直接抛出
      throw error;
    }
  }
  
  throw lastError;
};

// 调用Coze工作流进行服装识别
export const analyzeClothingImage = async (file: File): Promise<AnalysisResult> => {
  try {
    const startTime = Date.now();
    console.log(`开始分析图片: ${file.name}, 大小: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
    
    // 必须成功上传图片到Coze才能继续
    let fileId: string;
    try {
      fileId = await uploadImageToCoze(file);
      
      // 检查file_id是否有效
      if (!fileId || fileId.startsWith('blob:') || fileId.startsWith('data:')) {
        throw new Error('获得的不是有效的file_id');
      }
      
      console.log('成功获得有效的file_id:', fileId);
    } catch (uploadError) {
      console.error('上传到Coze失败:', uploadError);
      // 提供更详细的错误信息
      if (uploadError.message?.includes('401')) {
        throw new Error('API认证失败，请检查Token配置');
      } else if (uploadError.message?.includes('413')) {
        throw new Error('图片文件过大，请选择较小的图片');
      } else if (uploadError.message?.includes('415')) {
        throw new Error('不支持的图片格式，请使用JPG、PNG或WebP格式');
      } else {
        throw new Error(`图片上传失败: ${uploadError.message}`);
      }
    }
    
    // 调用Coze工作流API（带重试机制）
    let resultText: string;
    let tags: ClothingTags;
    let analysisResult: AnalysisResult;
    
    // 最多重试5次，如果结果全是未识别
    const maxResultRetries = 5;
    for (let resultRetry = 1; resultRetry <= maxResultRetries; resultRetry++) {
      try {
        console.log(`分析尝试 ${resultRetry}/${maxResultRetries}`);
        
        // 使用带重试机制的API调用
        resultText = await callCozeAPIWithRetry(fileId);
        
        const analysisTime = Date.now() - startTime;
        console.log('最终收到的结果文本:', resultText);
        
        tags = parseClothingTags(resultText);
        console.log('解析后的标签:', tags);
        
        analysisResult = {
          imageUrl: URL.createObjectURL(file), // 使用本地blob URL用于显示
          tags,
          confidence: 0, // 移除假置信度数据
          analysisTime
        };
        
        // 检查结果是否全是未识别
        if (isResultAllUnrecognized(tags)) {
          console.log(`分析结果全是未识别，尝试重试 ${resultRetry}/${maxResultRetries}`);
          if (resultRetry < maxResultRetries) {
            // 等待一段时间后重试
            const waitTime = 2000 * resultRetry;
            console.log(`等待 ${waitTime}ms 后重试...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue; // 继续下一次重试
          } else {
            console.log('重试次数用完，使用当前结果');
          }
        }
        
        // 结果有效或重试次数用完，跳出循环
        break;
        
      } catch (apiError) {
        console.error(`分析尝试 ${resultRetry} 失败:`, apiError);
        
        if (resultRetry === maxResultRetries) {
          // 最后一次尝试失败，抛出错误
          throw apiError;
        }
        
        // 等待后重试
        const waitTime = 1000 * resultRetry;
        console.log(`等待 ${waitTime}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    // 检查分析结果是否有效（不是全部未识别）
    const isValidResult = isAnalysisResultValid(analysisResult.tags);
    
    // 保存到数据库和历史记录
    if (isValidResult) {
      try {
        await saveAnalysisToDatabase(analysisResult, file);
        console.log('成功保存到数据库');
      } catch (dbError) {
        // 如果是重复图片错误，不抛出错误
        if (dbError.message && dbError.message.includes('图片已存在于数据库中')) {
          console.log('图片已存在于数据库中');
        } else {
          console.warn('数据库保存失败:', dbError);
        }
      }
    } else {
      console.log('分析结果无效（全部未识别），跳过数据库保存');
    }
    
    // 无论结果是否有效，都保存到历史记录
    await saveToHistory(analysisResult, file);
    console.log('成功保存到历史记录');
    
    return analysisResult;
    
  } catch (error) {
    console.error('服装识别分析失败:', error);
    
    // 返回错误状态的分析结果，而不是抛出错误
    const errorResult: AnalysisResult = {
      imageUrl: URL.createObjectURL(file),
      tags: {
        样式名称: '未识别',
        颜色: '未识别',
        色调: '未识别',
        领: '未识别',
        袖: '未识别',
        版型: '未识别',
        长度: '未识别',
        面料: '未识别',
        图案: '未识别',
        工艺: '未识别',
        场合: '未识别',
        季节: '未识别',
        风格: '未识别'
      },
      confidence: 0,
      analysisTime: Date.now() - startTime,
      isError: true,
      error: error.message || '服装识别分析失败，请重试',
      fileName: file.name
    };
    
    // 保存错误结果到历史记录
    try {
      await saveToHistory(errorResult, file);
    } catch (historyError) {
      console.error('保存错误结果到历史记录失败:', historyError);
    }
    
    return errorResult;
  }
};

// 检查分析结果是否有效（不是全部未识别）
const isAnalysisResultValid = (tags: ClothingTags): boolean => {
  // 检查是否有至少一个标签不是"未识别"
  const validTags = Object.values(tags).filter(value => 
    value && value !== '未识别' && value.trim() !== ''
  );
  
  console.log('有效标签数量:', validTags.length, '总标签数:', Object.keys(tags).length);
  
  // 如果有效标签数量大于等于总标签数的30%，认为是有效结果
  const validRatio = validTags.length / Object.keys(tags).length;
  const isValid = validRatio >= 0.3;
  
  console.log('有效标签比例:', (validRatio * 100).toFixed(1) + '%', '是否有效:', isValid);
  
  return isValid;
};

// 解析标签文本为结构化数据
const parseClothingTags = (tagsText: string): ClothingTags => {
  console.log('\n=== 开始解析标签 ===');
  console.log('原始输入文本:', JSON.stringify(tagsText));
  
  const defaultTags: ClothingTags = {
    样式名称: '未识别',
    颜色: '未识别',
    色调: '未识别',
    领: '未识别',
    袖: '未识别',
    版型: '未识别',
    长度: '未识别',
    面料: '未识别',
    图案: '未识别',
    工艺: '未识别',
    场合: '未识别',
    季节: '未识别',
    风格: '未识别'
  };

  if (!tagsText) {
    console.log('输入文本为空，返回默认标签');
    return defaultTags;
  }

  try {
    // 清理文本，移除多余的字符和格式问题
    console.log('\n--- 步骤1: 文本清理 ---');
    let cleanedText = tagsText
      .replace(/[{}"\\]/g, '') // 移除大括号、引号、反斜杠
      .replace(/\}+$/g, '') // 移除末尾的多余大括号
      .replace(/"+/g, '') // 移除多余的引号
      .replace(/^output:\s*/i, '') // 移除开头的"output:"前缀
      .trim();
    
    console.log('移除output前缀后的文本:', JSON.stringify(cleanedText));
    
    console.log('清理前的文本:', JSON.stringify(tagsText));
    console.log('清理后的文本:', JSON.stringify(cleanedText));
    
    // 支持多种格式的解析，按优先级尝试
    const tags = { ...defaultTags };
    let foundMatches = 0;
    
    console.log('\n--- 步骤2: 格式1解析 (支持英文和中文逗号分割) ---');
    // 格式1: 同时支持英文逗号和中文逗号分割的键值对
    const pairs = cleanedText.split(/[,，]/);
    console.log('分割后的键值对数组:', pairs);
    
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      console.log(`处理第${i+1}个键值对:`, JSON.stringify(pair));
      
      const colonIndex = pair.indexOf('：');
      console.log('冒号位置:', colonIndex);
      
      if (colonIndex > 0) {
        const key = pair.substring(0, colonIndex).trim();
        let value = pair.substring(colonIndex + 1).trim();
        console.log('提取的键:', JSON.stringify(key));
        console.log('提取的值(清理前):', JSON.stringify(value));
        
        // 清理值中的多余字符和标点
        value = value.replace(/[}"，。]+$/g, '').trim();
        console.log('提取的值(清理后):', JSON.stringify(value));
        
        const keyExists = key in tags;
        const valueValid = value && value !== '未识别' && value !== 'undefined' && value !== 'null';
        console.log('键是否存在:', keyExists, '值是否有效:', valueValid);
        
        if (keyExists && valueValid) {
          tags[key as keyof ClothingTags] = value;
          foundMatches++;
          console.log(`✓ 成功匹配: ${key} = ${value}`);
        } else {
          console.log(`✗ 跳过: 键存在=${keyExists}, 值有效=${valueValid}`);
        }
      } else {
        console.log('未找到冒号，跳过此键值对');
      }
    }
    
    console.log('格式1匹配数量:', foundMatches);
    
    // 格式2: 样式名称：[具体样式名称]，颜色：[具体颜色]...
    if (foundMatches === 0) {
      console.log('\n--- 步骤3: 格式2解析 (方括号格式) ---');
      let regex = /(\w+)：\[([^\]]+)\]/g;
      let match;
      while ((match = regex.exec(cleanedText)) !== null) {
        const [, key, value] = match;
        console.log(`方括号格式匹配 - 键: ${key}, 值: ${value}`);
        if (key in tags) {
          tags[key as keyof ClothingTags] = value.trim();
          foundMatches++;
          console.log(`✓ 方括号格式匹配: ${key} = ${value}`);
        }
      }
      console.log('格式2匹配数量:', foundMatches);
    }
    
    // 格式3: 直接的键值对格式（按行分割）
    if (foundMatches === 0) {
      console.log('\n--- 步骤4: 格式3解析 (按行分割) ---');
      const lines = cleanedText.split(/[\n]/);
      console.log('按行分割后的数组:', lines);
      
      for (const line of lines) {
        console.log('处理行:', JSON.stringify(line));
        const colonIndex = line.indexOf('：');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim();
          let value = line.substring(colonIndex + 1).trim();
          // 清理值中的多余字符
          value = value.replace(/[}"，。]+$/g, '').trim();
          console.log(`行格式 - 键: ${key}, 值: ${value}`);
          if (key in tags && value && value !== '未识别') {
            tags[key as keyof ClothingTags] = value;
            foundMatches++;
            console.log(`✓ 行格式匹配: ${key} = ${value}`);
          }
        }
      }
      console.log('格式3匹配数量:', foundMatches);
    }
    
    // 格式4: 单行格式，用正则匹配键值对
    if (foundMatches === 0) {
      console.log('\n--- 步骤5: 格式4解析 (正则匹配) ---');
      let regex = /(\w+)：([^，。\n]+)/g;
      let match;
      while ((match = regex.exec(cleanedText)) !== null) {
        const [, key, value] = match;
        console.log(`正则匹配 - 键: ${key}, 值: ${value}`);
        if (key in tags) {
          // 清理值中的多余字符
          let cleanValue = value.trim().replace(/[}"]+$/g, '');
          console.log(`正则格式清理后的值: ${cleanValue}`);
          if (cleanValue && cleanValue !== '未识别') {
            tags[key as keyof ClothingTags] = cleanValue;
            foundMatches++;
            console.log(`✓ 正则格式匹配: ${key} = ${cleanValue}`);
          }
        }
      }
      console.log('格式4匹配数量:', foundMatches);
    }

    console.log('\n=== 解析完成 ===');
    console.log('总匹配数量:', foundMatches);
    console.log('最终解析结果:', tags);
    return tags;
  } catch (error) {
    console.error('解析标签失败:', error);
    return defaultTags;
  }
};

// 生成示例标签数据（用于演示）
const generateSampleTags = (filename: string): ClothingTags => {
  const styles = ['连衣裙', '衬衫', 'T恤', '外套', '裤子', '裙子', '套装', '背心', '毛衣'];
  const colors = ['黑色', '白色', '蓝色', '红色', '灰色', '粉色', '绿色', '黄色', '紫色'];
  const tones = ['深色调', '浅色调', '中性色调', '暖色调', '冷色调'];
  const collars = ['圆领', 'V领', '立领', '翻领', '一字领', '高领', '无领'];
  const sleeves = ['长袖', '短袖', '七分袖', '无袖', '五分袖'];
  const fits = ['修身', '宽松', '直筒', '紧身', '标准'];
  const lengths = ['短款', '中长款', '长款', '超长款'];
  const fabrics = ['棉质', '丝绸', '羊毛', '聚酯纤维', '亚麻', '雪纺', '牛仔'];
  const patterns = ['纯色', '条纹', '格子', '印花', '刺绣', '蕾丝', '几何图案'];
  const crafts = ['简约', '精工', '手工', '机织', '针织'];
  const occasions = ['休闲', '正式', '商务', '聚会', '运动', '居家'];
  const seasons = ['春季', '夏季', '秋季', '冬季', '四季'];
  const styles_fashion = ['简约', '复古', '时尚', '甜美', '帅气', '优雅', '休闲'];

  const getRandomItem = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  return {
    样式名称: getRandomItem(styles),
    颜色: getRandomItem(colors),
    色调: getRandomItem(tones),
    领: getRandomItem(collars),
    袖: getRandomItem(sleeves),
    版型: getRandomItem(fits),
    长度: getRandomItem(lengths),
    面料: getRandomItem(fabrics),
    图案: getRandomItem(patterns),
    工艺: getRandomItem(crafts),
    场合: getRandomItem(occasions),
    季节: getRandomItem(seasons),
    风格: getRandomItem(styles_fashion)
  };
};

// 批量分析图片
// 重试分析失败的图片
export const retryAnalysis = async (result: AnalysisResult): Promise<AnalysisResult> => {
  if (!result.fileName || !result.isError) {
    throw new Error('无法重试：缺少文件信息或结果未失败');
  }
  
  // 从blob URL重新创建File对象
  try {
    const response = await fetch(result.imageUrl);
    const blob = await response.blob();
    const file = new File([blob], result.fileName, { type: blob.type });
    
    console.log(`重试分析图片: ${result.fileName}`);
    return await analyzeClothingImage(file);
  } catch (error) {
    console.error('重试分析失败:', error);
    throw error;
  }
};

export const analyzeBatchImages = async (files: File[], onProgress?: (current: number, total: number, fileName: string) => void): Promise<AnalysisResult[]> => {
  const results: AnalysisResult[] = [];
  const { checkDuplicateResult } = await import('./storageService');
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    try {
      // 更新进度
      onProgress?.(i + 1, files.length, file.name);
      
      // 创建临时的AnalysisResult用于查重检查
      const tempResult: AnalysisResult = {
        imageUrl: '',
        tags: {} as any,
        confidence: 0,
        analysisTime: Date.now(),
        fileName: file.name
      };
      
      // 检查是否为重复图片
      const duplicateResult = checkDuplicateResult(tempResult);
      if (duplicateResult) {
        console.log(`跳过重复图片: ${file.name}，使用已有分析结果`);
        // 如果重复结果的图片URL是base64格式，直接使用；否则创建新的blob URL
        let imageUrl = duplicateResult.imageUrl;
        if (!imageUrl || (!imageUrl.startsWith('data:') && !imageUrl.startsWith('http'))) {
          imageUrl = URL.createObjectURL(file);
        }
        const updatedResult = {
          ...duplicateResult,
          imageUrl,
          analysisTime: duplicateResult.analysisTime || 0 // 确保重复结果的分析时间为0或原值
        };
        results.push(updatedResult);
        continue;
      }
      
      // 如果不是重复图片，进行分析
      console.log(`开始分析新图片: ${file.name} (${i + 1}/${files.length})`);
      const result = await analyzeClothingImage(file);
      results.push(result);
      
    } catch (error) {
      console.error(`分析图片 ${file.name} 失败:`, error);
      
      // 创建错误结果
      const errorResult: AnalysisResult = {
        imageUrl: URL.createObjectURL(file),
        tags: {
          样式名称: '分析失败',
          颜色: '未识别',
          色调: '未识别',
          领: '未识别',
          袖: '未识别',
          版型: '未识别',
          长度: '未识别',
          面料: '未识别',
          图案: '未识别',
          工艺: '未识别',
          场合: '未识别',
          季节: '未识别',
          风格: '未识别'
        },
        confidence: 0,
        analysisTime: 0,
        isError: true,
        error: error.message || '分析失败',
        fileName: file.name
      };
      
      results.push(errorResult);
    }
  }
  
  return results;
};

// 批量分析图片（带查重和进度回调的增强版本）
export const analyzeBatchImagesWithDeduplication = async (
  files: File[], 
  onProgress?: (current: number, total: number, fileName: string, isDuplicate?: boolean) => void
): Promise<AnalysisResult[]> => {
  const results: AnalysisResult[] = [];
  const { loadAnalysisResults } = await import('./storageService');
  let duplicateCount = 0;
  let newAnalysisCount = 0;
  
  console.log(`开始批量分析 ${files.length} 张图片，启用查重功能...`);
  
  // 一次性加载所有已有结果，避免重复查询
  const existingResults = loadAnalysisResults();
  console.log(`已加载 ${existingResults.length} 条历史记录用于查重`);
  
  // 创建文件名到结果的映射，提高查找效率
  const existingResultsMap = new Map<string, AnalysisResult>();
  existingResults.forEach(result => {
    if (result.fileName) {
      existingResultsMap.set(result.fileName, result);
    }
  });
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    try {
      // 检查是否为重复图片（使用Map快速查找）
       const duplicateResult = existingResultsMap.get(file.name);
       if (duplicateResult) {
         duplicateCount++;
         console.log(`[${i + 1}/${files.length}] 跳过重复图片: ${file.name}`);
         
         // 更新进度（标记为重复）
         onProgress?.(i + 1, files.length, file.name, true);
         
         // 如果重复结果的图片URL是base64格式，直接使用；否则创建新的blob URL
         let imageUrl = duplicateResult.imageUrl;
         if (!imageUrl || (!imageUrl.startsWith('data:') && !imageUrl.startsWith('http'))) {
           imageUrl = URL.createObjectURL(file);
         }
         const updatedResult = {
           ...duplicateResult,
           imageUrl,
           analysisTime: duplicateResult.analysisTime || 0 // 确保重复结果的分析时间为0或原值
         };
         results.push(updatedResult);
         continue;
       }
      
      // 如果不是重复图片，进行分析
      newAnalysisCount++;
      console.log(`[${i + 1}/${files.length}] 开始分析新图片: ${file.name}`);
      
      // 更新进度（标记为新分析）
      onProgress?.(i + 1, files.length, file.name, false);
      
      const result = await analyzeClothingImage(file);
      results.push(result);
      
      console.log(`[${i + 1}/${files.length}] 分析完成: ${file.name}`);
      
    } catch (error) {
      console.error(`[${i + 1}/${files.length}] 分析图片 ${file.name} 失败:`, error);
      
      // 创建错误结果
      const errorResult: AnalysisResult = {
        imageUrl: URL.createObjectURL(file),
        tags: {
          样式名称: '分析失败',
          颜色: '未识别',
          色调: '未识别',
          领: '未识别',
          袖: '未识别',
          版型: '未识别',
          长度: '未识别',
          面料: '未识别',
          图案: '未识别',
          工艺: '未识别',
          场合: '未识别',
          季节: '未识别',
          风格: '未识别'
        },
        confidence: 0,
        analysisTime: 0,
        isError: true,
        error: error.message || '分析失败',
        fileName: file.name
      };
      
      results.push(errorResult);
    }
  }
  
  console.log(`批量分析完成: 总计 ${files.length} 张图片，新分析 ${newAnalysisCount} 张，跳过重复 ${duplicateCount} 张`);
  return results;
};