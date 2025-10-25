[Verified] Cơ chế Pen Tool trong Photoshop — mô tả chi tiết, thực chiến.
(English quick-notes are under each bullet.)

1) Tư duy nền tảng

Anchor point (điểm neo) + Segment (đoạn path) + Handles/Direction lines (tay nắm/đường hướng).
Anchor points + segments + direction handles define the path.

Corner point: không liên kết hướng hai phía (góc gãy).
Corner point breaks handle symmetry.

Smooth point: hai tay nắm thẳng hàng, độ cong mượt liên tục.
Smooth point keeps handles collinear for continuous curvature.

2) Vẽ đường thẳng (Straight segments)

Click → Click: tạo các đoạn thẳng nối 2 điểm neo.
Click → Click for straight lines.

Shift + Click: khóa góc ở bội số 45° (0°, 45°, 90°…).
Hold Shift to constrain to 45° increments.

Backspace/Delete (khi đang vẽ): xóa điểm vừa đặt. Esc: kết thúc path.
Backspace deletes last point; Esc ends path.

3) Vẽ đường cong (Curved segments)

Click–Drag để tạo “smooth point”: kéo chuột khi đặt điểm để “rút” hai tay nắm.
Click–Drag to pull out handles and create a smooth point.

Kéo như thế nào? Quy tắc tiếp tuyến (tangent rule)

Góc kéo quyết định hướng tiếp tuyến (độ cong bẻ theo hướng vuông góc với tay nắm).
Drag angle = tangent direction; curvature bends perpendicular to the handle.

Độ dài tay nắm quyết định độ mạnh cong (tay nắm càng dài, cong càng “mềm/đậm”).
Handle length = curvature strength.

Mẹo cực quan trọng (tránh “bị ngược”)

Khi đặt điểm B, đoạn A→B bị ảnh hưởng bởi tay nắm “vào” của B (tay nắm đối hướng với chiều bạn kéo).
⇒ Muốn khúc cong A→B “phồng lên” lên trên tại B, khi đặt B hãy kéo xuống dưới.
At point B, the incoming handle (opposite your drag) shapes the A→B curve. Drag opposite the bulge you want.

Shift trong lúc kéo: khóa góc tay nắm 0/45/90° để kiểm soát cong ổn định.
Hold Shift while dragging for clean, constrained handles.

Spacebar (đang kéo tay nắm): tạm thời di chuyển vị trí điểm neo trước khi thả.
Hold Space to reposition the anchor before releasing.

Hai bài tập kinh điển

Đường cong “C”

Click–Drag tại A theo hướng tiếp tuyến mong muốn khi rời A.

Click–Drag tại B ngược phía phồng bạn muốn ở B (xem mẹo “bị ngược”).
For a "C" curve, drag at A along the leaving tangent; at B drag opposite the desired bulge.

Đường cong “S”

A: Click–Drag theo hướng rời A.

B: Click–Drag ngược phía phồng cho khúc A→B.

Giữ Alt/Option & kéo 1 tay nắm của B để bẻ hướng rời B khác hướng vào B (tạo “S”).
For an "S", break B's handles with Alt/Option to change leaving direction.

4) Alt/Option để chỉnh curve “đúng bệnh”

Alt/Option + Drag tay nắm tại một điểm → Convert to Corner (Cusp): tách hai tay nắm, chỉnh một phía không ảnh hưởng phía kia.
Alt/Option-drag a handle to break symmetry (cusp): adjust one side independently.

Alt/Option + Click lên điểm smooth → Corner không tay nắm: bỏ cong, biến về góc nhọn.
Alt/Option-click a smooth point to remove handles (sharp corner).

Alt/Option + Click–Drag trên điểm corner (chưa có tay nắm) → rút tay nắm mới: biến corner thành smooth/cusp tùy bạn kéo một hay hai tay nắm.
Alt/Option-drag from a corner to pull out new handles.

5) Chỉnh trong lúc đang vẽ (power moves)

Ctrl/Cmd (tạm Direct Selection): giữ để dịch điểm neo hoặc kéo tay nắm ngay lập tức, rồi thả ra tiếp tục vẽ.
Hold Ctrl/Cmd to temporarily move points/handles while drawing.

Đóng path: rê về điểm đầu, biểu tượng vòng tròn xuất hiện → click để đóng.
Hover start point until you see a small circle to close the path.

Add/Delete point nhanh: khi Pen đang chọn

Rê lên path thấy dấu + → click để thêm điểm.

Rê lên điểm thấy dấu – → click để xóa điểm.
Pen auto-switches to Add/Delete when hovering segments/points.

6) Quy tắc vàng để cong mượt, ít “lổn nhổn”

Ít điểm, tay nắm dài hơn là nhiều điểm, tay nắm ngắn → path mượt, dễ chỉnh.
Fewer points + longer handles = smoother, editable curves.

Đặt điểm ở chỗ đổi hướng cong (extreme of curvature), không đặt giữa đoạn phẳng.
Anchor at curvature changes, not mid-flat segments.

Giữ tay nắm thẳng hàng cho smooth; chỉ dùng Alt tách tay nắm khi cần góc hoặc S-curve.
Keep handles collinear; use Alt to break only when needed.

7) Quy trình chuẩn (recipe nhanh)

Lên plan: nhìn hình, xác định các “điểm đổi hướng”.
Plan anchors at curvature extrema.

Đi từ ít điểm: đặt A (Click–Drag), đặt B (Click–Drag ngược phía phồng).
Start with minimal points.

Alt khi cần: tại điểm muốn đổi chiều mạnh hoặc tạo “S”, Alt/Option–Drag để bẻ tay nắm một phía.
Use Alt for cusps or S-shapes.

Ctrl/Cmd tinh chỉnh: kéo nhẹ điểm/tay nắm để hoàn thiện.
Refine with temporary Direct Selection.

8) Lỗi thường gặp & cách gỡ

Cong sai hướng ở điểm vừa đặt → nhớ quy tắc: muốn phồng lên trên thì kéo xuống dưới khi đặt điểm đó.
Curve bulges opposite to your drag at that anchor.

Đường gãy khựng → bạn đã có corner thay vì smooth; Alt/Option–Drag để rút tay nắm và làm mượt.
Kinks = corners; pull handles to smooth.

“Răng cưa” vì quá nhiều điểm → xóa bớt, kéo dài tay nắm.
Too many anchors cause jitter; prefer longer handles.

9) TL;DR – Cheat sheet (EN/VN)

Click = corner/straight. | Click = điểm thẳng/góc.

Click–Drag = smooth/curved. | Click–Drag = điểm mượt/công.

Shift = constrain 45°. | Shift = khóa 45°.

Alt/Option–Drag handle = break symmetry (cusp). | Alt–Kéo tay nắm = tách tay nắm.

Alt/Option–Click point = remove handles (sharp). | Alt–Click điểm = bỏ tay nắm.

Alt/Option–Drag on corner = create handles. | Alt–Kéo từ corner = rút tay nắm.

Ctrl/Cmd (hold) = tạm chọn điểm/tay nắm để chỉnh. | Ctrl/Cmd = chỉnh nhanh.

Space (while dragging) = di chuyển điểm trước khi thả. | Space = đổi chỗ điểm khi đang kéo.
