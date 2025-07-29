import { ClothingAnalysisRecord } from '../config/postgresql';
import { AnalysisResult } from './cozeService';

// 根据环境选择数据库服务
const isBrowser = typeof window !== 'undefined';

let dbService: any;

if (isBrowser) {
  // 浏览器环境使用兼容的数据库服务
  dbService = import('./browserDatabaseService');
} else {
  // Node.js 环境使用 PostgreSQL 服务
  dbService = import('./postgresqlService');
}

// 动态导入数据库服务函数
const getDbService = async () => {
  const service = await dbService;
  return service;
};

// 导出数据库连接检查函数
export const checkDatabaseConnection = async (): Promise<boolean> => {
  const service = await getDbService();
  return service.checkDatabaseConnection();
};

export const initializeDatabaseService = async (): Promise<void> => {
  const service = await getDbService();
  return service.initializeDatabaseService();
};

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

// 计算文件哈希
export const calculateFileHash = async (file: File): Promise<string> => {
  const service = await getDbService();
  return service.calculateFileHash(file);
};

// 检查重复图片
export const checkDuplicateImage = async (imageHash: string): Promise<ClothingAnalysisRecord | null> => {
  const service = await getDbService();
  return service.checkDuplicateImage(imageHash);
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
export const saveAnalysisToDatabase = async (
  analysisResult: AnalysisResult,
  file: File
): Promise<ClothingAnalysisRecord | null> => {
  const service = await getDbService();
  return service.saveAnalysisToDatabase(analysisResult, file);
};

// 批量保存分析结果到数据库（优化性能）
export const saveBatchAnalysisToDatabase = async (
  analysisResults: { result: AnalysisResult; file: File }[]
): Promise<(ClothingAnalysisRecord | null)[]> => {
  const service = await getDbService();
  
  // 如果服务支持批量保存，使用批量保存
  if (service.saveBatchAnalysisToDatabase) {
    return service.saveBatchAnalysisToDatabase(analysisResults);
  }
  
  // 否则使用并发保存，但限制并发数量
  const batchSize = 3;
  const results: (ClothingAnalysisRecord | null)[] = [];
  
  for (let i = 0; i < analysisResults.length; i += batchSize) {
    const batch = analysisResults.slice(i, i + batchSize);
    const batchPromises = batch.map(({ result, file }) => 
      saveAnalysisToDatabase(result, file).catch(error => {
        console.warn(`保存 ${file.name} 到数据库失败:`, error);
        return null;
      })
    );
    
    const batchResults = await Promise.allSettled(batchPromises);
    results.push(...batchResults.map(r => r.status === 'fulfilled' ? r.value : null));
    
    // 短暂延迟，避免数据库压力过大
    if (i + batchSize < analysisResults.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  return results;
};

// 从数据库获取所有分析历史（带重试机制）
export const getAnalysisHistory = async (): Promise<ClothingAnalysisRecord[]> => {
  const service = await getDbService();
  return service.getAnalysisHistory();
};

// 根据ID获取特定的分析记录（带重试机制）
export const getAnalysisById = async (id: string): Promise<ClothingAnalysisRecord | null> => {
  const service = await getDbService();
  return service.getAnalysisById(id);
};

// 删除分析记录（带重试机制）
export const deleteAnalysisRecord = async (id: string): Promise<boolean> => {
  const service = await getDbService();
  return service.deleteAnalysisRecord(id);
};

// 更新分析记录（带重试机制）
export const updateAnalysisRecord = async (
  id: string,
  updates: Partial<ClothingAnalysisRecord>
): Promise<ClothingAnalysisRecord | null> => {
  const service = await getDbService();
  return service.updateAnalysisRecord(id, updates);
};

// 搜索分析记录（带重试机制）
export const searchAnalysisRecords = async (
  searchTerm: string,
  searchField: keyof ClothingAnalysisRecord = 'image_name'
): Promise<ClothingAnalysisRecord[]> => {
  const service = await getDbService();
  return service.searchAnalysisRecords(searchTerm, searchField);
};

// 批量删除分析记录（带重试机制）
export const deleteMultipleAnalysisRecords = async (ids: string[]): Promise<{ success: string[], failed: string[] }> => {
  const service = await getDbService();
  return service.deleteMultipleAnalysisRecords(ids);
};

// 获取统计信息（带重试机制）
export const getAnalysisStats = async () => {
  const service = await getDbService();
  return service.getAnalysisStats();
};