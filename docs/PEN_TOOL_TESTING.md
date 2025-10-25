# 🧪 Pen Tool Testing Guide

## Kiểm tra nhanh / Quick Testing Checklist

### ✅ Basic Functions
- [ ] Click → Tạo corner point
- [ ] Click-Drag → Tạo smooth curve với handles
- [ ] Click điểm đầu → Đóng path
- [ ] 3+ points → Có thể apply

### ✅ Keyboard Shortcuts
- [ ] **Alt + Drag handle** → Bẻ tay nắm (handles độc lập)
- [ ] **Alt + Click smooth point** → Xóa handles, biến thành corner
- [ ] **Ctrl + Drag anchor** → Di chuyển điểm neo
- [ ] **Ctrl + Drag handle** → Điều chỉnh handle
- [ ] **Shift + Drag** → Constrain góc 45°
- [ ] **Space + Drag** → Reposition anchor khi đang vẽ handle
- [ ] **Backspace** → Xóa điểm cuối
- [ ] **Esc** → Finish/cancel path
- [ ] **Enter** → Apply immediately

### ✅ Visual Feedback
- [ ] Anchor points: White square + blue border
- [ ] Hover anchor: Orange highlight
- [ ] Near first point: Orange highlight + close cursor
- [ ] Control handles: Dashed lines + small circles
- [ ] Preview curve to mouse
- [ ] Dashed closing line preview

### ✅ Advanced Features
- [ ] Handles chỉ hiện khi hover/select/last point
- [ ] Symmetric handles khi không Alt
- [ ] Independent handles khi Alt
- [ ] Bezier curves smooth giữa các điểm
- [ ] Corner points → straight lines
- [ ] Mixed corner + smooth points

---

## 🎯 Test Cases

### Test 1: Simple Curve (C shape)
```
1. Click-Drag tại (0.2, 0.3) → Kéo sang phải
2. Click-Drag tại (0.8, 0.7) → Kéo sang phải
3. Click điểm đầu để đóng
Expected: Đường cong mượt hình C
```

### Test 2: S Curve
```
1. Click-Drag tại (0.2, 0.3) → Kéo xuống
2. Click-Drag tại (0.5, 0.5) → Kéo xuống
3. Alt + Drag handle của điểm 2 lên trên
4. Click-Drag tại (0.8, 0.7) → Kéo lên
Expected: Đường S mượt
```

### Test 3: Corner Points
```
1. Click tại (0.2, 0.2)
2. Click tại (0.8, 0.2)
3. Click tại (0.8, 0.8)
4. Click tại (0.2, 0.8)
5. Click điểm đầu
Expected: Hình vuông góc nhọn
```

### Test 4: Mixed Points
```
1. Click tại (0.5, 0.2) - corner
2. Click-Drag tại (0.8, 0.5) - smooth
3. Click tại (0.5, 0.8) - corner
4. Click-Drag tại (0.2, 0.5) - smooth
5. Click điểm đầu
Expected: Hình kim cương với 2 góc sắc + 2 cong mượt
```

### Test 5: Shift Constraint
```
1. Click-Drag tại (0.3, 0.5)
2. Giữ Shift → Kéo handle
Expected: Handle snap 0°/45°/90°/135°...
```

### Test 6: Space Reposition
```
1. Click-Drag tại (0.3, 0.3)
2. Trong khi kéo handle, giữ Space
3. Di chuyển chuột → Anchor di chuyển theo
Expected: Vị trí anchor thay đổi, handle vẫn đang active
```

### Test 7: Ctrl Direct Selection
```
1. Vẽ 3-4 points
2. Giữ Ctrl + Click anchor
3. Kéo anchor sang vị trí khác
Expected: Anchor di chuyển, curve cập nhật real-time
```

### Test 8: Alt Break Symmetry
```
1. Click-Drag tại (0.3, 0.5) → Có handles đối xứng
2. Alt + Drag một handle
Expected: Handle đó độc lập, handle kia không đổi
```

### Test 9: Backspace Delete
```
1. Click vài points
2. Backspace
Expected: Xóa điểm cuối, về state trước đó
```

### Test 10: Close Path Visual
```
1. Click-Drag 3 points
2. Di chuột gần điểm đầu
Expected: 
- Điểm đầu highlight orange
- Cursor đổi sang "close" icon
- Đường nét đứt nối đến điểm đầu
```

---

## 🐛 Known Edge Cases

### Handles at image boundaries
- Handles có thể vượt ra ngoài image bounds (0-1 range)
- Điều này OK - giống Photoshop behavior

### Performance với nhiều points
- Canvas redraw on every point change
- Nên tối ưu nếu > 50 points

### Touch devices
- Alt/Ctrl modifiers khó dùng trên tablet
- Có thể thêm UI buttons cho modifiers

---

## 📊 Performance Benchmarks

### Target Metrics
- Mouse move latency: < 16ms (60fps)
- Canvas redraw: < 10ms
- Bezier calculation: < 1ms per curve

### Current Status
- ✅ All interactions feel responsive
- ✅ Smooth cursor tracking
- ✅ No lag when dragging handles

---

## 🔧 Debugging Tips

### Console logs to add
```typescript
// In mouse handlers
console.log('Pen points:', penPoints);
console.log('Modifiers:', {isAlt, isCtrl, isShift, isSpace});
console.log('Hovered:', {pointIndex, handleInfo});
```

### Visual debugging
- Uncomment control handle lines for all points
- Log canvas coordinates vs normalized
- Check bezierCurveTo parameters

---

## ✨ Future Enhancements

### Nice-to-have features
- [ ] Undo/Redo individual point edits
- [ ] Point selection + multi-select
- [ ] Keyboard arrow keys to nudge points
- [ ] Numeric input for precise coordinates
- [ ] Save/load paths
- [ ] Convert to SVG path
- [ ] Smooth/Simplify path algorithm

### Advanced features
- [ ] Pen pressure support (tablet)
- [ ] Snap to grid/guides
- [ ] Smart path completion (auto-close)
- [ ] Path operations (union, subtract, intersect)

---

Made for testing Photoshop-style Pen Tool
