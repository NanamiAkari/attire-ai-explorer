import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Database, Search, Trash2, Download, BarChart3, CheckSquare, Square } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  getAnalysisHistory,
  deleteAnalysisRecord,
  deleteMultipleAnalysisRecords,
  searchAnalysisRecords,
  getAnalysisStats,
  ClothingAnalysisRecord
} from '@/services/databaseService';
import { checkSupabaseConnection } from '@/config/supabase';
import { MultiSelectDatabaseGrid } from '@/components/MultiSelectDatabaseGrid';
import { AnalysisResult } from '@/services/cozeService';

const DatabasePage: React.FC = () => {
  const [records, setRecords] = useState<ClothingAnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

  // 将数据库记录转换为AnalysisResult格式
  const convertToAnalysisResult = (record: ClothingAnalysisRecord): AnalysisResult => {
    return {
      imageUrl: record.image_url || '',
      tags: record.tags || {},
      confidence: record.confidence || 0, // 移除假置信度数据
      analysisTime: record.analysis_time || 0,
      fileName: record.image_name || ''
    };
  };

  // 检查数据库连接
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const connected = await checkSupabaseConnection();
        setIsConnected(connected);
        if (!connected) {
          setError('无法连接到Supabase数据库，请检查配置');
        }
      } catch (err) {
        setIsConnected(false);
        setError('数据库连接检查失败');
      }
    };
    checkConnection();
  }, []);

  // 加载数据库记录
  const loadRecords = async () => {
    if (!isConnected) return;
    
    try {
      setLoading(true);
      const data = await getAnalysisHistory();
      setRecords(data);
      setError(null);
    } catch (err) {
      console.error('加载记录失败:', err);
      setError('加载数据库记录失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载统计信息
  const loadStats = async () => {
    if (!isConnected) return;
    
    try {
      const statsData = await getAnalysisStats();
      setStats(statsData);
    } catch (err) {
      console.error('加载统计信息失败:', err);
    }
  };

  useEffect(() => {
    if (isConnected) {
      loadRecords();
      loadStats();
    }
  }, [isConnected]);

  // 搜索记录
  const handleSearch = async () => {
    if (!isConnected || !searchTerm.trim()) {
      loadRecords();
      return;
    }

    try {
      setLoading(true);
      const searchResults = await searchAnalysisRecords(searchTerm);
      setRecords(searchResults);
      setError(null);
    } catch (err) {
      console.error('搜索失败:', err);
      setError('搜索记录失败');
    } finally {
      setLoading(false);
    }
  };

  // 删除记录
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条记录吗？')) return;

    try {
      setError(null); // 清除之前的错误
      const success = await deleteAnalysisRecord(id);
      if (success) {
        // 从本地状态中移除已删除的记录
        setRecords(prevRecords => prevRecords.filter(record => record.id !== id));
        // 从选中记录中移除
        setSelectedRecords(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
        // 重新加载统计信息
        await loadStats();
        console.log('记录删除成功:', id);
      } else {
        setError('删除记录失败：服务器返回失败状态');
      }
    } catch (err) {
      console.error('删除记录失败:', err);
      setError(`删除记录失败：${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  // 切换多选模式
  const toggleMultiSelectMode = () => {
    setIsMultiSelectMode(!isMultiSelectMode);
    setSelectedRecords(new Set());
  };

  // 切换单个记录的选中状态
  const toggleRecordSelection = (recordId: string) => {
    const newSelected = new Set(selectedRecords);
    if (newSelected.has(recordId)) {
      newSelected.delete(recordId);
    } else {
      newSelected.add(recordId);
    }
    setSelectedRecords(newSelected);
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedRecords.size === records.length) {
      setSelectedRecords(new Set());
    } else {
      setSelectedRecords(new Set(records.map(record => record.id!)));
    }
  };

  // 批量删除选中的记录
  const handleBatchDelete = async () => {
    if (selectedRecords.size === 0) {
      alert('请先选择要删除的记录');
      return;
    }

    if (window.confirm(`确定要删除选中的 ${selectedRecords.size} 条记录吗？此操作不可恢复。`)) {
      try {
        setLoading(true);
        setError(null);
        
        const idsToDelete = Array.from(selectedRecords);
        const result = await deleteMultipleAnalysisRecords(idsToDelete);
        
        if (result.success.length > 0) {
          // 从本地状态中移除成功删除的记录
          setRecords(prevRecords => 
            prevRecords.filter(record => !result.success.includes(record.id!))
          );
          
          // 重新加载统计信息
          await loadStats();
          
          console.log(`成功删除 ${result.success.length} 条记录`);
        }
        
        if (result.failed.length > 0) {
          setError(`${result.failed.length} 条记录删除失败`);
        }
        
        // 清空选中状态并退出多选模式
        setSelectedRecords(new Set());
        setIsMultiSelectMode(false);
        
      } catch (error) {
        console.error('批量删除失败:', error);
        setError(`批量删除失败：${error instanceof Error ? error.message : '未知错误'}`);
      } finally {
        setLoading(false);
      }
    }
  };

  // 导出数据
  const handleExport = () => {
    const dataStr = JSON.stringify(records, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `clothing_analysis_database_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  // 渲染标签
  const renderTags = (tags: any) => {
    return Object.entries(tags)
      .filter(([_, value]) => value && value !== '未识别')
      .map(([key, value]) => (
        <Badge key={key} variant="secondary" className="mr-1 mb-1">
          {key}: {value as string}
        </Badge>
      ));
  };

  if (!isConnected) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error || '数据库未连接。请确保已正确配置Supabase连接信息。'}
          </AlertDescription>
        </Alert>
        
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              数据库配置说明
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p>要使用数据库功能，请按以下步骤配置：</p>
              <ol className="list-decimal list-inside space-y-2">
                <li>在Supabase中创建一个新项目</li>
                <li>创建名为 <code>clothing_analysis</code> 的表，包含以下字段：
                  <ul className="list-disc list-inside ml-4 mt-2">
                    <li>id (uuid, primary key)</li>
                    <li>image_url (text)</li>
                    <li>image_name (text)</li>
                    <li>image_size (bigint)</li>
                    <li>tags (jsonb)</li>
                    <li>confidence (real)</li>
                    <li>analysis_time (bigint)</li>
                    <li>created_at (timestamp with time zone)</li>
                    <li>updated_at (timestamp with time zone)</li>
                  </ul>
                </li>
                <li>复制 .env.example 为 .env</li>
                <li>在 .env 文件中填入你的Supabase URL和API密钥</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">数据库管理</h1>
        <div className="flex gap-2">
          <Button onClick={loadRecords} variant="outline">
            刷新数据
          </Button>
          <Button onClick={handleExport} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            导出数据
          </Button>
        </div>
      </div>

      {error && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="records" className="space-y-6">
        <TabsList>
          <TabsTrigger value="records">分析记录</TabsTrigger>
          <TabsTrigger value="stats">统计信息</TabsTrigger>
        </TabsList>

        <TabsContent value="records">
          {/* 搜索栏 */}
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="搜索图片名称或标签..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              搜索
            </Button>
          </div>

          {/* 多选模式控制栏 */}
          <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button onClick={toggleMultiSelectMode} variant="outline" size="sm">
                  {isMultiSelectMode ? <Square className="w-4 h-4 mr-2" /> : <CheckSquare className="w-4 h-4 mr-2" />}
                  {isMultiSelectMode ? '退出多选' : '多选模式'}
                </Button>
                
                <div className="text-sm text-gray-600">
                  共 {records.length} 条记录
                </div>
              </div>
              
              {/* 多选模式下的批量操作 */}
              {isMultiSelectMode && (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedRecords.size === records.length && records.length > 0}
                      onCheckedChange={toggleSelectAll}
                      id="select-all-db"
                    />
                    <label htmlFor="select-all-db" className="text-sm cursor-pointer">
                      全选 ({selectedRecords.size}/{records.length})
                    </label>
                  </div>
                  
                  {selectedRecords.size > 0 && (
                    <Button onClick={handleBatchDelete} variant="destructive" size="sm">
                      <Trash2 className="w-4 h-4 mr-2" />
                      删除选中 ({selectedRecords.size})
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 记录列表 */}
          {loading ? (
            <div className="text-center py-8">加载中...</div>
          ) : records.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? '未找到匹配的记录' : '暂无分析记录'}
            </div>
          ) : (
            <MultiSelectDatabaseGrid 
              records={records}
              onDelete={handleDelete}
              isMultiSelectMode={isMultiSelectMode}
              selectedRecords={selectedRecords}
              onToggleSelection={toggleRecordSelection}
              className="mt-6"
            />
          )}
        </TabsContent>

        <TabsContent value="stats">
          {stats ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    总体统计
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div>总记录数: {stats.totalRecords}</div>
                    {stats.avgConfidence > 0 && (
                <div>平均置信度: {stats.avgConfidence}%</div>
              )}
                    <div>平均分析时间: {stats.avgAnalysisTime}ms</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>热门样式</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {Object.entries(stats.tagStats.样式名称)
                      .sort(([,a], [,b]) => (b as number) - (a as number))
                      .slice(0, 5)
                      .map(([style, count]) => (
                        <div key={style} className="flex justify-between">
                          <span>{style}</span>
                          <Badge variant="secondary">{count as number}</Badge>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>热门颜色</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {Object.entries(stats.tagStats.颜色)
                      .sort(([,a], [,b]) => (b as number) - (a as number))
                      .slice(0, 5)
                      .map(([color, count]) => (
                        <div key={color} className="flex justify-between">
                          <span>{color}</span>
                          <Badge variant="secondary">{count as number}</Badge>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-8">加载统计信息中...</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DatabasePage;