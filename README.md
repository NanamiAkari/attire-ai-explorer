# Attire AI Explorer 使用说明

## 📖 项目简介

Attire AI Explorer 是一个基于人工智能的智能服装识别系统，能够自动识别和分类服装图片，支持批量处理和准确率统计。系统采用现代化的Web界面，提供直观的操作体验和详细的分析结果。

## ✨ 主要功能

- 🔍 **智能服装识别**：基于GPT-4 Vision的高精度服装识别
- 📊 **批量处理**：支持Excel文件批量导入服装名称列表
- 🖼️ **多图片上传**：支持同时上传多张服装图片
- 📈 **实时统计**：实时显示识别准确率和进度
- 🔄 **智能重试**：自动处理API失败，确保识别完整性
- 💾 **状态持久化**：切换页面不丢失测试数据
- 📋 **详细分析**：提供错误分析和识别结果详情
- 🎨 **现代化UI**：响应式设计，支持多种设备

## 🚀 快速开始

### 环境要求

- Node.js 18+ 或 Bun
- 现代浏览器（Chrome、Firefox、Safari、Edge）
- OpenAI API 密钥

### 安装步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/NanamiAkari/attire-ai-explorer.git
   cd attire-ai-explorer
   ```

2. **安装依赖**
   ```bash
   # 使用npm
   npm install
   
   # 或使用yarn
   yarn install
   
   # 或使用bun（推荐）
   bun install
   ```

3. **配置环境变量**
   ```bash
   # 复制环境变量模板
   cp .env.example .env
   ```
   
   编辑 `.env` 文件，填入配置信息：
   ```env
   # Coze API配置
   VITE_COZE_API_TOKEN=your_coze_api_token_here
   VITE_COZE_BOT_ID=your_bot_id_here
   
   # 后端API配置
   VITE_API_BASE_URL=http://localhost:3001/api
   
   # PostgreSQL数据库配置
   VITE_DB_HOST=localhost
   VITE_DB_PORT=5432
   VITE_DB_NAME=clothing_analysis
   VITE_DB_USER=postgres
   VITE_DB_PASSWORD=your_password_here
   ```

4. **设置数据库**
   
   确保PostgreSQL服务正在运行，并创建数据库：
   ```sql
   CREATE DATABASE clothing_analysis;
   ```

5. **启动后端服务器**
   ```bash
   # 进入服务器目录
   cd server
   
   # 安装依赖
   npm install
   
   # 启动后端服务器
   npm start
   ```
   
   后端服务器将在 `http://localhost:3001` 启动。

6. **启动前端项目**
   ```bash
   # 返回项目根目录
   cd ..
   
   # 开发模式
   npm run dev
   
   # 生产构建
   npm run build
   npm run preview
   ```

## 📝 使用指南

### 1. 准备数据

#### Excel文件格式
创建一个Excel文件，包含服装名称列表：

| 服装名称 |
|----------|
| Classic Cotton Tee |
| Denim Jacket |
| Floral Print Dress |
| Skinny Jeans |

**注意事项：**
- 第一列应包含服装名称
- 支持 `.xlsx` 和 `.xls` 格式
- 建议使用英文名称以获得更好的识别效果

#### 图片要求
- **格式**：支持 JPG、PNG、WEBP
- **大小**：建议每张图片小于10MB
- **质量**：清晰的服装图片，避免模糊或遮挡
- **数量**：支持批量上传多张图片

### 2. 操作流程

#### 步骤一：上传Excel文件
1. 点击"选择Excel文件"按钮
2. 选择包含服装名称的Excel文件
3. 系统会自动解析并显示服装列表

#### 步骤二：上传图片
1. 点击"选择图片"按钮或拖拽图片到上传区域
2. 支持同时选择多张图片
3. 系统会显示已上传的图片预览

#### 步骤三：开始测试
1. 确认Excel数据和图片都已上传
2. 点击"开始测试"按钮
3. 系统开始自动识别每张图片

#### 步骤四：查看结果
1. 实时查看识别进度和准确率
2. 查看详细的识别结果列表
3. 分析错误识别的图片和原因

### 3. 功能详解

#### 智能重试机制
- 自动检测API调用失败
- 智能重试失败的请求
- 确保所有图片都能得到识别结果

#### 状态持久化
- 自动保存测试进度到本地存储
- 切换页面或刷新浏览器不会丢失数据
- 支持恢复之前的测试状态

#### 结果分析
- **准确率统计**：实时计算识别准确率
- **错误分析**：列出识别错误的图片
- **详细结果**：显示每张图片的识别结果和置信度

#### 数据管理
- **清除测试结果**：只清除识别结果，保留上传的文件
- **清空所有**：清除所有数据和上传的文件
- **重新测试**：基于现有数据重新开始识别

## ⚙️ 高级配置

### API配置

在 `src/lib/openai.ts` 中可以调整以下参数：

```typescript
// 模型配置
model: "gpt-4-vision-preview"

// 最大token数
max_tokens: 300

// 并发请求数
const CONCURRENT_REQUESTS = 3

// 重试次数
const MAX_RETRIES = 3
```

### 识别提示词

可以在 `src/lib/openai.ts` 中自定义识别提示词：

```typescript
const prompt = `请仔细观察这张服装图片，从以下列表中选择最匹配的服装名称：
${clothingList}

要求：
1. 只返回最匹配的一个服装名称
2. 必须从提供的列表中选择
3. 如果不确定，选择最相似的
4. 不要添加任何解释或其他文字`;
```

## 🔧 故障排除

### 常见问题

#### 1. API调用失败
**症状**：显示"API调用失败"错误

**解决方案**：
- 检查API密钥是否正确配置
- 确认OpenAI账户余额充足
- 检查网络连接是否正常
- 验证API密钥权限

#### 2. 图片上传失败
**症状**：图片无法上传或显示错误

**解决方案**：
- 检查图片格式是否支持（JPG、PNG、WEBP）
- 确认图片大小不超过限制
- 尝试压缩图片后重新上传

#### 3. Excel解析错误
**症状**：Excel文件无法解析或数据显示异常

**解决方案**：
- 确认Excel文件格式正确（.xlsx或.xls）
- 检查第一列是否包含服装名称
- 尝试重新保存Excel文件

#### 4. 识别结果不准确
**症状**：识别准确率较低

**解决方案**：
- 使用更清晰的服装图片
- 确保图片中服装清晰可见
- 调整Excel中的服装名称描述
- 使用英文服装名称

### 性能优化

#### 1. 提高识别速度
- 调整并发请求数量（在API限制范围内）
- 压缩图片大小
- 使用更快的网络连接

#### 2. 提高识别准确率
- 使用高质量的服装图片
- 确保服装名称描述准确
- 避免图片中有多件服装
- 使用标准的服装分类名称

## 📊 数据格式说明

### Excel数据格式
```
| 列名 | 数据类型 | 说明 |
|------|----------|------|
| 服装名称 | 文本 | 服装的标准名称 |
```

### 识别结果格式
```json
{
  "imageName": "图片文件名",
  "actualClothing": "实际服装名称",
  "predictedClothing": "识别结果",
  "isCorrect": true/false,
  "confidence": "置信度"
}
```

## 🔒 安全注意事项

1. **API密钥安全**
   - 不要将API密钥提交到代码仓库
   - 使用环境变量管理敏感信息
   - 定期更换API密钥

2. **数据隐私**
   - 上传的图片仅用于识别，不会被存储
   - 识别结果保存在本地浏览器中
   - 清除浏览器数据会删除所有本地结果

3. **网络安全**
   - 建议在HTTPS环境下使用
   - 避免在公共网络下处理敏感数据

## 📞 技术支持

如果您在使用过程中遇到问题，可以：

1. 查看本文档的故障排除部分
2. 检查浏览器控制台的错误信息
3. 在GitHub仓库中提交Issue
4. 联系技术支持团队

## 📄 许可证

本项目采用 MIT 许可证，详情请查看 LICENSE 文件。

---

**版本信息**：v1.0.0  
**最后更新**：2024年12月  
**维护团队**：Attire AI Explorer Team