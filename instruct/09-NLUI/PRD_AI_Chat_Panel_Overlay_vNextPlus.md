# PRD — Sprint: AI Chat Panel Overlay (Global FAB) — Final vNext+ (Locked)

## 1) Summary
Build an **AI Chat panel overlay** accessible from **every screen** via a **global FAB**. The panel is **full screen height**, overlays current content, and supports chat with **persistent last active session** across app close/reopen.

All confirmations for sensitive/destructive actions must be handled **inside chat history** as a **message-like confirmation form** (Yes/No). **No prompts/popups outside chatbox**.

---

## 2) Goals
- Global FAB toggles chat overlay from any screen.
- Full-height overlay; while open, **all FABs hidden/under panel** and not clickable.
- Chat UX: header “AI Assistant” + X, scrollable history, input + send.
- Keyboard: Enter sends (trim/ignore whitespace), Shift+Enter newline.
- **Single-flight:** while waiting for AI response, sending is disabled.
- Accurate waiting indicator across close/reopen via refresh-on-open.
- In-chat confirmation with strict expiry + persistence rules.
- Idempotent refresh + no duplicate bubbles.
- Session expiry does not “lose” history; user can continue in a new session seamlessly.

---

## 3) Non-goals (this sprint)
- Multi-session list/switch/search/rename UI
- Attachments/images/voice
- Rich markdown beyond basic text
- Streaming responses
- Tool-call trace UI

---

## 4) UX / UI Spec

### 4.1 Global FAB (Chat toggle)
- Visible on all screens.
- Tap toggles panel open/closed.

### 4.2 Overlay Chat Panel
- Overlays current screen (no navigation away).
- **Height MUST equal screen height** (100% viewport height).
- Layout:
  1) Header: **AI Assistant** + **X**
  2) Chat history box (scrollable)
  3) Composer row: input + Send

### 4.3 Close behavior (strict)
- Backdrop click: **must NOT close**
- **ESC always closes panel** when panel is open (regardless of input focus) and consumes event
- **Mobile Back closes panel** when panel is open and consumes event  
  - OS may dismiss keyboard first depending on platform, but end state must be panel closed after a back action.
- Header **X** closes panel
- No other auto-close behavior.

### 4.4 FABs when panel is open (strict)
- All FABs (chat toggle, quick add transaction, etc.) must be **hidden or fully covered**.
- FABs must **not receive pointer events**.
- Layering: panel overlay **above all floating UI elements**.

### 4.5 Input behavior (required)
- **Enter:** send message if trimmed content non-empty.
- Whitespace-only: do not send.
- **Shift+Enter:** insert newline.
- After sending: clear input; keep focus preferred.

---

## 5) Chat Flow + Waiting Indicator

### 5.1 Single-flight messaging (required)
- While waiting for AI response:
  - Show **in-chat waiting indicator** (assistant-like typing/loading bubble).
  - **Disable Send** and Enter-to-send is no-op.
- Single-flight lock applies **only while an in-flight request exists**; on failure it unlocks immediately.

### 5.2 Waiting indicator entity (required)
- Waiting indicator is a **distinct entity with stable id**, bound to the pending turn/message.

### 5.3 Turn ordering (required)
- “Latest state by turn order” must be determined by a **server-provided monotonic sequence** (preferred) or **server timestamp**.
- **Client timestamps must not be used** for ordering decisions.

### 5.4 Refresh-on-open (required)
- **On open panel:** always refresh latest conversation state (lightweight).
- Must be **idempotent** and apply only the **latest** state (ignore stale/out-of-order results).
- Offline:
  - Fallback to local cache and show inline note **“May be outdated (offline)”**.
  - Offline state may be triggered by **repeated request failures**, not only device connectivity flags.

### 5.5 Refresh rate limiting (required)
- Refresh-on-open must be **rate-limited** (no more than once per X seconds), **unless** there is a known pending state:
  - waiting response, or
  - pending confirmation

(X is implementation-defined; must prevent spam while preserving correctness.)

---

## 6) In-chat Confirmation (strict)

### 6.1 Presentation
- Confirmation appears **inside chat history** as assistant-like message card.
- Contains preview/summary + Yes/No buttons only when pending.
- No external prompt/popup.

### 6.2 Confirmation entity + dedupe
- Confirmation cards must have **stable ids** and be deduped on refresh (same as messages).

### 6.3 Pending confirmation limit
- **At most one pending confirmation per session.**
- If a new confirmation arrives while one is pending:
  - mark the **new** one as **“Expired (superseded)”** immediately (non-interactive).

### 6.4 Composer warning when confirmation pending
- When there is a pending confirmation AND sending is enabled (not waiting response):
  - show inline warning near composer:  
    **“Sending a new message will expire the pending confirmation.”**
- Warning only appears when send is enabled.

### 6.5 Expiry rules (required, exact)
A pending confirmation becomes **Expired** when:
1) Session expires (detected by server returning “session not found/expired”), OR
2) User sends a new message **and it is server-acknowledged**.

**Definition:** server-acknowledged means the server **accepted the user message into the session**, not waiting for assistant completion.

If expired and not confirmed:
- Keep it visible in history
- Update content to: **“Expired — please re-run the request”**
- Controls removed/disabled (non-interactive)

### 6.6 Confirm action failure
- If user taps Yes/No and confirm request fails:
  - confirmation remains **Pending**
  - show **inline error near the form**
  - allow retry

### 6.7 Post-confirm content update (required)
- Update to “Confirmed” **only after confirm ack**:
  - Yes → **“Confirmed: Yes”** + optional result summary
  - No → **“Cancelled”** / “Rejected”
- If action execution fails after confirm ack:
  - do **not** revert confirmation
  - append separate assistant message: **“Action failed: …”**
- If execution is asynchronous/long-running:
  - show an in-chat status message (e.g., “Proceeding…”) until completion, then show final success/failure.

---

## 7) Persistence Scope & Session Switching

### 7.1 Persist scope (required)
- Persist **last active session only** (messages + statuses) across reload/close app/reopen.

### 7.2 Session expiry detection
- Session expiry is detected via server response: **“session not found/expired”**.

### 7.3 When session expires (required)
- Any pending confirmation becomes **Expired**.
- Any waiting response becomes **Failed** (no infinite loading).
- App transparently creates a new session for subsequent sends.

### 7.4 History behavior on session expiry (recommended, locked)
- **Keep the existing chat timeline visible (read-only)** even if its session expires.
- New messages are sent in the **new session**, but the UI preserves the full timeline continuity (no sudden clearing).
- The UI may optionally insert a system-style divider message: “Session expired — continuing in a new session.”

### 7.5 Switching session due to expiry (required)
- Invalidate old waiting states and persist under new session id.
- Do not mix entity ids across sessions.

---

## 8) Failures + Retry (required)
- Failed messages (network or session-expired) must offer **Retry**.
- Retry uses the **latest valid session**.
- Retrying must not create duplicates.

---

## 9) Idempotency / Duplicate Protection (required)
- Retrying, reopening panel, or refreshing must **not create duplicate bubbles**.
- **All entities** must have stable ids and be deduped by id:
  - user messages
  - assistant messages
  - waiting indicators
  - confirmation cards

---

## 10) Acceptance Criteria (DoD)
1. FAB visible on all screens; toggles panel.
2. Panel full-height overlay.
3. Backdrop click doesn’t close; ESC closes; Mobile Back closes; X closes — ESC/Back consume event when panel open.
4. While panel open, all FABs hidden/covered and not clickable (no pointer events); overlay above all floaters.
5. Enter sends trimmed non-empty; Shift+Enter newline; whitespace-only no-op.
6. Single-flight enforced; waiting indicator shown; sending disabled while waiting; failures unlock immediately.
7. Turn order based on server sequence/timestamp; refresh ignores stale results.
8. On open panel, refresh latest state; offline fallback shows cache + “may be outdated”; offline can be triggered by repeated failures.
9. Refresh rate-limited unless pending waiting/confirmation exists.
10. Confirmation only in chat; stable ids; deduped on refresh.
11. At most one pending confirmation; new confirmation while pending becomes “Expired (superseded)”.
12. Pending confirmation expires only on session expiry OR new user message server-acknowledged.
13. Confirm failure keeps pending + inline error; retry available.
14. Confirmed state only after confirm ack; execution failure appended as separate message; async execution shows progress status.
15. Session expiry turns waiting into failed; pending confirm into expired; history remains visible read-only; new messages continue in new session.
16. Retry exists for failed messages and uses latest valid session without duplicates.

---

## 11) Glossary

- **FAB (Floating Action Button)**: Nút nổi (thường ở góc dưới) dùng để toggle mở/đóng Chat Panel. Khi panel mở, tất cả FAB khác phải bị che/ẩn và không nhận click.

- **Chat Panel / Overlay Panel**: Panel hiển thị đè lên màn hình hiện tại (overlay). Panel cao bằng chiều cao màn hình (100vh) và không điều hướng sang trang khác.

- **Session**: Ngữ cảnh hội thoại do backend quản lý. Session có thể hết hạn. Sprint này chỉ persist **last active session**.

- **Session expiry**: Trạng thái session không còn hợp lệ. Được phát hiện khi backend trả về lỗi kiểu **“session not found/expired”**.

- **Turn**: Một “lượt” hội thoại. Thường gồm user message và assistant response tương ứng (hoặc trạng thái pending). Turn dùng để xác định thứ tự áp dụng state khi refresh.

- **Turn order**: Thứ tự lượt hội thoại. **Bắt buộc** dựa trên **server monotonic sequence** (ưu tiên) hoặc **server timestamp**. Không dùng client time để quyết định “mới nhất”.

- **In-flight request**: Request đang được gửi và chưa có kết quả cuối (pending). Chỉ khi còn in-flight mới khoá send theo single-flight.

- **Single-flight**: Quy tắc chỉ cho phép **tối đa 1** request chat đang in-flight tại một thời điểm. Khi waiting, Send/Enter-to-send bị disable.

- **Waiting indicator**: Bubble/indicator trong chat history thể hiện “AI đang trả lời”. Đây là một entity riêng có **stable id** và gắn với pending turn để có thể replace/remove đúng khi refresh.

- **Confirmation card / In-chat confirmation**: Form Yes/No hiển thị **trong chat history** như message của assistant để xác nhận hành động nhạy cảm. Không được dùng modal/popup ngoài chat.

- **Pending confirmation**: Confirmation card chưa được user chọn Yes/No.

- **Confirm ack**: Xác nhận từ backend rằng lựa chọn Yes/No đã được chấp nhận. Chỉ sau confirm ack mới chuyển confirmation sang “Confirmed: Yes/No”.

- **Execution failure**: Hành động sau khi confirm bị thất bại. Khi xảy ra, không revert confirmation; append một assistant message “Action failed: …”.

- **Server-acknowledged message (Ack)**: Backend **đã nhận và chấp nhận** user message vào session. **Không** đợi assistant trả lời xong. Ack này dùng để kích hoạt rule “sending a new message expires pending confirmation”.

- **Idempotent refresh**: Refresh state nhiều lần không tạo duplicate. UI chỉ áp dụng state mới nhất theo turn order và dedupe theo stable id.

- **Dedupe**: Loại bỏ trùng lặp message/entity dựa trên stable id (áp dụng cho user/assistant/waiting/confirmation).

- **Read-only history (on expiry)**: Khi session hết hạn, timeline cũ vẫn hiển thị để đọc nhưng không còn là session “active”; message mới sẽ đi vào session mới.

- **Rate-limited refresh**: Giới hạn tần suất refresh khi mở panel (no more than once per X seconds), trừ khi có trạng thái pending (waiting/confirmation) cần cập nhật chính xác.

