# 🔧 PowerShell Commands Reference

## Các Lệnh Thường Dùng (Windows PowerShell)

### Development

```powershell
# Start dev server + Electron
npm run dev:electron

# Chỉ start dev server
npm run dev

# Chỉ start Electron (khi dev server đã chạy)
npm run dev:electron
```

---

### Build

```powershell
# Build app (NSIS installer)
npm run build:electron

# Build với custom API URL
$env:VITE_API_URL="https://api-ditech.auto-agents.org"
npm run build:electron
```

---

### Publish to GitHub Releases

```powershell
# 1. Get GitHub Personal Access Token
# Vào: https://github.com/settings/tokens
# Tạo token với quyền: repo (full control)

# 2. Set token trong PowerShell
$env:GH_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# 3. Build và publish
npm run build:electron -- --publish always

# Hoặc publish only (không build lại)
npm run build:electron -- --publish onTagOrDraft
```

**Lưu ý:**
- Token chỉ tồn tại trong session hiện tại
- Nếu đóng PowerShell phải set lại
- Để lưu vĩnh viễn (không khuyến khích):
  ```powershell
  [Environment]::SetEnvironmentVariable("GH_TOKEN", "ghp_xxx", "User")
  ```

---

### Environment Variables

```powershell
# Set biến môi trường tạm thời (session hiện tại)
$env:VARIABLE_NAME="value"

# Ví dụ:
$env:NODE_ENV="production"
$env:VITE_API_URL="https://api-ditech.auto-agents.org"
$env:GH_TOKEN="ghp_xxxx"

# Xem giá trị biến
echo $env:VARIABLE_NAME

# Xóa biến
Remove-Item env:VARIABLE_NAME

# Set biến vĩnh viễn (User level)
[Environment]::SetEnvironmentVariable("VARIABLE_NAME", "value", "User")

# Set biến vĩnh viễn (System level - cần Admin)
[Environment]::SetEnvironmentVariable("VARIABLE_NAME", "value", "Machine")
```

---

### File Operations

```powershell
# Xem nội dung file
Get-Content filename.txt

# Tìm file
Get-ChildItem -Recurse -Filter "*.exe"

# Xóa folder
Remove-Item -Recurse -Force folder-name

# Copy file
Copy-Item source.txt destination.txt

# Di chuyển/Đổi tên
Move-Item oldname.txt newname.txt
```

---

### Process Management

```powershell
# Tìm process
Get-Process | Where-Object {$_.Name -like "*electron*"}

# Kill process
Stop-Process -Name "electron" -Force

# Start process
Start-Process "path\to\app.exe"
```

---

### Git Commands (giống Bash)

```powershell
git status
git add .
git commit -m "message"
git push origin main
git pull
git branch
git checkout -b new-branch
```

---

### NPM/Node Commands

```powershell
# Install dependencies
npm install

# Install specific package
npm install package-name --save
npm install package-name --save-dev

# Update packages
npm update

# Check outdated packages
npm outdated

# Clean cache
npm cache clean --force

# Run script
npm run script-name

# List installed packages
npm list --depth=0
```

---

## 🆚 So Sánh PowerShell vs Bash

| Task | PowerShell (Windows) | Bash (Linux/Mac) |
|------|---------------------|------------------|
| Set env var | `$env:VAR="value"` | `export VAR="value"` |
| Echo variable | `echo $env:VAR` | `echo $VAR` |
| List files | `Get-ChildItem` hoặc `ls` | `ls` |
| Remove folder | `Remove-Item -Recurse` | `rm -rf` |
| Current dir | `Get-Location` hoặc `pwd` | `pwd` |
| Change dir | `Set-Location` hoặc `cd` | `cd` |
| Clear screen | `Clear-Host` hoặc `cls` | `clear` |

---

## 🔥 Quick Tips

### 1. Tab Completion
Nhấn `Tab` để auto-complete commands và paths

### 2. Command History
- `↑` `↓` để xem lịch sử commands
- `Ctrl+R` để search command history

### 3. Copy/Paste
- Copy: `Ctrl+C` (trong PowerShell window)
- Paste: `Ctrl+V` hoặc Right-click

### 4. Stop Running Command
- `Ctrl+C` để stop command đang chạy

### 5. Multiple Commands
```powershell
# Chạy tuần tự (command2 chỉ chạy nếu command1 thành công)
command1; command2

# Chạy tuần tự (luôn chạy cả 2)
command1 | command2

# Chạy parallel
Start-Job {command1}
Start-Job {command2}
```

---

## 📝 Common Tasks

### Build và Publish App
```powershell
# 1. Bump version trong package.json
code package.json  # Sửa "version": "1.0.1"

# 2. Build
npm run build:electron

# 3. Test locally
.\electron-dist\AutoAgents-Agent-1.0.1-Setup.exe

# 4. Publish to GitHub
$env:GH_TOKEN="ghp_xxxx"
npm run build:electron -- --publish always
```

### Start Dev Environment
```powershell
# Terminal 1: Dev server
cd C:\App\autoagents-app
npm run dev

# Terminal 2: Electron app
cd C:\App\autoagents-app
npm run dev:electron

# Hoặc 1 command (auto-start server):
npm run dev:electron
```

### Setup Cloudflare Tunnel
```powershell
# Install cloudflared
winget install cloudflare.cloudflared

# Login
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create autoagents-api

# Route DNS
cloudflared tunnel route dns autoagents-api api-ditech.auto-agents.org

# Start tunnel
cloudflared tunnel run autoagents-api
```

---

Lưu file này để tham khảo! 📌
