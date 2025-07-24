// 历史记录服务
export interface HistoryRecord {
  id: string;
  timestamp: number;
  fileName: string;
  imageUrl: string;
  savedImagePath: string;
  tags: any;
  confidence: number;
  analysisTime: number;
}

const HISTORY_STORAGE_KEY = 'clothing_analysis_history';
const MAX_HISTORY_RECORDS = 100;

// 获取历史记录
export const getAnalysisHistory = (): HistoryRecord[] => {
  try {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('获取历史记录失败:', error);
    return [];
  }
};

// 保存分析结果到历史记录
export const saveToHistory = async (result: any, file: File): Promise<HistoryRecord> => {
  try {
    // 生成唯一ID
    const id = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 保存图片到本地存储（使用IndexedDB）
    const savedImagePath = await saveImageToIndexedDB(file, id);
    
    const record: HistoryRecord = {
      id,
      timestamp: Date.now(),
      fileName: file.name,
      imageUrl: result.imageUrl,
      savedImagePath,
      tags: result.tags,
      confidence: result.confidence,
      analysisTime: result.analysisTime
    };
    
    // 获取现有历史记录
    const history = getAnalysisHistory();
    
    // 添加新记录到开头
    history.unshift(record);
    
    // 限制历史记录数量
    if (history.length > MAX_HISTORY_RECORDS) {
      const removedRecords = history.splice(MAX_HISTORY_RECORDS);
      // 清理被移除记录的图片
      removedRecords.forEach(record => {
        deleteImageFromIndexedDB(record.id).catch(console.error);
      });
    }
    
    // 保存到localStorage
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    
    return record;
  } catch (error) {
    console.error('保存历史记录失败:', error);
    throw error;
  }
};

// 删除历史记录
export const deleteHistoryRecord = async (id: string): Promise<void> => {
  try {
    const history = getAnalysisHistory();
    const updatedHistory = history.filter(record => record.id !== id);
    
    // 删除对应的图片
    await deleteImageFromIndexedDB(id);
    
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
  } catch (error) {
    console.error('删除历史记录失败:', error);
    throw error;
  }
};

// 清空所有历史记录
export const clearAllHistory = async (): Promise<void> => {
  try {
    const history = getAnalysisHistory();
    
    // 删除所有图片
    await Promise.all(
      history.map(record => deleteImageFromIndexedDB(record.id))
    );
    
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch (error) {
    console.error('清空历史记录失败:', error);
    throw error;
  }
};

// 搜索和筛选历史记录
export const searchHistory = (query: string, filters?: {
  dateRange?: { start: number; end: number };
  tags?: string[];
}): HistoryRecord[] => {
  const history = getAnalysisHistory();
  
  return history.filter(record => {
    // 文本搜索
    const matchesQuery = !query || 
      record.fileName.toLowerCase().includes(query.toLowerCase()) ||
      Object.values(record.tags).some(tag => 
        typeof tag === 'string' && tag.toLowerCase().includes(query.toLowerCase())
      );
    
    // 日期范围筛选
    const matchesDateRange = !filters?.dateRange || 
      (record.timestamp >= filters.dateRange.start && 
       record.timestamp <= filters.dateRange.end);
    
    // 标签筛选
    const matchesTags = !filters?.tags?.length || 
      filters.tags.some(filterTag => 
        Object.values(record.tags).some(tag => 
          typeof tag === 'string' && tag.includes(filterTag)
        )
      );
    
    return matchesQuery && matchesDateRange && matchesTags;
  });
};

// IndexedDB 操作
const DB_NAME = 'ClothingAnalysisDB';
const DB_VERSION = 1;
const STORE_NAME = 'images';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

const saveImageToIndexedDB = async (file: File, id: string): Promise<string> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const imageData = {
      id,
      file: file,
      timestamp: Date.now()
    };
    
    await new Promise((resolve, reject) => {
      const request = store.put(imageData);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    return id;
  } catch (error) {
    console.error('保存图片到IndexedDB失败:', error);
    throw error;
  }
};

export const getImageFromIndexedDB = async (id: string): Promise<File | null> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.file : null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('从IndexedDB获取图片失败:', error);
    return null;
  }
};

const deleteImageFromIndexedDB = async (id: string): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    await new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('从IndexedDB删除图片失败:', error);
    throw error;
  }
};