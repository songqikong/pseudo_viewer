# Pseudo-Label Generator GUI

基于 FastAPI 和 React (Vite) 的 3D 体素伪标签生成及可视化工具。

本项目用于提供一个可视化的前后端网页程序，帮助用户调整 `GeneratorConfig` 的各种配置项（如 `voxel_size`, `point_cloud_range`, `voronoi_max_distance`, `conv_kernel_size` 等），实时生成体素网格，并直观得查看生成的二维鸟瞰图（BEV Maps）和三维点云（3D Voxel Grid）。

## 核心功能

1. **可视化参数配置**：
   通过右侧的控制面板直接滑动/输入调节：
   - 生成参数：Voxel Size、点云范围（Point Cloud Range）等。
   - Voronoi 填充参数：包含距离计算方式（欧拉、曼哈顿、切比雪夫）以及距离权重策略。
   - 众数卷积（Mode Convolution Filter）：卷积核大小（Kernel Size）、CUDA 加速切换。
   - 语义高度计算（Semantic Heights）：过滤阈值（Filter Percentage）。

2. **数据选择与加载**：
   支持 **SemanticKITTI**（`.ply`）与 **SemanticPOSS**（`.bin`），通过统一处理脚本 `generate_pseudo_unified` 实时生成伪标签（不依赖 MinkowskiEngine）。

3. **双重视图可视化**：
   - **BEV Maps**：并排展示 "最高层投影（Original）"、"Voronoi 补全模式"、"众数滤波结果" 三张图像对比。
   - **3D Voxel Grid**：将体素还原回真实世界坐标，在渲染引擎中生成可动态交互的三维着色点云。

---

## 环境要求与依赖

### 后端 (Python)
推荐在现有的 `miniconda` 或虚拟环境下运行：
- Python 3.8+
- PyTorch（可选，用于 BEV/众数滤波的 CUDA 加速）
- NumPy / PyYAML
- FastAPI / Uvicorn / Pydantic (通过以下命令安装)：
  ```bash
  pip install fastapi uvicorn pydantic
  ```

### 前端 (Node.js)
- Node.js 18+
- npm 安装依赖（已经预置）：
  ```bash
  npm install
  npm install three @react-three/fiber @react-three/drei axios lucide-react
  ```

---

## 如何启动服务

**一键同时启动前后端**（推荐）：
```bash
cd data_prepare/pseude_gen/dense/ui
./run_all.sh
```
后端将运行在 http://localhost:8000，前端在 http://localhost:5173。按 Ctrl+C 会同时结束两个进程。

---

分为两个部分启动（方便开发调试）：

### 第一步：启动 FastAPI 后端服务器
在后端目录下启动：
```bash
cd /home/kongsongqi/Coding/SelfCom/data_prepare/pseude_gen/dense/ui/backend
python main.py
```
*注：后端将默认启动在 `http://localhost:8000` 端口。请确保对应的数据目录能够正确访问。*

### 第二步：启动 React 前端服务器
在前端目录下启动：
```bash
cd /home/kongsongqi/Coding/SelfCom/data_prepare/pseude_gen/dense/ui/frontend
npm run dev
```
*注：Vite 测试服务器将默认启动在 `http://localhost:5173`。*

现在你可以打开浏览器访问 **[http://localhost:5173](http://localhost:5173)** 开始使用了。

---

## 目录结构说明

```
ui/
├── backend/
│   └── main.py             # FastAPI 应用的主程序，以及包含路由与请求处理。
├── frontend/
│   ├── index.html          # 前端入口 HTML。
│   ├── package.json        
│   ├── vite.config.js      # Vite 打包配置。
│   ├── src/
│   │   ├── App.jsx         # 主应用组件（包含侧边栏，Tab切换等主逻辑）。
│   │   ├── index.css       # 全局样式（包含玻璃拟态等自定义暗黑主题）。
│   │   ├── main.jsx        
│   │   └── components/
│   │       ├── ConfigPanel.jsx         # 侧边栏的参数配置表单组件。
│   │       ├── BEVViewer.jsx           # 生成二维 BEV 标签贴图（Canvas）功能。
│   │       └── PointCloudViewer.jsx    # 三维空间的体素点云可视化功能 (Three.js)。
```
