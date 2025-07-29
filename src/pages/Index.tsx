import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ImageUpload } from '@/components/ImageUpload';
import { BatchUpload } from '@/components/BatchUpload';
import { SearchFilters, SearchFilters as SearchFiltersType } from '@/components/SearchFilters';
import { SimilaritySearch } from '@/components/SimilaritySearch';
import { ImageGrid } from '@/components/ImageGrid';
import { Instructions } from '@/components/Instructions';
import { TestMode } from '@/components/TestMode';
import { analyzeClothingImage, AnalysisResult, analyzeBatchImagesWithDeduplication } from '@/services/cozeService';
import { 
  loadAnalysisResults, 
  saveAnalysisResults, 
  clearAnalysisResults,
  addAnalysisResult,
  updateAnalysisResult as updateStoredResult
} from '@/services/storageService';
import { 
  getAnalysisHistory, 
  searchAnalysisRecords,
  saveAnalysisToDatabase,
  saveBatchAnalysisToDatabase,
  updateAnalysisRecord,
  ClothingAnalysisRecord 
} from '@/services/databaseService';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Upload, Search, Grid, Loader2, History, Database, Image as ImageIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const Index = () => {
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [filteredResults, setFilteredResults] = useState<AnalysisResult[]>([]);
  const [databaseResults, setDatabaseResults] = useState<ClothingAnalysisRecord[]>([]);
  const [filteredDatabaseResults, setFilteredDatabaseResults] = useState<ClothingAnalysisRecord[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchSource, setSearchSource] = useState<'local' | 'database'>('local');
  const [isLoadingDatabase, setIsLoadingDatabase] = useState(false);
  const [showAllResults, setShowAllResults] = useState(false);
  const [hasSimilaritySearchResults, setHasSimilaritySearchResults] = useState(false);
  const [filters, setFilters] = useState<SearchFiltersType>({
    searchText: '',
    tags: [],
    style: [],
    color: [],
    tone: [],
    season: [],
    collar: [],
    sleeve: [],
    fit: [],
    length: [],
    fabric: [],
    pattern: [],
    craft: [],
    fashionStyle: [],
    occasion: []
  });
  const { toast } = useToast();

  // 组件加载时从本地存储恢复数据并检查数据库连接
  useEffect(() => {
    const loadStoredData = async () => {
      try {
        const savedResults = loadAnalysisResults();
        setResults(savedResults);
        console.log('已加载本地存储的分析结果:', savedResults.length);
      } catch (error) {
        console.error('加载本地存储数据失败:', error);
      }
    };

    const checkDatabaseConnection = async () => {
      try {
        const { checkDatabaseConnection } = await import('../services/databaseService');
    const isConnected = await checkDatabaseConnection();
        if (!isConnected) {
          toast({
            title: "数据库连接异常",
            description: "无法连接到数据库，分析结果将保存到本地历史记录",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('数据库连接检查失败:', error);
      }
    };

    loadStoredData();
    checkDatabaseConnection();
  }, [toast]);

  // 加载数据库记录
  const loadDatabaseRecords = async () => {
    setIsLoadingDatabase(true);
    try {
      const records = await getAnalysisHistory();
      setDatabaseResults(records);
      toast({
        title: "数据库记录加载成功",
        description: `加载了 ${records.length} 条记录`,
      });
    } catch (error) {
      console.error('加载数据库记录失败:', error);
      toast({
        title: "加载失败",
        description: "无法加载数据库记录，请检查网络连接",
        variant: "destructive",
      });
    } finally {
      setIsLoadingDatabase(false);
    }
  };

  // 当搜索源切换到数据库时，自动加载数据库记录
  useEffect(() => {
    if (searchSource === 'database' && databaseResults.length === 0) {
      loadDatabaseRecords();
    }
  }, [searchSource]);

  // 当results变化时保存到本地存储
  useEffect(() => {
    if (results.length > 0) {
      saveAnalysisResults(results).catch(error => {
        console.error('保存分析结果到本地存储失败:', error);
      });
    }
  }, [results]);

  // 当results或filters变化时更新filteredResults
  useEffect(() => {
    if (searchSource === 'local') {
      let filtered = results;
      
      // 文本搜索
      if (filters.searchText.trim()) {
        const searchLower = filters.searchText.toLowerCase();
        filtered = filtered.filter(result => 
          Object.values(result.tags).some(tag => 
            tag.toLowerCase().includes(searchLower)
          )
        );
      }
      
      // 样式筛选
      if (filters.style.length > 0) {
        filtered = filtered.filter(result => 
          filters.style.includes(result.tags.样式名称)
        );
      }
      
      // 颜色筛选
      if (filters.color.length > 0) {
        filtered = filtered.filter(result => 
          filters.color.includes(result.tags.颜色)
        );
      }
      
      // 色调筛选
      if (filters.tone && filters.tone.length > 0) {
        filtered = filtered.filter(result => 
          filters.tone.includes(result.tags.色调)
        );
      }
      
      // 季节筛选 - 包含四季通用的逻辑
      if (filters.season.length > 0) {
        filtered = filtered.filter(result => {
          const itemSeason = result.tags.季节;
          // 如果物品是四季通用，则在任何季节筛选中都显示
          if (itemSeason === '四季通用') {
            return true;
          }
          // 如果筛选条件包含四季通用，则显示所有物品
          if (filters.season.includes('四季通用')) {
            return true;
          }
          // 否则按正常季节匹配
          return filters.season.includes(itemSeason);
        });
      }
      
      // 领型筛选
      if (filters.collar.length > 0) {
        filtered = filtered.filter(result => 
          filters.collar.includes(result.tags.领)
        );
      }
      
      // 袖型筛选
      if (filters.sleeve.length > 0) {
        filtered = filtered.filter(result => 
          filters.sleeve.includes(result.tags.袖)
        );
      }
      
      // 版型筛选
      if (filters.fit.length > 0) {
        filtered = filtered.filter(result => 
          filters.fit.includes(result.tags.版型)
        );
      }
      
      // 长度筛选
      if (filters.length && filters.length.length > 0) {
        filtered = filtered.filter(result => 
          filters.length.includes(result.tags.长度)
        );
      }
      
      // 面料筛选
      if (filters.fabric.length > 0) {
        filtered = filtered.filter(result => 
          filters.fabric.includes(result.tags.面料)
        );
      }
      
      // 图案筛选
      if (filters.pattern && filters.pattern.length > 0) {
        filtered = filtered.filter(result => 
          filters.pattern.includes(result.tags.图案)
        );
      }
      
      // 工艺筛选
      if (filters.craft && filters.craft.length > 0) {
        filtered = filtered.filter(result => 
          filters.craft.includes(result.tags.工艺)
        );
      }
      
      // 风格筛选
      if (filters.fashionStyle && filters.fashionStyle.length > 0) {
        filtered = filtered.filter(result => 
          filters.fashionStyle.includes(result.tags.风格)
        );
      }
      
      // 场合筛选
      if (filters.occasion.length > 0) {
        filtered = filtered.filter(result => 
          filters.occasion.includes(result.tags.场合)
        );
      }
      
      setFilteredResults(filtered);
    }
  }, [results, filters, searchSource]);

  // 当databaseResults或filters变化时更新filteredDatabaseResults
  useEffect(() => {
    if (searchSource === 'database' && !hasSimilaritySearchResults) {
      let filtered = databaseResults;
      
      // 文本搜索
      if (filters.searchText.trim()) {
        const searchLower = filters.searchText.toLowerCase();
        filtered = filtered.filter(record => 
          record.image_name.toLowerCase().includes(searchLower) ||
          Object.values(record.tags).some(tag => 
            typeof tag === 'string' && tag.toLowerCase().includes(searchLower)
          )
        );
      }
      
      // 样式筛选
      if (filters.style.length > 0) {
        filtered = filtered.filter(record => 
          filters.style.includes(record.tags.样式名称)
        );
      }
      
      // 颜色筛选
      if (filters.color.length > 0) {
        filtered = filtered.filter(record => 
          filters.color.includes(record.tags.颜色)
        );
      }
      
      // 色调筛选
      if (filters.tone && filters.tone.length > 0) {
        filtered = filtered.filter(record => 
          filters.tone.includes(record.tags.色调)
        );
      }
      
      // 季节筛选
      if (filters.season.length > 0) {
        filtered = filtered.filter(record => {
          const itemSeason = record.tags.季节;
          if (itemSeason === '四季通用') {
            return true;
          }
          if (filters.season.includes('四季通用')) {
            return true;
          }
          return filters.season.includes(itemSeason);
        });
      }
      
      // 其他筛选条件...
      if (filters.collar.length > 0) {
        filtered = filtered.filter(record => 
          filters.collar.includes(record.tags.领)
        );
      }
      
      if (filters.sleeve.length > 0) {
        filtered = filtered.filter(record => 
          filters.sleeve.includes(record.tags.袖)
        );
      }
      
      if (filters.fit.length > 0) {
        filtered = filtered.filter(record => 
          filters.fit.includes(record.tags.版型)
        );
      }
      
      if (filters.fabric.length > 0) {
        filtered = filtered.filter(record => 
          filters.fabric.includes(record.tags.面料)
        );
      }
      
      // 长度筛选
      if (filters.length && filters.length.length > 0) {
        filtered = filtered.filter(record => 
          filters.length.includes(record.tags.长度)
        );
      }
      
      // 图案筛选
      if (filters.pattern && filters.pattern.length > 0) {
        filtered = filtered.filter(record => 
          filters.pattern.includes(record.tags.图案)
        );
      }
      
      // 工艺筛选
      if (filters.craft && filters.craft.length > 0) {
        filtered = filtered.filter(record => 
          filters.craft.includes(record.tags.工艺)
        );
      }
      
      // 风格筛选
      if (filters.fashionStyle && filters.fashionStyle.length > 0) {
        filtered = filtered.filter(record => 
          filters.fashionStyle.includes(record.tags.风格)
        );
      }
      
      if (filters.occasion.length > 0) {
        filtered = filtered.filter(record => 
          filters.occasion.includes(record.tags.场合)
        );
      }
      
      setFilteredDatabaseResults(filtered);
    }
  }, [databaseResults, filters, searchSource, hasSimilaritySearchResults]);

  const handleSimilaritySearchResults = (searchResults: AnalysisResult[]) => {
    if (searchSource === 'local') {
      setFilteredResults(searchResults);
      setHasSimilaritySearchResults(searchResults.length > 0);
    } else {
      // 将AnalysisResult转换为ClothingAnalysisRecord格式，保留相似度信息
      const databaseSearchResults = searchResults.map(result => {
        // 查找对应的数据库记录
        const dbRecord = databaseResults.find(record => record.image_url === result.imageUrl);
        const baseRecord = dbRecord || {
          id: Math.random().toString(),
          image_name: 'similarity_result',
          image_url: result.imageUrl,
          tags: result.tags,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        // 添加相似度信息到记录中
        return {
          ...baseRecord,
          similarity: result.similarity,
          combinedScore: (result as any).combinedScore,
          tagSimilarity: (result as any).tagSimilarity
        };
      });
      setFilteredDatabaseResults(databaseSearchResults);
      setHasSimilaritySearchResults(searchResults.length > 0);
    }
  };

  // 清除搜索结果
  const handleClearSearchResults = () => {
    if (searchSource === 'local') {
      setFilteredResults(results);
    } else {
      setFilteredDatabaseResults(databaseResults);
    }
    setHasSimilaritySearchResults(false);
    toast({
      title: "已清除搜索结果",
      description: "已恢复显示所有结果",
    });
  };

  const handleImageUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    setIsAnalyzing(true);
    toast({
      title: "开始分析",
      description: `正在分析 ${files.length} 张图片...`,
    });

    try {
      for (const file of files) {
        try {
          console.log('开始分析图片:', file.name);
          const result = await analyzeClothingImage(file);
          console.log('分析结果:', result);
          setResults(prev => [...prev, result]);
          
          toast({
            title: "分析完成",
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
                setResults(prev => [...prev, result]);
                retrySuccess = true;
                
                toast({
                  title: "重试成功",
                  description: `${file.name} 重试分析成功`,
                });
                break;
              } catch (retryError) {
                console.error(`重试 ${retry} 失败:`, retryError);
                if (retry === 3) {
                  errorMessage = `重试 3 次后仍然失败: ${retryError.message}`;
                }
              }
            }
            
            if (retrySuccess) {
              continue; // 重试成功，继续下一个文件
            }
          }
          
          // 如果是数据库相关错误，提供更详细的信息
          if (errorMessage.includes('Failed to fetch') || errorMessage.includes('network')) {
            errorMessage = '网络连接失败，请检查网络设置';
          } else if (errorMessage.includes('database')) {
            errorMessage = '数据库连接失败，结果已保存到本地历史记录';
          }
          
          toast({
            title: "分析失败",
            description: `${file.name} 分析失败: ${errorMessage}`,
            variant: "destructive",
          });
        }
      }
    } finally {
      setIsAnalyzing(false);
    }
  }, [toast]);

  const handleBatchUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    setIsAnalyzing(true);
    
    try {
      console.log(`开始批量分析 ${files.length} 张图片，启用查重功能...`);
      
      // 使用新的带查重功能的批量分析函数
      const results = await analyzeBatchImagesWithDeduplication(
        files,
        (current, total, fileName, isDuplicate) => {
          // 更新进度提示
          const statusText = isDuplicate ? '跳过重复' : '分析中';
          toast({
            title: "分析进度",
            description: `${statusText}: ${fileName} (${current}/${total})`,
          });
        }
      );
      
      // 统计结果
      const newAnalysisCount = results.filter(r => !r.isError && r.analysisTime > 0).length;
      const duplicateCount = results.filter(r => !r.isError && r.analysisTime === 0).length;
      const errorCount = results.filter(r => r.isError).length;
      
      // 批量更新结果
      if (results.length > 0) {
        setResults(prev => [...prev, ...results]);
        
        // 批量保存成功分析的结果到数据库（只保存新分析的结果）
        const newResults = results.filter(r => !r.isError && r.analysisTime > 0);
        if (newResults.length > 0) {
          try {
            console.log(`开始批量保存 ${newResults.length} 条新分析结果到数据库...`);
            
            // 准备批量保存的数据
            const batchData = newResults
              .map(result => {
                const correspondingFile = files.find(f => f.name === result.fileName);
                if (correspondingFile) {
                  return { result, file: correspondingFile };
                } else {
                  console.warn('未找到对应的文件对象:', result.fileName);
                  return null;
                }
              })
              .filter(Boolean) as { result: AnalysisResult; file: File }[];
            
            // 使用优化的批量保存函数
            await saveBatchAnalysisToDatabase(batchData);
            
            console.log('批量保存到数据库完成');
          } catch (dbError) {
            console.warn('批量保存到数据库失败:', dbError);
          }
        }
        
        // 显示完成提示
        let description = `处理完成: 新分析 ${newAnalysisCount} 张`;
        if (duplicateCount > 0) {
          description += `，跳过重复 ${duplicateCount} 张`;
        }
        if (errorCount > 0) {
          description += `，失败 ${errorCount} 张`;
        }
        
        toast({
          title: "批量分析完成",
          description,
        });
      }
      
      if (errorCount === files.length) {
        throw new Error("所有图片分析失败");
      }
      
    } catch (error) {
      console.error('批量分析过程出错:', error);
      if (!error.message?.includes("所有图片分析失败")) {
        toast({
          title: "批量分析失败",
          description: "批量分析过程中出现错误，请重试",
          variant: "destructive",
        });
      }
      throw error; // 重新抛出错误以便BatchUpload组件处理
    } finally {
      setIsAnalyzing(false);
    }
  }, [toast]);

  const handleResultUpdate = (index: number, updatedResult: AnalysisResult) => {
    setResults(prev => {
      const newResults = prev.map((result, i) => i === index ? updatedResult : result);
      // 异步更新本地存储
      updateStoredResult(index, updatedResult).catch(error => {
        console.error('更新本地存储失败:', error);
      });
      return newResults;
    });
  };

  const handleClearResults = () => {
    setResults([]);
    clearAnalysisResults();
    toast({
      title: "已清空",
      description: "所有分析结果已清空",
    });
  };

  // 将数据库记录转换为AnalysisResult格式
  const convertDatabaseRecordToAnalysisResult = (record: ClothingAnalysisRecord): AnalysisResult => {
    return {
      id: record.id,
      imageUrl: record.image_url,
      imageName: record.image_name,
      tags: record.tags,
      confidence: record.confidence || 0, // 移除假置信度数据
      analysisTime: record.analysis_time || 0,
      createdAt: record.created_at,
      fileSize: record.file_size || 0,
      // 保留相似度信息
      similarity: (record as any).similarity,
      combinedScore: (record as any).combinedScore,
      tagSimilarity: (record as any).tagSimilarity
    };
  };

  // 处理数据库记录的标签更新
  const handleDatabaseTagUpdate = async (record: ClothingAnalysisRecord, updatedTags: any) => {
    if (!record.id) {
      toast({
        title: "更新失败",
        description: "记录ID无效",
        variant: "destructive",
      });
      return;
    }

    try {
      // 调用数据库更新API
      const updatedRecord = await updateAnalysisRecord(record.id, {
        tags: updatedTags,
        updated_at: new Date().toISOString()
      });

      if (updatedRecord) {
        // 更新本地状态
        setDatabaseResults(prev => 
          prev.map(r => r.id === record.id ? { ...r, tags: updatedTags } : r)
        );
        
        toast({
          title: "标签已更新",
          description: "数据库记录标签更新成功",
        });
      } else {
        throw new Error('更新失败');
      }
    } catch (error) {
      console.error('更新数据库记录标签失败:', error);
      toast({
        title: "更新失败",
        description: "无法更新数据库记录，请检查网络连接",
        variant: "destructive",
      });
    }
  };

  // 处理数据库记录的删除
  const handleDatabaseDelete = async (record: ClothingAnalysisRecord) => {
    // 这里可以添加删除数据库记录的逻辑
    console.log('删除数据库记录:', record.id);
    setDatabaseResults(prev => prev.filter(r => r.id !== record.id));
    toast({
      title: "记录已删除",
      description: "数据库记录删除成功",
    });
  };



  return (
    <div className="min-h-screen bg-gradient-to-br from-fashion-light via-background to-fashion-light/30">
      {/* 头部 */}
      <div className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-gradient-to-r from-fashion-primary to-fashion-secondary">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-fashion-primary to-fashion-secondary bg-clip-text text-transparent">
                  AI服装识别系统
                </h1>
                <p className="text-sm text-muted-foreground">
                  智能识别服装属性，生成结构化标签
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                onClick={() => window.location.href = '/history'}
                className="flex items-center space-x-2"
              >
                <History className="h-4 w-4" />
                <span>历史记录</span>
              </Button>
              <Button 
                variant="outline" 
                onClick={() => window.location.href = '/database'}
                className="flex items-center space-x-2"
              >
                <Database className="h-4 w-4" />
                <span>数据库</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 主要内容 */}
      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="instructions" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-[500px]">
            <TabsTrigger value="instructions" className="flex items-center space-x-2">
              <Sparkles className="h-4 w-4" />
              <span>使用说明</span>
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center space-x-2">
              <Upload className="h-4 w-4" />
              <span>上传分析</span>
            </TabsTrigger>
            <TabsTrigger value="search" className="flex items-center space-x-2">
              <Search className="h-4 w-4" />
              <span>智能搜索</span>
            </TabsTrigger>
            <TabsTrigger value="test" className="flex items-center space-x-2">
              <Grid className="h-4 w-4" />
              <span>测试模式</span>
            </TabsTrigger>
          </TabsList>

          {/* 使用说明页面 */}
          <TabsContent value="instructions">
            <Instructions />
          </TabsContent>

          {/* 上传分析页面 */}
          <TabsContent value="upload" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Upload className="h-5 w-5 text-fashion-primary" />
                  <span>图片上传与AI分析</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ImageUpload 
                    onImageUpload={handleImageUpload}
                    isAnalyzing={isAnalyzing}
                  />
                  <BatchUpload 
                    onBatchUpload={handleBatchUpload}
                    isAnalyzing={isAnalyzing}
                  />
                </div>
                
                {isAnalyzing && (
                  <div className="mt-6 flex items-center justify-center space-x-3 p-6 bg-fashion-light rounded-lg">
                    <Loader2 className="h-6 w-6 animate-spin text-fashion-primary" />
                    <span className="text-lg font-medium text-fashion-dark">
                      AI正在分析图片...
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 最近分析结果 */}
            {results.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>最新分析结果</CardTitle>
                </CardHeader>
                <CardContent>
                  <ImageGrid
                    results={showAllResults ? results.slice().reverse() : results.slice(-4).reverse()} // 按时间倒序显示
                    onResultUpdate={handleResultUpdate}
                  />
                  {results.length > 4 && (
                    <div className="mt-4 text-center">
                      <Button 
                        variant="fashionOutline"
                        onClick={() => setShowAllResults(!showAllResults)}
                      >
                        {showAllResults ? '收起结果' : '查看更多'}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* 智能搜索页面 - 合并搜索筛选和相似搜索 */}
          <TabsContent value="search" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
              {/* 左侧：搜索控制面板 */}
              <div className="lg:col-span-1 overflow-y-auto pr-2 space-y-6 search-scrollbar">
                {/* 数据源切换 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Database className="h-5 w-5 text-fashion-primary" />
                      <span>数据源选择</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <Button
                        variant={searchSource === 'local' ? 'default' : 'outline'}
                        className="w-full justify-start"
                        onClick={() => {
                          setSearchSource('local');
                        }}
                      >
                        本地结果 ({results.length})
                      </Button>
                      <Button
                        variant={searchSource === 'database' ? 'default' : 'outline'}
                        className="w-full justify-start"
                        onClick={() => {
                          setSearchSource('database');
                        }}
                        disabled={isLoadingDatabase}
                      >
                        {isLoadingDatabase ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            加载中...
                          </>
                        ) : (
                          `数据库记录 (${databaseResults.length})`
                        )}
                      </Button>
                      {searchSource === 'database' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={loadDatabaseRecords}
                          disabled={isLoadingDatabase}
                        >
                          刷新数据库
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* 搜索筛选 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Search className="h-5 w-5 text-fashion-primary" />
                      <span>条件筛选</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <SearchFilters 
                      filters={filters} 
                      onFiltersChange={(newFilters) => {
                        setFilters(newFilters);
                      }}
                      results={searchSource === 'local' ? results : databaseResults.map(record => ({
                        id: record.id,
                        imageUrl: record.image_url,
                        tags: record.tags,
                        timestamp: new Date(record.created_at).getTime()
                      }))}
                    />
                  </CardContent>
                </Card>

                {/* 相似搜索 */}
                <SimilaritySearch 
                  results={searchSource === 'local' ? filteredResults : filteredDatabaseResults.map(record => ({
                    imageUrl: record.image_url,
                    tags: record.tags,
                    confidence: 0,
                    analysisTime: 0
                  }))}
                  onSearchResults={handleSimilaritySearchResults}
                />
              </div>
              
              {/* 右侧：搜索结果展示 */}
              <div className="lg:col-span-2 overflow-y-auto pl-2 custom-scrollbar">
                {(searchSource === 'local' ? filteredResults.length > 0 : filteredDatabaseResults.length > 0) ? (
                  <Card className="h-full">
                    <CardHeader className="sticky top-0 bg-white z-10 border-b">
                      <div className="flex items-center justify-between">
                        <CardTitle>
                          {searchSource === 'local' ? (
                            `搜索结果 (${filteredResults.length})`
                          ) : (
                            `数据库搜索结果 (${filteredDatabaseResults.length})`
                          )}
                        </CardTitle>
                        {hasSimilaritySearchResults && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleClearSearchResults}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-4 w-4 mr-1" />
                            清除搜索结果
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pb-6">
                      {searchSource === 'local' ? (
                        <ImageGrid
                          results={filteredResults}
                          onResultUpdate={handleResultUpdate}
                        />
                      ) : (
                        <ImageGrid
                          results={filteredDatabaseResults.map(convertDatabaseRecordToAnalysisResult)}
                          onTagUpdate={(index, updatedTags) => {
                            const record = filteredDatabaseResults[index];
                            if (record) {
                              handleDatabaseTagUpdate(record, updatedTags);
                            }
                          }}
                          onDelete={(index) => {
                            const record = filteredDatabaseResults[index];
                            if (record) {
                              handleDatabaseDelete(record);
                            }
                          }}
                        />
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="h-full flex items-center justify-center">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <div className="text-center space-y-3">
                        <div className="w-16 h-16 mx-auto bg-fashion-light rounded-full flex items-center justify-center">
                          <Search className="h-8 w-8 text-fashion-primary" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">
                          开始智能搜索
                        </h3>
                        <p className="text-muted-foreground max-w-md">
                          {searchSource === 'local' 
                            ? results.length === 0 
                              ? '请先上传图片进行分析，然后使用左侧的筛选条件或相似搜索功能'
                              : '使用左侧的筛选条件缩小搜索范围，或上传参考图片进行相似搜索'
                            : databaseResults.length === 0
                              ? '数据库中暂无记录，请切换到本地结果或等待数据库加载'
                              : '使用左侧的筛选条件缩小搜索范围，或上传参考图片进行相似搜索'
                          }
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>



          {/* 测试模式页面 */}
          <TabsContent value="test" className="space-y-6">
            <TestMode />
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
};

export default Index;
