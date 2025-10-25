# Mockup Mode - Tính năng tạo Mockup tự động

## Tổng quan

Mockup Mode là tính năng mới trong ứng dụng AutoAgents-Redesign, cho phép người dùng tự động thay thế nội dung của Smart Object trong file Photoshop (.psd) với ảnh sticker/design của họ, và xuất ra file PNG đã hoàn thiện - tất cả mà không cần mở Photoshop.

## Kiến trúc

### Backend (Server-side)

**Công nghệ sử dụng:**
- `ag-psd`: Thư viện Node.js để đọc và ghi file PSD/PSB
- `sharp`: Thư viện xử lý ảnh để convert PSD sang PNG
- `multer`: Middleware Express để xử lý multipart/form-data (file upload)
- `canvas`: Canvas engine cho Node.js (dependency của ag-psd)

**API Endpoint:**
```
POST /api/mockup/process-mockups
```

**Request:**
- Content-Type: `multipart/form-data`
- Fields:
  - `sticker`: File ảnh sticker/design (PNG, JPG, etc.) - 1 file
  - `psdFiles`: Một hoặc nhiều file PSD mockup - tối đa 10 files

**Response:**
```json
{
  "message": "Xử lý mockup thành công!",
  "processedImages": [
    {
      "filename": "mockup1_processed.png",
      "path": "/output/mockup1_processed.png"
    },
    {
      "filename": "mockup2_processed.png",
      "path": "/output/mockup2_processed.png"
    }
  ]
}
```

**Luồng xử lý:**
1. Nhận file sticker và các file PSD từ client
2. Đọc từng file PSD bằng `ag-psd`
3. Tìm kiếm đệ quy tất cả các layer có tên **"REPLACE"** là Smart Object
4. Thay thế dữ liệu của Smart Object bằng buffer của file sticker
5. Ghi lại file PSD đã chỉnh sửa
6. Đọc lại file PSD mới và lấy dữ liệu ảnh composite (imageData)
7. Chuyển đổi imageData thành PNG bằng `sharp`
8. Lưu file PNG vào thư mục `public/output/`
9. Trả về danh sách đường dẫn của các file đã xử lý

**Files:**
- `server/src/routes/mockup.ts`: Route handler cho API mockup
- `server/src/index.ts`: Đã được cập nhật để tích hợp route `/api/mockup` và serve folder `/output`

### Frontend (Client-side)

**Component mới:**
- `components/MockupMode.tsx`: Giao diện chính cho Mockup Mode

**Tính năng UI:**
1. **Panel bên trái (Upload Section):**
   - Upload ảnh sticker/design
   - Preview ảnh sticker đã chọn
   - Upload nhiều file PSD mockup
   - Hiển thị danh sách file PSD đã chọn
   - Nút "Tạo Mockup" để bắt đầu xử lý
   - Hiển thị thông báo lỗi nếu có

2. **Panel bên phải (Results Section):**
   - Hiển thị grid các ảnh mockup đã xử lý
   - Mỗi ảnh có nút "Tải về" riêng
   - Preview ảnh PNG kết quả

**Tích hợp vào App:**
- `App.tsx`: Đã thêm `'mockup'` vào type `AppMode`
- `components/Header.tsx`: Đã thêm nút "Mockup" với badge "New" màu xanh lá
- Logic chuyển đổi mode trong `App.tsx` đã được cập nhật

## Yêu cầu cho File PSD

Để Mockup Mode hoạt động đúng, file PSD mockup cần đáp ứng các điều kiện sau:

1. **Smart Object Layer:** File PSD phải chứa ít nhất một layer là Smart Object
2. **Tên layer:** Layer Smart Object cần được đặt tên chính xác là **"REPLACE"** (in hoa, không dấu)
3. **Cấu trúc:** Smart Object có thể nằm ở bất kỳ vị trí nào trong cây layer (thậm chí trong các folder/group)
4. **Multiple layers:** Nếu có nhiều layer tên "REPLACE", tất cả sẽ được thay thế bằng cùng một sticker

## Hướng dẫn sử dụng

### Chuẩn bị file PSD:
1. Mở file mockup trong Photoshop
2. Tìm layer cần thay thế nội dung
3. Convert layer đó thành Smart Object (nếu chưa phải):
   - Right-click layer → Convert to Smart Object
4. Đổi tên layer thành **"REPLACE"**
5. Lưu file PSD

### Sử dụng trong ứng dụng:
1. Click nút "Mockup" trên thanh Header
2. Click vào khu vực "Tải lên ảnh sticker" để chọn ảnh design của bạn (PNG, JPG, etc.)
3. Click "Thêm file PSD" để chọn một hoặc nhiều file PSD mockup
4. Click "Tạo Mockup"
5. Đợi quá trình xử lý hoàn tất
6. Xem kết quả và click "Tải về" để download từng ảnh mockup đã hoàn thiện

## Lợi ích so với Script Photoshop cũ

### Script JSX cũ (Hướng 2 - Bị từ chối):
❌ Phải cài đặt Photoshop trên server
❌ Tốn kém chi phí license
❌ Không scale được (Photoshop rất nặng)
❌ Phụ thuộc vào hệ điều hành
❌ Giao diện có thể hiển thị lên màn hình
❌ Khó tự động hóa hoàn toàn

### Giải pháp mới với ag-psd (Hướng 1 - Đã triển khai):
✅ Không cần Photoshop
✅ Miễn phí, open-source
✅ Scale tốt, có thể chạy song song nhiều request
✅ Chạy trên mọi nền tảng (Windows, Linux, macOS)
✅ Hoàn toàn headless (không có UI)
✅ Tích hợp liền mạch vào web app
✅ Hiệu năng cao

## Giới hạn hiện tại

1. **Smart Object phức tạp:** Một số loại Smart Object với hiệu ứng hoặc transform phức tạp có thể không được xử lý hoàn hảo
2. **Kích thước file:** Upload bị giới hạn bởi Express (mặc định 50MB)
3. **Số lượng file:** Giới hạn tối đa 10 file PSD mỗi lần xử lý
4. **Render quality:** Chất lượng render phụ thuộc vào `ag-psd`, có thể không đạt 100% như Photoshop gốc

## Phát triển tiếp theo

### Tính năng có thể thêm:
- [ ] Upload file PSD từ URL thay vì chỉ từ máy tính
- [ ] Batch processing với queue system cho số lượng lớn
- [ ] Preview trước khi xử lý (render thumbnail)
- [ ] Hỗ trợ thay thế nhiều layer khác nhau với nhiều sticker khác nhau
- [ ] Tùy chỉnh vị trí, kích thước, rotation của sticker
- [ ] Export nhiều định dạng (JPEG, WEBP, TIFF)
- [ ] Lưu lịch sử mockup đã tạo
- [ ] Template library - thư viện mockup có sẵn

### Tối ưu hóa:
- [ ] Caching để tăng tốc xử lý cho các file PSD giống nhau
- [ ] WebWorker để xử lý trên client side (nếu có thể)
- [ ] Progress bar chi tiết cho từng file
- [ ] Nén file PNG output để giảm kích thước

## Dependencies đã thêm

```json
{
  "ag-psd": "^latest",
  "sharp": "^latest",
  "canvas": "^latest",
  "multer": "^latest",
  "@types/multer": "^latest"
}
```

## Ghi chú kỹ thuật

- Có một lỗi TypeScript về xung đột phiên bản `@types/express` giữa thư mục gốc và thư mục server. Lỗi này được bỏ qua bằng `// @ts-ignore` và không ảnh hưởng đến runtime.
- Thư mục `public/output/` được tự động tạo khi server khởi động lần đầu xử lý mockup.
- File output được serve qua Express static middleware tại route `/output/`.

---

**Ngày tạo:** October 24, 2025
**Version:** 1.0
**Tác giả:** GitHub Copilot
