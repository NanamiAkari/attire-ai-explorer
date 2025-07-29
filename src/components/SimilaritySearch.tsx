import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { AnalysisResult, ClothingTags, analyzeClothingImage } from '@/services/cozeService';
import { calculateBatchSimilarity } from '@/services/similarityService';
import { Search, Upload, X, Image as ImageIcon, Zap, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import ErrorBoundary from './ErrorBoundary';

// 搜索步骤枚举
enum SearchStep {
  UPLOAD = 'upload',
  ANALYZING = 'analyzing', 
  ANALYZED = 'analyzed',
  SEARCHING = 'searching',
  COMPLETED = 'completed'
}

interface SimilaritySearchProps {
  results: AnalysisResult[];
  onSearchResults: (searchResults: AnalysisResult[]) => void;
  className?: string;
}

export const SimilaritySearch: React.FC<SimilaritySearchProps> = ({ 
  results, 
  onSearchResults, 
  className 
}) => {
  const [searchImage, setSearchImage] = useState<File | null>(null);
  const [searchImageUrl, setSearchImageUrl] = useState<string>('');
  const [similarity, setSimilarity] = useState([5]); // 相似度阈值
  const [currentStep, setCurrentStep] = useState<SearchStep>(SearchStep.UPLOAD);
  const [searchImageTags, setSearchImageTags] = useState<ClothingTags | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [searchProgress, setSearchProgress] = useState(0);
  const [searchResults, setSearchResults] = useState<AnalysisResult[]>([]);
  const [useTagSimilarity, setUseTagSimilarity] = useState(true); // 是否启用标签相似度重排序
  const [isSearchActive, setIsSearchActive] = useState(false); // 标记是否有活跃的搜索状态
  const { toast } = useToast();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      // 如果有活跃的搜索状态，询问用户是否要重置
      if (isSearchActive) {
        const shouldReset = window.confirm('当前有搜索结果，上传新图片将清除现有搜索。是否继续？');
        if (!shouldReset) {
          return;
        }
      }
      
      // 重置状态
      setSearchImage(file);
      const url = URL.createObjectURL(file);
      setSearchImageUrl(url);
      setCurrentStep(SearchStep.ANALYZING);
      setAnalysisProgress(0);
      setSearchImageTags(null);
      setSearchResults([]);
      setIsSearchActive(false);
      
      // 开始分析图片
      await analyzeUploadedImage(file);
    }
  }, [isSearchActive]);
  
  // 分析上传的图片（使用主页的完善逻辑）
  const analyzeUploadedImage = async (file: File) => {
    setCurrentStep(SearchStep.ANALYZING);
    setAnalysisProgress(10);
    
    try {
      console.log('开始分析图片:', file.name);
      
      toast({
        title: "开始分析图片",
        description: "正在识别图片中的服装特征...",
      });
      
      setAnalysisProgress(30);
      
      const result = await analyzeClothingImage(file);
      console.log('分析结果:', result);
      
      setAnalysisProgress(80);
      setSearchImageTags(result.tags);
      setCurrentStep(SearchStep.ANALYZED);
      setAnalysisProgress(100);
      
      toast({
        title: "图片分析完成",
        description: `${file.name} 分析成功`,
      });
    } catch (error) {
      console.error(`分析图片失败: ${file.name}`, error);
      let errorMessage = error.message || '未知错误';
      
      // 检查是否是QPS限制错误，如果是则进行重试
      const isQpsError = errorMessage.includes('qps too high') || 
                        errorMessage.includes('720711011') || 
                        errorMessage.includes('Pro call plugin qps too high');
      
      if (isQpsError) {
        // QPS限制错误，尝试重试
        let retrySuccess = false;
        for (let retry = 1; retry <= 3; retry++) {
          try {
            const waitTime = 3000 * retry; // 3秒、6秒、9秒
            console.log(`QPS限制重试 ${retry}/3，等待 ${waitTime}ms...`);
            toast({
              title: "QPS限制重试",
              description: `${file.name} 遇到频率限制，${waitTime/1000}秒后重试 (${retry}/3)`,
            });
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            const result = await analyzeClothingImage(file);
            setSearchImageTags(result.tags);
            setCurrentStep(SearchStep.ANALYZED);
            setAnalysisProgress(100);
            retrySuccess = true;
            
            toast({
              title: "重试成功",
              description: `${file.name} 重试分析成功`,
            });
            return; // 重试成功，直接返回
          } catch (retryError) {
            console.error(`重试 ${retry} 失败:`, retryError);
            if (retry === 3) {
              errorMessage = `重试 3 次后仍然失败: ${retryError.message}`;
            }
          }
        }
        
        if (retrySuccess) {
          return; // 重试成功，不执行下面的错误处理
        }
      }
      
      // 如果是数据库相关错误，提供更详细的信息
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('network')) {
        errorMessage = '网络连接失败，请检查网络设置';
      } else if (errorMessage.includes('database')) {
        errorMessage = '数据库连接失败，结果已保存到本地历史记录';
      }
      
      setCurrentStep(SearchStep.UPLOAD);
      setAnalysisProgress(0);
      
      toast({
        title: "分析失败",
        description: `${file.name} 分析失败: ${errorMessage}`,
        variant: "destructive",
      });
    }
  };


  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.bmp', '.webp']
    },
    multiple: false,
    disabled: currentStep === SearchStep.ANALYZING || currentStep === SearchStep.SEARCHING
  });

  const removeSearchImage = () => {
    setSearchImage(null);
    setSearchImageUrl('');
    setSearchImageTags(null);
    setCurrentStep(SearchStep.UPLOAD);
    setSearchResults([]);
    setIsSearchActive(false);
    if (searchImageUrl) {
      URL.revokeObjectURL(searchImageUrl);
    }
  };
  
  // 开始相似度搜索
  const startSimilaritySearch = async () => {
    if (!searchImage || !searchImageTags || results.length === 0) {
      toast({
        title: "搜索失败",
        description: "请确保已上传并分析图片，且有可搜索的数据",
        variant: "destructive"
      });
      return;
    }

    setCurrentStep(SearchStep.SEARCHING);
    setSearchProgress(0);
    setIsSearchActive(true);
    
    try {
      toast({
        title: "开始相似度搜索",
        description: "正在进行向量匹配和标签相似度分析...",
      });
      
      setSearchProgress(20);
      
      // 准备目标图片数据
      const targetImages = results.map((result, index) => ({
        id: `result_${index}`,
        imageUrl: result.imageUrl
      }));
      
      setSearchProgress(40);
      
      // 第一步：向量匹配计算图片相似度（带进度回调）
      const similarityResults = await calculateBatchSimilarity(
        searchImageUrl, 
        targetImages,
        (current, total) => {
          // 将相似度计算进度映射到40%-60%
          const progress = 40 + Math.floor((current / total) * 20);
          setSearchProgress(progress);
        }
      );
      
      setSearchProgress(60);
      
      // 将相似度结果合并到原始结果中
      let searchResults = results
        .map((result, index) => {
          const similarityResult = similarityResults.find(sr => sr.id === `result_${index}`);
          return {
            ...result,
            similarity: similarityResult?.similarity || 0
          };
        });
      
      setSearchProgress(80);
      
      // 第二步：标签相似度重排序（可选）
      if (useTagSimilarity) {
        searchResults = searchResults.map(result => {
          const tagSimilarity = calculateTagSimilarity(searchImageTags, result.tags);
          // 综合评分：图片相似度 * 0.6 + 标签相似度 * 0.4（标签相似度需要转换为0-1小数）
          const combinedScore = result.similarity * 0.6 + (tagSimilarity / 100) * 0.4;
          return {
            ...result,
            tagSimilarity,
            combinedScore
          };
        });
        
        // 基于综合相似度进行阈值过滤
        searchResults = searchResults.filter(result => {
          const score = (result as any).combinedScore || result.similarity;
          return score >= similarity[0] / 100;
        });
        
        // 按综合评分从高到低排序
        searchResults.sort((a, b) => {
          const scoreA = (a as any).combinedScore || a.similarity;
          const scoreB = (b as any).combinedScore || b.similarity;
          return scoreB - scoreA;
        });
      } else {
        // 基于图片相似度进行阈值过滤
        searchResults = searchResults.filter(result => result.similarity >= similarity[0] / 100);
        
        // 仅按图片相似度排序
        searchResults.sort((a, b) => b.similarity - a.similarity);
      }
      
      setSearchProgress(100);
      setSearchResults(searchResults);
      setCurrentStep(SearchStep.COMPLETED);
      onSearchResults(searchResults);
      
      const maxScore = searchResults.length > 0 ? Math.max(...searchResults.map(r => r.combinedScore || r.similarity)) : 0;
      // 将小数形式的相似度值转换为百分比显示
      const displayScore = Math.round(maxScore * 100);
      
      toast({
        title: "搜索完成",
        description: `找到 ${searchResults.length} 个相似结果，最高评分 ${displayScore}%`,
      });
    } catch (error) {
      console.error('相似度搜索失败:', error);
      setCurrentStep(SearchStep.ANALYZED);
      toast({
        title: "搜索失败",
        description: "相似度搜索过程中出现错误，请重试",
        variant: "destructive"
      });
    }
  };

  // 计算标签相似度
  const calculateTagSimilarity = (tags1: ClothingTags, tags2: ClothingTags): number => {
    // 定义重要标签的权重
    const tagWeights: Record<keyof ClothingTags, number> = {
      '样式名称': 3,
      '样式': 3,
      '颜色': 2,
      '领型': 2,
      '袖型': 2,
      '连衣裙': 2,
      '裙子': 2,
      '裤子': 2,
      '外套': 2,
      '毛衣': 2,
      '圆领': 1.5,
      'V领': 1.5,
      '高领': 1.5,
      '翻领': 1.5,
      '立领': 1.5,
      '一字领': 1.5,
      '方领': 1.5,
      '心形领': 1.5,
      '长袖': 1.5,
      '短袖': 1.5,
      '无袖': 1.5,
      '七分袖': 1.5,
      '五分袖': 1.5,
      '泡泡袖': 1.5,
      '喇叭袖': 1.5,
      '灯笼袖': 1.5,
      '棉质': 1,
      '丝麻': 1,
      '麻质': 1,
      '毛料': 1,
      '化纤': 1,
      '混纺': 1,
      '牛仔': 1,
      '皮革': 1,
      '休闲': 1,
      '正式': 1,
      '运动': 1,
      '居家': 1,
      '派对': 1,
      '度假': 1,
      '职场': 1
    };

    const tagKeys = Object.keys(tags1) as (keyof ClothingTags)[];
    let weightedMatchScore = 0;
    let totalWeight = 0;

    tagKeys.forEach(key => {
      const value1 = tags1[key]?.toLowerCase().trim();
      const value2 = tags2[key]?.toLowerCase().trim();
      const weight = tagWeights[key] || 1;
      
      if (value1 && value2 && value1 !== '未识别' && value2 !== '未识别') {
        totalWeight += weight;
        
        if (value1 === value2) {
          // 完全匹配
          weightedMatchScore += weight;
        } else {
          // 部分匹配检查（包含关系）
          if (value1.includes(value2) || value2.includes(value1)) {
            weightedMatchScore += weight * 0.6;
          }
          // 同义词匹配（可以扩展）
          else if (
            (value1.includes('黑') && value2.includes('黑')) ||
            (value1.includes('白') && value2.includes('白')) ||
            (value1.includes('红') && value2.includes('红')) ||
            (value1.includes('蓝') && value2.includes('蓝'))
          ) {
            weightedMatchScore += weight * 0.4;
          }
        }
      }
    });

    return totalWeight > 0 ? (weightedMatchScore / totalWeight) * 100 : 0;
  };

  // 分析搜索图片的标签
  const analyzeSearchImage = async (file: File): Promise<ClothingTags | null> => {
    try {
      toast({
        title: "正在分析搜索图片",
        description: "AI正在识别图片中的服装标签...",
      });
      
      const result = await analyzeClothingImage(file);
      
      if (result.isError || !result.tags) {
        toast({
          title: "图片分析失败",
          description: "无法识别搜索图片的标签，将仅使用图片相似度排序",
          variant: "destructive"
        });
        return null;
      }
      
      return result.tags;
    } catch (error) {
      console.error('分析搜索图片失败:', error);
      toast({
        title: "图片分析失败",
        description: "分析过程中出现错误，将仅使用图片相似度排序",
        variant: "destructive"
      });
      return null;
    }
  };





  const handleClearSearch = () => {
    onSearchResults(results); // 恢复所有结果
    removeSearchImage();
    toast({
      title: "已清除搜索",
      description: "已恢复显示所有结果",
    });
  };

  const renderStepIndicator = () => {
    const steps = [
      { key: SearchStep.UPLOAD, label: '上传图片', icon: Upload },
      { key: SearchStep.ANALYZING, label: '分析图片', icon: Loader2 },
      { key: SearchStep.ANALYZED, label: '分析完成', icon: CheckCircle },
      { key: SearchStep.SEARCHING, label: '搜索匹配', icon: Search },
      { key: SearchStep.COMPLETED, label: '搜索完成', icon: CheckCircle }
    ];

    return (
      <div className="flex items-center justify-between mb-6">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === step.key;
          const isCompleted = steps.findIndex(s => s.key === currentStep) > index;
          const isAnalyzing = currentStep === SearchStep.ANALYZING && step.key === SearchStep.ANALYZING;
          const isSearching = currentStep === SearchStep.SEARCHING && step.key === SearchStep.SEARCHING;
          
          return (
            <div key={step.key} className="flex flex-col items-center space-y-1">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors',
                isActive || isCompleted 
                  ? 'border-fashion-primary bg-fashion-primary text-white' 
                  : 'border-muted-foreground/25 text-muted-foreground'
              )}>
                <Icon className={cn(
                  'h-4 w-4',
                  (isAnalyzing || isSearching) && 'animate-spin'
                )} />
              </div>
              <span className={cn(
                'text-xs text-center',
                isActive || isCompleted ? 'text-fashion-primary font-medium' : 'text-muted-foreground'
              )}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <ErrorBoundary>
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ImageIcon className="h-5 w-5" />
            <span>智能相似度搜索</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
        {/* 步骤指示器 */}
        {renderStepIndicator()}

        {/* 步骤1: 上传图片 */}
        {currentStep === SearchStep.UPLOAD && (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-medium">上传参考图片</h3>
              <p className="text-sm text-muted-foreground">
                上传一张服装图片，系统将为您找到相似的款式
              </p>
            </div>
            
            <div
              {...getRootProps()}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                isDragActive ? 'border-fashion-primary bg-fashion-light' : 'border-muted-foreground/25',
                (currentStep === SearchStep.ANALYZING || currentStep === SearchStep.SEARCHING) && 'pointer-events-none opacity-50'
              )}
            >
              <input {...getInputProps()} />
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">
                {isDragActive ? '释放图片到这里' : '拖拽图片到这里'}
              </p>
              <p className="text-sm text-muted-foreground">
                或点击选择文件 • 支持 JPG、PNG 格式
              </p>
            </div>
          </div>
        )}

        {/* 步骤2: 分析中 */}
        {currentStep === SearchStep.ANALYZING && (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-medium">正在分析图片</h3>
              <p className="text-sm text-muted-foreground">
                AI正在识别图片中的服装特征和标签...
              </p>
            </div>
            
            <div className="relative">
              <img
                src={searchImageUrl}
                alt="分析中的图片"
                className="w-full h-64 object-contain rounded-lg bg-gray-50"
              />
              <div className="absolute inset-0 bg-black/20 rounded-lg flex items-center justify-center">
                <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 flex items-center space-x-3">
                  <Loader2 className="h-5 w-5 animate-spin text-fashion-primary" />
                  <span className="text-sm font-medium">分析中...</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>分析进度</span>
                <span>{analysisProgress}%</span>
              </div>
              <Progress value={analysisProgress} className="h-2" />
            </div>
          </div>
        )}

        {/* 步骤3: 分析完成，准备搜索 */}
        {currentStep === SearchStep.ANALYZED && (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-medium flex items-center justify-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span>分析完成</span>
              </h3>
              <p className="text-sm text-muted-foreground">
                图片分析成功，现在可以开始搜索相似的服装
              </p>
            </div>
            
            <div className="relative">
              <img
                src={searchImageUrl}
                alt="已分析的图片"
                className="w-full h-64 object-contain rounded-lg bg-gray-50"
              />
              <Button
                variant="destructive"
                size="sm"
                onClick={removeSearchImage}
                className="absolute top-2 right-2 h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* 分析结果展示 */}
            {searchImageTags && (
              <div className="bg-fashion-light/50 rounded-lg p-4 space-y-2">
                <h4 className="text-sm font-medium flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>识别到的标签</span>
                </h4>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(searchImageTags).map(([key, value]) => (
                    value && (
                      <Badge key={key} variant="secondary" className="text-xs">
                        {value}
                      </Badge>
                    )
                  ))}
                </div>
              </div>
            )}

            {/* 搜索选项 */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="useTagSimilarity"
                  checked={useTagSimilarity}
                  onChange={(e) => setUseTagSimilarity(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="useTagSimilarity" className="text-sm">
                  启用标签相似度重排序
                </Label>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">相似度阈值</Label>
                  <Badge variant="outline">{similarity[0]}%</Badge>
                </div>
                <Slider
                  value={similarity}
                  onValueChange={setSimilarity}
                  max={100}
                  min={0}
                  step={5}
                  className="w-full"
                />
              </div>
            </div>

            <Button
              onClick={startSimilaritySearch}
              disabled={results.length === 0}
              className="w-full"
              size="lg"
            >
              <Search className="h-4 w-4 mr-2" />
              开始搜索 ({results.length} 张图片)
            </Button>
          </div>
        )}

        {/* 步骤4: 搜索中 */}
        {currentStep === SearchStep.SEARCHING && (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-medium">正在搜索匹配</h3>
              <p className="text-sm text-muted-foreground">
                正在数据库中进行向量匹配和标签相似度分析...
              </p>
            </div>
            
            <div className="relative">
              <img
                src={searchImageUrl}
                alt="搜索中的图片"
                className="w-full h-64 object-contain rounded-lg bg-gray-50"
              />
              <div className="absolute inset-0 bg-black/20 rounded-lg flex items-center justify-center">
                <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 flex items-center space-x-3">
                  <Search className="h-5 w-5 animate-pulse text-fashion-primary" />
                  <span className="text-sm font-medium">搜索中...</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>搜索进度</span>
                <span>{searchProgress}%</span>
              </div>
              <Progress value={searchProgress} className="h-2" />
            </div>
          </div>
        )}

        {/* 步骤5: 搜索完成 */}
        {currentStep === SearchStep.COMPLETED && (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-medium flex items-center justify-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span>搜索完成</span>
              </h3>
              <p className="text-sm text-muted-foreground">
                找到 {searchResults.length} 个相似结果，已按评分排序
              </p>
            </div>
            
            <div className="relative">
              <img
                src={searchImageUrl}
                alt="搜索完成的图片"
                className="w-full h-48 object-contain rounded-lg bg-gray-50"
              />
              <Button
                variant="destructive"
                size="sm"
                onClick={removeSearchImage}
                className="absolute top-2 right-2 h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>

            {/* 搜索结果统计 */}
            <div className="bg-fashion-light/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">搜索结果</span>
                <Badge variant="secondary">{searchResults.length} 个匹配</Badge>
              </div>
              {searchResults.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  最高评分: {Math.round(Math.max(...searchResults.map(r => 
                    useTagSimilarity && (r as any).combinedScore 
                      ? (r as any).combinedScore 
                      : r.similarity
                  )) * 100)}%
                </div>
              )}
            </div>

            {/* 搜索选项调整 */}
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="useTagSimilarityCompleted"
                  checked={useTagSimilarity}
                  onChange={(e) => setUseTagSimilarity(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="useTagSimilarityCompleted" className="text-sm">
                  启用标签相似度重排序
                </Label>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">相似度阈值</Label>
                  <Badge variant="outline">{similarity[0]}%</Badge>
                </div>
                <Slider
                  value={similarity}
                  onValueChange={setSimilarity}
                  max={100}
                  min={0}
                  step={5}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  调整阈值后点击"重新搜索"以应用新的筛选条件
                </p>
              </div>
            </div>

            <div className="flex space-x-2">
              <Button
                onClick={startSimilaritySearch}
                variant="default"
                className="flex-1"
              >
                <Search className="h-4 w-4 mr-2" />
                重新搜索
              </Button>
              <Button
                onClick={() => {
                  removeSearchImage();
                  onSearchResults(results);
                }}
                variant="outline"
                className="flex-1"
              >
                清除搜索
              </Button>
            </div>
          </div>
        )}

        {/* 底部提示信息 */}
        {currentStep === SearchStep.UPLOAD && (
          <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
            <p>• 系统将分析图片的颜色、纹理、形状等特征</p>
            <p>• 支持向量匹配和标签相似度双重排序</p>
            <p>• 结果将以卡片形式展示，附带详细评分</p>
          </div>
        )}
        </CardContent>
      </Card>
    </ErrorBoundary>
  );
};