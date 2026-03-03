# Money Manager 2 — Hướng dẫn sử dụng

## Giới thiệu

Money Manager 2 (MM2) là ứng dụng quản lý tài chính cá nhân giúp bạn theo dõi thu chi, lập ngân sách, quản lý trả góp, và dự báo tài chính — tất cả trong một giao diện web hiện đại.

### Điểm nổi bật

- 📊 **Dashboard trực quan** — Thu, chi, thặng dư trong nháy mắt
- 🤖 **Trợ lý AI** — Hỏi bằng tiếng Việt: *"Tháng này chi bao nhiêu?"*, *"Ghi nhận ăn trưa 50k"*
- 🔄 **Giao dịch định kỳ** — Tự động tạo tiền lương, tiền nhà, đóng bảo hiểm
- 💳 **Quản lý trả góp** — Theo dõi lịch trả góp, cảnh báo quá hạn
- 🎯 **Ngân sách** — Đặt hạn mức chi tiêu theo danh mục
- 📈 **Dự báo** — Xem trước số dư tương lai dựa trên giao dịch định kỳ và trả góp

---

## Khởi chạy hệ thống

Mở 4 cửa sổ terminal và chạy lần lượt:

```bash
# Terminal 1: Giao diện web
cd d:\Projects\mm2
npm run dev                    # → http://localhost:5173

# Terminal 2: Backend (Tool Gateway)
cd d:\Projects\mm2\tool-gateway
npm run dev                    # → http://localhost:3200

# Terminal 3: MCP Server (kết nối AI)
cd d:\Projects\mm2\mcp-server
npm run dev                    # → http://localhost:3100

# Terminal 4: AI Gateway (trợ lý AI)
cd d:\Projects\mm2\ai-gateway
npm run dev                    # → http://localhost:3300
```

Mở trình duyệt tại **http://localhost:5173** để bắt đầu.

> [!TIP]
> Chỉ cần Terminal 1 + 2 là đủ để sử dụng cơ bản. Terminal 3 + 4 dành cho tính năng trợ lý AI.

---

## Tính năng chi tiết

### 1. Dashboard (Trang chủ)

Trang tổng quan hiển thị:
- **Thu nhập / Chi tiêu / Thặng dư** trong tháng hiện tại
- **Biểu đồ dòng tiền** — xu hướng thu chi theo ngày
- **Biểu đồ chi tiêu** — tỷ lệ chi tiêu theo danh mục
- **Tình trạng ngân sách** — đã chi bao nhiêu so với hạn mức
- **Giao dịch chờ duyệt** — nhấn để xem chi tiết
- **Thanh toán sắp tới** — kỳ trả góp gần nhất

### 2. Tài khoản

Quản lý các tài khoản tài chính:
- **Loại tài khoản**: Ngân hàng, Thẻ tín dụng, Tiền mặt
- **Số dư**: Hiển thị số dư thực (posted) riêng biệt
- **Thao tác**: Thêm, sửa, xóa tài khoản

> [!NOTE]
> Xóa tài khoản là thao tác nhạy cảm — hệ thống sẽ yêu cầu xác nhận.

### 3. Giao dịch

Ghi nhận mọi khoản thu chi:
- **Thu nhập**: Số tiền dương (lương, thưởng, ...)
- **Chi phí**: Số tiền âm (ăn uống, mua sắm, ...)
- **Chuyển khoản**: Chuyển tiền giữa các tài khoản nội bộ
- **Trạng thái**:
  - `posted` — Đã xác nhận
  - `pending` — Chờ xác nhận (giao dịch tự động tạo)
  - `ignored` — Bỏ qua (không tính vào thống kê)
- **Tìm kiếm**: Lọc theo tháng, tài khoản, danh mục, từ khóa
- **Xóa hàng loạt**: Chọn nhiều giao dịch và xóa cùng lúc

> [!TIP]
> Giao dịch bị xóa chỉ là "xóa mềm" — bạn có thể khôi phục bất cứ lúc nào.

### 4. Danh mục

Tổ chức thu chi theo cây danh mục 2 cấp:
- **Danh mục chính**: Ăn uống, Di chuyển, Giải trí, ...
- **Danh mục con**: Ăn trưa, Grab, Netflix, ...
- **Thao tác**: Thêm, đổi tên, di chuyển danh mục con sang danh mục khác, xóa

### 5. Giao dịch định kỳ (Recurring)

Tự động hóa các khoản thu chi lặp lại:
- **Tần suất**: Hàng ngày, hàng tuần, 2 tuần, hàng tháng, hàng quý, hàng năm
- **Loại**: Thu nhập, Chi phí, Chuyển khoản
- **Chế độ tự động**: Tự động tạo giao dịch khi đến ngày (có thể tắt)
- **Trạng thái mặc định**: Giao dịch tự động tạo sẽ ở trạng thái `pending` để bạn duyệt
- **Liên kết thông minh**: Nếu đã có giao dịch trùng khớp (cùng ngày, danh mục, số tiền), hệ thống sẽ tự liên kết thay vì tạo mới

### 6. Trả góp (Installments)

Quản lý các khoản trả góp dài hạn:
- **Tạo kế hoạch**: Nhập tổng số tiền, số tháng, ngày bắt đầu → hệ thống tự tính lịch thanh toán
- **Lịch thanh toán**: Xem chi tiết từng kỳ (số tiền, ngày đến hạn, trạng thái)
- **Trạng thái kỳ**: `upcoming` → `due` → `overdue` → `paid`
- **Thanh toán**: Đánh dấu đã trả hoặc liên kết với giao dịch thủ công
- **Tự động**: Tự động tạo giao dịch khi đến kỳ (tùy chọn)

### 7. Người nhận/người trả (Payees)

Quản lý danh sách đối tác giao dịch:
- Gắn payee vào giao dịch để theo dõi chi tiêu theo đối tác
- Hỗ trợ ẩn (archive) payee không còn sử dụng

### 8. Ngân sách (Budget)

Đặt hạn mức chi tiêu hàng tháng:
- **Theo danh mục**: Đặt ngân sách cho từng danh mục/danh mục con
- **Theo dõi**: Xem đã chi bao nhiêu so với hạn mức (thanh tiến trình)
- **Clone**: Sao chép ngân sách từ tháng trước sang tháng mới
- **Tự động**: Tạo ngân sách dựa trên giao dịch định kỳ và trả góp

### 9. Phân tích (Analytics)

Insight chi tiết về tài chính:
- **Chi tiêu theo danh mục** — Biểu đồ tròn
- **Xu hướng chi tiêu hàng ngày** — Biểu đồ cột
- **So sánh danh mục** — Tháng này vs tháng trước (tăng/giảm)
- **Tình trạng ngân sách** — Tổng ngân sách vs tổng đã chi

### 10. Dự báo (Forecast)

Dự đoán tài chính tương lai:
- **Dự báo số dư** — 12 tháng tới, dựa trên giao dịch định kỳ + trả góp
- **Thu nhập / Chi phí dự kiến** — Phân tách rõ nguồn
- **Chi tiết tháng** — Nhấn vào tháng bất kỳ để xem breakdown:
  - Khoản nào đã có (posted), khoản nào dự kiến (projected), khoản nào bị trễ (missed/overdue)
  - Nguồn gốc: định kỳ, trả góp, hoặc thủ công

### 11. Cài đặt (Settings)

- **Định dạng ngày**: `dd/MM/yyyy`, `MM/dd/yyyy`, ...
- **Khóa ứng dụng**: Bật mật khẩu bảo vệ
- **Sao lưu / Khôi phục**: Xuất toàn bộ dữ liệu ra JSON, nhập lại khi cần

### 12. Nhật ký (Audit Logs)

Xem lịch sử mọi thao tác thay đổi dữ liệu:
- Ai (user), làm gì (tool name), trên đối tượng nào, kết quả ra sao
- Hữu ích khi cần truy vết thao tác bất thường

---

## Trợ lý AI

### Cách hoạt động

Trợ lý AI cho phép bạn tương tác với Money Manager bằng ngôn ngữ tự nhiên thay vì click UI:

```
Bạn: "Tháng 2 tôi chi bao nhiêu cho ăn uống?"
AI:  "Tháng 2/2026, bạn chi 3.250.000đ cho danh mục Ăn uống, gồm:
      - Ăn trưa: 1.800.000đ (18 giao dịch)
      - Cà phê: 750.000đ (15 giao dịch)
      - Ăn tối: 700.000đ (7 giao dịch)"
```

### Những gì AI có thể làm

| Nhóm | Ví dụ câu lệnh |
|------|----------------|
| **Xem thông tin** | *"Tổng số dư các tài khoản"*, *"Ngân sách tháng này còn bao nhiêu?"* |
| **Ghi nhận** | *"Ghi nhận ăn trưa 50k hôm nay"*, *"Chuyển 2 triệu từ VCB sang Momo"* |
| **Phân tích** | *"So sánh chi tiêu tháng 1 và tháng 2"*, *"Danh mục nào tăng nhiều nhất?"* |
| **Quản lý** | *"Tạo quy tắc lương 15 triệu hàng tháng"*, *"Xem lịch trả góp iPhone"* |

### Thao tác nhạy cảm

Khi AI muốn thực hiện thao tác xóa hoặc import dữ liệu (Tier 2), hệ thống sẽ:
1. **Dừng lại** và hiển thị preview thao tác
2. **Yêu cầu xác nhận** từ bạn trước khi thực hiện
3. Token xác nhận có hiệu lực **5 phút** và chỉ dùng được **1 lần**

> [!CAUTION]
> AI không bao giờ tự ý xóa dữ liệu. Mọi thao tác phá hủy đều cần sự đồng ý rõ ràng của bạn.

### Cấu hình LLM

Mặc định sử dụng OpenAI. Để đổi provider, chỉ cần sửa file `ai-gateway/.env`:

```env
# OpenAI (mặc định)
LLM_API_KEY=sk-your-key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o

# Hoặc dùng model local (Ollama)
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=llama3
```

---

## Bảo mật

### Nguyên tắc chính

| Nguyên tắc | Chi tiết |
|-----------|----------|
| **Localhost-only** | Tất cả services chỉ lắng nghe trên `127.0.0.1` — không truy cập được từ mạng ngoài |
| **Origin Guard** | Chỉ chấp nhận request từ origins được tin tưởng (mặc định: `localhost:5173`) |
| **3 cấp độ bảo vệ** | Đọc (tự do) → Ghi (audit log) → Xóa/Import (cần xác nhận) |
| **Dữ liệu tại chỗ** | Database SQLite nằm trên máy bạn, không gửi lên cloud |

### Cấp độ thao tác

| Cấp | Loại | Cần xác nhận? | Ví dụ |
|-----|------|:---:|-------|
| **Tier 0** | Đọc | Không | Xem tài khoản, tìm giao dịch |
| **Tier 1** | Ghi | Không (đã audit log) | Tạo giao dịch, cập nhật tài khoản |
| **Tier 2** | Xóa/Nhạy cảm | ✅ Có | Xóa tài khoản, import dữ liệu |

### Mật khẩu ứng dụng

Bật tại **Cài đặt > Bảo mật**:
- Khi bật, ứng dụng sẽ hiện màn hình khóa khi mở
- Nhập đúng mật khẩu mới có thể truy cập

---

## Sao lưu & Khôi phục

### Xuất dữ liệu
1. Vào **Cài đặt > Quản lý dữ liệu**
2. Nhấn **Xuất dữ liệu** → tải file JSON chứa toàn bộ database
3. Lưu file ở nơi an toàn

### Nhập dữ liệu
1. Vào **Cài đặt > Quản lý dữ liệu**
2. Nhấn **Nhập dữ liệu** → chọn file JSON đã xuất
3. **Xác nhận** — thao tác này sẽ **thay thế toàn bộ** dữ liệu hiện tại

> [!WARNING]
> Nhập dữ liệu sẽ xóa sạch dữ liệu cũ. Hãy xuất bản sao lưu trước khi nhập.

---

## Câu hỏi thường gặp

### Dữ liệu lưu ở đâu?
Database SQLite nằm tại `tool-gateway/data/mm2.db` trên máy của bạn. Không có dữ liệu nào được gửi lên internet (trừ khi bạn bật trợ lý AI — lúc đó chỉ nội dung chat được gửi đến LLM provider).

### Mất dữ liệu thì sao?
Nếu đã xuất bản sao lưu (file JSON), bạn có thể khôi phục 100% dữ liệu. Nếu chưa, dữ liệu sẽ mất vĩnh viễn.

### AI có truy cập dữ liệu không?
Có — khi bạn hỏi AI, nó sẽ gọi các công cụ để đọc/ghi dữ liệu. Tuy nhiên, AI chỉ thấy dữ liệu bạn hỏi, không tải toàn bộ database. Với thao tác nhạy cảm (xóa), AI luôn phải chờ bạn xác nhận.

### Có thể dùng offline không?
Có, nếu bạn không cần trợ lý AI. Client, Tool Gateway, và MCP Server đều chạy local. Chỉ AI Gateway cần kết nối internet (để gọi OpenAI API) — trừ khi bạn dùng LLM local như Ollama.
