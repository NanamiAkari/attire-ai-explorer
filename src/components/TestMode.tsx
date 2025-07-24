import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, Image as ImageIcon, Loader2, CheckCircle, AlertCircle, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { analyzeClothingImage, ClothingTags, AnalysisResult } from '@/services/cozeService';
import * as XLSX from 'xlsx';

interface ExcelRow {
  filename: string;
  style: string;
  color: string;
  collar: string;
  sleeve: string;
  [key: string]: any;
}

interface TestResult {
  filename: string;
  correctTags: {
    style: string;
    color: string;
    collar: string;
    sleeve: string;
  };
  predictedTags: {
    style: string;
    color: string;
    collar: string;
    sleeve: string;
  };
  isCorrect: {
    style: boolean;
    color: boolean;
    collar: boolean;
    sleeve: boolean;
  };
  imageUrl: string;
  analysisResult?: AnalysisResult;
}

interface TestModeProps {
  className?: string;
}

// 智能标签匹配函数
const isTagMatch = (predicted: string, correct: string): boolean => {
  if (!predicted || !correct) return false;
  
  // 转换为小写并去除空格
  const pred = predicted.toLowerCase().trim();
  const corr = correct.toLowerCase().trim();
  
  // 完全匹配
  if (pred === corr) return true;
  
  // 同义词映射
  const synonyms: { [key: string]: string[] } = {
    // 领型同义词
    '无': ['无领', '无领型'],
    '无领': ['无', '无领型'],
    '无领型': ['无', '无领'],
    
    // 颜色同义词
    '蓝色': ['浅蓝色', '深蓝色', '蓝'],
    '浅蓝色': ['蓝色', '蓝'],
    '深蓝色': ['蓝色', '蓝'],
    '蓝': ['蓝色', '浅蓝色', '深蓝色'],
    '红色': ['浅红色', '深红色', '红'],
    '浅红色': ['红色', '红'],
    '深红色': ['红色', '红'],
    '红': ['红色', '浅红色', '深红色'],
    '绿色': ['浅绿色', '深绿色', '绿'],
    '浅绿色': ['绿色', '绿'],
    '深绿色': ['绿色', '绿'],
    '绿': ['绿色', '浅绿色', '深绿色'],
    '黄色': ['浅黄色', '深黄色', '黄'],
    '浅黄色': ['黄色', '黄'],
    '深黄色': ['黄色', '黄'],
    '黄': ['黄色', '浅黄色', '深黄色'],
    '紫色': ['浅紫色', '深紫色', '紫'],
    '浅紫色': ['紫色', '紫'],
    '深紫色': ['紫色', '紫'],
    '紫': ['紫色', '浅紫色', '深紫色'],
    '灰色': ['浅灰色', '深灰色', '灰'],
    '浅灰色': ['灰色', '灰'],
    '深灰色': ['灰色', '灰'],
    '灰': ['灰色', '浅灰色', '深灰色'],
    
    // 样式同义词
    't恤': ['t 恤', 'T恤', 'T 恤', 'tshirt', 't-shirt'],
    't 恤': ['t恤', 'T恤', 'T 恤', 'tshirt', 't-shirt'],
    'T恤': ['t恤', 't 恤', 'T 恤', 'tshirt', 't-shirt'],
    'T 恤': ['t恤', 't 恤', 'T恤', 'tshirt', 't-shirt'],
    '衬衫': ['衬衣'],
    '衬衣': ['衬衫'],
    '连衣裙': ['裙子', '长裙'],
    '裙子': ['连衣裙'],
    '长裙': ['连衣裙'],
    
    // 袖型同义词
    '短袖': ['短袖型', '短'],
    '短袖型': ['短袖', '短'],
    '短': ['短袖', '短袖型'],
    '长袖': ['长袖型', '长'],
    '长袖型': ['长袖', '长'],
    '长': ['长袖', '长袖型'],
    '无袖': ['无袖型', '无'],
    '无袖型': ['无袖', '无'],
  };
  
  // 检查同义词匹配
  if (synonyms[pred] && synonyms[pred].includes(corr)) {
    return true;
  }
  if (synonyms[corr] && synonyms[corr].includes(pred)) {
    return true;
  }
  
  // 模糊匹配（去除空格、标点符号）
  const cleanPred = pred.replace(/[\s\-_]/g, '');
  const cleanCorr = corr.replace(/[\s\-_]/g, '');
  if (cleanPred === cleanCorr) return true;
  
  // 包含关系匹配（较短的字符串包含在较长的字符串中）
  if (pred.length > 2 && corr.length > 2) {
    if (pred.includes(corr) || corr.includes(pred)) {
      return true;
    }
  }
  
  return false;
};

export const TestMode: React.FC<TestModeProps> = ({ className }) => {
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelData, setExcelData] = useState<ExcelRow[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [accuracy, setAccuracy] = useState<{
    overall: number;
    style: number;
    color: number;
    collar: number;
    sleeve: number;
  } | null>(null);
  const [selectedErrorImage, setSelectedErrorImage] = useState<TestResult | null>(null);
  const { toast } = useToast();

  // 状态持久化键名
  const STORAGE_KEYS = {
    testResults: 'testMode_testResults',
    progress: 'testMode_progress',
    accuracy: 'testMode_accuracy',
    excelData: 'testMode_excelData',
    isAnalyzing: 'testMode_isAnalyzing'
  };

  // 组件加载时恢复状态
  useEffect(() => {
    try {
      const savedTestResults = localStorage.getItem(STORAGE_KEYS.testResults);
      const savedProgress = localStorage.getItem(STORAGE_KEYS.progress);
      const savedAccuracy = localStorage.getItem(STORAGE_KEYS.accuracy);
      const savedExcelData = localStorage.getItem(STORAGE_KEYS.excelData);
      const savedIsAnalyzing = localStorage.getItem(STORAGE_KEYS.isAnalyzing);

      if (savedTestResults) {
        setTestResults(JSON.parse(savedTestResults));
      }
      if (savedProgress) {
        setProgress(JSON.parse(savedProgress));
      }
      if (savedAccuracy) {
        setAccuracy(JSON.parse(savedAccuracy));
      }
      if (savedExcelData) {
        setExcelData(JSON.parse(savedExcelData));
      }
      if (savedIsAnalyzing) {
        setIsAnalyzing(JSON.parse(savedIsAnalyzing));
      }
    } catch (error) {
      console.error('恢复测试模式状态失败:', error);
    }
  }, []);

  // 保存状态到localStorage
  const saveStateToStorage = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.testResults, JSON.stringify(testResults));
      localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(progress));
      localStorage.setItem(STORAGE_KEYS.accuracy, JSON.stringify(accuracy));
      localStorage.setItem(STORAGE_KEYS.excelData, JSON.stringify(excelData));
      localStorage.setItem(STORAGE_KEYS.isAnalyzing, JSON.stringify(isAnalyzing));
    } catch (error) {
      console.error('保存测试模式状态失败:', error);
    }
  }, [testResults, progress, accuracy, excelData, isAnalyzing]);

  // 当状态变化时保存到localStorage
  useEffect(() => {
    saveStateToStorage();
  }, [saveStateToStorage]);

  // 清除状态的函数
  const clearTestState = useCallback(() => {
    setTestResults([]);
    setProgress(0);
    setAccuracy(null);
    setExcelData([]);
    setIsAnalyzing(false);
    setExcelFile(null);
    setImages([]);
    setSelectedErrorImage(null);
    
    // 清除localStorage
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }, []);

  // Excel文件上传处理
  const onExcelDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setExcelFile(file);
      parseExcelFile(file);
    }
  }, []);

  // 图片文件上传处理
  const onImageDrop = useCallback((acceptedFiles: File[]) => {
    setImages(prev => [...prev, ...acceptedFiles]);
    toast({
      title: "图片已添加",
      description: `已添加 ${acceptedFiles.length} 个图片文件`,
    });
  }, [toast]);

  const { getRootProps: getExcelRootProps, getInputProps: getExcelInputProps, isDragActive: isExcelDragActive } = useDropzone({
    onDrop: onExcelDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false,
    disabled: isAnalyzing
  });

  const { getRootProps: getImageRootProps, getInputProps: getImageInputProps, isDragActive: isImageDragActive } = useDropzone({
    onDrop: onImageDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    multiple: true,
    disabled: isAnalyzing
  });

  // 解析Excel文件
  const parseExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];
        
        // 转换数据格式，确保包含必要的字段
        const formattedData: ExcelRow[] = jsonData.map(row => ({
          filename: row.filename || row['文件名'] || '',
          style: row.style || row['样式'] || '',
          color: row.color || row['颜色'] || '',
          collar: row.collar || row['领型'] || '',
          sleeve: row.sleeve || row['袖型'] || ''
        }));
        
        setExcelData(formattedData);
        toast({
          title: "Excel文件解析成功",
          description: `已解析 ${formattedData.length} 条标签数据`,
        });
      } catch (error) {
        console.error('解析Excel文件失败:', error);
        toast({
          title: "解析失败",
          description: "Excel文件格式不正确，请检查文件格式",
          variant: "destructive",
        });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // 开始测试
  const startTest = async () => {
    if (!excelFile || images.length === 0) {
      toast({
        title: "请先上传文件",
        description: "请确保已上传Excel文件和对应的图片",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setProgress(0);
    setTestResults([]);
    setAccuracy(null);

    const results: TestResult[] = [];
    
    try {
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const imageName = image.name;
        
        // 查找对应的Excel数据
        const excelRow = excelData.find(row => 
          row.filename === imageName || 
          row.filename === imageName.replace(/\.[^/.]+$/, '') // 去掉扩展名匹配
        );
        
        if (!excelRow) {
          console.warn(`未找到图片 ${imageName} 对应的Excel数据`);
          continue;
        }

        try {
          // 分析图片（带重试逻辑）
          let analysisResult = await analyzeClothingImage(image);
          let retryCount = 0;
          const maxRetries = 3;
          
          // 检查是否有"未识别"的结果，如果有则重试
          while (retryCount < maxRetries) {
            const predictedTags = {
              style: analysisResult.tags.样式名称 || '',
              color: analysisResult.tags.颜色 || '',
              collar: analysisResult.tags.领 || '',
              sleeve: analysisResult.tags.袖 || ''
            };
            
            // 检查是否有"未识别"的结果
            const hasUnrecognized = Object.values(predictedTags).some(tag => 
              tag === '未识别' || tag === '无法识别' || tag === '' || tag === 'unknown'
            );
            
            if (!hasUnrecognized) {
              break; // 没有未识别的结果，退出重试循环
            }
            
            retryCount++;
            if (retryCount < maxRetries) {
              console.log(`图片 ${imageName} 存在未识别结果，进行第 ${retryCount} 次重试`);
              // 等待一小段时间后重试
              await new Promise(resolve => setTimeout(resolve, 1000));
              analysisResult = await analyzeClothingImage(image);
            } else {
              console.warn(`图片 ${imageName} 重试 ${maxRetries} 次后仍有未识别结果`);
            }
          }
          
          // 提取最终的预测标签
          const predictedTags = {
            style: analysisResult.tags.样式名称 || '',
            color: analysisResult.tags.颜色 || '',
            collar: analysisResult.tags.领 || '',
            sleeve: analysisResult.tags.袖 || ''
          };
          
          // 正确标签
          const correctTags = {
            style: excelRow.style,
            color: excelRow.color,
            collar: excelRow.collar,
            sleeve: excelRow.sleeve
          };
          
          // 比较标签准确性（使用智能匹配）
          const isCorrect = {
            style: isTagMatch(predictedTags.style, correctTags.style),
            color: isTagMatch(predictedTags.color, correctTags.color),
            collar: isTagMatch(predictedTags.collar, correctTags.collar),
            sleeve: isTagMatch(predictedTags.sleeve, correctTags.sleeve)
          };
          
          const testResult: TestResult = {
            filename: imageName,
            correctTags,
            predictedTags,
            isCorrect,
            imageUrl: URL.createObjectURL(image),
            analysisResult
          };
          
          results.push(testResult);
          
        } catch (error) {
          console.error(`分析图片 ${imageName} 失败:`, error);
        }
        
        // 更新进度
        setProgress(((i + 1) / images.length) * 100);
      }
      
      setTestResults(results);
      calculateAccuracy(results);
      
      toast({
        title: "测试完成",
        description: `已完成 ${results.length} 张图片的测试`,
      });
      
    } catch (error) {
      console.error('测试过程中出错:', error);
      toast({
        title: "测试失败",
        description: "测试过程中出现错误，请重试",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 计算准确率
  const calculateAccuracy = (results: TestResult[]) => {
    if (results.length === 0) return;
    
    const totalTags = results.length * 4; // 4个维度
    let correctStyle = 0;
    let correctColor = 0;
    let correctCollar = 0;
    let correctSleeve = 0;
    let totalCorrect = 0;
    
    results.forEach(result => {
      if (result.isCorrect.style) correctStyle++;
      if (result.isCorrect.color) correctColor++;
      if (result.isCorrect.collar) correctCollar++;
      if (result.isCorrect.sleeve) correctSleeve++;
      
      totalCorrect += Object.values(result.isCorrect).filter(Boolean).length;
    });
    
    setAccuracy({
      overall: (totalCorrect / totalTags) * 100,
      style: (correctStyle / results.length) * 100,
      color: (correctColor / results.length) * 100,
      collar: (correctCollar / results.length) * 100,
      sleeve: (correctSleeve / results.length) * 100
    });
  };

  // 获取错误的图片
  const getErrorImages = () => {
    return testResults.filter(result => 
      !result.isCorrect.style || 
      !result.isCorrect.color || 
      !result.isCorrect.collar || 
      !result.isCorrect.sleeve
    );
  };

  // 清空所有数据
  const clearAll = () => {
    setExcelFile(null);
    setExcelData([]);
    setImages([]);
    setTestResults([]);
    setProgress(0);
    setAccuracy(null);
    setSelectedErrorImage(null);
    
    // 清理图片URL
    testResults.forEach(result => {
      URL.revokeObjectURL(result.imageUrl);
    });
    
    // 清除localStorage
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* 文件上传区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Excel文件上传 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
              <span>上传Excel标签文件</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Card 
              {...getExcelRootProps()} 
              className={cn(
                'border-2 border-dashed p-6 text-center cursor-pointer transition-all duration-200',
                isExcelDragActive 
                  ? 'border-green-500 bg-green-50' 
                  : 'border-border hover:border-green-500 hover:bg-green-50/50'
              )}
            >
              <input {...getExcelInputProps()} />
              <div className="flex flex-col items-center space-y-3">
                <div className="p-3 rounded-full bg-green-100">
                  <FileSpreadsheet className="h-6 w-6 text-green-600" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-medium">
                    {isExcelDragActive ? '释放文件开始上传' : '上传Excel文件'}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    支持 .xlsx 和 .xls 格式
                  </p>
                </div>
              </div>
            </Card>
            
            {excelFile && (
              <div className="mt-4 p-3 bg-green-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">{excelFile.name}</span>
                  <Badge variant="secondary">{excelData.length} 条数据</Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 图片文件上传 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <ImageIcon className="h-5 w-5 text-blue-600" />
              <span>上传测试图片</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Card 
              {...getImageRootProps()} 
              className={cn(
                'border-2 border-dashed p-6 text-center cursor-pointer transition-all duration-200',
                isImageDragActive 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-border hover:border-blue-500 hover:bg-blue-50/50'
              )}
            >
              <input {...getImageInputProps()} />
              <div className="flex flex-col items-center space-y-3">
                <div className="p-3 rounded-full bg-blue-100">
                  <ImageIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-medium">
                    {isImageDragActive ? '释放文件开始上传' : '上传测试图片'}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    支持 JPG、PNG、WebP 格式
                  </p>
                </div>
              </div>
            </Card>
            
            {images.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">已上传图片 ({images.length})</span>
                  <Button variant="outline" size="sm" onClick={() => setImages([])}>
                    清空
                  </Button>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {images.map((image, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-blue-50 rounded text-sm">
                      <span className="truncate">{image.name}</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => removeImage(index)}
                        className="h-6 w-6 p-0"
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 控制按钮 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button 
                onClick={startTest}
                disabled={!excelFile || images.length === 0 || isAnalyzing}
                className="flex items-center space-x-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>测试中...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    <span>开始测试</span>
                  </>
                )}
              </Button>
              
              <Button 
                variant="outline"
                onClick={clearTestState}
                disabled={isAnalyzing || testResults.length === 0}
                className="flex items-center space-x-2"
              >
                <AlertCircle className="h-4 w-4" />
                <span>清除测试结果</span>
              </Button>
              
              <Button 
                variant="outline"
                onClick={clearAll}
                disabled={isAnalyzing}
                className="flex items-center space-x-2"
              >
                <AlertCircle className="h-4 w-4" />
                <span>清空所有</span>
              </Button>
            </div>
            
            {isAnalyzing && (
              <div className="flex items-center space-x-3">
                <span className="text-sm text-muted-foreground">进度:</span>
                <Progress value={progress} className="w-32" />
                <span className="text-sm font-medium">{Math.round(progress)}%</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 准确率显示 */}
      {accuracy && (
        <Card>
          <CardHeader>
            <CardTitle>测试结果</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {accuracy.overall.toFixed(1)}%
                </div>
                <div className="text-sm text-blue-700">总体准确率</div>
              </div>
              
              <div className="text-center p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg">
                <div className="text-xl font-bold text-green-600">
                  {accuracy.style.toFixed(1)}%
                </div>
                <div className="text-sm text-green-700">样式准确率</div>
              </div>
              
              <div className="text-center p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg">
                <div className="text-xl font-bold text-yellow-600">
                  {accuracy.color.toFixed(1)}%
                </div>
                <div className="text-sm text-yellow-700">颜色准确率</div>
              </div>
              
              <div className="text-center p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg">
                <div className="text-xl font-bold text-purple-600">
                  {accuracy.collar.toFixed(1)}%
                </div>
                <div className="text-sm text-purple-700">领型准确率</div>
              </div>
              
              <div className="text-center p-4 bg-gradient-to-r from-red-50 to-red-100 rounded-lg">
                <div className="text-xl font-bold text-red-600">
                  {accuracy.sleeve.toFixed(1)}%
                </div>
                <div className="text-sm text-red-700">袖型准确率</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 错误图片展示 */}
      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <span>识别错误的图片 ({getErrorImages().length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {getErrorImages().length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                <p>所有图片识别正确！</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {getErrorImages().map((result, index) => (
                  <div key={index} className="relative group">
                    <div className="aspect-square rounded-lg overflow-hidden border-2 border-red-200">
                      <img 
                        src={result.imageUrl} 
                        alt={result.filename}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 rounded-lg flex items-center justify-center">
                      <Button 
                        variant="secondary"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setSelectedErrorImage(result)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        查看详情
                      </Button>
                    </div>
                    <div className="mt-2">
                      <p className="text-xs font-medium truncate">{result.filename}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {!result.isCorrect.style && <Badge variant="destructive" className="text-xs">样式</Badge>}
                        {!result.isCorrect.color && <Badge variant="destructive" className="text-xs">颜色</Badge>}
                        {!result.isCorrect.collar && <Badge variant="destructive" className="text-xs">领型</Badge>}
                        {!result.isCorrect.sleeve && <Badge variant="destructive" className="text-xs">袖型</Badge>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 错误详情弹窗 */}
      {selectedErrorImage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>错误详情 - {selectedErrorImage.filename}</CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setSelectedErrorImage(null)}
                >
                  ×
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="aspect-video rounded-lg overflow-hidden">
                <img 
                  src={selectedErrorImage.imageUrl} 
                  alt={selectedErrorImage.filename}
                  className="w-full h-full object-contain"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2 text-green-600">正确标签</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>样式:</span>
                      <span className="font-medium">{selectedErrorImage.correctTags.style}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>颜色:</span>
                      <span className="font-medium">{selectedErrorImage.correctTags.color}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>领型:</span>
                      <span className="font-medium">{selectedErrorImage.correctTags.collar}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>袖型:</span>
                      <span className="font-medium">{selectedErrorImage.correctTags.sleeve}</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2 text-red-600">识别结果</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>样式:</span>
                      <span className={cn(
                        'font-medium',
                        selectedErrorImage.isCorrect.style ? 'text-green-600' : 'text-red-600'
                      )}>
                        {selectedErrorImage.predictedTags.style}
                        {!selectedErrorImage.isCorrect.style && ' ❌'}
                        {selectedErrorImage.isCorrect.style && ' ✅'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>颜色:</span>
                      <span className={cn(
                        'font-medium',
                        selectedErrorImage.isCorrect.color ? 'text-green-600' : 'text-red-600'
                      )}>
                        {selectedErrorImage.predictedTags.color}
                        {!selectedErrorImage.isCorrect.color && ' ❌'}
                        {selectedErrorImage.isCorrect.color && ' ✅'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>领型:</span>
                      <span className={cn(
                        'font-medium',
                        selectedErrorImage.isCorrect.collar ? 'text-green-600' : 'text-red-600'
                      )}>
                        {selectedErrorImage.predictedTags.collar}
                        {!selectedErrorImage.isCorrect.collar && ' ❌'}
                        {selectedErrorImage.isCorrect.collar && ' ✅'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>袖型:</span>
                      <span className={cn(
                        'font-medium',
                        selectedErrorImage.isCorrect.sleeve ? 'text-green-600' : 'text-red-600'
                      )}>
                        {selectedErrorImage.predictedTags.sleeve}
                        {!selectedErrorImage.isCorrect.sleeve && ' ❌'}
                        {selectedErrorImage.isCorrect.sleeve && ' ✅'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};