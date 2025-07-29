import { ClothingAnalysisRecord } from '../config/postgresql';
import { AnalysisResult } from './cozeService';

// 浏览器环境下的数据库服务 - 通过后端 API 调用
// 这个文件替代直接的数据库连接，避免在浏览器中使用 Node.js 模块

// API 基础 URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

// 数据库连接检查
export const checkDatabaseConnection = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/database/check`);
    const data = await response.json();
    console.log('数据库连接检查 - API模式:', data);
    return data.connected;
  } catch (error) {
    console.error('数据库连接检查失败:', error);
    return false;
  }
};

// 初始化数据库服务
export const initializeDatabaseService = async (): Promise<void> => {
  try {
    console.log('初始化数据库服务 - API模式');
    // 检查后端服务是否可用
    const isConnected = await checkDatabaseConnection();
    if (!isConnected) {
      console.warn('后端数据库服务不可用，请确保后端服务器正在运行');
    }
  } catch (error) {
    console.error('数据库服务初始化失败:', error);
    throw error;
  }
};

// 计算文件哈希
export const calculateFileHash = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// 检查重复图片
export const checkDuplicateImage = async (imageHash: string): Promise<ClothingAnalysisRecord | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/analysis`);
    if (!response.ok) return null;
    
    const records: ClothingAnalysisRecord[] = await response.json();
    return records.find(record => record.image_hash === imageHash) || null;
  } catch (error) {
    console.error('检查重复图片失败:', error);
    return null;
  }
};

// 保存分析结果到数据库
export const saveAnalysisToDatabase = async (
  analysisResult: AnalysisResult,
  file: File
): Promise<ClothingAnalysisRecord | null> => {
  try {
    // 创建 FormData 对象
    const formData = new FormData();
    formData.append('image', file);
    formData.append('analysisResult', JSON.stringify(analysisResult));

    const response = await fetch(`${API_BASE_URL}/analysis`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('保存分析记录 - API模式:', result);
    
    return result.record;
  } catch (error) {
    console.error('保存分析结果失败:', error);
    return null;
  }
};

// 获取分析历史
export const getAnalysisHistory = async (): Promise<ClothingAnalysisRecord[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/analysis`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const records = await response.json();
    return records;
  } catch (error) {
    console.error('获取分析历史失败:', error);
    return [];
  }
};

// 根据ID获取分析记录
export const getAnalysisById = async (id: string): Promise<ClothingAnalysisRecord | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/analysis/${id}`);
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const record = await response.json();
    return record;
  } catch (error) {
    console.error('获取分析记录失败:', error);
    return null;
  }
};

// 删除分析记录
export const deleteAnalysisRecord = async (id: string): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/analysis/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return false;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return true;
  } catch (error) {
    console.error('删除分析记录失败:', error);
    return false;
  }
};

// 更新分析记录
export const updateAnalysisRecord = async (
  id: string,
  updates: Partial<ClothingAnalysisRecord>
): Promise<ClothingAnalysisRecord | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/analysis/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const record = await response.json();
    return record;
  } catch (error) {
    console.error('更新分析记录失败:', error);
    return null;
  }
};

// 搜索分析记录
export const searchAnalysisRecords = async (
  searchTerm: string,
  searchField: keyof ClothingAnalysisRecord = 'image_name'
): Promise<ClothingAnalysisRecord[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/analysis/search/${encodeURIComponent(searchTerm)}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const records = await response.json();
    return records;
  } catch (error) {
    console.error('搜索分析记录失败:', error);
    return [];
  }
};

// 批量删除分析记录
export const deleteMultipleAnalysisRecords = async (ids: string[]): Promise<{ success: string[], failed: string[] }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/analysis`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ids })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('批量删除分析记录失败:', error);
    return { success: [], failed: ids };
  }
};

// 获取分析统计
export const getAnalysisStats = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/analysis/stats`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const stats = await response.json();
    return stats;
  } catch (error) {
    console.error('获取分析统计失败:', error);
    return {
      totalRecords: 0,
      totalSize: 0,
      averageConfidence: 0,
      averageAnalysisTime: 0
    };
  }
};