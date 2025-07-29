import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AnalysisResult, retryAnalysis } from '@/services/cozeService';
import { ClothingAnalysisRecord } from '@/config/postgresql';
import { TagEditor } from './TagEditor';
import { Eye, Clock, Target, Trash2, Database, RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface MultiSelectDatabaseGridProps {
  records: ClothingAnalysisRecord[];
  onDelete?: (id: string) => void;
  className?: string;
  isMultiSelectMode?: boolean;
  selectedRecords?: Set<string>;
  onToggleSelection?: (recordId: string) => void;
}

export const MultiSelectDatabaseGrid: React.FC<MultiSelectDatabaseGridProps> = ({ 
  records, 
  onDelete,
  className,
  isMultiSelectMode = false,
  selectedRecords = new Set(),
  onToggleSelection
}) => {
  const [selectedResult, setSelectedResult] = useState<AnalysisResult | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<ClothingAnalysisRecord | null>(null);
  const [retryingIndex, setRetryingIndex] = useState<number>(-1);
  const { toast } = useToast();

  const handleRetry = async (index: number, result: AnalysisResult) => {
    if (!result.isError) return;
    
    setRetryingIndex(index);
    try {
      const newResult = await retryAnalysis(result);
      // 数据库记录的重试不需要更新父组件状态
      
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

  const convertToAnalysisResult = (record: ClothingAnalysisRecord): AnalysisResult => {
    return {
      imageUrl: record.image_url || '',
      tags: record.tags || {},
      confidence: record.confidence || 0,
      analysisTime: record.analysis_time || 0,
      fileName: record.image_name || '',
      isError: record.analysis_result?.error_status || false,
      error: record.analysis_result?.error_message,
      similarity: record.similarity
    };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  if (records.length === 0) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto bg-fashion-light rounded-full flex items-center justify-center">
              <Database className="h-8 w-8 text-fashion-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              暂无数据库记录
            </h3>
            <p className="text-muted-foreground">
              数据库中还没有保存的分析记录
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {records.map((record, index) => {
          const result = convertToAnalysisResult(record);
          const isSelected = selectedRecords.has(record.id!);
          
          return (
            <Card 
              key={record.id} 
              className={cn(
                "group hover:shadow-lg hover:shadow-fashion-primary/20 transition-all duration-300 ease-in-out hover:-translate-y-1 border-0 shadow-md",
                isSelected && isMultiSelectMode && "ring-2 ring-fashion-primary bg-fashion-light/20"
              )}
            >
              <CardContent className="p-4">
                {/* 多选模式下的勾选框 */}
                {isMultiSelectMode && (
                  <div className="absolute top-2 left-2 z-10">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelection?.(record.id!)}
                      className="bg-white border-2 shadow-sm"
                    />
                  </div>
                )}
                
                {/* 图片 - 方形缩略图，悬停缩放效果 */}
                <div 
                  className="aspect-square rounded-lg overflow-hidden bg-fashion-light mb-3 relative group cursor-pointer"
                  onClick={() => isMultiSelectMode && onToggleSelection?.(record.id!)}
                >
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
                  
                  {/* 多选模式下的选中遮罩 */}
                  {isMultiSelectMode && isSelected && (
                    <div className="absolute inset-0 bg-fashion-primary/20 border-2 border-fashion-primary rounded-lg" />
                  )}
                </div>

                {/* 基本信息 */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center space-x-2 flex-wrap">
                      {/* 文件名 */}
                      <div className="text-xs text-muted-foreground truncate max-w-[120px]">
                        {record.image_name}
                      </div>
                    </div>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 mr-1" />
                      {record.created_at ? formatDate(record.created_at) : '未知时间'}
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
                          {result.tags?.样式名称 || result.tags?.样式 || '未识别'}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {result.tags ? [
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
                            )) : null
                          }
                        </div>
                      </>
                    )}
                  </div>

                  {/* 操作按钮 */}
                  {!isMultiSelectMode && (
                    <div className="flex gap-2">
                      {/* 查看详情按钮或重试按钮 */}
                      {result.isError ? (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 border-red-500 text-red-600 hover:bg-red-50"
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
                              className="flex-1"
                              onClick={() => {
                                setSelectedResult(result);
                                setSelectedRecord(record);
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
                              <span>数据库记录详情</span>
                            </DialogTitle>
                          </DialogHeader>
                          
                          {/* 删除按钮单独放置，与关闭按钮分离 */}
                          {onDelete && (
                            <div className="flex justify-end mb-4">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  onDelete(record.id!);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                删除记录
                              </Button>
                            </div>
                          )}
                          
                          {selectedResult && selectedRecord && (
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
                                <div className="p-4 bg-fashion-light rounded-lg">
                                  <div className="space-y-2">
                                    <div className="text-sm">
                                      <span className="font-medium">文件名：</span>
                                      {selectedRecord.image_name}
                                    </div>
                                    <div className="text-sm">
                                      <span className="font-medium">文件大小：</span>
                                      {selectedRecord.image_size ? `${(selectedRecord.image_size / 1024).toFixed(1)} KB` : '未知'}
                                    </div>
                                    <div className="text-sm">
                                      <span className="font-medium">创建时间：</span>
                                      {selectedRecord.created_at ? formatDate(selectedRecord.created_at) : '未知时间'}
                                    </div>
                                    <div className="text-sm">
                                      <span className="font-medium">更新时间：</span>
                                      {selectedRecord.updated_at ? formatDate(selectedRecord.updated_at) : '未知时间'}
                                    </div>
                                    {selectedResult.confidence > 0 && (
                                      <div className="text-sm">
                                        <span className="font-medium">置信度：</span>
                                        {selectedResult.confidence}%
                                      </div>
                                    )}
                                    {selectedResult.analysisTime > 0 && (
                                      <div className="flex items-center text-sm text-muted-foreground">
                                        <Clock className="h-4 w-4 mr-1" />
                                        分析耗时 {selectedResult.analysisTime}ms
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* 标签详情 */}
                              <div>
                                <TagEditor
                                  tags={selectedResult.tags}
                                  onTagsUpdate={() => {}} // 数据库管理页面不允许编辑
                                  readOnly={true}
                                />
                              </div>
                            </div>
                          )}
                        </DialogContent>
                        </Dialog>
                      )}
                      
                      {/* 单独删除按钮 */}
                      {onDelete && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onDelete(record.id!)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};