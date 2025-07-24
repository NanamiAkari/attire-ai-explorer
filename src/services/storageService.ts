// 本地存储服务
import { AnalysisResult } from './cozeService';

const STORAGE_KEY = 'clothing_analysis_results';

// 将blob URL转换为base64
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

// 保存分析结果到本地存储
export const saveAnalysisResults = async (results: AnalysisResult[]): Promise<void> => {
  try {
    const serializedResults = await Promise.all(
      results.map(async (result) => {
        let imageUrl = result.imageUrl;
        
        // 如果是blob URL，转换为base64
        if (result.imageUrl.startsWith('blob:')) {
          try {
            imageUrl = await blobToBase64(result.imageUrl);
          } catch (error) {
            console.error('转换blob URL为base64失败:', error);
            imageUrl = ''; // 转换失败时设为空
          }
        }
        
        return {
          ...result,
          imageUrl
        };
      })
    );
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializedResults));
  } catch (error) {
    console.error('保存分析结果失败:', error);
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
  } catch (error) {
    console.error('清空分析结果失败:', error);
  }
};

// 添加单个分析结果
export const addAnalysisResult = async (result: AnalysisResult): Promise<void> => {
  const existingResults = loadAnalysisResults();
  const updatedResults = [...existingResults, result];
  await saveAnalysisResults(updatedResults);
};

// 更新指定索引的分析结果
export const updateAnalysisResult = async (index: number, updatedResult: AnalysisResult): Promise<void> => {
  const existingResults = loadAnalysisResults();
  if (index >= 0 && index < existingResults.length) {
    existingResults[index] = updatedResult;
    await saveAnalysisResults(existingResults);
  }
};

// 删除指定索引的分析结果
export const removeAnalysisResult = async (index: number): Promise<void> => {
  const existingResults = loadAnalysisResults();
  if (index >= 0 && index < existingResults.length) {
    existingResults.splice(index, 1);
    await saveAnalysisResults(existingResults);
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