import { Pool, PoolClient } from 'pg';

// PostgreSQL配置
const dbConfig = {
  user: 'postgres',
  host: 'localhost',
  database: 'clothing_analysis',
  password: '030815', // 用户提供的密码
  port: 5432,
  max: 20, // 连接池最大连接数
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// 创建连接池
export const pool = new Pool(dbConfig);

// 数据库表结构定义
export interface ClothingAnalysisRecord {
  id?: string;
  image_url: string;
  image_name: string;
  image_size: number;
  image_hash?: string; // 图片内容哈希，用于防重复上传
  tags: {
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
  };
  confidence: number;
  analysis_time: number;
  created_at?: string;
  updated_at?: string;
}

// 初始化数据库表
export const initializeDatabase = async (): Promise<void> => {
  const client = await pool.connect();
  try {
    // 创建表（如果不存在）
    await client.query(`
      CREATE TABLE IF NOT EXISTS clothing_analysis (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        image_url TEXT NOT NULL,
        image_name TEXT NOT NULL,
        image_size BIGINT NOT NULL,
        image_hash TEXT UNIQUE,
        tags JSONB NOT NULL,
        confidence REAL NOT NULL,
        analysis_time BIGINT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // 创建索引以提高查询性能
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_clothing_analysis_created_at 
      ON clothing_analysis(created_at DESC);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_clothing_analysis_image_hash 
      ON clothing_analysis(image_hash);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_clothing_analysis_tags 
      ON clothing_analysis USING GIN(tags);
    `);
    
    console.log('数据库表初始化成功');
  } catch (error) {
    console.error('数据库初始化失败:', error);
    throw error;
  } finally {
    client.release();
  }
};

// 检查PostgreSQL连接状态
export const checkPostgreSQLConnection = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT NOW()');
      console.log('PostgreSQL连接成功:', result.rows[0]);
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('PostgreSQL连接失败:', error);
    return false;
  }
};

// 执行查询的辅助函数
export const executeQuery = async <T = any>(
  text: string, 
  params?: any[]
): Promise<T[]> => {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows;
  } finally {
    client.release();
  }
};

// 执行单个查询的辅助函数
export const executeQuerySingle = async <T = any>(
  text: string, 
  params?: any[]
): Promise<T | null> => {
  const rows = await executeQuery<T>(text, params);
  return rows.length > 0 ? rows[0] : null;
};

// 关闭连接池
export const closePool = async (): Promise<void> => {
  await pool.end();
};