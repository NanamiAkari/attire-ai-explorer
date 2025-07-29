# Attire AI Explorer 后端服务器

这是 Attire AI Explorer 项目的后端 API 服务器，提供数据库操作和文件上传功能。

## 功能特性

- RESTful API 接口
- PostgreSQL 数据库集成
- 图片上传和处理
- 服装分析记录管理
- 数据统计和搜索功能

## 环境要求

- Node.js >= 16.0.0
- PostgreSQL >= 12.0
- npm 或 yarn

## 安装和配置

### 1. 安装依赖

```bash
npm install
```

### 2. 环境变量配置

复制 `.env` 文件并根据你的环境修改配置：

```bash
# 服务器配置
PORT=3001

# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=clothing_analysis
DB_USER=postgres
DB_PASSWORD=your_password

# 其他配置
NODE_ENV=development
```

### 3. 数据库设置

确保 PostgreSQL 服务正在运行，并创建数据库：

```sql
CREATE DATABASE clothing_analysis;
```

服务器启动时会自动创建所需的表和索引。

## 启动服务器

### 开发模式

```bash
npm run dev
```

### 生产模式

```bash
npm start
```

服务器将在 `http://localhost:3001` 启动。

## API 接口

### 健康检查

- **GET** `/api/health` - 服务器健康检查
- **GET** `/api/database/check` - 数据库连接检查

### 分析记录管理

- **POST** `/api/analysis` - 保存分析结果（支持文件上传）
- **GET** `/api/analysis` - 获取所有分析记录
- **GET** `/api/analysis/:id` - 根据ID获取分析记录
- **PUT** `/api/analysis/:id` - 更新分析记录
- **DELETE** `/api/analysis/:id` - 删除分析记录
- **DELETE** `/api/analysis` - 批量删除分析记录
- **GET** `/api/analysis/search/:searchTerm` - 搜索分析记录
- **GET** `/api/analysis/stats` - 获取统计信息

## 数据库结构

### clothing_analysis 表

| 字段 | 类型 | 描述 |
|------|------|------|
| id | UUID | 主键 |
| image_url | TEXT | 图片URL |
| image_name | TEXT | 图片名称 |
| image_size | BIGINT | 图片大小 |
| image_hash | TEXT | 图片哈希值（用于去重） |
| tags | JSONB | 分析标签 |
| confidence | REAL | 置信度 |
| analysis_time | BIGINT | 分析耗时 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

## 错误处理

所有 API 接口都包含适当的错误处理和状态码：

- `200` - 成功
- `400` - 请求参数错误
- `404` - 资源不存在
- `500` - 服务器内部错误

## 开发说明

### 文件结构

```
server/
├── index.js          # 主服务器文件
├── package.json      # 依赖配置
├── .env             # 环境变量
└── README.md        # 说明文档
```

### 主要依赖

- **express** - Web 框架
- **cors** - 跨域支持
- **multer** - 文件上传处理
- **pg** - PostgreSQL 客户端
- **dotenv** - 环境变量管理
- **uuid** - UUID 生成

## 安全注意事项

1. 确保 `.env` 文件不被提交到版本控制系统
2. 在生产环境中使用强密码
3. 配置适当的 CORS 策略
4. 定期更新依赖包

## 故障排除

### 常见问题

1. **数据库连接失败**
   - 检查 PostgreSQL 服务是否运行
   - 验证数据库配置信息
   - 确认数据库用户权限

2. **端口冲突**
   - 修改 `.env` 文件中的 `PORT` 配置
   - 检查端口是否被其他服务占用

3. **文件上传失败**
   - 检查文件大小限制（当前限制为 10MB）
   - 验证文件格式是否支持

## 许可证

MIT License