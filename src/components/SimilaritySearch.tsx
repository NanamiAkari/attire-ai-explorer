import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { AnalysisResult } from '@/services/cozeService';
import { calculateBatchSimilarity } from '@/services/similarityService';
import { Search, Upload, X, Image as ImageIcon, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

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
  const [similarity, setSimilarity] = useState([70]); // 相似度阈值
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setSearchImage(file);
      const url = URL.createObjectURL(file);
      setSearchImageUrl(url);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    multiple: false
  });

  const removeSearchImage = () => {
    if (searchImageUrl) {
      URL.revokeObjectURL(searchImageUrl);
    }
    setSearchImage(null);
    setSearchImageUrl('');
  };



  const handleSimilaritySearch = async () => {
    if (!searchImage || results.length === 0) {
      toast({
        title: "搜索失败",
        description: "请先上传搜索图片，并确保有分析结果",
        variant: "destructive"
      });
      return;
    }

    setIsSearching(true);
    
    try {
      toast({
        title: "开始相似度分析",
        description: "正在提取图片特征并计算相似度...",
      });
      
      // 准备目标图片数据
      const targetImages = results.map((result, index) => ({
        id: `result_${index}`,
        imageUrl: result.imageUrl
      }));
      
      // 使用真实的相似度计算服务
      const similarityResults = await calculateBatchSimilarity(searchImageUrl, targetImages);
      
      // 将相似度结果合并到原始结果中，并按相似度从高到低排序
      const searchResults = results
        .map((result, index) => {
          const similarityResult = similarityResults.find(sr => sr.id === `result_${index}`);
          return {
            ...result,
            similarity: similarityResult?.similarity || 0
          };
        })
        .filter(result => result.similarity >= similarity[0]) // 过滤低于阈值的结果
        .sort((a, b) => b.similarity - a.similarity); // 按相似度从高到低排序
      
      onSearchResults(searchResults);
      
      const maxSimilarity = searchResults.length > 0 ? Math.max(...searchResults.map(r => r.similarity)) : 0;
      
      toast({
        title: "相似度搜索完成",
        description: searchResults.length > 0 
          ? `找到 ${searchResults.length} 个相似结果，最高相似度 ${Math.round(maxSimilarity)}%`
          : `未找到相似度超过 ${similarity[0]}% 的结果，请降低阈值重试`,
        variant: searchResults.length > 0 ? "default" : "destructive"
      });
    } catch (error) {
      console.error('相似度搜索失败:', error);
      toast({
        title: "搜索失败",
        description: "相似度搜索过程中出现错误，请重试",
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
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

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <ImageIcon className="h-5 w-5" />
          <span>图片相似度搜索</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 上传搜索图片 */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">上传参考图片</Label>
          
          {!searchImage ? (
            <div
              {...getRootProps()}
              className={cn(
                'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors',
                isDragActive ? 'border-fashion-primary bg-fashion-light' : 'border-muted-foreground/25'
              )}
            >
              <input {...getInputProps()} />
              <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {isDragActive
                  ? '释放图片到这里...'
                  : '拖拽图片到这里，或点击选择'}
              </p>
            </div>
          ) : (
            <div className="relative">
              <img
                src={searchImageUrl}
                alt="搜索图片"
                className="w-full h-32 object-cover rounded-lg"
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
          )}
        </div>

        {/* 相似度阈值设置 */}
        <div className="space-y-3">
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
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        {/* 搜索按钮 */}
        <div className="flex space-x-2">
          <Button
            onClick={handleSimilaritySearch}
            disabled={!searchImage || isSearching || results.length === 0}
            className="flex-1"
          >
            {isSearching ? (
              <>
                <Zap className="h-4 w-4 mr-2 animate-pulse" />
                搜索中...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                开始搜索
              </>
            )}
          </Button>
          
          <Button
            variant="outline"
            onClick={handleClearSearch}
            disabled={isSearching}
          >
            清除搜索
          </Button>
        </div>

        {/* 搜索提示和统计信息 */}
        <div className="space-y-3">
          {results.length > 0 && (
            <div className="flex items-center justify-between p-3 bg-fashion-light rounded-lg">
              <div className="text-sm text-muted-foreground">
                当前有 <span className="font-medium text-foreground">{results.length}</span> 张图片可供搜索
              </div>
              <Badge variant="secondary" className="text-xs">
                阈值 ≥ {similarity[0]}%
              </Badge>
            </div>
          )}
          
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• 上传一张参考图片，系统将使用AI技术找到相似的服装</p>
            <p>• 调整相似度阈值来控制搜索精度，结果将按相似度从高到低排序</p>
            <p>• 系统会分析颜色、纹理、形状等特征进行匹配</p>
            <p>• 相似度越高，搜索结果越精确</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};