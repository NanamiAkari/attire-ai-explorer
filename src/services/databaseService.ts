import { supabase, ClothingAnalysisRecord } from '../config/supabase';
import { AnalysisResult } from './cozeService';

// 重试配置
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1秒
  maxDelay: 10000  // 10秒
};

// 通用重试函数，使用指数退避算法
const withRetry = async <T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  operationName: string = '数据库操作'
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const result = await operation();
      if (attempt > 0) {
        console.log(`${operationName}在第${attempt + 1}次尝试后成功`);
      }
      return result;
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === config.maxRetries) {
        console.error(`${operationName}在${config.maxRetries + 1}次尝试后仍然失败:`, lastError);
        throw lastError;
      }
      
      // 计算延迟时间（指数退避）
      const delay = Math.min(
        config.baseDelay * Math.pow(2, attempt),
        config.maxDelay
      );
      
      console.warn(`${operationName}第${attempt + 1}次尝试失败，${delay}ms后重试:`, lastError.message);
      
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
};

// 保存分析结果到数据库（带重试机制）
// 将文件转换为base64格式
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

// 计算文件的SHA-256哈希值
export const calculateFileHash = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};

// 检查数据库中是否已存在相同哈希的图片
export const checkDuplicateImage = async (imageHash: string): Promise<ClothingAnalysisRecord | null> => {
  try {
    const { data, error } = await supabase
      .from('clothing_analysis')
      .select('*')
      .eq('image_hash', imageHash)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 表示没有找到记录
      throw error;
    }
    
    return data as ClothingAnalysisRecord || null;
  } catch (error) {
    console.error('检查重复图片失败:', error);
    return null;
  }
};

export const saveAnalysisToDatabase = async (
  analysisResult: AnalysisResult,
  file: File
): Promise<ClothingAnalysisRecord | null> => {
  try {
    console.log('开始保存分析结果到数据库...');
    
    // 计算图片哈希值
    const imageHash = await calculateFileHash(file);
    console.log('图片哈希值:', imageHash);
    
    // 检查是否已存在相同的图片
    const existingRecord = await checkDuplicateImage(imageHash);
    if (existingRecord) {
      console.log('发现重复图片，返回已存在的记录:', existingRecord.id);
      throw new Error(`图片已存在于数据库中，记录ID: ${existingRecord.id}，上传时间: ${new Date(existingRecord.created_at || '').toLocaleString()}`);
    }
    
    // 将图片转换为base64格式以便在数据库中持久化
    const base64Image = await fileToBase64(file);
    
    // 准备数据
    const record: Omit<ClothingAnalysisRecord, 'id' | 'created_at' | 'updated_at'> = {
      image_url: base64Image, // 使用base64格式而不是blob URL
      image_name: file.name,
      image_size: file.size,
      image_hash: imageHash, // 添加图片哈希值
      tags: analysisResult.tags,
      confidence: analysisResult.confidence,
      analysis_time: analysisResult.analysisTime
    };
    
    console.log('准备保存的数据:', { ...record, image_url: 'base64数据已转换', image_hash: imageHash });
    
    // 使用重试机制插入数据到Supabase
    const result = await withRetry(async () => {
      const { data, error } = await supabase
        .from('clothing_analysis')
        .insert([record])
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return data as ClothingAnalysisRecord;
    }, DEFAULT_RETRY_CONFIG, '保存分析结果');
    
    console.log('成功保存到数据库:', result);
    return result;
    
  } catch (error) {
    console.error('数据库保存最终失败:', error);
    throw error; // 重新抛出错误以便上层处理
  }
};

// 从数据库获取所有分析历史（带重试机制）
export const getAnalysisHistory = async (): Promise<ClothingAnalysisRecord[]> => {
  try {
    console.log('从数据库获取分析历史...');
    
    const result = await withRetry(async () => {
      const { data, error } = await supabase
        .from('clothing_analysis')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      return data || [];
    }, DEFAULT_RETRY_CONFIG, '获取分析历史');
    
    console.log(`成功获取${result.length}条历史记录`);
    return result;
    
  } catch (error) {
    console.error('获取历史记录最终失败:', error);
    return [];
  }
};

// 根据ID获取特定的分析记录（带重试机制）
export const getAnalysisById = async (id: string): Promise<ClothingAnalysisRecord | null> => {
  try {
    const result = await withRetry(async () => {
      const { data, error } = await supabase
        .from('clothing_analysis')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        throw error;
      }
      
      return data as ClothingAnalysisRecord;
    }, DEFAULT_RETRY_CONFIG, '获取分析记录');
    
    return result;
    
  } catch (error) {
    console.error('获取分析记录最终失败:', error);
    return null;
  }
};

// 删除分析记录（带重试机制）
export const deleteAnalysisRecord = async (id: string): Promise<boolean> => {
  try {
    await withRetry(async () => {
      const { error } = await supabase
        .from('clothing_analysis')
        .delete()
        .eq('id', id);
      
      if (error) {
        throw error;
      }
      
      return true;
    }, DEFAULT_RETRY_CONFIG, '删除记录');
    
    console.log('成功删除记录:', id);
    return true;
    
  } catch (error) {
    console.error('删除记录最终失败:', error);
    return false;
  }
};

// 更新分析记录（带重试机制）
export const updateAnalysisRecord = async (
  id: string,
  updates: Partial<ClothingAnalysisRecord>
): Promise<ClothingAnalysisRecord | null> => {
  try {
    const result = await withRetry(async () => {
      const { data, error } = await supabase
        .from('clothing_analysis')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return data as ClothingAnalysisRecord;
    }, DEFAULT_RETRY_CONFIG, '更新记录');
    
    console.log('成功更新记录:', result);
    return result;
    
  } catch (error) {
    console.error('更新记录最终失败:', error);
    return null;
  }
};

// 搜索分析记录（带重试机制）
export const searchAnalysisRecords = async (
  searchTerm: string,
  searchField: keyof ClothingAnalysisRecord = 'image_name'
): Promise<ClothingAnalysisRecord[]> => {
  try {
    const result = await withRetry(async () => {
      let query = supabase.from('clothing_analysis').select('*');
      
      if (searchField === 'tags') {
        // 在tags字段中搜索
        query = query.or(`tags->>样式名称.ilike.%${searchTerm}%,tags->>颜色.ilike.%${searchTerm}%,tags->>面料.ilike.%${searchTerm}%`);
      } else {
        // 在其他字段中搜索
        query = query.ilike(searchField as string, `%${searchTerm}%`);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      return data || [];
    }, DEFAULT_RETRY_CONFIG, '搜索记录');
    
    return result;
    
  } catch (error) {
    console.error('搜索记录最终失败:', error);
    return [];
  }
};

// 批量删除分析记录（带重试机制）
export const deleteMultipleAnalysisRecords = async (ids: string[]): Promise<{ success: string[], failed: string[] }> => {
  const success: string[] = [];
  const failed: string[] = [];
  
  try {
    console.log(`开始批量删除${ids.length}条记录...`);
    
    // 使用事务批量删除
    const result = await withRetry(async () => {
      const { data, error } = await supabase
        .from('clothing_analysis')
        .delete()
        .in('id', ids)
        .select('id');
      
      if (error) {
        throw error;
      }
      
      return data || [];
    }, DEFAULT_RETRY_CONFIG, '批量删除记录');
    
    // 记录成功删除的ID
    const deletedIds = result.map(record => record.id);
    success.push(...deletedIds);
    
    // 找出失败的ID
    const failedIds = ids.filter(id => !deletedIds.includes(id));
    failed.push(...failedIds);
    
    console.log(`批量删除完成: 成功${success.length}条，失败${failed.length}条`);
    
    return { success, failed };
    
  } catch (error) {
    console.error('批量删除最终失败:', error);
    // 如果整个操作失败，所有ID都标记为失败
    failed.push(...ids);
    return { success, failed };
  }
};

// 获取统计信息（带重试机制）
export const getAnalysisStats = async () => {
  try {
    const data = await withRetry(async () => {
      const { data, error } = await supabase
        .from('clothing_analysis')
        .select('tags, confidence, analysis_time, created_at');
      
      if (error) {
        throw error;
      }
      
      return data || [];
    }, DEFAULT_RETRY_CONFIG, '获取统计信息');
    
    // 计算统计信息
    const totalRecords = data.length;
    if (totalRecords === 0) {
      return {
        totalRecords: 0,
        avgConfidence: 0,
        avgAnalysisTime: 0,
        tagStats: {
          样式名称: {},
          颜色: {},
          面料: {}
        }
      };
    }
    
    const avgConfidence = data.reduce((sum, record) => sum + record.confidence, 0) / totalRecords;
    const avgAnalysisTime = data.reduce((sum, record) => sum + record.analysis_time, 0) / totalRecords;
    
    // 统计最常见的标签
    const tagStats = {
      样式名称: {} as Record<string, number>,
      颜色: {} as Record<string, number>,
      面料: {} as Record<string, number>
    };
    
    data.forEach(record => {
      const tags = record.tags;
      if (tags.样式名称 && tags.样式名称 !== '未识别') {
        tagStats.样式名称[tags.样式名称] = (tagStats.样式名称[tags.样式名称] || 0) + 1;
      }
      if (tags.颜色 && tags.颜色 !== '未识别') {
        tagStats.颜色[tags.颜色] = (tagStats.颜色[tags.颜色] || 0) + 1;
      }
      if (tags.面料 && tags.面料 !== '未识别') {
        tagStats.面料[tags.面料] = (tagStats.面料[tags.面料] || 0) + 1;
      }
    });
    
    return {
      totalRecords,
      avgConfidence: Math.round(avgConfidence * 100) / 100,
      avgAnalysisTime: Math.round(avgAnalysisTime),
      tagStats
    };
    
  } catch (error) {
    console.error('获取统计信息最终失败:', error);
    return null;
  }
};