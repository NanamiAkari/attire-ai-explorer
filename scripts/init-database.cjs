const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// 数据库配置
const dbConfig = {
  user: 'postgres',
  host: 'localhost',
  database: 'postgres', // 先连接到默认数据库
  password: '030815',
  port: 5432,
};

// 目标数据库配置
const targetDbConfig = {
  ...dbConfig,
  database: 'clothing_analysis'
};

async function initializeDatabase() {
  let pool = new Pool(dbConfig);
  
  try {
    console.log('正在连接到PostgreSQL...');
    
    // 检查数据库是否存在
    const checkDbQuery = `
      SELECT 1 FROM pg_database WHERE datname = 'clothing_analysis';
    `;
    
    const dbExists = await pool.query(checkDbQuery);
    
    if (dbExists.rows.length === 0) {
      console.log('创建数据库 clothing_analysis...');
      await pool.query('CREATE DATABASE clothing_analysis;');
      console.log('数据库创建成功!');
    } else {
      console.log('数据库 clothing_analysis 已存在');
    }
    
    // 关闭连接到默认数据库的连接池
    await pool.end();
    
    // 连接到目标数据库
    pool = new Pool(targetDbConfig);
    
    console.log('正在创建数据表...');
    
    // 创建表
    const createTableQuery = `
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
    `;
    
    await pool.query(createTableQuery);
    console.log('数据表创建成功!');
    
    // 创建索引
    console.log('正在创建索引...');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_clothing_analysis_created_at ON clothing_analysis(created_at DESC);',
      'CREATE INDEX IF NOT EXISTS idx_clothing_analysis_image_hash ON clothing_analysis(image_hash);',
      'CREATE INDEX IF NOT EXISTS idx_clothing_analysis_tags ON clothing_analysis USING GIN(tags);'
    ];
    
    for (const indexQuery of indexes) {
      await pool.query(indexQuery);
    }
    
    console.log('索引创建成功!');
    
    // 创建更新时间触发器
    const triggerQuery = `
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql';
      
      DROP TRIGGER IF EXISTS update_clothing_analysis_updated_at ON clothing_analysis;
      
      CREATE TRIGGER update_clothing_analysis_updated_at
          BEFORE UPDATE ON clothing_analysis
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
    `;
    
    await pool.query(triggerQuery);
    console.log('触发器创建成功!');
    
    console.log('\n数据库初始化完成!');
    console.log('数据库名称: clothing_analysis');
    console.log('主机: localhost');
    console.log('端口: 5432');
    console.log('用户: postgres');
    
  } catch (error) {
    console.error('数据库初始化失败:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// 运行初始化
initializeDatabase();