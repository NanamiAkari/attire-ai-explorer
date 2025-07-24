import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AnalysisResult, retryAnalysis } from '@/services/cozeService';
import { TagEditor } from './TagEditor';
import { Eye, Clock, Target, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ImageGridProps {
  results: AnalysisResult[];
  onResultUpdate?: (index: number, result: AnalysisResult) => void;
  onTagUpdate?: (index: number, newTags: any) => void;
  onDelete?: (index: number) => void;
  className?: string;
}

export const ImageGrid: React.FC<ImageGridProps> = ({ 
  results, 
  onResultUpdate, 
  onTagUpdate,
  onDelete,
  className 
}) => {
  const [selectedResult, setSelectedResult] = useState<AnalysisResult | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [retryingIndex, setRetryingIndex] = useState<number>(-1);
  const { toast } = useToast();

  const handleTagsUpdate = (tags: any) => {
    if (selectedResult && selectedIndex >= 0) {
      const updatedResult = { ...selectedResult, tags };
      
      // 调用相应的回调函数
      if (onResultUpdate) {
        onResultUpdate(selectedIndex, updatedResult);
      }
      if (onTagUpdate) {
        onTagUpdate(selectedIndex, tags);
      }
      
      setSelectedResult(updatedResult);
    }
  };

  const handleRetry = async (index: number, result: AnalysisResult) => {
    if (!result.isError) return;
    
    setRetryingIndex(index);
    try {
      const newResult = await retryAnalysis(result);
      onUpdate?.(index, newResult);
      
      if (newResult.isError) {
        toast({
          title: "重试失败",
          description: newResult.error || "分析仍然失败，请稍后再试",
          variant: "destructive",
        });
      } else {
        toast({
          title: "重试成功",
          description: "图片分析已完成",
        });
      }
    } catch (error) {
      console.error('重试失败:', error);
      toast({
        title: "重试失败",
        description: "网络错误，请稍后再试",
        variant: "destructive",
      });
    } finally {
      setRetryingIndex(-1);
    }
  };

  if (results.length === 0) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto bg-fashion-light rounded-full flex items-center justify-center">
              <Target className="h-8 w-8 text-fashion-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              还没有分析结果
            </h3>
            <p className="text-muted-foreground">
              上传服装图片开始AI识别分析
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {results.map((result, index) => (
          <Card 
            key={index} 
            className="group hover:shadow-lg hover:shadow-fashion-primary/20 transition-all duration-300 ease-in-out hover:-translate-y-1 border-0 shadow-md"
          >
            <CardContent className="p-4">
              {/* 图片 - 方形缩略图，悬停缩放效果 */}
              <div className="aspect-square rounded-lg overflow-hidden bg-fashion-light mb-3 relative group">
                <img
                  src={result.imageUrl}
                  alt={`分析结果 ${index + 1}`}
                  className={cn(
                    "w-full h-full object-cover transition-all duration-300 ease-in-out group-hover:scale-110 group-hover:brightness-105",
                    result.isError && "opacity-75"
                  )}
                  loading="lazy"
                />
                {result.isError && (
                  <div className="absolute inset-0 bg-red-500 bg-opacity-10 rounded-lg" />
                )}
                {/* 悬停时的遮罩效果 */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-300 ease-in-out" />
                {result.isError && (
                  <div className="absolute top-2 right-2">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  </div>
                )}
              </div>

              {/* 基本信息 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center space-x-2 flex-wrap">
                    {/* 相似度徽章 - 绿色，仅在有真实相似度数据时显示 */}
                    {result.similarity !== undefined && result.similarity > 0 && (
                      <Badge 
                        variant="outline" 
                        className="border-green-500 text-green-600 bg-green-50 hover:bg-green-100 transition-colors font-medium"
                      >
                        相似度 {Math.round(result.similarity)}%
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Clock className="h-3 w-3 mr-1" />
                    {result.analysisTime}ms
                  </div>
                </div>

                {/* 主要标签或错误信息 */}
                <div className="space-y-2">
                  {result.isError ? (
                    <div className="flex items-center gap-2 text-sm text-red-600">
                      <AlertCircle className="h-4 w-4" />
                      <span>{result.error || '分析失败'}</span>
                    </div>
                  ) : (
                    <>
                      <div className="text-sm font-medium text-foreground">
                        {result.tags.样式名称 || result.tags.样式 || '未识别'}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {[
                          { label: '颜色', value: result.tags.颜色 },
                          { label: '领型', value: result.tags.领型 },
                          { label: '袖型', value: result.tags.袖型 }
                        ]
                          .filter(item => item.value && item.value !== '未识别')
                          .map((item, tagIndex) => (
                            <Badge 
                              key={tagIndex} 
                              variant="secondary" 
                              className="text-xs"
                            >
                              {item.label}: {item.value}
                            </Badge>
                          ))
                        }
                      </div>
                    </>
                  )}
                </div>

                {/* 查看详情按钮或重试按钮 */}
                {result.isError ? (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full border-red-500 text-red-600 hover:bg-red-50"
                    onClick={() => handleRetry(index, result)}
                    disabled={retryingIndex === index}
                  >
                    {retryingIndex === index ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    {retryingIndex === index ? '重试中...' : '重试分析'}
                  </Button>
                ) : (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        variant="fashion" 
                        size="sm" 
                        className="w-full"
                        onClick={() => {
                          setSelectedResult(result);
                          setSelectedIndex(index);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        查看详情
                      </Button>
                    </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="flex items-center space-x-2">
                        <Target className="h-5 w-5 text-fashion-primary" />
                        <span>服装识别详情</span>
                      </DialogTitle>
                    </DialogHeader>
                    
                    {/* 删除按钮单独放置，与关闭按钮分离 */}
                    {onDelete && (
                      <div className="flex justify-end mb-4">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            onDelete(selectedIndex);
                            // 关闭弹窗的逻辑会由Dialog组件自动处理
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          删除记录
                        </Button>
                      </div>
                    )}
                    
                    {selectedResult && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* 图片展示 */}
                        <div className="space-y-4">
                          <div className="aspect-square rounded-lg overflow-hidden bg-fashion-light">
                            <img
                              src={selectedResult.imageUrl}
                              alt="分析图片"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          
                          {/* 分析信息 */}
                          <div className="flex items-center justify-between p-4 bg-fashion-light rounded-lg">
                            <div className="flex items-center space-x-2 flex-wrap">
                              {/* 详情页面的相似度徽章 - 绿色，只在有真实数据时显示 */}
                              {selectedResult.similarity !== undefined && selectedResult.similarity > 0 && (
                                <Badge 
                                  variant="outline" 
                                  className="border-green-500 text-green-600 bg-green-50 font-medium"
                                >
                                  相似度 {Math.round(selectedResult.similarity)}%
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center text-sm text-muted-foreground">
                              <Clock className="h-4 w-4 mr-1" />
                              分析耗时 {selectedResult.analysisTime}ms
                            </div>
                          </div>
                        </div>

                        {/* 标签详情 */}
                        <div>
                          <TagEditor
                            tags={selectedResult.tags}
                            onTagsUpdate={handleTagsUpdate}
                          />
                        </div>
                      </div>
                    )}
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};