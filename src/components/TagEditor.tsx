import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ClothingTags } from '@/services/cozeService';
import { Edit, Save, X, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TagEditorProps {
  tags: ClothingTags;
  onTagsUpdate: (updatedTags: ClothingTags) => void;
  className?: string;
}

// 按照任务说明书图1的顺序：基础属性 -> 设计细节 -> 材质工艺 -> 功能属性
const TAG_LABELS: Record<keyof ClothingTags, string> = {
  // 基础属性
  样式名称: '样式名称',
  颜色: '颜色',
  色调: '色调',
  // 设计细节
  领: '领型',
  袖: '袖型',
  版型: '版型',
  长度: '长度',
  // 材质工艺
  面料: '面料',
  图案: '图案',
  工艺: '工艺',
  // 功能属性
  场合: '场合',
  季节: '季节',
  风格: '风格'
};

// 标签分组定义，用于更好的展示
const TAG_GROUPS = {
  基础属性: ['样式名称', '颜色', '色调'],
  设计细节: ['领', '袖', '版型', '长度'],
  材质工艺: ['面料', '图案', '工艺'],
  功能属性: ['场合', '季节', '风格']
};

export const TagEditor: React.FC<TagEditorProps> = ({ tags, onTagsUpdate, className }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTags, setEditedTags] = useState<ClothingTags>(tags);
  const [customTags, setCustomTags] = useState<Record<string, string>>({});
  const [newTagKey, setNewTagKey] = useState('');
  const [newTagValue, setNewTagValue] = useState('');
  const { toast } = useToast();

  const handleSave = () => {
    const finalTags = { ...editedTags, ...customTags };
    onTagsUpdate(finalTags as ClothingTags);
    setIsEditing(false);
    toast({
      title: "保存成功",
      description: "标签已更新",
    });
  };

  const handleCancel = () => {
    setEditedTags(tags);
    setCustomTags({});
    setIsEditing(false);
  };

  const handleTagChange = (key: keyof ClothingTags, value: string) => {
    setEditedTags(prev => ({ ...prev, [key]: value }));
  };

  const handleAddCustomTag = () => {
    if (newTagKey.trim() && newTagValue.trim()) {
      setCustomTags(prev => ({ ...prev, [newTagKey.trim()]: newTagValue.trim() }));
      setNewTagKey('');
      setNewTagValue('');
    }
  };

  const handleRemoveCustomTag = (key: string) => {
    setCustomTags(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  };

  if (!isEditing) {
    return (
      <Card className={className}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">服装标签</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="h-8 w-8 p-0"
          >
            <Edit className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 按分组展示标签 */}
          {Object.entries(TAG_GROUPS).map(([groupName, tagKeys]) => {
            const groupTags = tagKeys.filter(key => tags[key as keyof ClothingTags]);
            if (groupTags.length === 0) return null;
            
            return (
              <div key={groupName} className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">{groupName}</div>
                <div className="flex flex-wrap gap-1">
                  {groupTags.map((key) => (
                    <Badge key={key} variant="secondary" className="text-xs">
                      {TAG_LABELS[key as keyof ClothingTags]}: {tags[key as keyof ClothingTags]}
                    </Badge>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">编辑标签</CardTitle>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSave}
            className="h-8 w-8 p-0"
          >
            <Save className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 基础标签编辑 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(TAG_LABELS).map(([key, label]) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={key} className="text-xs">{label}</Label>
              <Input
                id={key}
                value={editedTags[key as keyof ClothingTags] || ''}
                onChange={(e) => handleTagChange(key as keyof ClothingTags, e.target.value)}
                className="h-8 text-xs"
                placeholder={`输入${label}`}
              />
            </div>
          ))}
        </div>

        {/* 自定义标签 */}
        {Object.keys(customTags).length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs font-medium">自定义标签</Label>
            <div className="flex flex-wrap gap-1">
              {Object.entries(customTags).map(([key, value]) => (
                <Badge key={key} variant="outline" className="text-xs flex items-center gap-1">
                  {key}: {value}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveCustomTag(key)}
                    className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* 添加自定义标签 */}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
              <Plus className="h-4 w-4 mr-1" />
              添加自定义标签
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>添加自定义标签</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="tag-key">标签名称</Label>
                <Input
                  id="tag-key"
                  value={newTagKey}
                  onChange={(e) => setNewTagKey(e.target.value)}
                  placeholder="例如：品牌、价格等"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tag-value">标签值</Label>
                <Input
                  id="tag-value"
                  value={newTagValue}
                  onChange={(e) => setNewTagValue(e.target.value)}
                  placeholder="输入标签值"
                />
              </div>
              <Button 
                onClick={handleAddCustomTag} 
                className="w-full"
                disabled={!newTagKey.trim() || !newTagValue.trim()}
              >
                添加标签
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};