// 本地存储服务
import { AnalysisResult } from './cozeService';

const STORAGE_KEY = 'clothing_analysis_results';
const MAX_STORAGE_SIZE = 4 * 1024 * 1024; // 4MB 限制，避免超出localStorage配额
const MAX_RESULTS_COUNT = 100; // 最大存储结果数量

// 计算字符串的字节大小
const getStringByteSize = (str: string): number => {
  return new Blob([str]).size;
};

// 检查是否为重复图片（基于文件名）
const isDuplicateResult = (newResult: AnalysisResult, existingResults: AnalysisResult[]): AnalysisResult | null => {
  return existingResults.find(result => 
    result.fileName === newResult.fileName
  ) || null;
};

// 缓存已加载的结果，避免重复读取localStorage
let cachedResults: AnalysisResult[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5000; // 5秒缓存

// 获取缓存的结果或重新加载
const getCachedResults = (): AnalysisResult[] => {
  const now = Date.now();
  if (cachedResults && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedResults;
  }
  
  cachedResults = loadAnalysisResults();
  cacheTimestamp = now;
  return cachedResults;
};

// 清除缓存
const clearCache = (): void => {
  cachedResults = null;
  cacheTimestamp = 0;
};

// 将blob URL转换为压缩的base64（降低质量以减少存储空间）
const blobToCompressedBase64 = (blobUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    fetch(blobUrl)
      .then(response => response.blob())
      .then(blob => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
          // 压缩图片尺寸
          const maxWidth = 400;
          const maxHeight = 400;
          let { width, height } = img;
          
          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          ctx?.drawImage(img, 0, 0, width, height);
          
          // 压缩质量
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(compressedDataUrl);
        };
        
        img.onerror = reject;
        img.src = URL.createObjectURL(blob);
      })
      .catch(reject);
  });
};

// 将blob URL转换为base64（保持原有逻辑作为备用）
const blobToBase64 = (blobUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    fetch(blobUrl)
      .then(response => response.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      })
      .catch(reject);
  });
};

// 清理旧数据以释放存储空间
const cleanupOldResults = (results: AnalysisResult[]): AnalysisResult[] => {
  // 按时间排序，保留最新的结果
  const sortedResults = results.sort((a, b) => {
    const timeA = a.analysisTime || 0;
    const timeB = b.analysisTime || 0;
    return timeB - timeA;
  });
  
  // 限制数量
  return sortedResults.slice(0, MAX_RESULTS_COUNT);
};

// 保存分析结果到本地存储（优化版本）
export const saveAnalysisResults = async (results: AnalysisResult[]): Promise<void> => {
  try {
    // 清理旧数据
    const cleanedResults = cleanupOldResults(results);
    
    const serializedResults = await Promise.all(
      cleanedResults.map(async (result) => {
        let imageUrl = result.imageUrl;
        
        // 如果是blob URL，转换为压缩的base64以节省空间
        if (result.imageUrl.startsWith('blob:')) {
          try {
            imageUrl = await blobToCompressedBase64(result.imageUrl);
          } catch (error) {
            console.error('转换blob URL为压缩base64失败，尝试原始转换:', error);
            try {
              imageUrl = await blobToBase64(result.imageUrl);
            } catch (fallbackError) {
              console.error('转换blob URL为base64失败:', fallbackError);
              imageUrl = ''; // 转换失败时设为空
            }
          }
        }
        
        return {
          ...result,
          imageUrl
        };
      })
    );
    
    const serializedData = JSON.stringify(serializedResults);
    const dataSize = getStringByteSize(serializedData);
    
    // 检查存储大小限制
    if (dataSize > MAX_STORAGE_SIZE) {
      console.warn(`数据大小 ${(dataSize / 1024 / 1024).toFixed(2)}MB 超出限制，进一步清理数据...`);
      
      // 进一步减少数据量
      const reducedResults = cleanedResults.slice(0, Math.floor(MAX_RESULTS_COUNT / 2));
      const reducedData = JSON.stringify(reducedResults.map(result => ({
        ...result,
        imageUrl: result.imageUrl.startsWith('data:') ? '' : result.imageUrl // 移除base64图片以节省空间
      })));
      
      localStorage.setItem(STORAGE_KEY, reducedData);
      console.log(`已保存 ${reducedResults.length} 条记录（移除图片数据以节省空间）`);
    } else {
      localStorage.setItem(STORAGE_KEY, serializedData);
      console.log(`已保存 ${serializedResults.length} 条记录，数据大小: ${(dataSize / 1024).toFixed(2)}KB`);
    }
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      console.error('localStorage配额超出，尝试清理数据...');
      try {
        // 紧急清理：只保留最新的少量记录
        const emergencyResults = results.slice(-20).map(result => ({
          ...result,
          imageUrl: '' // 移除所有图片数据
        }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(emergencyResults));
        console.log('紧急清理完成，保留最新20条记录（无图片数据）');
      } catch (emergencyError) {
        console.error('紧急清理失败，清空所有数据:', emergencyError);
        localStorage.removeItem(STORAGE_KEY);
      }
    } else {
      console.error('保存分析结果失败:', error);
    }
  }
};

// 从本地存储加载分析结果
export const loadAnalysisResults = (): AnalysisResult[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const results = JSON.parse(stored) as AnalysisResult[];
    return results.filter(result => result && result.tags); // 过滤无效数据
  } catch (error) {
    console.error('加载分析结果失败:', error);
    return [];
  }
};

// 清空本地存储的分析结果
export const clearAnalysisResults = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    clearCache(); // 清除缓存
  } catch (error) {
    console.error('清空分析结果失败:', error);
  }
};

// 检查是否为重复结果
export const checkDuplicateResult = (newResult: AnalysisResult): AnalysisResult | null => {
  const existingResults = getCachedResults();
  return isDuplicateResult(newResult, existingResults);
};

// 添加单个分析结果（带查重）
export const addAnalysisResult = async (result: AnalysisResult): Promise<AnalysisResult> => {
  const existingResults = getCachedResults();
  
  // 检查是否重复
  const duplicateResult = isDuplicateResult(result, existingResults);
  if (duplicateResult) {
    console.log(`发现重复图片: ${result.fileName}，返回已有结果`);
    return duplicateResult;
  }
  
  const updatedResults = [...existingResults, result];
  await saveAnalysisResults(updatedResults);
  clearCache(); // 清除缓存，确保下次获取最新数据
  return result;
};

// 批量添加分析结果（带查重）
export const addAnalysisResults = async (newResults: AnalysisResult[]): Promise<AnalysisResult[]> => {
  const existingResults = getCachedResults();
  const finalResults: AnalysisResult[] = [];
  const toAdd: AnalysisResult[] = [];
  
  for (const newResult of newResults) {
    const duplicateResult = isDuplicateResult(newResult, existingResults);
    if (duplicateResult) {
      console.log(`发现重复图片: ${newResult.fileName}，使用已有结果`);
      finalResults.push(duplicateResult);
    } else {
      toAdd.push(newResult);
      finalResults.push(newResult);
    }
  }
  
  if (toAdd.length > 0) {
    const updatedResults = [...existingResults, ...toAdd];
    await saveAnalysisResults(updatedResults);
    clearCache(); // 清除缓存，确保下次获取最新数据
    console.log(`新增 ${toAdd.length} 条分析结果，跳过 ${newResults.length - toAdd.length} 条重复结果`);
  } else {
    console.log('所有结果都是重复的，无需保存');
  }
  
  return finalResults;
};

// 更新指定索引的分析结果
export const updateAnalysisResult = async (index: number, updatedResult: AnalysisResult): Promise<void> => {
  const existingResults = loadAnalysisResults();
  if (index >= 0 && index < existingResults.length) {
    existingResults[index] = updatedResult;
    await saveAnalysisResults(existingResults);
    clearCache(); // 清除缓存
  }
};

// 删除指定索引的分析结果
export const removeAnalysisResult = async (index: number): Promise<void> => {
  const existingResults = loadAnalysisResults();
  if (index >= 0 && index < existingResults.length) {
    existingResults.splice(index, 1);
    await saveAnalysisResults(existingResults);
    clearCache(); // 清除缓存
  }
};

// 搜索分析结果
export const searchAnalysisResults = (query: string): AnalysisResult[] => {
  const allResults = loadAnalysisResults();
  if (!query.trim()) return allResults;
  
  const searchLower = query.toLowerCase();
  return allResults.filter(result => 
    Object.values(result.tags).some(tag => 
      tag.toLowerCase().includes(searchLower)
    )
  );
};

// 按标签筛选分析结果
export const filterAnalysisResults = (filters: {
  style?: string[];
  color?: string[];
  tone?: string[];
  season?: string[];
  collar?: string[];
  sleeve?: string[];
  fit?: string[];
  length?: string[];
  fabric?: string[];
  pattern?: string[];
  craft?: string[];
  fashionStyle?: string[];
  occasion?: string[];
}): AnalysisResult[] => {
  const allResults = loadAnalysisResults();
  
  return allResults.filter(result => {
    if (filters.style && filters.style.length > 0) {
      if (!filters.style.includes(result.tags.样式名称)) return false;
    }
    
    if (filters.color && filters.color.length > 0) {
      if (!filters.color.includes(result.tags.颜色)) return false;
    }
    
    if (filters.tone && filters.tone.length > 0) {
      if (!filters.tone.includes(result.tags.色调)) return false;
    }
    
    if (filters.season && filters.season.length > 0) {
      if (!filters.season.includes(result.tags.季节)) return false;
    }
    
    if (filters.collar && filters.collar.length > 0) {
      if (!filters.collar.includes(result.tags.领)) return false;
    }
    
    if (filters.sleeve && filters.sleeve.length > 0) {
      if (!filters.sleeve.includes(result.tags.袖)) return false;
    }
    
    if (filters.fit && filters.fit.length > 0) {
      if (!filters.fit.includes(result.tags.版型)) return false;
    }
    
    if (filters.length && filters.length.length > 0) {
      if (!filters.length.includes(result.tags.长度)) return false;
    }
    
    if (filters.fabric && filters.fabric.length > 0) {
      if (!filters.fabric.includes(result.tags.面料)) return false;
    }
    
    if (filters.pattern && filters.pattern.length > 0) {
      if (!filters.pattern.includes(result.tags.图案)) return false;
    }
    
    if (filters.craft && filters.craft.length > 0) {
      if (!filters.craft.includes(result.tags.工艺)) return false;
    }
    
    if (filters.fashionStyle && filters.fashionStyle.length > 0) {
      if (!filters.fashionStyle.includes(result.tags.风格)) return false;
    }
    
    if (filters.occasion && filters.occasion.length > 0) {
      if (!filters.occasion.includes(result.tags.场合)) return false;
    }
    
    return true;
  });
};