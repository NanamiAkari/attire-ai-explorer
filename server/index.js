require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Pool } = require('pg');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// PostgreSQL 连接配置
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'clothing_analysis',
  password: process.env.DB_PASSWORD || '030815',
  port: process.env.DB_PORT || 5432,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// 文件上传配置
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// 工具函数：生成文件哈希
const generateFileHash = (buffer) => {
  return crypto.createHash('md5').update(buffer).digest('hex');
};

// 工具函数：初始化数据库表
const initializeDatabase = async () => {
  const client = await pool.connect();
  try {
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
    
    // 创建索引
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

// API 路由

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// 检查数据库连接
app.get('/api/database/check', async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT NOW()');
      res.json({ connected: true, timestamp: result.rows[0].now });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('数据库连接检查失败:', error);
    res.status(500).json({ connected: false, error: error.message });
  }
});

// 保存分析结果
app.post('/api/analysis', upload.single('image'), async (req, res) => {
  try {
    const { analysisResult } = req.body;
    const file = req.file;
    
    if (!analysisResult || !file) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    const parsedResult = JSON.parse(analysisResult);
    const imageHash = generateFileHash(file.buffer);
    
    // 检查重复图片
    const existingRecord = await pool.query(
      'SELECT * FROM clothing_analysis WHERE image_hash = $1',
      [imageHash]
    );
    
    if (existingRecord.rows.length > 0) {
      return res.json({ 
        success: true, 
        record: existingRecord.rows[0],
        message: '图片已存在于数据库中'
      });
    }
    
    // 将图片转换为base64格式存储
    const imageBase64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    
    // 保存新记录
    const result = await pool.query(`
      INSERT INTO clothing_analysis (
        image_url, image_name, image_size, image_hash, 
        tags, confidence, analysis_time
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      imageBase64,
      file.originalname,
      file.size,
      imageHash,
      JSON.stringify(parsedResult.tags),
      parsedResult.confidence,
      parsedResult.analysisTime
    ]);
    
    res.json({ success: true, record: result.rows[0] });
  } catch (error) {
    console.error('保存分析结果失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取分析历史
app.get('/api/analysis', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM clothing_analysis 
      ORDER BY created_at DESC
    `);
    
    const records = result.rows.map(record => ({
      ...record,
      tags: typeof record.tags === 'string' ? JSON.parse(record.tags) : record.tags
    }));
    
    res.json(records);
  } catch (error) {
    console.error('获取分析历史失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 搜索分析记录
app.get('/api/analysis/search/:searchTerm', async (req, res) => {
  try {
    const { searchTerm } = req.params;
    const searchPattern = `%${searchTerm}%`;
    
    const result = await pool.query(`
      SELECT * FROM clothing_analysis 
      WHERE 
        image_name ILIKE $1 OR
        tags::text ILIKE $1
      ORDER BY created_at DESC
    `, [searchPattern]);
    
    const records = result.rows.map(record => ({
      ...record,
      tags: typeof record.tags === 'string' ? JSON.parse(record.tags) : record.tags
    }));
    
    res.json(records);
  } catch (error) {
    console.error('搜索分析记录失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取统计信息
app.get('/api/analysis/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_records,
        COALESCE(SUM(image_size), 0) as total_size,
        COALESCE(AVG(confidence), 0) as average_confidence,
        COALESCE(AVG(analysis_time), 0) as average_analysis_time
      FROM clothing_analysis
    `);
    
    const stats = result.rows[0];
    
    res.json({
      totalRecords: parseInt(stats.total_records),
      totalSize: parseInt(stats.total_size),
      averageConfidence: parseFloat(stats.average_confidence),
      averageAnalysisTime: parseFloat(stats.average_analysis_time)
    });
  } catch (error) {
    console.error('获取统计信息失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 根据ID获取分析记录
app.get('/api/analysis/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM clothing_analysis WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '记录不存在' });
    }
    
    const record = result.rows[0];
    record.tags = typeof record.tags === 'string' ? JSON.parse(record.tags) : record.tags;
    
    res.json(record);
  } catch (error) {
    console.error('获取分析记录失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 更新分析记录
app.put('/api/analysis/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const setClause = [];
    const values = [];
    let paramIndex = 1;
    
    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'created_at') {
        setClause.push(`${key} = $${paramIndex}`);
        values.push(key === 'tags' ? JSON.stringify(value) : value);
        paramIndex++;
      }
    });
    
    setClause.push(`updated_at = $${paramIndex}`);
    values.push(new Date().toISOString());
    values.push(id);
    
    const query = `
      UPDATE clothing_analysis 
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex + 1}
      RETURNING *
    `;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '记录不存在' });
    }
    
    const record = result.rows[0];
    record.tags = typeof record.tags === 'string' ? JSON.parse(record.tags) : record.tags;
    
    res.json(record);
  } catch (error) {
    console.error('更新分析记录失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 删除分析记录
app.delete('/api/analysis/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM clothing_analysis WHERE id = $1 RETURNING id',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '记录不存在' });
    }
    
    res.json({ success: true, deletedId: id });
  } catch (error) {
    console.error('删除分析记录失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 批量删除分析记录
app.delete('/api/analysis', async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: '无效的ID列表' });
    }
    
    const placeholders = ids.map((_, index) => `$${index + 1}`).join(',');
    const result = await pool.query(
      `DELETE FROM clothing_analysis WHERE id IN (${placeholders}) RETURNING id`,
      ids
    );
    
    const deletedIds = result.rows.map(row => row.id);
    const failedIds = ids.filter(id => !deletedIds.includes(id));
    
    res.json({ 
      success: deletedIds, 
      failed: failedIds 
    });
  } catch (error) {
    console.error('批量删除分析记录失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 错误处理中间件
app.use((error, req, res, next) => {
  console.error('服务器错误:', error);
  res.status(500).json({ error: '服务器内部错误' });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// 启动服务器
const startServer = async () => {
  try {
    // 初始化数据库
    await initializeDatabase();
    
    app.listen(PORT, () => {
      console.log(`服务器运行在端口 ${PORT}`);
      console.log(`健康检查: http://localhost:${PORT}/api/health`);
      console.log(`数据库检查: http://localhost:${PORT}/api/database/check`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
};

startServer();

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('\n正在关闭服务器...');
  await pool.end();
  process.exit(0);
});