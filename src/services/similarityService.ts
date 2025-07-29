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

// 最大缓存条目数
const MAX_CACHE_SIZE = 100;

// 保存特征向量到缓存（优化版本，限制缓存大小）
const saveCachedFeatures = (features: ImageFeature[]) => {
  try {
    // 限制缓存大小，删除最旧的条目
    let filteredFeatures = features;
    if (features.length > MAX_CACHE_SIZE) {
      filteredFeatures = features
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_CACHE_SIZE);
    }
    
    localStorage.setItem(FEATURE_CACHE_KEY, JSON.stringify(filteredFeatures));
  } catch (error) {
    console.error('保存特征向量缓存失败:', error);
    // 如果存储失败，尝试清理缓存后重试
    try {
      localStorage.removeItem(FEATURE_CACHE_KEY);
      console.log('已清理缓存，请重试');
    } catch (clearError) {
      console.error('清理缓存也失败:', clearError);
    }
  }
};

// 使用Canvas提取图片特征（优化版本，减少计算复杂度）
const extractImageFeatures = async (imageUrl: string): Promise<number[]> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    // 设置超时，避免图片加载卡住
    const timeout = setTimeout(() => {
      reject(new Error('图片加载超时'));
    }, 5000); // 5秒超时
    
    // 只对外部URL设置crossOrigin，避免本地图片加载失败
    if (!imageUrl.startsWith('blob:') && !imageUrl.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    
    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('无法创建Canvas上下文'));
          return;
        }
        
        // 提高分辨率以获得更精确的特征
        const size = 48; // 提升到48x48，显著增加信息量
        canvas.width = size;
        canvas.height = size;
        
        ctx.drawImage(img, 0, 0, size, size);
        const imageData = ctx.getImageData(0, 0, size, size);
        const data = imageData.data;
        
        // 增强特征提取：多层次特征组合
        const features: number[] = [];
        
        // RGB颜色直方图 (每个通道10个bin，进一步提高颜色分辨率)
        const rHist = new Array(10).fill(0);
        const gHist = new Array(10).fill(0);
        const bHist = new Array(10).fill(0);
        
        // HSV颜色直方图 (色调18个bin，饱和度和明度各10个bin)
        const hHist = new Array(18).fill(0);
        const sHist = new Array(10).fill(0);
        const vHist = new Array(10).fill(0);
        
        // 分块特征：将图片分为3x3块，获得更精细的空间信息
        const blockSize = size / 3;
        const blockFeatures: number[] = [];
        
        // 颜色分布统计
        let totalBrightness = 0;
        let colorVariance = 0;
        const colorMoments = [0, 0, 0]; // RGB的二阶矩
        
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // RGB直方图 (调整为10个bin)
          const rBin = Math.min(Math.floor(r / 25.6), 9); // 25.6 = 256/10
          const gBin = Math.min(Math.floor(g / 25.6), 9);
          const bBin = Math.min(Math.floor(b / 25.6), 9);
          
          rHist[rBin]++;
          gHist[gBin]++;
          bHist[bBin]++;
          
          // 颜色统计
          const brightness = (r + g + b) / 3;
          totalBrightness += brightness;
          
          // 计算颜色矩
          colorMoments[0] += r * r;
          colorMoments[1] += g * g;
          colorMoments[2] += b * b;
          
          // RGB转HSV
          const rNorm = r / 255;
          const gNorm = g / 255;
          const bNorm = b / 255;
          
          const max = Math.max(rNorm, gNorm, bNorm);
          const min = Math.min(rNorm, gNorm, bNorm);
          const delta = max - min;
          
          // 色调 (Hue)
          let h = 0;
          if (delta !== 0) {
            if (max === rNorm) {
              h = ((gNorm - bNorm) / delta) % 6;
            } else if (max === gNorm) {
              h = (bNorm - rNorm) / delta + 2;
            } else {
              h = (rNorm - gNorm) / delta + 4;
            }
          }
          h = h * 60;
          if (h < 0) h += 360;
          
          // 饱和度 (Saturation)
          const s = max === 0 ? 0 : delta / max;
          
          // 明度 (Value)
          const v = max;
          
          // HSV直方图 (调整bin数量)
          const hBin = Math.min(Math.floor(h / 20), 17); // 20 = 360/18
          const sBin = Math.min(Math.floor(s * 10), 9);
          const vBin = Math.min(Math.floor(v * 10), 9);
          
          hHist[hBin]++;
          sHist[sBin]++;
          vHist[vBin]++;
        }
        
        // 计算颜色方差
        const avgBrightness = totalBrightness / (size * size);
        for (let i = 0; i < data.length; i += 4) {
          const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
          colorVariance += Math.pow(brightness - avgBrightness, 2);
        }
        colorVariance /= (size * size);
        
        // 计算3x3分块特征
        for (let blockY = 0; blockY < 3; blockY++) {
          for (let blockX = 0; blockX < 3; blockX++) {
            let blockR = 0, blockG = 0, blockB = 0, blockCount = 0;
            let blockVariance = 0;
            
            for (let y = Math.floor(blockY * blockSize); y < Math.floor((blockY + 1) * blockSize); y++) {
              for (let x = Math.floor(blockX * blockSize); x < Math.floor((blockX + 1) * blockSize); x++) {
                const idx = (y * size + x) * 4;
                if (idx < data.length) {
                  blockR += data[idx];
                  blockG += data[idx + 1];
                  blockB += data[idx + 2];
                  blockCount++;
                }
              }
            }
            
            if (blockCount > 0) {
              const avgR = blockR / blockCount;
              const avgG = blockG / blockCount;
              const avgB = blockB / blockCount;
              
              // 计算分块内的颜色方差
              for (let y = Math.floor(blockY * blockSize); y < Math.floor((blockY + 1) * blockSize); y++) {
                for (let x = Math.floor(blockX * blockSize); x < Math.floor((blockX + 1) * blockSize); x++) {
                  const idx = (y * size + x) * 4;
                  if (idx < data.length) {
                    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
                    blockVariance += Math.pow(r - avgR, 2) + Math.pow(g - avgG, 2) + Math.pow(b - avgB, 2);
                  }
                }
              }
              blockVariance /= (blockCount * 3);
              
              blockFeatures.push(avgR / 255);
              blockFeatures.push(avgG / 255);
              blockFeatures.push(avgB / 255);
              blockFeatures.push(Math.sqrt(blockVariance) / 255); // 分块纹理复杂度
            }
          }
        }
        
        // 归一化直方图
        const totalPixels = size * size;
        features.push(...rHist.map(v => v / totalPixels));
        features.push(...gHist.map(v => v / totalPixels));
        features.push(...bHist.map(v => v / totalPixels));
        features.push(...hHist.map(v => v / totalPixels));
        features.push(...sHist.map(v => v / totalPixels));
        features.push(...vHist.map(v => v / totalPixels));
        
        // 添加分块特征 (3x3=9块，每块4个特征=36个特征)
        features.push(...blockFeatures);
        
        // 添加全局统计特征
        features.push(avgBrightness / 255); // 平均亮度
        features.push(Math.sqrt(colorVariance) / 255); // 颜色方差
        features.push(Math.sqrt(colorMoments[0] / totalPixels) / 255); // R通道二阶矩
        features.push(Math.sqrt(colorMoments[1] / totalPixels) / 255); // G通道二阶矩
        features.push(Math.sqrt(colorMoments[2] / totalPixels) / 255); // B通道二阶矩
        
        // 计算增强的边缘特征
        let edgeStrength = 0;
        let edgeDirection = [0, 0, 0, 0]; // 四个方向的边缘强度
        
        for (let y = 1; y < size - 1; y++) {
          for (let x = 1; x < size - 1; x++) {
            const idx = (y * size + x) * 4;
            const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
            
            // Sobel算子计算梯度
            const grayTL = (data[(y-1)*size*4 + (x-1)*4] + data[(y-1)*size*4 + (x-1)*4 + 1] + data[(y-1)*size*4 + (x-1)*4 + 2]) / 3;
            const grayTM = (data[(y-1)*size*4 + x*4] + data[(y-1)*size*4 + x*4 + 1] + data[(y-1)*size*4 + x*4 + 2]) / 3;
            const grayTR = (data[(y-1)*size*4 + (x+1)*4] + data[(y-1)*size*4 + (x+1)*4 + 1] + data[(y-1)*size*4 + (x+1)*4 + 2]) / 3;
            const grayML = (data[y*size*4 + (x-1)*4] + data[y*size*4 + (x-1)*4 + 1] + data[y*size*4 + (x-1)*4 + 2]) / 3;
            const grayMR = (data[y*size*4 + (x+1)*4] + data[y*size*4 + (x+1)*4 + 1] + data[y*size*4 + (x+1)*4 + 2]) / 3;
            const grayBL = (data[(y+1)*size*4 + (x-1)*4] + data[(y+1)*size*4 + (x-1)*4 + 1] + data[(y+1)*size*4 + (x-1)*4 + 2]) / 3;
            const grayBM = (data[(y+1)*size*4 + x*4] + data[(y+1)*size*4 + x*4 + 1] + data[(y+1)*size*4 + x*4 + 2]) / 3;
            const grayBR = (data[(y+1)*size*4 + (x+1)*4] + data[(y+1)*size*4 + (x+1)*4 + 1] + data[(y+1)*size*4 + (x+1)*4 + 2]) / 3;
            
            // Sobel X和Y方向梯度
            const gx = (grayTR + 2*grayMR + grayBR) - (grayTL + 2*grayML + grayBL);
            const gy = (grayBL + 2*grayBM + grayBR) - (grayTL + 2*grayTM + grayTR);
            
            const magnitude = Math.sqrt(gx * gx + gy * gy);
            edgeStrength += magnitude;
            
            // 计算边缘方向
            const angle = Math.atan2(gy, gx) * 180 / Math.PI;
            const normalizedAngle = (angle + 180) % 180; // 0-180度
            
            if (normalizedAngle < 45) edgeDirection[0] += magnitude; // 水平
            else if (normalizedAngle < 90) edgeDirection[1] += magnitude; // 对角线
            else if (normalizedAngle < 135) edgeDirection[2] += magnitude; // 垂直
            else edgeDirection[3] += magnitude; // 反对角线
          }
        }
        
        features.push(edgeStrength / (size * size * 255)); // 总边缘强度
        features.push(...edgeDirection.map(d => d / (size * size * 255))); // 四个方向的边缘强度
        
        resolve(features);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    };
    
    img.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('图片加载失败'));
    };
    
    img.src = imageUrl;
  });
};

// 计算优化的相似度（平衡版本，提高相同图片的相似度）
const calculateCosineSimilarity = (features1: number[], features2: number[]): number => {
  if (features1.length !== features2.length) {
    console.warn('特征向量维度不匹配');
    return 0;
  }
  
  // 定义特征权重：RGB(10+10+10=30) + HSV(18+10+10=38) + 分块(36) + 统计(5) + 边缘(5) = 114维
  // 注意：图片尺寸提升到48x48，特征精度更高
  const featureWeights = [
    // RGB直方图权重 (30维) - 基础颜色信息
    ...new Array(30).fill(1.2),
    // HSV直方图权重 (38维) - 色调重要但不过度
    ...new Array(18).fill(2.0), // 色调权重适中
    ...new Array(10).fill(1.8),  // 饱和度权重适中
    ...new Array(10).fill(1.5),  // 明度权重适中
    // 分块特征权重 (36维) - 空间布局重要
    ...new Array(36).fill(2.2),
    // 全局统计特征权重 (5维) - 整体特征
    1.8, 2.0, 1.5, 1.5, 1.5, // 亮度、方差、RGB二阶矩权重适中
    // 边缘特征权重 (5维) - 纹理和方向信息
    2.2, 1.8, 1.8, 1.8, 1.8 // 总边缘强度 + 四个方向权重适中
  ];
  
  // 确保权重数组长度匹配
  while (featureWeights.length < features1.length) {
    featureWeights.push(1.0);
  }
  
  // 1. 计算基础余弦相似度
  let weightedDotProduct = 0;
  let weightedNorm1 = 0;
  let weightedNorm2 = 0;
  
  const len = Math.min(features1.length, featureWeights.length);
  for (let i = 0; i < len; i++) {
    const f1 = features1[i];
    const f2 = features2[i];
    const weight = featureWeights[i];
    
    const weightedF1 = f1 * weight;
    const weightedF2 = f2 * weight;
    
    weightedDotProduct += weightedF1 * weightedF2;
    weightedNorm1 += weightedF1 * weightedF1;
    weightedNorm2 += weightedF2 * weightedF2;
  }
  
  if (weightedNorm1 === 0 || weightedNorm2 === 0) {
    return 0;
  }
  
  const cosineSim = weightedDotProduct / (Math.sqrt(weightedNorm1) * Math.sqrt(weightedNorm2));
  
  // 2. 计算特征差异惩罚（优化版本）
  let totalDifference = 0;
  let maxDifference = 0;
  
  for (let i = 0; i < len; i++) {
    const diff = Math.abs(features1[i] - features2[i]);
    totalDifference += diff * featureWeights[i];
    maxDifference = Math.max(maxDifference, diff);
  }
  
  const avgDifference = totalDifference / len;
  
  // 3. 计算分块颜色一致性（空间布局相似性）- 优化版本
  const blockStart = 30 + 38; // RGB + HSV之后是分块特征
  let blockConsistency = 0;
  
  for (let i = 0; i < 9; i++) { // 9个分块 (3x3)
    const blockIdx = blockStart + i * 4; // 每个分块4个特征
    if (blockIdx + 3 < len) {
      const r1 = features1[blockIdx], g1 = features1[blockIdx + 1], b1 = features1[blockIdx + 2], t1 = features1[blockIdx + 3];
      const r2 = features2[blockIdx], g2 = features2[blockIdx + 1], b2 = features2[blockIdx + 2], t2 = features2[blockIdx + 3];
      
      // 计算每个分块的颜色和纹理距离
      const colorDist = Math.sqrt((r1-r2)*(r1-r2) + (g1-g2)*(g1-g2) + (b1-b2)*(b1-b2));
      const textureDist = Math.abs(t1 - t2);
      const combinedDist = colorDist * 0.7 + textureDist * 0.3;
      
      blockConsistency += Math.exp(-combinedDist * 5); // 减少距离惩罚强度
    }
  }
  blockConsistency /= 9;
  
  // 4. 计算色调一致性（HSV中的色调部分）- 优化版本
  const hueStart = 30; // RGB之后是HSV
  let hueConsistency = 0;
  
  for (let i = 0; i < 18; i++) { // 18个色调bins
    const h1 = features1[hueStart + i];
    const h2 = features2[hueStart + i];
    const hueDiff = Math.abs(h1 - h2);
    hueConsistency += Math.exp(-hueDiff * 8); // 减少色调差异惩罚强度
  }
  hueConsistency /= 18;
  
  // 5. 综合相似度计算（平衡版本）
  let finalSimilarity = cosineSim * 0.4 + // 基础余弦相似度权重提高
                       blockConsistency * 0.25 + // 空间布局一致性权重适中
                       hueConsistency * 0.25 + // 色调一致性权重适中
                       (1 - avgDifference) * 0.1; // 整体差异惩罚权重降低
  
  // 6. 应用适度的非线性变换
  finalSimilarity = Math.pow(finalSimilarity, 0.7); // 适度的非线性变换
  
  // 7. 优化的最大差异惩罚
  if (maxDifference > 0.8) {
    finalSimilarity *= 0.3; // 严重惩罚
  } else if (maxDifference > 0.6) {
    finalSimilarity *= 0.5; // 中等惩罚
  } else if (maxDifference > 0.4) {
    finalSimilarity *= 0.7; // 轻微惩罚
  } else if (maxDifference > 0.3) {
    finalSimilarity *= 0.85; // 很轻微惩罚
  }
  
  // 8. 优化的相似度调整
  if (finalSimilarity < 0.2) {
    finalSimilarity *= 0.5; // 降低极低相似度
  } else if (finalSimilarity < 0.4) {
    finalSimilarity *= 0.8; // 轻微降低低相似度
  }
  
  // 9. 减少全局抑制因子
  finalSimilarity *= 0.9; // 轻微全局调整
  
  return Math.max(0, Math.min(1, finalSimilarity));
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
  targetImages: Array<{ id: string; imageUrl: string }>,
  onProgress?: (current: number, total: number) => void
): Promise<SimilarityResult[]> => {
  const searchImageId = 'search_' + Date.now();
  
  console.log('开始批量相似度计算:', {
    searchImageUrl,
    targetImagesCount: targetImages.length
  });
  
  try {
    // 先提取搜索图片的特征
    console.log('提取搜索图片特征...');
    const searchFeatures = await getImageFeatures(searchImageUrl, searchImageId);
    console.log('搜索图片特征提取完成，特征维度:', searchFeatures.length);
    
    // 顺序计算所有目标图片的相似度（支持进度回调）
    console.log('开始计算目标图片相似度...');
    const results: SimilarityResult[] = [];
    
    for (let index = 0; index < targetImages.length; index++) {
      const target = targetImages[index];
      try {
        console.log(`处理目标图片 ${index + 1}/${targetImages.length}: ${target.id}`);
        
        // 报告进度
        onProgress?.(index + 1, targetImages.length);
        
        const targetFeatures = await getImageFeatures(target.imageUrl, target.id);
        const similarity = calculateCosineSimilarity(searchFeatures, targetFeatures);
        
        console.log(`图片 ${target.id} 相似度: ${(similarity * 100).toFixed(2)}%`);
        
        results.push({
          id: target.id,
          imageUrl: target.imageUrl,
          similarity
        });
      } catch (error) {
        console.error(`计算图片 ${target.id} 相似度失败:`, error);
        results.push({
          id: target.id,
          imageUrl: target.imageUrl,
          similarity: 0 // 无法计算相似度时返回0
        });
      }
    }
    
    console.log('批量相似度计算完成，结果:', results.map(r => ({
      id: r.id,
      similarity: (r.similarity * 100).toFixed(2) + '%'
    })));
    
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