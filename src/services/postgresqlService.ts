import { 
  pool, 
  ClothingAnalysisRecord, 
  executeQuery, 
  executeQuerySingle,
  initializeDatabase,
  checkPostgreSQLConnection 
} from '../config/postgresql';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// 初始化数据库服务
export const initializeDatabaseService = async (): Promise<void> => {
  try {
    await initializeDatabase();
    console.log('数据库服务初始化成功');
  } catch (error) {
    console.error('数据库服务初始化失败:', error);
    throw error;
  }
};

// 检查数据库连接
export const checkDatabaseConnection = async (): Promise<boolean> => {
  return await checkPostgreSQLConnection();
};

// 生成图片内容哈希
const generateImageHash = (imageData: string): string => {
  return crypto.createHash('md5').update(imageData).digest('hex');
};

// 保存分析记录
export const saveAnalysisRecord = async (
  record: Omit<ClothingAnalysisRecord, 'id' | 'created_at' | 'updated_at'>
): Promise<ClothingAnalysisRecord> => {
  try {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const query = `
      INSERT INTO clothing_analysis (
        id, image_url, image_name, image_size, image_hash, 
        tags, confidence, analysis_time, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `;
    
    const values = [
      id,
      record.image_url,
      record.image_name,
      record.image_size,
      record.image_hash,
      JSON.stringify(record.tags),
      record.confidence,
      record.analysis_time,
      now,
      now
    ];
    
    const result = await executeQuerySingle<ClothingAnalysisRecord>(query, values);
    
    if (!result) {
      throw new Error('保存分析记录失败');
    }
    
    // 解析JSON字段
    if (typeof result.tags === 'string') {
      result.tags = JSON.parse(result.tags);
    }
    
    console.log('分析记录保存成功:', result.id);
    return result;
  } catch (error) {
    console.error('保存分析记录失败:', error);
    throw error;
  }
};

// 获取所有分析记录
export const getAllAnalysisRecords = async (): Promise<ClothingAnalysisRecord[]> => {
  try {
    const query = `
      SELECT * FROM clothing_analysis 
      ORDER BY created_at DESC;
    `;
    
    const records = await executeQuery<ClothingAnalysisRecord>(query);
    
    // 解析JSON字段
    return records.map(record => ({
      ...record,
      tags: typeof record.tags === 'string' ? JSON.parse(record.tags) : record.tags
    }));
  } catch (error) {
    console.error('获取分析记录失败:', error);
    throw error;
  }
};

// 根据ID获取分析记录
export const getAnalysisRecordById = async (id: string): Promise<ClothingAnalysisRecord | null> => {
  try {
    const query = `
      SELECT * FROM clothing_analysis 
      WHERE id = $1;
    `;
    
    const record = await executeQuerySingle<ClothingAnalysisRecord>(query, [id]);
    
    if (record && typeof record.tags === 'string') {
      record.tags = JSON.parse(record.tags);
    }
    
    return record;
  } catch (error) {
    console.error('获取分析记录失败:', error);
    throw error;
  }
};

// 删除分析记录
export const deleteAnalysisRecord = async (id: string): Promise<boolean> => {
  try {
    const query = `
      DELETE FROM clothing_analysis 
      WHERE id = $1;
    `;
    
    const result = await pool.query(query, [id]);
    
    const success = result.rowCount !== null && result.rowCount > 0;
    console.log(success ? '分析记录删除成功' : '未找到要删除的记录:', id);
    return success;
  } catch (error) {
    console.error('删除分析记录失败:', error);
    throw error;
  }
};

// 批量删除分析记录
export const deleteMultipleAnalysisRecords = async (ids: string[]): Promise<{ success: string[], failed: string[] }> => {
  const success: string[] = [];
  const failed: string[] = [];
  
  if (ids.length === 0) {
    return { success, failed };
  }
  
  // 逐个删除以便准确跟踪成功和失败的记录
  for (const id of ids) {
    try {
      const query = `
        DELETE FROM clothing_analysis 
        WHERE id = $1;
      `;
      
      const result = await pool.query(query, [id]);
      
      if (result.rowCount !== null && result.rowCount > 0) {
        success.push(id);
      } else {
        failed.push(id);
      }
    } catch (error) {
      console.error(`删除记录 ${id} 失败:`, error);
      failed.push(id);
    }
  }
  
  console.log(`批量删除完成: 成功 ${success.length} 条，失败 ${failed.length} 条`);
  return { success, failed };
};

// 搜索分析记录
export const searchAnalysisRecords = async (searchTerm: string): Promise<ClothingAnalysisRecord[]> => {
  try {
    const query = `
      SELECT * FROM clothing_analysis 
      WHERE 
        image_name ILIKE $1 OR
        tags::text ILIKE $1
      ORDER BY created_at DESC;
    `;
    
    const searchPattern = `%${searchTerm}%`;
    const records = await executeQuery<ClothingAnalysisRecord>(query, [searchPattern]);
    
    // 解析JSON字段
    return records.map(record => ({
      ...record,
      tags: typeof record.tags === 'string' ? JSON.parse(record.tags) : record.tags
    }));
  } catch (error) {
    console.error('搜索分析记录失败:', error);
    throw error;
  }
};

// 获取统计信息
export const getAnalysisStatistics = async (): Promise<{
  totalRecords: number;
  totalSize: number;
  averageConfidence: number;
  averageAnalysisTime: number;
}> => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_records,
        COALESCE(SUM(image_size), 0) as total_size,
        COALESCE(AVG(confidence), 0) as average_confidence,
        COALESCE(AVG(analysis_time), 0) as average_analysis_time
      FROM clothing_analysis;
    `;
    
    const result = await executeQuerySingle<{
      total_records: string;
      total_size: string;
      average_confidence: string;
      average_analysis_time: string;
    }>(query);
    
    if (!result) {
      return {
        totalRecords: 0,
        totalSize: 0,
        averageConfidence: 0,
        averageAnalysisTime: 0
      };
    }
    
    return {
      totalRecords: parseInt(result.total_records),
      totalSize: parseInt(result.total_size),
      averageConfidence: parseFloat(result.average_confidence),
      averageAnalysisTime: parseFloat(result.average_analysis_time)
    };
  } catch (error) {
    console.error('获取统计信息失败:', error);
    throw error;
  }
};

// 检查图片是否已存在（基于哈希）
export const checkImageExists = async (imageHash: string): Promise<ClothingAnalysisRecord | null> => {
  try {
    const query = `
      SELECT * FROM clothing_analysis 
      WHERE image_hash = $1 
      LIMIT 1;
    `;
    
    const record = await executeQuerySingle<ClothingAnalysisRecord>(query, [imageHash]);
    
    if (record && typeof record.tags === 'string') {
      record.tags = JSON.parse(record.tags);
    }
    
    return record;
  } catch (error) {
    console.error('检查图片是否存在失败:', error);
    throw error;
  }
};

// 更新分析记录
export const updateAnalysisRecord = async (
  id: string,
  updates: Partial<Omit<ClothingAnalysisRecord, 'id' | 'created_at'>>
): Promise<ClothingAnalysisRecord | null> => {
  try {
    const setClause = [];
    const values = [];
    let paramIndex = 1;
    
    if (updates.image_url !== undefined) {
      setClause.push(`image_url = $${paramIndex++}`);
      values.push(updates.image_url);
    }
    
    if (updates.image_name !== undefined) {
      setClause.push(`image_name = $${paramIndex++}`);
      values.push(updates.image_name);
    }
    
    if (updates.image_size !== undefined) {
      setClause.push(`image_size = $${paramIndex++}`);
      values.push(updates.image_size);
    }
    
    if (updates.image_hash !== undefined) {
      setClause.push(`image_hash = $${paramIndex++}`);
      values.push(updates.image_hash);
    }
    
    if (updates.tags !== undefined) {
      setClause.push(`tags = $${paramIndex++}`);
      values.push(JSON.stringify(updates.tags));
    }
    
    if (updates.confidence !== undefined) {
      setClause.push(`confidence = $${paramIndex++}`);
      values.push(updates.confidence);
    }
    
    if (updates.analysis_time !== undefined) {
      setClause.push(`analysis_time = $${paramIndex++}`);
      values.push(updates.analysis_time);
    }
    
    if (setClause.length === 0) {
      throw new Error('没有提供要更新的字段');
    }
    
    setClause.push(`updated_at = $${paramIndex++}`);
    values.push(new Date().toISOString());
    
    values.push(id); // WHERE条件的参数
    
    const query = `
      UPDATE clothing_analysis 
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *;
    `;
    
    const record = await executeQuerySingle<ClothingAnalysisRecord>(query, values);
    
    if (record && typeof record.tags === 'string') {
      record.tags = JSON.parse(record.tags);
    }
    
    return record;
  } catch (error) {
    console.error('更新分析记录失败:', error);
    throw error;
  }
};