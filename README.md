# LAN Stream - 局域网文件传输工具

这是一个轻量级的本地网络文件和文本即时分享工具。它通过一个简洁的Web界面，让你可以在同一局域网下的设备之间快速分享文件和文字。

## ✨ 主要功能

- **实时分享**: 通过 WebSocket 技术，分享的文本和文件会即时显示在所有连接的设备上。
- **文件与文本分享**: 不仅可以发送文字消息，还可以轻松上传和分享各类文件。
- **拖拽上传**: 支持将文件直接拖拽到浏览器窗口进行上传。
- **历史记录**: 保留分享历史，可以查看、下载或删除历史文件。
- **图片预览**: 图片文件会自动生成预览，方便浏览。
- **跨平台**: 后端使用 Go 语言编写，可以轻松编译运行在 Windows, macOS, Linux, 甚至树莓派等 ARM 设备上。
- **主题切换**: 支持浅色和深色两种界面主题。
- **易于部署**: 提供了打包脚本，可以一键将应用打包为可执行文件及相关资源。

## 🛠️ 开发环境

- **Go**: 需要安装 Go 语言环境 (推荐 1.18 或更高版本)。
- **现代浏览器**: 用于访问前端页面 (例如 Chrome, Firefox, Safari)。

## 🚀 快速开始

### 1. 克隆或下载项目

```bash
git clone https://github.com/kingwsi/lan-stream.git
cd lan-stream
```

### 2. 运行开发服务器

直接使用 `go run` 命令可以快速启动一个用于开发的服务器。

```bash
go run main.go
```

服务器启动后，会显示可以在浏览器中访问的地址。

### 3. 访问应用

服务器启动后，会打印出类似如下的提示信息：

```
Server is running...
Open your browser and go to http://localhost:8081
Or on other devices in the same network, use one of these addresses:
http://192.168.1.10:8081
```

在你的电脑或手机浏览器中打开其中一个地址，即可开始使用。

## 📦 打包和部署

项目提供了针对不同平台的打包脚本，可以将应用打包成一个独立的部署包。

### 1. 修改配置 (可选)

你可以编辑 `config.json` 文件来修改应用的端口号和文件上传目录。

```json
{
    "upload_directory": "uploads",
    "port": "8081"
}
```

### 2. 执行打包脚本

- **打包为 Linux (amd64) 版本:**

  ```bash
  sh build.sh
  ```
  执行后会生成 `lan-stream-deploy.tar.gz`。

- **打包为 Linux (arm64) 版本 (例如树莓派):**

  ```bash
  sh build-arm64.sh
  ```
  执行后会生成 `lan-stream-arm64-deploy.tar.gz`。

### 3. 部署和运行

1.  将生成的 `.tar.gz` 压缩包上传到你的服务器或目标设备。
2.  解压压缩包:

    ```bash
    # 以 amd64 版本为例
    tar -xzvf lan-stream-deploy.tar.gz
    ```
3.  进入解压后的目录，给二进制文件添加执行权限:

    ```bash
    chmod +x lan-stream-linux
    ```
4.  在后台运行应用:

    ```bash
    nohup ./lan-stream-linux &
    ```

现在，你就可以通过 `http://<服务器IP>:<端口号>` 来访问你的应用了。
