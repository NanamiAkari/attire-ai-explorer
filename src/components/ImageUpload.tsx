import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Upload, X, Image as ImageIcon, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  onImageUpload: (files: File[]) => void;
  isAnalyzing?: boolean;
  className?: string;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ onImageUpload, isAnalyzing = false, className }) => {
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const imageFiles = acceptedFiles.filter(file => file.type.startsWith('image/'));
    setUploadedImages(prev => [...prev, ...imageFiles]);
    onImageUpload(imageFiles);
  }, [onImageUpload]);

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    multiple: true
  });

  return (
    <div className={cn('w-full space-y-4', className)}>
      <Card 
        {...getRootProps()} 
        className={cn(
          'border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-200',
          isDragActive 
            ? 'border-fashion-primary bg-fashion-light' 
            : 'border-border hover:border-fashion-primary hover:bg-fashion-light/50'
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center space-y-4">
          <div className="p-4 rounded-full bg-fashion-light">
            <Upload className="h-8 w-8 text-fashion-primary" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">
              {isDragActive ? '释放文件开始上传' : '上传服装图片'}
            </h3>
            <p className="text-muted-foreground">
              拖拽图片到此处，或点击选择文件
            </p>
            <p className="text-sm text-muted-foreground">
              支持 JPG、PNG、WebP 格式
            </p>
          </div>
          <Button variant="fashion" size="lg">
            <ImageIcon className="mr-2 h-4 w-4" />
            选择图片
          </Button>
        </div>
      </Card>

      {uploadedImages.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-foreground">已上传的图片</h4>
            <Button 
              onClick={() => onImageUpload(uploadedImages)}
              disabled={isAnalyzing}
              variant="fashion"
              size="sm"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  开始分析
                </>
              )}
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {uploadedImages.map((file, index) => (
              <div key={index} className="relative group">
                <div className="aspect-square rounded-lg overflow-hidden border border-border bg-fashion-light">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`Upload ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeImage(index)}
                  disabled={isAnalyzing}
                >
                  <X className="h-3 w-3" />
                </Button>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {file.name}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};