import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Search, Filter, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchFilters {
  searchText: string;
  tags: string[];
  style: string[];
  color: string[];
  tone?: string[];
  season: string[];
  collar: string[];
  sleeve: string[];
  fit: string[];
  length?: string[];
  fabric: string[];
  pattern?: string[];
  craft?: string[];
  fashionStyle?: string[];
  occasion: string[];
}

interface SearchFiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  className?: string;
}

export const SearchFilters: React.FC<SearchFiltersProps> = ({
  filters,
  onFiltersChange,
  className
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const commonStyles = [
    '连衣裙', '衬衫', 'T恤', '外套', '裤子', '裙子', '套装', '背心', '毛衣', '牛仔裤',
    '短裤', '长裤', '半身裙', '长裙', '短裙', '西装', '风衣', '羽绒服', '针织衫', '卫衣'
  ];
  const commonColors = [
    '黑色', '白色', '蓝色', '红色', '灰色', '粉色', '绿色', '黄色', '紫色', '棕色',
    '橙色', '米色', '卡其色', '深蓝', '浅蓝', '深灰', '浅灰', '酒红', '墨绿', '天蓝'
  ];
  const commonTones = [
    '深色调', '浅色调', '中性色调', '暖色调', '冷色调', '明亮色调', '柔和色调', '对比色调'
  ];
  const commonSeasons = [
    '春季', '夏季', '秋季', '冬季', '四季'
  ];
  const commonCollars = [
    '圆领', 'V领', '立领', '翻领', '一字领', '高领', '无领', '方领', '心形领', '荷叶领'
  ];
  const commonSleeves = [
    '长袖', '短袖', '七分袖', '无袖', '五分袖', '九分袖', '泡泡袖', '喇叭袖', '灯笼袖'
  ];
  const commonFits = [
    '修身', '宽松', '直筒', '紧身', '标准', '收腰', 'A字型', 'H型', 'X型', 'O型'
  ];
  const commonLengths = [
    '短款', '中长款', '长款', '超长款', '迷你', '及膝', '及踝', '拖地'
  ];
  const commonFabrics = [
    '棉质', '丝绸', '羊毛', '聚酯纤维', '亚麻', '雪纺', '牛仔', '针织', '皮革', '绒面',
    '蕾丝', '纱质', '毛呢', '天鹅绒', '麻质', '混纺', '涤纶', '尼龙', '氨纶', '莫代尔'
  ];
  const commonPatterns = [
    '纯色', '条纹', '格子', '印花', '刺绣', '蕾丝', '几何图案', '波点', '碎花', '动物纹',
    '抽象图案', '字母印花', '数字印花', '卡通图案', '民族图案', '复古图案'
  ];
  const commonCrafts = [
    '简约', '精工', '手工', '机织', '针织', '刺绣工艺', '印染工艺', '拼接工艺', '褶皱工艺', '镂空工艺'
  ];
  const commonOccasions = [
    '休闲', '正式', '商务', '聚会', '运动', '居家', '约会', '旅行', '工作', '度假',
    '晚宴', '婚礼', '派对', '日常', '通勤', '户外', '海滩', '购物'
  ];
  const commonStylesFashion = [
    '简约', '复古', '时尚', '甜美', '帅气', '优雅', '休闲', '朋克', '波西米亚', '田园',
    '街头', '学院', '欧美', '韩式', '日系', '中式', '民族', '前卫'
  ];

  const handleSearchTextChange = (value: string) => {
    onFiltersChange({ ...filters, searchText: value });
  };

  const toggleFilter = (category: keyof SearchFilters, value: string) => {
    if (category === 'searchText') return;
    
    const currentValues = filters[category] as string[];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    
    onFiltersChange({ ...filters, [category]: newValues });
  };

  const clearAllFilters = () => {
    onFiltersChange({
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
  };

  const handleSearch = () => {
    // 触发搜索，这里可以添加额外的搜索逻辑
    // 目前搜索是实时的，这个按钮主要用于用户体验
  };

  const hasActiveFilters = filters.searchText || 
    filters.tags.length > 0 || 
    filters.style.length > 0 || 
    filters.color.length > 0 || 
    (filters.tone?.length || 0) > 0 ||
    filters.season.length > 0 ||
    filters.collar.length > 0 ||
    filters.sleeve.length > 0 ||
    filters.fit.length > 0 ||
    (filters.length?.length || 0) > 0 ||
    filters.fabric.length > 0 ||
    (filters.pattern?.length || 0) > 0 ||
    (filters.craft?.length || 0) > 0 ||
    (filters.fashionStyle?.length || 0) > 0 ||
    filters.occasion.length > 0;

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Search className="h-5 w-5 text-fashion-primary" />
            <CardTitle className="text-lg">搜索与筛选</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            {hasActiveFilters && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={clearAllFilters}
                className="text-muted-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                清除
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <Filter className="h-4 w-4 mr-1" />
              {isExpanded ? '收起' : '展开'}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* 文本搜索 */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">文本搜索</Label>
          <div className="flex space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索服装描述、品牌、标签..."
                value={filters.searchText}
                onChange={(e) => handleSearchTextChange(e.target.value)}
                className="pl-10"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button 
              onClick={handleSearch}
              className="bg-fashion-primary hover:bg-fashion-primary/90"
            >
              <Search className="h-4 w-4 mr-1" />
              搜索
            </Button>
          </div>
        </div>

        {/* 筛选条件 */}
        {isExpanded && (
          <div className="space-y-4">
            {/* 样式筛选 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">样式</Label>
              <div className="flex flex-wrap gap-2">
                {commonStyles.map((style) => (
                  <Badge
                    key={style}
                    variant={filters.style.includes(style) ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer transition-colors",
                      filters.style.includes(style)
                        ? "bg-fashion-primary text-white"
                        : "hover:bg-fashion-light"
                    )}
                    onClick={() => toggleFilter('style', style)}
                  >
                    {style}
                  </Badge>
                ))}
              </div>
            </div>

            {/* 颜色筛选 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">颜色</Label>
              <div className="flex flex-wrap gap-2">
                {commonColors.map((color) => (
                  <Badge
                    key={color}
                    variant={filters.color.includes(color) ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer transition-colors",
                      filters.color.includes(color)
                        ? "bg-fashion-primary text-white"
                        : "hover:bg-fashion-light"
                    )}
                    onClick={() => toggleFilter('color', color)}
                  >
                    {color}
                  </Badge>
                ))}
              </div>
            </div>

            {/* 色调筛选 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">色调</Label>
              <div className="flex flex-wrap gap-2">
                {commonTones.map((tone) => (
                  <Badge
                    key={tone}
                    variant={filters.tone?.includes(tone) ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer transition-colors",
                      filters.tone?.includes(tone)
                        ? "bg-indigo-500 text-white"
                        : "hover:bg-fashion-light"
                    )}
                    onClick={() => toggleFilter('tone', tone)}
                  >
                    {tone}
                  </Badge>
                ))}
              </div>
            </div>

            {/* 季节筛选 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">季节</Label>
              <div className="flex flex-wrap gap-2">
                {commonSeasons.map((season) => (
                  <Badge
                    key={season}
                    variant={filters.season.includes(season) ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer transition-colors",
                      filters.season.includes(season)
                        ? "bg-fashion-primary text-white"
                        : "hover:bg-fashion-light"
                    )}
                    onClick={() => toggleFilter('season', season)}
                  >
                    {season}
                  </Badge>
                ))}
              </div>
            </div>

            {/* 领型筛选 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">领型</Label>
              <div className="flex flex-wrap gap-2">
                {commonCollars.map((collar) => (
                  <Badge
                    key={collar}
                    variant={filters.collar.includes(collar) ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer transition-colors",
                      filters.collar.includes(collar)
                        ? "bg-fashion-primary text-white"
                        : "hover:bg-fashion-light"
                    )}
                    onClick={() => toggleFilter('collar', collar)}
                  >
                    {collar}
                  </Badge>
                ))}
              </div>
            </div>

            {/* 袖型筛选 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">袖型</Label>
              <div className="flex flex-wrap gap-2">
                {commonSleeves.map((sleeve) => (
                  <Badge
                    key={sleeve}
                    variant={filters.sleeve.includes(sleeve) ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer transition-colors",
                      filters.sleeve.includes(sleeve)
                        ? "bg-fashion-primary text-white"
                        : "hover:bg-fashion-light"
                    )}
                    onClick={() => toggleFilter('sleeve', sleeve)}
                  >
                    {sleeve}
                  </Badge>
                ))}
              </div>
            </div>

            {/* 版型筛选 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">版型</Label>
              <div className="flex flex-wrap gap-2">
                {commonFits.map((fit) => (
                  <Badge
                    key={fit}
                    variant={filters.fit.includes(fit) ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer transition-colors",
                      filters.fit.includes(fit)
                        ? "bg-fashion-primary text-white"
                        : "hover:bg-fashion-light"
                    )}
                    onClick={() => toggleFilter('fit', fit)}
                  >
                    {fit}
                  </Badge>
                ))}
              </div>
            </div>

            {/* 长度筛选 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">长度</Label>
              <div className="flex flex-wrap gap-2">
                {commonLengths.map((length) => (
                  <Badge
                    key={length}
                    variant={filters.length?.includes(length) ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer transition-colors",
                      filters.length?.includes(length)
                        ? "bg-teal-500 text-white"
                        : "hover:bg-fashion-light"
                    )}
                    onClick={() => toggleFilter('length', length)}
                  >
                    {length}
                  </Badge>
                ))}
              </div>
            </div>

            {/* 面料筛选 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">面料</Label>
              <div className="flex flex-wrap gap-2">
                {commonFabrics.map((fabric) => (
                  <Badge
                    key={fabric}
                    variant={filters.fabric.includes(fabric) ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer transition-colors",
                      filters.fabric.includes(fabric)
                        ? "bg-fashion-primary text-white"
                        : "hover:bg-fashion-light"
                    )}
                    onClick={() => toggleFilter('fabric', fabric)}
                  >
                    {fabric}
                  </Badge>
                ))}
              </div>
            </div>

            {/* 图案筛选 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">图案</Label>
              <div className="flex flex-wrap gap-2">
                {commonPatterns.map((pattern) => (
                  <Badge
                    key={pattern}
                    variant={filters.pattern?.includes(pattern) ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer transition-colors",
                      filters.pattern?.includes(pattern)
                        ? "bg-cyan-500 text-white"
                        : "hover:bg-fashion-light"
                    )}
                    onClick={() => toggleFilter('pattern', pattern)}
                  >
                    {pattern}
                  </Badge>
                ))}
              </div>
            </div>

            {/* 工艺筛选 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">工艺</Label>
              <div className="flex flex-wrap gap-2">
                {commonCrafts.map((craft) => (
                  <Badge
                    key={craft}
                    variant={filters.craft?.includes(craft) ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer transition-colors",
                      filters.craft?.includes(craft)
                        ? "bg-amber-500 text-white"
                        : "hover:bg-fashion-light"
                    )}
                    onClick={() => toggleFilter('craft', craft)}
                  >
                    {craft}
                  </Badge>
                ))}
              </div>
            </div>

            {/* 风格筛选 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">风格</Label>
              <div className="flex flex-wrap gap-2">
                {commonStylesFashion.map((fashionStyle) => (
                  <Badge
                    key={fashionStyle}
                    variant={filters.fashionStyle?.includes(fashionStyle) ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer transition-colors",
                      filters.fashionStyle?.includes(fashionStyle)
                        ? "bg-rose-500 text-white"
                        : "hover:bg-fashion-light"
                    )}
                    onClick={() => toggleFilter('fashionStyle', fashionStyle)}
                  >
                    {fashionStyle}
                  </Badge>
                ))}
              </div>
            </div>

            {/* 场合筛选 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">场合</Label>
              <div className="flex flex-wrap gap-2">
                {commonOccasions.map((occasion) => (
                  <Badge
                    key={occasion}
                    variant={filters.occasion.includes(occasion) ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer transition-colors",
                      filters.occasion.includes(occasion)
                        ? "bg-fashion-primary text-white"
                        : "hover:bg-fashion-light"
                    )}
                    onClick={() => toggleFilter('occasion', occasion)}
                  >
                    {occasion}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 活动筛选标签 */}
        {hasActiveFilters && (
          <div className="pt-3 border-t border-border">
            <Label className="text-sm font-medium mb-2 block">当前筛选</Label>
            <div className="flex flex-wrap gap-2">
              {filters.style.map((style) => (
                <Badge
                  key={`style-${style}`}
                  variant="default"
                  className="bg-fashion-primary text-white"
                >
                  {style}
                  <X 
                    className="h-3 w-3 ml-1 cursor-pointer" 
                    onClick={() => toggleFilter('style', style)}
                  />
                </Badge>
              ))}
              {filters.color.map((color) => (
                <Badge
                  key={`color-${color}`}
                  variant="default"
                  className="bg-fashion-secondary text-white"
                >
                  {color}
                  <X 
                    className="h-3 w-3 ml-1 cursor-pointer" 
                    onClick={() => toggleFilter('color', color)}
                  />
                </Badge>
              ))}
              {filters.season.map((season) => (
                <Badge
                  key={`season-${season}`}
                  variant="default"
                  className="bg-fashion-accent text-white"
                >
                  {season}
                  <X 
                    className="h-3 w-3 ml-1 cursor-pointer" 
                    onClick={() => toggleFilter('season', season)}
                  />
                </Badge>
              ))}
              {filters.collar.map((collar) => (
                <Badge
                  key={`collar-${collar}`}
                  variant="default"
                  className="bg-blue-500 text-white"
                >
                  {collar}
                  <X 
                    className="h-3 w-3 ml-1 cursor-pointer" 
                    onClick={() => toggleFilter('collar', collar)}
                  />
                </Badge>
              ))}
              {filters.sleeve.map((sleeve) => (
                <Badge
                  key={`sleeve-${sleeve}`}
                  variant="default"
                  className="bg-green-500 text-white"
                >
                  {sleeve}
                  <X 
                    className="h-3 w-3 ml-1 cursor-pointer" 
                    onClick={() => toggleFilter('sleeve', sleeve)}
                  />
                </Badge>
              ))}
              {filters.fit.map((fit) => (
                <Badge
                  key={`fit-${fit}`}
                  variant="default"
                  className="bg-purple-500 text-white"
                >
                  {fit}
                  <X 
                    className="h-3 w-3 ml-1 cursor-pointer" 
                    onClick={() => toggleFilter('fit', fit)}
                  />
                </Badge>
              ))}
              {filters.fabric.map((fabric) => (
                <Badge
                  key={`fabric-${fabric}`}
                  variant="default"
                  className="bg-orange-500 text-white"
                >
                  {fabric}
                  <X 
                    className="h-3 w-3 ml-1 cursor-pointer" 
                    onClick={() => toggleFilter('fabric', fabric)}
                  />
                </Badge>
              ))}
              {filters.occasion.map((occasion) => (
                <Badge
                  key={`occasion-${occasion}`}
                  variant="default"
                  className="bg-pink-500 text-white"
                >
                  {occasion}
                  <X 
                    className="h-3 w-3 ml-1 cursor-pointer" 
                    onClick={() => toggleFilter('occasion', occasion)}
                  />
                </Badge>
              ))}
              {filters.tone?.map((tone) => (
                <Badge
                  key={`tone-${tone}`}
                  variant="default"
                  className="bg-indigo-500 text-white"
                >
                  {tone}
                  <X 
                    className="h-3 w-3 ml-1 cursor-pointer" 
                    onClick={() => toggleFilter('tone', tone)}
                  />
                </Badge>
              ))}
              {filters.length?.map((length) => (
                <Badge
                  key={`length-${length}`}
                  variant="default"
                  className="bg-teal-500 text-white"
                >
                  {length}
                  <X 
                    className="h-3 w-3 ml-1 cursor-pointer" 
                    onClick={() => toggleFilter('length', length)}
                  />
                </Badge>
              ))}
              {filters.pattern?.map((pattern) => (
                <Badge
                  key={`pattern-${pattern}`}
                  variant="default"
                  className="bg-cyan-500 text-white"
                >
                  {pattern}
                  <X 
                    className="h-3 w-3 ml-1 cursor-pointer" 
                    onClick={() => toggleFilter('pattern', pattern)}
                  />
                </Badge>
              ))}
              {filters.craft?.map((craft) => (
                <Badge
                  key={`craft-${craft}`}
                  variant="default"
                  className="bg-amber-500 text-white"
                >
                  {craft}
                  <X 
                    className="h-3 w-3 ml-1 cursor-pointer" 
                    onClick={() => toggleFilter('craft', craft)}
                  />
                </Badge>
              ))}
              {filters.fashionStyle?.map((fashionStyle) => (
                <Badge
                  key={`fashionStyle-${fashionStyle}`}
                  variant="default"
                  className="bg-rose-500 text-white"
                >
                  {fashionStyle}
                  <X 
                    className="h-3 w-3 ml-1 cursor-pointer" 
                    onClick={() => toggleFilter('fashionStyle', fashionStyle)}
                  />
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};