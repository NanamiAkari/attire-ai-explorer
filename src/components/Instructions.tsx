import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Upload, 
  Sparkles, 
  Search, 
  Edit, 
  Info,
  CheckCircle,
  AlertCircle 
} from 'lucide-react';
import fashionHero from '@/assets/fashion-hero.jpg';

export const Instructions: React.FC = () => {
  const features = [
    {
      icon: Upload,
      title: '图片上传',
      description: '支持批量上传JPG、PNG、WebP格式的服装图片',
      status: '完成'
    },
    {
      icon: Sparkles,
      title: 'AI识别',
      description: '使用Coze工作流AI模型自动识别服装属性和特征',
      status: '演示'
    },
    {
      icon: Edit,
      title: '标签编辑',
      description: '支持手动编辑、添加、删除AI生成的标签',
      status: '完成'
    },
    {
      icon: Search,
      title: '多维搜索',
      description: '支持文本搜索和多维度标签筛选功能',
      status: '完成'
    }
  ];

  const tagCategories = [
    { name: '样式名称', example: '连衣裙、衬衫、T恤、外套' },
    { name: '颜色', example: '黑色、白色、蓝色、红色' },
    { name: '色调', example: '深色调、浅色调、暖色调' },
    { name: '领型', example: '圆领、V领、立领、翻领' },
    { name: '袖型', example: '长袖、短袖、无袖、七分袖' },
    { name: '版型', example: '修身、宽松、直筒、紧身' },
    { name: '长度', example: '短款、中长款、长款' },
    { name: '面料', example: '棉质、丝绸、羊毛、亚麻' },
    { name: '图案', example: '纯色、条纹、格子、印花' },
    { name: '工艺', example: '简约、精工、手工、机织' },
    { name: '场合', example: '休闲、正式、商务、聚会' },
    { name: '季节', example: '春季、夏季、秋季、冬季' },
    { name: '风格', example: '简约、复古、时尚、甜美' }
  ];

  return (
    <div className="space-y-6">
      {/* 英雄区域 */}
      <Card className="overflow-hidden">
        <div className="relative h-64 bg-gradient-to-r from-fashion-primary to-fashion-secondary">
          <img 
            src={fashionHero} 
            alt="Fashion Collection" 
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-fashion-primary/80 to-fashion-secondary/80 flex items-center justify-center">
            <div className="text-center text-white space-y-4">
              <h1 className="text-4xl font-bold">AI服装识别系统</h1>
              <p className="text-xl">智能识别服装属性，生成结构化标签</p>
              <div className="flex items-center justify-center space-x-6 text-sm">
                <div className="flex items-center space-x-2">
                  <Sparkles className="h-4 w-4" />
                  <span>AI识别</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Edit className="h-4 w-4" />
                  <span>标签管理</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Search className="h-4 w-4" />
                  <span>智能搜索</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
      
      {/* 系统说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Info className="h-5 w-5 text-fashion-primary" />
            <span>系统说明</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            AI服装识别系统是一个基于人工智能的服装属性识别平台，
            能够自动分析服装图片并生成结构化的标签信息，帮助用户快速管理和搜索服装数据。
          </p>
          
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>演示模式：</strong> 当前系统运行在演示模式下，使用模拟数据展示功能。
              在生产环境中将连接真实的Coze AI工作流进行服装识别。
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* 功能特点 */}
      <Card>
        <CardHeader>
          <CardTitle>功能特点</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start space-x-3 p-4 rounded-lg bg-fashion-light/50">
                <div className="p-2 rounded-lg bg-fashion-primary/10">
                  <feature.icon className="h-5 w-5 text-fashion-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h4 className="font-medium">{feature.title}</h4>
                    <Badge 
                      variant={feature.status === '完成' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {feature.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 识别标签说明 */}
      <Card>
        <CardHeader>
          <CardTitle>识别标签类别</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tagCategories.map((category, index) => (
              <div key={index} className="space-y-2">
                <h4 className="font-medium text-fashion-dark">{category.name}</h4>
                <p className="text-sm text-muted-foreground">{category.example}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 使用步骤 */}
      <Card>
        <CardHeader>
          <CardTitle>使用步骤</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              {
                step: 1,
                title: '上传图片',
                description: '在"上传分析"标签页中，拖拽或选择服装图片进行上传'
              },
              {
                step: 2,
                title: 'AI分析',
                description: '系统自动使用AI模型分析图片，生成结构化标签'
              },
              {
                step: 3,
                title: '查看结果',
                description: '在结果展示页面查看识别结果，点击"查看详情"了解完整信息'
              },
              {
                step: 4,
                title: '编辑标签',
                description: '可以手动编辑AI生成的标签，确保准确性'
              },
              {
                step: 5,
                title: '搜索筛选',
                description: '使用搜索功能和多维度筛选快速找到目标服装'
              }
            ].map((step, index) => (
              <div key={index} className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-fashion-primary text-white flex items-center justify-center text-sm font-medium">
                  {step.step}
                </div>
                <div>
                  <h4 className="font-medium mb-1">{step.title}</h4>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 技术说明 */}
      <Card>
        <CardHeader>
          <CardTitle>技术架构</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-medium">前端技术</h4>
              <div className="flex flex-wrap gap-2">
                {['React', 'TypeScript', 'Tailwind CSS', 'shadcn/ui'].map((tech) => (
                  <Badge key={tech} variant="outline">{tech}</Badge>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium">AI服务</h4>
              <div className="flex flex-wrap gap-2">
                {['Coze工作流', '计算机视觉', '自然语言处理'].map((tech) => (
                  <Badge key={tech} variant="outline">{tech}</Badge>
                ))}
              </div>
            </div>
          </div>
          
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              系统采用模块化设计，各组件独立可复用，便于维护和扩展。
              所有样式基于设计系统统一管理，确保界面一致性。
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};