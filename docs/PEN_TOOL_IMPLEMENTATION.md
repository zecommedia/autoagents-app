# ✅ Photoshop-Style Pen Tool Implementation Complete

## Tổng quan / Overview

Công cụ Pen Tool đã được triển khai đầy đủ theo cơ chế Photoshop Pen Tool, hỗ trợ **tất cả** các tính năng chuyên nghiệp như trong Adobe Photoshop/Illustrator.

The Pen Tool has been fully implemented following Photoshop Pen Tool mechanics, supporting **ALL** professional features as in Adobe Photoshop/Illustrator.

---

## 🎯 Tính năng chính / Core Features

### 1. **Vẽ đường cong Bézier / Bezier Curve Drawing**

#### Click đơn → Điểm góc (Corner Point)
- Click thường tạo điểm neo (anchor point)
- Không có tay nắm → đường thẳng
- Simple click creates anchor points
- No handles → straight lines

#### Click–Drag → Điểm mượt (Smooth Point)
- Kéo chuột sau khi click để tạo tay nắm
- Tay nắm đối xứng qua điểm neo
- Cong Bézier mượt mà
- Drag after click to create handles
- Symmetric handles through anchor
- Smooth Bézier curves

**Quy tắc tiếp tuyến quan trọng:**
- Hướng kéo = hướng tiếp tuyến khi rời điểm
- Độ dài kéo = độ cong mạnh yếu
- **MẸO:** Muốn cong phồng lên → kéo xuống (ngược hướng)
- Drag direction = tangent direction
- Drag length = curvature strength
- **TIP:** Want bulge up → drag down (opposite direction)

---

### 2. **Phím tắt chuyên nghiệp / Professional Shortcuts**

#### 🔧 **Alt/Option** - Bẻ tay nắm (Break Handle Symmetry)

**Tác dụng:**
- Alt + Kéo tay nắm → Tách độc lập (cusp/corner)
- Alt + Click điểm mượt → Xóa tay nắm, biến thành góc
- Alt + Kéo từ điểm góc → Tạo tay nắm mới

**Use cases:**
- Alt + Drag handle → Independent handles (cusp)
- Alt + Click smooth point → Remove handles, convert to corner
- Alt + Drag from corner → Create new handle

**Ví dụ thực chiến:**
- Vẽ đường "S": Alt để bẻ chiều giữa hai khúc cong
- Drawing "S" curve: Alt to break direction between two curves

---

#### 🖱️ **Ctrl/Cmd** - Chọn trực tiếp (Direct Selection)

**Tác dụng:**
- Ctrl + Click điểm → Chọn và kéo điểm neo
- Ctrl + Kéo tay nắm → Điều chỉnh đường cong
- Không cần chuyển công cụ, dùng tạm thời

**Function:**
- Ctrl + Click anchor → Select and drag anchor
- Ctrl + Drag handle → Adjust curve
- No need to switch tools, temporary selection

**Workflow:**
- Đang vẽ → Thấy sai → Ctrl giữ → Kéo sửa → Thả Ctrl tiếp tục
- While drawing → See error → Hold Ctrl → Drag fix → Release continue

---

#### ↗️ **Shift** - Khóa góc 45° (Constrain Angle)

**Tác dụng:**
- Shift khi kéo tay nắm → Snap góc 0°/45°/90°/135°...
- Dễ vẽ đường ngang/dọc/chéo chuẩn

**Function:**
- Shift while dragging handle → Snap to 0°/45°/90°/135°...
- Easy to draw perfect horizontal/vertical/diagonal

**Mẹo:**
- Vẽ biểu tượng, UI → Luôn dùng Shift cho góc chuẩn
- Drawing icons, UI → Always use Shift for perfect angles

---

#### ⎵ **Space** - Đổi vị trí điểm (Reposition Anchor)

**Tác dụng:**
- Đang kéo tay nắm → Giữ Space → Di chuyển vị trí điểm trước khi thả
- Sửa lỗi vị trí điểm không cần Ctrl

**Function:**
- While dragging handle → Hold Space → Move anchor position before release
- Fix anchor position without Ctrl

**Workflow:**
- Click–Drag tạo cong → Space giữ → Đưa điểm sang chỗ khác → Thả Space → Tiếp tục kéo cong
- Click–Drag curve → Hold Space → Move anchor elsewhere → Release Space → Continue curve

---

#### ⌫ **Backspace/Delete** - Xóa điểm cuối

**Tác dụng:**
- Xóa điểm vừa đặt, quay lại bước trước
- Không mất toàn bộ path

**Function:**
- Delete last placed point, go back one step
- Don't lose entire path

---

#### ⎋ **Esc** - Kết thúc path

**Tác dụng:**
- Path < 3 điểm → Hủy bỏ
- Path ≥ 3 điểm → Kết thúc và áp dụng (không đóng vòng)

**Function:**
- Path < 3 points → Cancel
- Path ≥ 3 points → Finish and apply (don't close loop)

---

#### ↩️ **Enter** - Áp dụng ngay

**Tác dụng:**
- Path ≥ 3 điểm → Đóng và xóa vùng chọn ngay

**Function:**
- Path ≥ 3 points → Close and erase immediately

---

### 3. **Đóng path / Close Path**

#### Click vào điểm đầu tiên
- Khi di chuột gần điểm đầu → Cursor đổi thành "đóng vòng"
- Click → Tự động nối điểm cuối với điểm đầu bằng curve
- When mouse near first point → Cursor shows "close loop"
- Click → Auto connect last to first with curve

**Visual feedback:**
- Điểm đầu được highlight cam (orange)
- Đường nét đứt nối điểm cuối về điểm đầu
- First point highlighted orange
- Dashed line connecting last to first

---

### 4. **Loại điểm / Point Types**

#### Smooth Point (Điểm mượt)
- Hai tay nắm thẳng hàng, đối xứng
- Curve liên tục, mượt mà
- Collinear symmetric handles
- Continuous smooth curve

#### Corner Point (Điểm góc)
- Không tay nắm HOẶC tay nắm độc lập
- Tạo góc gãy hoặc S-curve
- No handles OR independent handles
- Creates sharp angle or S-curve

**Chuyển đổi:**
- Smooth → Corner: Alt + Click
- Corner → Smooth: Alt + Drag tạo tay nắm đối xứng
- Smooth → Corner: Alt + Click
- Corner → Smooth: Alt + Drag to create symmetric handles

---

## 📝 Quy trình vẽ chuẩn / Standard Workflow

### Bước 1: Lên kế hoạch (Plan)
```
Nhìn hình → Xác định "điểm đổi hướng cong"
→ Đặt điểm ở chỗ cong thay đổi (extreme of curvature)
→ KHÔNG đặt giữa đoạn phẳng

Look at shape → Identify "curvature change points"
→ Place anchors at curvature extremes
→ DON'T place in middle of flat segments
```

### Bước 2: Vẽ (Draw)
```
Click–Drag điểm A → Kéo theo hướng rời A
Click–Drag điểm B → Kéo NGƯỢC phía phồng muốn có

Click–Drag point A → Drag along leaving direction
Click–Drag point B → Drag OPPOSITE desired bulge
```

### Bước 3: Tinh chỉnh (Refine)
```
Alt → Bẻ tay nắm nếu cần góc/S-curve
Ctrl → Kéo nhẹ điểm/tay nắm để hoàn thiện

Alt → Break handles for cusps/S-curves
Ctrl → Drag anchors/handles to perfect
```

---

## 🎨 Quy tắc vàng / Golden Rules

### 1. Ít điểm hơn = Tốt hơn
```
❌ Nhiều điểm, tay nắm ngắn → Đường lởm chởm
✅ Ít điểm, tay nắm dài → Đường mượt, dễ sửa

❌ Many points, short handles → Jagged path
✅ Fewer points, long handles → Smooth, editable
```

### 2. Đặt điểm ở chỗ quan trọng
```
✅ Điểm đổi hướng cong (curvature extrema)
✅ Góc sắc (sharp corners)
❌ Giữa đoạn thẳng hoặc cong đều
```

### 3. Giữ tay nắm thẳng hàng cho smooth
```
Smooth point: Hai tay nắm đối xứng 180°
Chỉ dùng Alt bẻ tay nắm khi THẬT SỰ cần góc

Smooth point: Handles symmetric 180°
Only use Alt to break when REALLY need cusp
```

---

## 💡 Lỗi thường gặp / Common Mistakes

### ❌ Lỗi 1: Cong sai hướng
```
Nguyên nhân: Kéo cùng phía với phồng muốn có
Sửa: Nhớ quy tắc - kéo NGƯỢC phía phồng

Cause: Dragging same side as desired bulge
Fix: Remember - drag OPPOSITE the bulge
```

### ❌ Lỗi 2: Đường gãy khựng
```
Nguyên nhân: Điểm corner thay vì smooth
Sửa: Alt + Drag để rút tay nắm và làm mượt

Cause: Corner point instead of smooth
Fix: Alt + Drag to pull handles and smooth
```

### ❌ Lỗi 3: Răng cưa
```
Nguyên nhân: Quá nhiều điểm
Sửa: Xóa bớt, kéo dài tay nắm

Cause: Too many anchors
Fix: Delete some, extend handles
```

---

## 🖥️ Chi tiết kỹ thuật / Technical Details

### Cấu trúc dữ liệu / Data Structure
```typescript
interface PenPoint {
  x: number;              // Normalized 0-1
  y: number;              // Normalized 0-1
  cp1?: {x: number, y: number};  // Incoming handle
  cp2?: {x: number, y: number};  // Outgoing handle
  type: 'smooth' | 'corner';     // Point type
}
```

### Trạng thái / State Management
```typescript
- penPoints: PenPoint[]           // Array of anchor points
- hoveredPointIndex: number | null
- hoveredHandleInfo: {pointIndex, handleType} | null
- isAltPressed: boolean
- isCtrlPressed: boolean
- isShiftPressed: boolean
- isSpacePressed: boolean
- isDraggingAnchor: {pointIndex} | null
- isDraggingHandle: boolean
- isDrawingHandle: boolean
```

### Rendering với Canvas 2D
```typescript
// Bezier curve với 2 control points
ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);

// Quadratic curve với 1 control point
ctx.quadraticCurveTo(cp.x, cp.y, end.x, end.y);

// Straight line (no handles)
ctx.lineTo(end.x, end.y);
```

---

## 🎯 Ví dụ thực chiến / Real-world Examples

### Vẽ chữ "C"
```
1. Click–Drag tại A (top) → Kéo sang PHẢI
2. Click–Drag tại B (bottom) → Kéo sang PHẢI
→ Đường cong mượt hình C

1. Click–Drag at A (top) → Drag RIGHT
2. Click–Drag at B (bottom) → Drag RIGHT
→ Smooth C curve
```

### Vẽ chữ "S"
```
1. Click–Drag tại A → Kéo xuống DƯỚI
2. Click–Drag tại B → Kéo xuống DƯỚI
3. Alt + Kéo tay nắm B để bẻ hướng → Tạo S

1. Click–Drag at A → Drag DOWN
2. Click–Drag at B → Drag DOWN
3. Alt + Drag B handle to break → Create S
```

### Vẽ hình trái tim ♥
```
1. Top center (A): Corner point
2. Left peak (B): Smooth, kéo lên trên-trái
3. Bottom point (C): Smooth, kéo xuống
4. Right peak (D): Smooth, kéo lên trên-phải
5. Click vào A để đóng

1. Top center (A): Corner point
2. Left peak (B): Smooth, drag up-left
3. Bottom point (C): Smooth, drag down
4. Right peak (D): Smooth, drag up-right
5. Click A to close
```

---

## 🔄 So sánh với Photoshop / Comparison with Photoshop

| Tính năng | Photoshop | Implementation này | ✅ |
|-----------|-----------|-------------------|-----|
| Click → Corner point | ✅ | ✅ | Hoàn chỉnh |
| Click–Drag → Smooth curve | ✅ | ✅ | Hoàn chỉnh |
| Alt: Break handles | ✅ | ✅ | Hoàn chỉnh |
| Ctrl: Direct select | ✅ | ✅ | Hoàn chỉnh |
| Shift: Constrain 45° | ✅ | ✅ | Hoàn chỉnh |
| Space: Reposition anchor | ✅ | ✅ | Hoàn chỉnh |
| Backspace: Delete last | ✅ | ✅ | Hoàn chỉnh |
| Close by clicking first | ✅ | ✅ | Hoàn chỉnh |
| Visual feedback | ✅ | ✅ | Adobe Illustrator style |

---

## 📚 Tài liệu tham khảo / References

- **PEN_TOOL_COMPLETE.md** - Tài liệu gốc cơ chế Pen Tool
- **components/CloneMode.tsx** - Implementation code
- **components/PenTool.css** - Adobe Illustrator cursor styles

---

## ✨ Bonus Features

### 1. Adobe Illustrator Visual Style
- Blue anchor points (white fill + blue stroke)
- Orange highlight on hover
- Dashed control handle lines
- Small circles for control points

### 2. Smart Visual Feedback
- Cursor changes near first point (close loop indicator)
- Handles only shown when relevant (hover/select/last point)
- Preview curve to mouse position
- Dashed closing line preview

### 3. Professional Workflow
- No mode switching needed (Ctrl for temporary selection)
- Forgiving input (Space to reposition mistakes)
- Progressive refinement (Add anchors, then adjust)

---

## 🚀 Cách sử dụng / How to Use

1. **Bật Pen Tool**: Click nút Pen Eraser trong control panel
2. **Vẽ path**: Click hoặc Click-Drag để đặt điểm
3. **Điều chỉnh**: Dùng Alt/Ctrl/Shift như hướng dẫn
4. **Đóng path**: Click điểm đầu hoặc Enter/Esc
5. **Xóa vùng**: Path sẽ tự động xóa vùng đã chọn

---

## 🎉 Kết luận / Conclusion

Công cụ Pen Tool đã được triển khai **HOÀN CHỈNH 100%** theo chuẩn Photoshop, bao gồm:

✅ Tất cả phím tắt chuyên nghiệp
✅ Cơ chế Bézier curve chính xác
✅ Visual feedback theo Adobe Illustrator
✅ Workflow mượt mà không cần chuyển công cụ
✅ Hỗ trợ đầy đủ corner/smooth/cusp points
✅ Constraint angles, reposition anchors, break symmetry

**Người dùng chuyên nghiệp từ Photoshop/Illustrator có thể sử dụng ngay lập tức không cần học lại!**

**Professional users from Photoshop/Illustrator can use it immediately without relearning!**

---

Made with ❤️ following Photoshop Pen Tool documentation
