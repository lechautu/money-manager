# MVP2 – Feature Instruction: Split Line (Split Transaction)

## 0) Mục tiêu
Cho phép 1 transaction được chia thành nhiều “split lines” (mỗi line có Category/Sub + Amount + Note optional) để reporting (Analytics/Budget) chính xác, đồng thời giữ UX nhập liệu nhanh.

---

## 1) Phạm vi
### In-scope
- Toggle Split ON/OFF trong Add/Edit Transaction
- CRUD split lines (add/edit/remove)
- Khi Split ON:
  - Ẩn Amount của transaction
  - Ẩn Container Category/Subcategory của transaction
  - Transaction.amount được **tự tính = sum(splitLines.amount)** khi Save
  - Container Category/Subcategory khi Save phải **NULL**
- Hiển thị Split ở Transactions List + Transaction Detail
- Edit split transaction

### Out-of-scope (không block release)
- Filter theo category phải match cả split lines (có thể làm sau)
- “Split editor” riêng ngoài Add/Edit sheet
- Auto-categorize theo rules cho từng split line (rules chỉ áp container, nhưng container bị ẩn)

---

## 2) Định nghĩa dữ liệu (không cần tech, chỉ cần behavior)
- Transaction có thể ở 2 trạng thái:
  - Normal: `is_split = false`, có `amount` và `container category/sub`
  - Split: `is_split = true`, có `splitLines[]`, `amount = sum(lines.amount)`, `container category/sub = NULL`
- SplitLine fields tối thiểu:
  - category_id, subcategory_id (required)
  - amount (required, > 0)
  - note (optional)

---

## 3) UX Flow & UI Spec

### 3.1 Transactions List (v2)
- Với split transaction:
  - Hiển thị badge: `Split`
  - Amount hiển thị = `transaction.amount` (đã compute)
  - Category icon/title:
    - Không dùng container category (vì NULL)
    - Hiển thị title ưu tiên:
      - Note/Merchant nếu có, else “Split Transaction”
    - Subline gợi ý: “N lines” (ví dụ “3 lines”)

### 3.2 Transaction Detail (v2)
- Với split transaction:
  - Không hiển thị container category/sub
  - Có section “Split”:
    - List các split lines: `Category/Sub — Amount` (+ note nếu có)
    - Dòng cuối: `Total: transaction.amount`

### 3.3 Add/Edit Transaction (full-screen sheet)

#### A) Split OFF (default)
- Hiển thị:
  - Amount (editable)
  - Container Category/Subcategory (editable)
  - Other fields (date, account, note, etc.)

#### B) Toggle Split ON
- UI thay đổi ngay lập tức:
  - Ẩn Amount field
  - Ẩn Container Category/Subcategory field
  - Hiển thị Split Editor inline:
    - List lines
    - CTA: `+ Add split line`
    - Footer: `Total (computed): X` (read-only)
- Split Editor (mỗi line):
  - Category/Sub picker (required)
  - Amount input (required)
  - Note input (optional)
  - Remove icon/button

##### Auto-create line khi vừa bật Split ON (để UX nhanh)
- Nếu trước đó transaction đang có:
  - Amount > 0 **và** container category/sub đã chọn
  => Tự tạo 1 split line:
  - line.category/sub = container category/sub
  - line.amount = amount cũ
  - line.note = (optional) trống
- Nếu chỉ có amount nhưng chưa có category:
  - Tạo 1 line với amount = amount cũ, category/sub = empty (user phải chọn)
- Nếu amount trống/0:
  - Bắt đầu với 0 lines (user bấm Add line)

#### C) Khi Split ON và user Save
- Validation (xem mục 4)
- Trước khi persist:
  - `computed_total = sum(splitLines.amount)`
  - Set `transaction.amount = computed_total`
  - Set `transaction.category_id = NULL` và `transaction.subcategory_id = NULL`
  - Set `transaction.is_split = true`
- Amount không bao giờ lấy từ input (vì đã ẩn)

#### D) Toggle Split OFF (từ ON)
- Hiển thị lại:
  - Amount field
  - Container Category/Subcategory
- Prefill:
  - Amount = computed_total hiện tại
  - Category/Sub:
    - Nếu trong session trước khi bật Split ON đã có container category/sub (draft) => restore lại
    - Nếu không có draft:
      - Option tối thiểu: để trống (user chọn)
      - Option UX tốt hơn: auto-pick category/sub của split line có amount lớn nhất

> Khi Split OFF rồi Save: splitLines có thể bị discard (tùy thiết kế), nhưng tối thiểu phải đảm bảo transaction trở về Normal state.

### 3.4 Không cho Split với Transfer (nếu app có Transfer type)
- Nếu type = Transfer:
  - Disable/hide Split toggle
  - (Copy hint) “Split is not available for transfers.”

---

## 4) Validation & Error States

### Khi Split ON
- Không cho Save nếu:
  - Không có split lines (>= 1 line required)
  - Bất kỳ line nào thiếu category/sub
  - Bất kỳ line nào amount <= 0 hoặc không hợp lệ
- Inline error:
  - Nếu thiếu category/sub: error ngay dưới picker của line
  - Nếu amount invalid: error ngay dưới amount input của line
- Footer:
  - Luôn hiển thị `Total (computed)` và update realtime

### Khi Split OFF
- Validation amount như hiện tại (existing behavior)
- Container category/sub required như hiện tại (existing behavior)

---

## 5) Reporting Rules (Analytics/Budget)
- Nếu `transaction.is_split = true`:
  - Analytics/Budget phải aggregate theo splitLines (không dùng container category)
- Nếu `is_split = false`:
  - Analytics/Budget theo container category như hiện tại
- Không double-count:
  - 1 split transaction chỉ được tính **1 lần** thông qua tổng các split lines

---

## 6) Edge Cases / Interaction với feature khác
- Clone transaction:
  - Nếu clone split transaction: copy splitLines, amount sẽ compute lại từ lines
  - Không copy installment link (nếu có)
- Installment linking:
  - Split được phép
  - Transaction.amount (computed) là số dùng để so với installment item amount (nếu có check/cảnh báo)
- Import/Export:
  - Khi import split transaction:
    - Nếu transaction.amount khác sum(lines): ưu tiên **recompute** amount từ lines (và log warning nội bộ nếu có hệ thống cảnh báo)

---

## 7) Definition of Done (DoD)
- Add/Edit:
  - Toggle Split ON => Amount + Container Category bị ẩn
  - Total (computed) realtime đúng
  - Save => transaction.amount = sum(lines), container category NULL
- List:
  - Split badge + amount đúng + subline “N lines”
- Detail:
  - Hiển thị đầy đủ split lines + total
- Analytics/Budget:
  - Split transaction được tính theo lines
- Regression:
  - Normal transaction không bị ảnh hưởng

---

## 8) QA Checklist (manual)
1) Bật Split ON từ transaction normal có amount+category => auto-create 1 line đúng
2) Split ON:
   - Add 3 lines => Total computed đúng
   - Remove 1 line => Total update đúng
3) Validation:
   - 0 lines => Save disabled
   - Line thiếu category => Save disabled + inline error
   - Line amount = 0 => Save disabled + inline error
4) Save split => mở detail thấy split lines + total đúng
5) Toggle Split OFF sau khi đã tạo lines => amount prefill = computed total
6) Analytics/Budget: cùng 1 khoảng thời gian, split lines phân bổ đúng theo category

---
