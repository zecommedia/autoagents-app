# 🎨 Custom Cursors & Icons System

Hệ thống quản lý cursors và icons linh hoạt cho AutoAgents-Redesign.

## 📁 Cấu trúc thư mục

```
public/
  cursors/              # SVG cursor files
    pen-tool.svg        # Pen tool cursor
    pen-tool-close.svg  # Pen tool cursor (close path state)
    eyedropper.svg      # Eyedropper/color picker cursor
    
config/
  cursors.ts           # Cursor configuration file
```

## 🚀 Cách sử dụng

### 1. Thay đổi cursor cho tool

Mở file `config/cursors.ts` và tìm tool bạn muốn thay đổi:

```typescript
penTool: {
  default: {
    svgPath: '/cursors/pen-tool.svg',  // ← Thay đổi path này
    hotspotX: 8,                        // ← Điểm click X
    hotspotY: 2,                        // ← Điểm click Y
    fallback: 'crosshair'               // ← Cursor fallback
  }
}
```

### 2. Tạo cursor SVG mới

#### Cách 1: Tạo file SVG mới

1. Tạo file SVG trong `public/cursors/`
2. Đặt tên file (ví dụ: `my-cursor.svg`)
3. Cập nhật `svgPath` trong config:

```typescript
svgPath: '/cursors/my-cursor.svg'
```

#### Cách 2: Sử dụng inline SVG

1. Tạo SVG string
2. Cập nhật trong `INLINE_SVG_CURSORS`:

```typescript
export const INLINE_SVG_CURSORS = {
  myTool: `url('data:image/svg+xml;utf8,<svg>...</svg>')`
}
```

### 3. Điều chỉnh hotspot

Hotspot là điểm "click" của cursor:

```typescript
hotspotX: 8,  // Vị trí X (pixels từ trái)
hotspotY: 2,  // Vị trí Y (pixels từ trên)
```

**Ví dụ:**
- Pen tool: hotspot tại đầu bút (8, 2)
- Eyedropper: hotspot tại đầu ống (1, 23)

### 4. Sử dụng trong component

```typescript
import { getCursorStyle } from '../config/cursors';

// Trong component
const cursorStyle = getCursorStyle('penTool', 'default');

<div style={{ cursor: cursorStyle }}>
  ...
</div>
```

Hoặc dùng React hook:

```typescript
import { useCursor } from '../config/cursors';

function MyComponent() {
  const cursor = useCursor('penTool', 'default');
  
  return <div style={{ cursor }}>...</div>;
}
```

## 🎨 Tạo cursor SVG

### Template cơ bản

```xml
<svg xmlns="http://www.w3.org/2000/svg" 
     width="32" height="32" 
     viewBox="0 0 32 32">
  <!-- Vẽ cursor của bạn ở đây -->
  <circle cx="16" cy="16" r="8" 
          fill="white" 
          stroke="black" 
          stroke-width="1"/>
</svg>
```

### Tips thiết kế

1. **Kích thước**: Nên dùng 24x24 hoặc 32x32 pixels
2. **Màu sắc**: 
   - Nền trắng/đen để dễ nhìn trên mọi background
   - Outline để tạo contrast
3. **Hotspot**: Đánh dấu điểm click rõ ràng
4. **Đơn giản**: Cursor quá phức tạp sẽ khó nhìn

### Ví dụ: Pen Tool Cursor

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">
  <g transform="translate(8, 2)">
    <!-- Pen nib (đầu bút) -->
    <path d="M 8 0 L 6 4 L 10 4 Z" 
          fill="white" 
          stroke="black" 
          stroke-width="0.75"/>
    
    <!-- Pen shaft (thân bút) -->
    <path d="M 8 4 L 8 20" 
          stroke="white" 
          stroke-width="1.5"/>
    <path d="M 8 4 L 8 20" 
          stroke="black" 
          stroke-width="0.75"/>
    
    <!-- Anchor point (điểm neo) -->
    <circle cx="8" cy="20" r="2.5" 
            fill="white" 
            stroke="black" 
            stroke-width="0.75"/>
    <circle cx="8" cy="20" r="1.2" 
            fill="black"/>
  </g>
</svg>
```

## 🔧 Available Tools

### Pen Tool
- **Default**: Cursor bút vẽ thường
- **Special**: Cursor khi gần điểm đầu (để đóng path)

### Eyedropper
- **Default**: Cursor ống nhỏ giọt

### Grab/Pan
- **Default**: Cursor grab
- **Hover**: Cursor grabbing

## 📝 Thêm tool mới

1. Tạo SVG files trong `public/cursors/`
2. Thêm config trong `config/cursors.ts`:

```typescript
export const CURSOR_CONFIG = {
  // ... existing tools
  
  myNewTool: {
    default: {
      svgPath: '/cursors/my-tool.svg',
      hotspotX: 10,
      hotspotY: 10,
      fallback: 'pointer'
    },
    hover: {
      svgPath: '/cursors/my-tool-hover.svg',
      hotspotX: 10,
      hotspotY: 10,
      fallback: 'pointer'
    }
  }
};
```

3. Sử dụng trong component:

```typescript
const cursor = getCursorStyle('myNewTool');
```

## 🎯 States

Mỗi tool có thể có 3 states:

- **default**: Trạng thái bình thường
- **hover**: Khi hover (tùy chọn)
- **special**: Trạng thái đặc biệt (tùy chọn)

## 🖼️ Công cụ thiết kế

Để tạo/edit cursor SVG, bạn có thể dùng:

1. **Online**: 
   - https://www.figma.com
   - https://www.boxy-svg.com
   - https://svg-edit.github.io/svgedit/

2. **Desktop**:
   - Adobe Illustrator
   - Inkscape (free)
   - Affinity Designer

3. **Code Editor**:
   - VS Code với extension "SVG Preview"

## 🔗 Export cursor từ Figma/Illustrator

1. Design cursor trong Figma/Illustrator
2. Export as SVG
3. Copy vào `public/cursors/`
4. Update config trong `cursors.ts`

## 💡 Examples

### Thay đổi pen tool cursor

1. Mở `public/cursors/pen-tool.svg`
2. Edit SVG (thay đổi màu, hình dạng, etc.)
3. Save file
4. Refresh browser → Cursor đã thay đổi!

### Thay đổi hotspot

```typescript
// Hotspot tại góc trên trái
hotspotX: 0,
hotspotY: 0,

// Hotspot tại giữa
hotspotX: 16,
hotspotY: 16,

// Hotspot tại góc dưới phải  
hotspotX: 32,
hotspotY: 32,
```

## 🐛 Troubleshooting

### Cursor không hiển thị?

1. Check console for errors
2. Verify SVG path is correct
3. Make sure SVG file exists in `public/cursors/`
4. Try using inline SVG fallback

### Hotspot sai vị trí?

1. Kiểm tra lại tọa độ trong SVG
2. Adjust `hotspotX` và `hotspotY`
3. Test với giá trị khác

### Cursor bị vỡ/không hiển thị đúng?

1. Validate SVG syntax
2. Remove complex filters/effects
3. Simplify SVG structure

## 📚 Resources

- [MDN: CSS cursor](https://developer.mozilla.org/en-US/docs/Web/CSS/cursor)
- [Custom cursor tutorial](https://css-tricks.com/using-css-cursors/)
- [SVG tutorial](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial)
