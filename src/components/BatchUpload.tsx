import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Upload, X, FileImage, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface BatchUploadProps {
  onBatchUpload: (files: File[]) => Promise<void>;
  isAnalyzing: boolean;
  className?: string;
}

interface FileWithPreview extends File {
  preview: string;
  status: 'pending' | 'analyzing' | 'completed' | 'error';
  error?: string;
}

export const BatchUpload: React.FC<BatchUploadProps> = ({ 
  onBatchUpload, 
  isAnalyzing, 
  className 
}) => {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => {
      const fileWithPreview = Object.assign(file, {
        preview: URL.createObjectURL(file),
        status: 'pending' as const
      });
      return fileWithPreview;
    });
    
    setFiles(prev => [...prev, ...newFiles]);
    
    toast({
      title: "文件已添加",
      description: `已添加 ${acceptedFiles.length} 个文件到批量上传队列`,
    });
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    multiple: true,
    disabled: isAnalyzing
  });

  const removeFile = (index: number) => {
    setFiles(prev => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const clearAll = () => {
    files.forEach(file => URL.revokeObjectURL(file.preview));
    setFiles([]);
    setProgress(0);
  };

  const handleBatchUpload = async () => {
    if (files.length === 0) return;
    
    try {
      // 更新文件状态为分析中
      setFiles(prev => prev.map(file => ({ ...file, status: 'analyzing' as const })));
      
      // 模拟进度更新
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev + (100 / files.length) / 10;
          return Math.min(newProgress, 95);
        });
      }, 200);
      
      await onBatchUpload(files);
      
      clearInterval(progressInterval);
      setProgress(100);
      
      // 更新文件状态为完成
      setFiles(prev => prev.map(file => ({ ...file, status: 'completed' as const })));
      
      toast({
        title: "批量分析完成",
        description: `成功分析了 ${files.length} 张图片`,
      });
      
      // 延迟清空
      setTimeout(() => {
        clearAll();
      }, 2000);
      
    } catch (error) {
      setFiles(prev => prev.map(file => ({ 
        ...file, 
        status: 'error' as const,
        error: error instanceof Error ? error.message : '分析失败'
      })));
      
      toast({
        title: "批量分析失败",
        description: "部分或全部图片分析失败，请重试",
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = (status: FileWithPreview['status']) => {
    switch (status) {
      case 'pending':
        return <FileImage className="h-4 w-4 text-muted-foreground" />;
      case 'analyzing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <FileImage className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: FileWithPreview['status']) => {
    switch (status) {
      case 'pending':
        return 'secondary';
      case 'analyzing':
        return 'default';
      case 'completed':
        return 'default';
      case 'error':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Upload className="h-5 w-5" />
          <span>批量上传</span>
          {files.length > 0 && (
            <Badge variant="outline">{files.length} 个文件</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 拖拽上传区域 */}
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
            isDragActive ? 'border-fashion-primary bg-fashion-light' : 'border-muted-foreground/25',
            isAnalyzing && 'opacity-50 cursor-not-allowed'
          )}
        >
          <input {...getInputProps()} />
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {isDragActive
              ? '释放文件到这里...'
              : '拖拽图片到这里，或点击选择文件'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            支持 JPG、PNG、WebP 格式，可选择多个文件
          </p>
        </div>

        {/* 文件列表 */}
        {files.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">待分析文件</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                disabled={isAnalyzing}
              >
                清空全部
              </Button>
            </div>
            
            <div className="max-h-60 overflow-y-auto space-y-2">
              {files.map((file, index) => (
                <div key={index} className="flex items-center space-x-3 p-2 border rounded-lg">
                  <img
                    src={file.preview}
                    alt={file.name}
                    className="w-12 h-12 object-cover rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(file.status)}
                    <Badge variant={getStatusColor(file.status)} className="text-xs">
                      {file.status === 'pending' && '待处理'}
                      {file.status === 'analyzing' && '分析中'}
                      {file.status === 'completed' && '已完成'}
                      {file.status === 'error' && '失败'}
                    </Badge>
                    {file.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        disabled={isAnalyzing}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 进度条 */}
        {isAnalyzing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>分析进度</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex space-x-2">
          <Button
            onClick={handleBatchUpload}
            disabled={files.length === 0 || isAnalyzing}
            className="flex-1"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                分析中...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                开始批量分析
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};