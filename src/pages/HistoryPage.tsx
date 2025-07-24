import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Search, Filter, Download, Upload, CheckSquare, Square } from 'lucide-react';
import { MultiSelectImageGrid } from '@/components/MultiSelectImageGrid';
import {
  getAnalysisHistory,
  deleteHistoryRecord,
  clearAllHistory,
  searchHistory,
  getImageFromIndexedDB,
  type HistoryRecord
} from '../services/historyService';
import { clearAnalysisResults, loadAnalysisResults, saveAnalysisResults } from '../services/storageService';
import { ClothingTags } from '../types/clothing';

const HistoryPage: React.FC = () => {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<HistoryRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [loading, setLoading] = useState(true);
  const [imageUrls, setImageUrls] = useState<{ [key: string]: string }>({});
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

  // 加载历史记录
  useEffect(() => {
    loadHistory();
  }, []);

  // 应用搜索和筛选
  useEffect(() => {
    applyFilters();
  }, [history, searchQuery, selectedTags, dateRange]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const records = getAnalysisHistory();
      setHistory(records);
      
      // 加载图片
      const urls: { [key: string]: string } = {};
      for (const record of records) {
        try {
          const file = await getImageFromIndexedDB(record.id);
          if (file) {
            urls[record.id] = URL.createObjectURL(file);
          }
        } catch (error) {
          console.error(`加载图片失败 ${record.id}:`, error);
        }
      }
      setImageUrls(urls);
    } catch (error) {
      console.error('加载历史记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...history];

    // 应用搜索
    if (searchQuery) {
      filtered = searchHistory(searchQuery);
    }

    // 应用日期筛选
    if (dateRange.start || dateRange.end) {
      const startTime = dateRange.start ? new Date(dateRange.start).getTime() : 0;
      const endTime = dateRange.end ? new Date(dateRange.end).getTime() : Date.now();
      filtered = filtered.filter(record => 
        record.timestamp >= startTime && record.timestamp <= endTime
      );
    }

    // 应用标签筛选
    if (selectedTags.length > 0) {
      filtered = filtered.filter(record =>
        selectedTags.some(tag =>
          Object.values(record.tags).some(value =>
            typeof value === 'string' && value.includes(tag)
          )
        )
      );
    }

    setFilteredHistory(filtered);
  };

  const handleDeleteRecord = async (id: string) => {
    if (window.confirm('确定要删除这条记录吗？')) {
      try {
        await deleteHistoryRecord(id);
        // 清理图片URL
        if (imageUrls[id]) {
          URL.revokeObjectURL(imageUrls[id]);
          const newUrls = { ...imageUrls };
          delete newUrls[id];
          setImageUrls(newUrls);
        }
        // 从本地状态中移除已删除的记录
        setHistory(prevHistory => prevHistory.filter(record => record.id !== id));
        console.log('记录删除成功:', id);
      } catch (error) {
        console.error('删除记录失败:', error);
        alert(`删除失败：${error instanceof Error ? error.message : '未知错误'}`);
      }
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('确定要清空所有历史记录吗？此操作不可恢复，同时会清空主页面的分析结果。')) {
      try {
        setLoading(true);
        await clearAllHistory();
        // 同时清空主页面的分析结果
        clearAnalysisResults();
        // 清理所有图片URL
        Object.values(imageUrls).forEach(url => URL.revokeObjectURL(url));
        setImageUrls({});
        setHistory([]);
        setFilteredHistory([]);
        setSelectedRecords(new Set());
        setIsMultiSelectMode(false);
        console.log('历史记录和分析结果清空成功');
      } catch (error) {
        console.error('清空历史记录失败:', error);
        alert(`清空失败：${error instanceof Error ? error.message : '未知错误'}`);
      } finally {
        setLoading(false);
      }
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
    if (selectedRecords.size === filteredHistory.length) {
      setSelectedRecords(new Set());
    } else {
      setSelectedRecords(new Set(filteredHistory.map(record => record.id)));
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
        
        // 删除历史记录
        for (const recordId of selectedRecords) {
          await deleteHistoryRecord(recordId);
          // 清理图片URL
          if (imageUrls[recordId]) {
            URL.revokeObjectURL(imageUrls[recordId]);
          }
        }
        
        // 从主页面的分析结果中删除对应记录
        const mainPageResults = loadAnalysisResults();
        const updatedMainPageResults = mainPageResults.filter(result => {
          // 通过文件名或其他标识符匹配并删除
          const recordToDelete = Array.from(selectedRecords).some(recordId => {
            const historyRecord = history.find(h => h.id === recordId);
            return historyRecord && (
              result.fileName === historyRecord.fileName ||
              result.imageName === historyRecord.fileName
            );
          });
          return !recordToDelete;
        });
        await saveAnalysisResults(updatedMainPageResults);
        
        // 更新本地状态
        const newImageUrls = { ...imageUrls };
        selectedRecords.forEach(recordId => {
          delete newImageUrls[recordId];
        });
        setImageUrls(newImageUrls);
        
        setHistory(prevHistory => prevHistory.filter(record => !selectedRecords.has(record.id)));
        setSelectedRecords(new Set());
        setIsMultiSelectMode(false);
        
        console.log(`成功删除 ${selectedRecords.size} 条记录`);
      } catch (error) {
        console.error('批量删除失败:', error);
        alert(`批量删除失败：${error instanceof Error ? error.message : '未知错误'}`);
      } finally {
        setLoading(false);
      }
    }
  };

  // 修改单个删除函数，同时从主页面删除
  const handleDeleteRecordWithMainPage = async (id: string) => {
    if (window.confirm('确定要删除这条记录吗？')) {
      try {
        await deleteHistoryRecord(id);
        
        // 从主页面的分析结果中删除对应记录
        const mainPageResults = loadAnalysisResults();
        const recordToDelete = history.find(h => h.id === id);
        if (recordToDelete) {
          const updatedMainPageResults = mainPageResults.filter(result => 
            result.fileName !== recordToDelete.fileName && 
            result.imageName !== recordToDelete.fileName
          );
          await saveAnalysisResults(updatedMainPageResults);
        }
        
        // 清理图片URL
        if (imageUrls[id]) {
          URL.revokeObjectURL(imageUrls[id]);
          const newUrls = { ...imageUrls };
          delete newUrls[id];
          setImageUrls(newUrls);
        }
        // 从本地状态中移除已删除的记录
        setHistory(prevHistory => prevHistory.filter(record => record.id !== id));
        console.log('记录删除成功:', id);
      } catch (error) {
        console.error('删除记录失败:', error);
        alert(`删除失败：${error instanceof Error ? error.message : '未知错误'}`);
      }
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  const getAllTags = () => {
    const tagSet = new Set<string>();
    history.forEach(record => {
      Object.values(record.tags).forEach(value => {
        if (typeof value === 'string' && value !== '未识别') {
          tagSet.add(value);
        }
      });
    });
    return Array.from(tagSet);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const exportHistory = () => {
    const dataStr = JSON.stringify(history, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `clothing_analysis_history_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">加载中...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">分析历史</h1>
        
        {/* 搜索和筛选区域 */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* 搜索框 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="搜索文件名或标签..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* 日期范围 */}
            <div className="flex gap-2">
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                placeholder="开始日期"
              />
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                placeholder="结束日期"
              />
            </div>
            
            {/* 操作按钮 */}
            <div className="flex gap-2">
              <Button onClick={toggleMultiSelectMode} variant="outline" size="sm">
                {isMultiSelectMode ? <Square className="w-4 h-4 mr-2" /> : <CheckSquare className="w-4 h-4 mr-2" />}
                {isMultiSelectMode ? '退出多选' : '多选模式'}
              </Button>
              <Button onClick={exportHistory} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                导出
              </Button>
              <Button onClick={handleClearAll} variant="destructive" size="sm">
                <Trash2 className="w-4 h-4 mr-2" />
                清空
              </Button>
            </div>
          </div>
          
          {/* 标签筛选 */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="w-4 h-4" />
              <span className="text-sm font-medium">按标签筛选:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {getAllTags().slice(0, 20).map(tag => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              共 {history.length} 条记录，显示 {filteredHistory.length} 条
            </div>
            
            {/* 多选模式下的批量操作 */}
            {isMultiSelectMode && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedRecords.size === filteredHistory.length && filteredHistory.length > 0}
                    onCheckedChange={toggleSelectAll}
                    id="select-all"
                  />
                  <label htmlFor="select-all" className="text-sm cursor-pointer">
                    全选 ({selectedRecords.size}/{filteredHistory.length})
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
        
        {/* 历史记录列表 - 使用MultiSelectImageGrid组件 */}
        <MultiSelectImageGrid
          records={filteredHistory}
          imageUrls={imageUrls}
          onDelete={handleDeleteRecordWithMainPage}
          className="mt-6"
          isMultiSelectMode={isMultiSelectMode}
          selectedRecords={selectedRecords}
          onToggleSelection={toggleRecordSelection}
        />
        
        {filteredHistory.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-4">暂无分析记录</div>
            <Button onClick={() => window.location.href = '/'}>
              开始分析
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;