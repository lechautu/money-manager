# MVP2 – Feature Instruction: Trends & Comparisons

## 0) Mục tiêu
Tạo màn **Trends** trong Analytics để:
- Xem **xu hướng** Expense/Income/Net theo tháng (3/6/12 tháng hoặc custom).
- So sánh **period-over-period** (Previous period / MoM) và **YoY** (nếu đủ dữ liệu).
- Hiển thị **Top movers** (category tăng/giảm mạnh) và cho phép drill-down về Transactions List.

---

## 1) Phạm vi (Scope)

### In-scope (MVP2)
1) Aggregation theo **tháng** (monthly buckets) cho:
- Total Expense
- Total Income
- Net = Income − Expense

2) Compare modes
- `Previous period` (cùng độ dài với range đang chọn)
- `YoY` (cùng kỳ năm trước, chỉ enable khi đủ dữ liệu)
- Nếu range = `This Month` thì previous period tương đương `Last Month` (MoM)

3) Top movers by category (dựa trên delta giữa current vs compare)
- Top 5 tăng mạnh (Increased)
- Top 5 giảm mạnh (Decreased)
- Mỗi item hiển thị: delta absolute + delta % (nếu base > 0)

4) Filters tối thiểu
- Range: This Month / 3M / 6M / 12M / Custom
- Accounts: All hoặc chọn 1+ account
- Type: All / Expense / Income

### Out-of-scope (không block MVP2)
- Merchant-level movers
- Weekly/Daily granularity
- Forecast overlay
- Export report
- Apply rules/budget rollover logic

---

## 2) Data/Behavior Rules (không cần tech details)

### 2.1 Inclusion/Exclusion
- **Exclude Transfer** khỏi Income/Expense (không có toggle include trong MVP2).
- **Split transactions**:
  - Reporting phải tính theo **split lines**.
  - Không double count: tổng theo category từ split lines phải khớp tổng expense/income của tháng.
- Installment-linked transactions:
  - Tính như transaction bình thường (actual).
- Negative amounts (nếu tồn tại):
  - Hiển thị đúng sign theo loại; không tự reclassify.

### 2.2 Compare behavior
- `Previous period`:
  - Compare với khoảng thời gian ngay trước đó, **cùng số tháng**.
- `YoY`:
  - Compare cùng range nhưng lùi 1 năm.
  - Nếu thiếu dữ liệu YoY: disable và show hint “Not enough data”.

### 2.3 Category movers computation
- Movers dựa trên **category totals** trong current period và compare period:
  - delta = current_total(category) − compare_total(category)
- Sorting:
  - Increased: sort delta desc, take top 5
  - Decreased: sort delta asc (âm lớn), take top 5
- Percent:
  - % = delta / compare_total (chỉ nếu compare_total > 0), else hiển thị “—” hoặc chỉ absolute.

---

## 3) IA / Entry
- Tab **Analytics** → sub-tab/segment: `Overview | Categories | Trends`
- Màn Trends là screen riêng trong Analytics.

---

## 4) UI Spec

## S1) Analytics → Trends (NEW)

### 4.1 Header controls (sticky)
- Range selector (chip/dropdown):
  - This Month, 3M, 6M, 12M, Custom
- Compare toggle:
  - OFF/ON
  - Khi ON → compare mode selector:
    - Previous period (default)
    - YoY (disable nếu thiếu dữ liệu)
- Account filter (chip):
  - All accounts (default) / multi-select
- Type filter (chip):
  - All (default) / Expense / Income

> Nếu header chật: Account + Type chuyển vào Filter Sheet.

### 4.2 Section A – KPI Summary
Hiển thị 3 KPI:
- Expense total (current period)
- Income total (current period)
- Net (current period)

Nếu Compare ON:
- Mỗi KPI hiển thị thêm:
  - Delta absolute (±)
  - Delta % (nếu base > 0; base = 0 → show “—”)

### 4.3 Section B – Trend Chart
- Metric selector: `Expense | Income | Net`
- Chart theo tháng (bar hoặc line đều được; MVP2 chỉ cần 1 kiểu nhất quán).
- Tap data point → tooltip:
  - Month label
  - Value
  - (Optional) delta vs compare bucket nếu có

Empty state:
- “No data in selected period” + CTA “Change range”

### 4.4 Section C – Top Movers
Title: `Top movers`
- Tabs: `Increased` | `Decreased`
- Row item:
  - Category icon + name
  - Delta absolute + delta %
  - Optional subline: `Current: X • Previous: Y`

Interaction:
- Tap item → open **Transactions List** pre-filter:
  - Date range = current period
  - Account(s) = selected
  - Category = tapped category
  - Type = Expense/Income tương ứng

Empty states:
- Compare OFF: show hint “Turn on Compare to see movers”
- Compare ON nhưng thiếu data: “Not enough data to compare”

### 4.5 Section D – Insight card (optional, keep minimal)
- 1 card tóm tắt:
  - “Spending increased/decreased by X vs previous period”
- Có thể skip nếu thiếu thời gian.

---

## 5) Copy / Text
- Screen title: `Trends`
- Compare disabled (YoY): `Not enough data for YoY comparison`
- Movers compare OFF hint: `Turn on Compare to see movers`
- Empty: `No data in selected period`

---

## 6) Definition of Done (DoD)
1) Trends screen accessible từ Analytics.
2) Range 3M/6M/12M + Custom hiển thị chart đúng số tháng.
3) KPI totals đúng cho Expense/Income/Net theo filter.
4) Compare `Previous period`:
   - KPI delta (absolute + %) hiển thị đúng.
5) Compare `YoY`:
   - Enable khi đủ dữ liệu; disable + hint khi không đủ.
6) Top movers:
   - Increased/Decreased top 5 đúng theo delta category.
   - Tap mover → mở Transactions List filter đúng.
7) Data rules:
   - Transfer excluded.
   - Split transactions counted via split lines.
   - Không double count.

---

## 7) QA Checklist (manual)
1) Range 6M, Compare ON (Previous period):
   - KPI totals + delta đúng
   - Movers có dữ liệu hợp lý
2) This Month, Compare ON:
   - Delta vs last month đúng (MoM behavior)
3) YoY:
   - Khi có dữ liệu năm trước → enable + delta hiển thị
   - Khi thiếu → disable + hint
4) Transfer transactions không ảnh hưởng KPI
5) Split transaction:
   - 1 giao dịch split thành 2 category → movers reflect đúng
6) Tap movers → Transactions List mở đúng filter

---
