// 图片相似度计算服务
import { COZE_API_BASE, COZE_API_TOKEN } from './cozeService';

// 图片特征向量接口
interface ImageFeature {
  id: string;
  imageUrl: string;
  features: number[];
  timestamp: number;
}

// 相似度结果接口
interface SimilarityResult {
  id: string;
  imageUrl: string;
  similarity: number;
}

// 本地特征向量缓存
const FEATURE_CACHE_KEY = 'image_features_cache';
const CACHE_EXPIRY_DAYS = 7; // 缓存7天

// 获取缓存的特征向量
const getCachedFeatures = (): ImageFeature[] => {
  try {
    const cached = localStorage.getItem(FEATURE_CACHE_KEY);
    if (!cached) return [];
    
    const features: ImageFeature[] = JSON.parse(cached);
    const now = Date.now();
    const expiryTime = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    
    // 过滤过期的缓存
    return features.filter(feature => now - feature.timestamp < expiryTime);
  } catch (error) {
    console.error('读取特征向量缓存失败:', error);
    return [];
  }
};

// 保存特征向量到缓存
const saveCachedFeatures = (features: ImageFeature[]) => {
  try {
    localStorage.setItem(FEATURE_CACHE_KEY, JSON.stringify(features));
  } catch (error) {
    console.error('保存特征向量缓存失败:', error);
  }
};

// 使用Canvas提取图片特征（简化版本）
const extractImageFeatures = async (imageUrl: string): Promise<number[]> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('无法创建Canvas上下文'));
          return;
        }
        
        // 缩放到固定尺寸以提取特征
        const size = 64;
        canvas.width = size;
        canvas.height = size;
        
        ctx.drawImage(img, 0, 0, size, size);
        const imageData = ctx.getImageData(0, 0, size, size);
        const data = imageData.data;
        
        // 提取颜色直方图特征
        const features: number[] = [];
        
        // RGB颜色直方图 (每个通道16个bin)
        const rHist = new Array(16).fill(0);
        const gHist = new Array(16).fill(0);
        const bHist = new Array(16).fill(0);
        
        for (let i = 0; i < data.length; i += 4) {
          const r = Math.floor(data[i] / 16);
          const g = Math.floor(data[i + 1] / 16);
          const b = Math.floor(data[i + 2] / 16);
          
          rHist[r]++;
          gHist[g]++;
          bHist[b]++;
        }
        
        // 归一化直方图
        const totalPixels = size * size;
        features.push(...rHist.map(v => v / totalPixels));
        features.push(...gHist.map(v => v / totalPixels));
        features.push(...bHist.map(v => v / totalPixels));
        
        // 提取纹理特征（简化的灰度共生矩阵）
        const grayData = [];
        for (let i = 0; i < data.length; i += 4) {
          const gray = Math.floor((data[i] + data[i + 1] + data[i + 2]) / 3 / 32); // 8级灰度
          grayData.push(gray);
        }
        
        // 计算水平方向的灰度共生矩阵
        const glcm = new Array(8).fill(0).map(() => new Array(8).fill(0));
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size - 1; x++) {
            const current = grayData[y * size + x];
            const next = grayData[y * size + x + 1];
            glcm[current][next]++;
          }
        }
        
        // 提取纹理特征：对比度、均匀性、熵
        let contrast = 0, uniformity = 0, entropy = 0;
        const total = (size - 1) * size;
        
        for (let i = 0; i < 8; i++) {
          for (let j = 0; j < 8; j++) {
            const p = glcm[i][j] / total;
            if (p > 0) {
              contrast += (i - j) * (i - j) * p;
              uniformity += p * p;
              entropy -= p * Math.log2(p);
            }
          }
        }
        
        features.push(contrast, uniformity, entropy);
        
        resolve(features);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('图片加载失败'));
    };
    
    img.src = imageUrl;
  });
};

// 计算余弦相似度
const calculateCosineSimilarity = (features1: number[], features2: number[]): number => {
  if (features1.length !== features2.length) {
    throw new Error('特征向量长度不匹配');
  }
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < features1.length; i++) {
    dotProduct += features1[i] * features2[i];
    norm1 += features1[i] * features1[i];
    norm2 += features2[i] * features2[i];
  }
  
  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }
  
  const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  return Math.max(0, Math.min(1, similarity)) * 100; // 转换为0-100的百分比
};

// 获取图片特征向量
export const getImageFeatures = async (imageUrl: string, imageId: string): Promise<number[]> => {
  // 先检查缓存
  const cachedFeatures = getCachedFeatures();
  const cached = cachedFeatures.find(f => f.id === imageId);
  
  if (cached) {
    console.log('使用缓存的特征向量:', imageId);
    return cached.features;
  }
  
  try {
    console.log('提取图片特征向量:', imageId);
    const features = await extractImageFeatures(imageUrl);
    
    // 保存到缓存
    const newFeature: ImageFeature = {
      id: imageId,
      imageUrl,
      features,
      timestamp: Date.now()
    };
    
    const updatedFeatures = [...cachedFeatures, newFeature];
    saveCachedFeatures(updatedFeatures);
    
    return features;
  } catch (error) {
    console.error('提取图片特征失败:', error);
    throw error;
  }
};

// 计算图片相似度
export const calculateImageSimilarity = async (
  searchImageUrl: string,
  targetImageUrl: string,
  searchImageId: string = 'search_image',
  targetImageId: string
): Promise<number> => {
  try {
    const [searchFeatures, targetFeatures] = await Promise.all([
      getImageFeatures(searchImageUrl, searchImageId),
      getImageFeatures(targetImageUrl, targetImageId)
    ]);
    
    return calculateCosineSimilarity(searchFeatures, targetFeatures);
  } catch (error) {
    console.error('计算图片相似度失败:', error);
    // 返回0表示无法计算相似度
    return 0;
  }
};

// 批量计算相似度
export const calculateBatchSimilarity = async (
  searchImageUrl: string,
  targetImages: Array<{ id: string; imageUrl: string }>
): Promise<SimilarityResult[]> => {
  const searchImageId = 'search_' + Date.now();
  
  try {
    // 先提取搜索图片的特征
    const searchFeatures = await getImageFeatures(searchImageUrl, searchImageId);
    
    // 并行计算所有目标图片的相似度
    const results = await Promise.all(
      targetImages.map(async (target) => {
        try {
          const targetFeatures = await getImageFeatures(target.imageUrl, target.id);
          const similarity = calculateCosineSimilarity(searchFeatures, targetFeatures);
          
          return {
            id: target.id,
            imageUrl: target.imageUrl,
            similarity
          };
        } catch (error) {
          console.error(`计算图片 ${target.id} 相似度失败:`, error);
          return {
            id: target.id,
            imageUrl: target.imageUrl,
            similarity: 0 // 无法计算相似度时返回0
          };
        }
      })
    );
    
    return results;
  } catch (error) {
    console.error('批量计算相似度失败:', error);
    // 降级方案：返回0相似度
    return targetImages.map(target => ({
      id: target.id,
      imageUrl: target.imageUrl,
      similarity: 0
    }));
  }
};

// 清除特征向量缓存
export const clearFeatureCache = () => {
  try {
    localStorage.removeItem(FEATURE_CACHE_KEY);
    console.log('特征向量缓存已清除');
  } catch (error) {
    console.error('清除特征向量缓存失败:', error);
  }
};

// 获取缓存统计信息
export const getCacheStats = () => {
  const features = getCachedFeatures();
  return {
    count: features.length,
    size: JSON.stringify(features).length,
    oldestTimestamp: features.length > 0 ? Math.min(...features.map(f => f.timestamp)) : null,
    newestTimestamp: features.length > 0 ? Math.max(...features.map(f => f.timestamp)) : null
  };
};