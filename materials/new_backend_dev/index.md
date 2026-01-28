# Spring Boot for Frontend Devs

Việc chuyển từ Frontend/App sang Backend giống như việc bạn từ một người thiết kế nội thất (tập trung vào trải nghiệm, thẩm mỹ, tương tác) chuyển sang làm kỹ sư xây dựng và hệ thống điện nước (tập trung vào kết cấu, sự bền bỉ và luồng dữ liệu).

Dưới đây là danh sách những "khoảng trống" phổ biến nhất mà các dev Frontend thường gặp phải khi bước chân vào Spring Boot:

---

### 1. Tư duy về "Luồng chạy" (Request-Response Cycle)

Ở Frontend, bạn quen với Event-driven (click, hover, async/await). Ở Backend, mọi thứ xoay quanh vòng đời của một HTTP Request.

* **Filter vs. Interceptor:** Bạn cần biết chặn request ở đâu (Security, Logging) trước khi nó chạm tới Controller.
* **DispatcherServlet:** "Trái tim" của Spring MVC. Hiểu cách nó điều phối request là cực kỳ quan trọng.

### 2. Dependency Injection (DI) & Inversion of Control (IoC)

Frontend (như Angular) cũng có DI, nhưng Spring nâng nó lên một tầm cao mới bằng **Reflection**.

* **Bean Lifecycle:** Một object trong Spring không chỉ là `new Object()`. Nó được Spring quản lý từ lúc sinh ra đến lúc chết đi.
* **Scopes:** Bạn cần phân biệt khi nào dùng `Singleton` (mặc định), `Prototype`, hay `Request/Session scope`.

### 3. "Cơn ác mộng" mang tên Persistence (JPA/Hibernate)

Đây là nơi các Frontend dev dễ "gục ngã" nhất.

* **Entity vs. DTO:** Tuyệt đối không bao giờ trả trực tiếp Entity (database model) ra ngoài API.
* **Lazy Loading vs. Eager Loading:** Nếu không hiểu cái này, bạn sẽ gặp lỗi `LazyInitializationException` hoặc vấn đề hiệu năng kinh điển mang tên **N+1 Query**.
* **Transaction Management (`@Transactional`):** Hiểu về tính toàn vẹn dữ liệu (ACID). Nếu một bước lỗi, toàn bộ phải rollback.

### 4. Concurrency & Multi-threading

Trong khi JavaScript (Frontend) chạy đơn luồng (Single-threaded) với Event Loop, Java là đa luồng.

* **Thread Safety:** Khi 100 người cùng gọi vào một Service, các biến global sẽ ra sao?
* **ThreadLocal:** Cách Spring lưu trữ thông tin user hiện tại xuyên suốt các layer.

### 5. Layered Architecture (Kiến trúc phân tầng)

Frontend thường tổ chức theo Component. Backend Spring Boot chuẩn mực phải chia tầng:

* **Controller:** Chỉ nhận và validate input.
* **Service:** Nơi chứa logic nghiệp vụ (Business Logic).
* **Repository:** Chỉ làm việc với Database.

> **Lưu ý:** Đừng bao giờ viết code logic xử lý dữ liệu ngay trong Controller.

### 6. Spring Security (Authentication & Authorization)

Frontend chỉ việc lưu Token vào LocalStorage và gửi đi. Backend phải:

* Cấu hình Filter Chain.
* Giải mã JWT, kiểm tra Role/Authority.
* Xử lý CORS và CSRF (phía Server-side).

### 7. Observability (Khả năng quan sát)

Backend không có `console.log` để user chụp màn hình gửi cho bạn đâu.

* **Logging (SLF4J/Logback):** Ghi log sao cho hiệu quả, không làm đầy ổ cứng nhưng vẫn đủ để debug.
* **Spring Boot Actuator:** Theo dõi "sức khỏe" của hệ thống (CPU, RAM, DB Connection).

### 8. Cẩm Nang Toàn Tập: JPA Relationships & Migration

Tổng hợp toàn bộ kiến thức từ thiết kế Database, code Java (Entity & Repository), SQL Migration và các ví dụ thực tế.

* **JPA Relationships:**
* **Migration:**

---

### Bảng so sánh nhanh để bạn dễ hình dung:

| Khái niệm | Frontend (Web/App) | Backend (Spring Boot 3) |
| --- | --- | --- |
| **Quản lý trạng thái** | Redux, Context API, Vuex | Database (PostgreSQL, MySQL), Redis |
| **Luồng xử lý** | Async/Await, Event Loop | Multi-threading, Thread Pool |
| **Bảo mật** | Ẩn/Hiện UI dựa trên Role | Method Security (`@PreAuthorize`), Filter |
| **Giao tiếp** | Gọi API (Axios, Fetch) | Xây dựng API (REST, GraphQL, gRPC) |
