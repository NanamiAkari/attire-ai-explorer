import { createClient } from '@supabase/supabase-js';

// Supabase配置
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ygtfrxubbsnyfhutttsi.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// 创建Supabase客户端
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

// 检查Supabase连接状态
export const checkSupabaseConnection = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase.from('clothing_analysis').select('count').limit(1);
    if (error) {
      console.error('Supabase连接检查失败:', error);
      return false;
    }
    console.log('Supabase连接成功');
    return true;
  } catch (error) {
    console.error('Supabase连接异常:', error);
    return false;
  }
};