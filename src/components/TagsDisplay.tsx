import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClothingTags } from '@/services/cozeService';
import { Edit, Save, X, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TagsDisplayProps {
  tags: ClothingTags;
  onTagsUpdate: (tags: ClothingTags) => void;
  className?: string;
}

export const TagsDisplay: React.FC<TagsDisplayProps> = ({ 
  tags, 
  onTagsUpdate, 
  className 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTags, setEditedTags] = useState<ClothingTags>(tags);

  const handleSave = () => {
    onTagsUpdate(editedTags);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedTags(tags);
    setIsEditing(false);
  };

  const handleInputChange = (key: keyof ClothingTags, value: string) => {
    setEditedTags(prev => ({ ...prev, [key]: value }));
  };

  const getTagColor = (key: string, value: string) => {
    if (value === '未识别') return 'secondary';
    
    switch (key) {
      case '样式名称':
      case '风格':
        return 'default';
      case '颜色':
      case '色调':
        return 'default';
      case '领':
      case '袖':
        return 'default';
      case '版型':
      case '长度':
        return 'default';
      case '面料':
      case '图案':
        return 'default';
      case '工艺':
      case '场合':
        return 'default';
      case '季节':
        return 'default';
      default:
        return 'secondary';
    }
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center space-x-2">
          <Tag className="h-5 w-5 text-fashion-primary" />
          <CardTitle className="text-lg">服装标签</CardTitle>
        </div>
        <div className="flex space-x-2">
          {!isEditing ? (
            <Button 
              variant="fashionOutline" 
              size="sm" 
              onClick={() => setIsEditing(true)}
            >
              <Edit className="h-4 w-4 mr-1" />
              编辑
            </Button>
          ) : (
            <>
              <Button 
                variant="fashion" 
                size="sm" 
                onClick={handleSave}
              >
                <Save className="h-4 w-4 mr-1" />
                保存
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCancel}
              >
                <X className="h-4 w-4 mr-1" />
                取消
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(tags).map(([key, value]) => (
            <div key={key} className="space-y-2">
              <Label className="text-sm font-medium text-fashion-dark">
                {key}
              </Label>
              {isEditing ? (
                <Input
                  value={editedTags[key as keyof ClothingTags]}
                  onChange={(e) => handleInputChange(key as keyof ClothingTags, e.target.value)}
                  className="h-8"
                  placeholder={`请输入${key}`}
                />
              ) : (
                <Badge 
                  variant={getTagColor(key, value) as any}
                  className="px-3 py-1 text-xs font-medium"
                >
                  {value}
                </Badge>
              )}
            </div>
          ))}
        </div>
        
        {!isEditing && (
          <div className="mt-6 pt-4 border-t border-border">
            <h4 className="text-sm font-medium text-fashion-dark mb-3">
              快速标签
            </h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(tags)
                .filter(([, value]) => value !== '未识别')
                .map(([key, value]) => (
                  <Badge 
                    key={`${key}-${value}`} 
                    variant="outline" 
                    className="border-fashion-primary/30 text-fashion-primary hover:bg-fashion-primary hover:text-white cursor-pointer transition-colors"
                  >
                    {value}
                  </Badge>
                ))
              }
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};