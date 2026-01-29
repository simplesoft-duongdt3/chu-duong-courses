# Spring Boot 3 Best Practices (The Pro Checklist)

### 1. Kiến trúc và Tổ chức Code

* **Ưu tiên Constructor Injection:** Đừng dùng `@Autowired` lên field. Dùng Constructor injection (kết hợp với `@RequiredArgsConstructor` của Lombok) giúp code dễ unit test hơn và đảm bảo các dependency không bị `null`.
* **Sử dụng Java Records cho DTO:** Với Java 17/21, hãy dùng `record` thay vì `class` cho các DTO. Nó giúp dữ liệu bất biến (immutable) và cú pháp cực kỳ ngắn gọn.
* **Layered Architecture:** Tuân thủ chặt chẽ luồng: `Controller` (chỉ điều hướng) -> `Service` (chỉ chứa logic nghiệp vụ) -> `Repository` (chỉ truy vấn dữ liệu). Đừng bao giờ viết logic tính toán trong Controller.

---

### 2. Làm việc với Database (JPA/Hibernate)

* **Luôn sử dụng Pagination & Sorting:** Tuyệt đối không bao giờ trả về `List<User>` nếu bảng có hàng nghìn dòng. Luôn dùng `Pageable` để bảo vệ bộ nhớ Server.
* **Tránh lỗi N+1:** Sử dụng `@EntityGraph` hoặc `JOIN FETCH` khi bạn biết chắc chắn mình cần lấy dữ liệu từ các bảng liên quan.
* **Soft Delete:** Thay vì xóa thật (`DELETE`), hãy dùng một cột `is_deleted` hoặc `status`. Dữ liệu là vàng, đừng vứt nó đi khi chưa thực sự cần thiết.

---

### 3. Cấu hình và Môi trường

* **Tận dụng Profiles:** Luôn tách biệt `application-dev.yml` (cho máy local) và `application-prod.yml` (cho server). Đừng bao giờ để mật khẩu DB thật trong code.
* **Sử dụng @ConfigurationProperties:** Thay vì dùng hàng chục cái `@Value("${...}")` rải rác, hãy gom các cấu hình liên quan vào một Class được đánh dấu `@ConfigurationProperties`. Nó hỗ trợ type-safe và dễ quản lý hơn nhiều.

---

### 4. Xử lý lỗi và Validation

* **Fail Fast:** Kiểm tra dữ liệu ngay tại "cửa ngõ" (Controller) bằng `@Valid`. Đừng để dữ liệu rác đi sâu vào tầng Service rồi mới báo lỗi.
* **Global Exception Handling:** Như chúng ta đã làm ở Chủ đề 5, hãy tập trung xử lý lỗi tại một nơi duy nhất. Đừng dùng `try-catch` bừa bãi trong logic nghiệp vụ.

---

### 5. Hiệu năng và Bảo mật

* **Stateless Authentication:** Luôn ưu tiên JWT cho các ứng dụng hiện đại. Đừng dùng Session nếu bạn có kế hoạch scale ứng dụng lên nhiều server.
* **Sử dụng Caching:** Với những dữ liệu ít thay đổi nhưng đọc nhiều (danh mục, cấu hình), hãy dùng `@Cacheable` (với Redis) để giảm tải cho Database.
* **Virtual Threads (Java 21):** Nếu ứng dụng của bạn thực hiện nhiều lệnh I/O (gọi API, đọc DB), hãy bật `spring.threads.virtual.enabled=true` để tối ưu hóa tài nguyên.

---

### 6. Đóng gói và Triển khai (Dockerization)

Đây là bước cuối cùng để "đóng gói" công lao của bạn. Một Dockerfile tốt phải sử dụng **Multi-stage build** và **Layered Jar** để giảm kích thước ảnh và tăng tốc độ deploy.

**Ví dụ Dockerfile tối ưu cho Spring Boot 3:**

```dockerfile
# Stage 1: Build
FROM eclipse-temurin:21-jdk-alpine as builder
WORKDIR /application
COPY . .
RUN ./mvnw clean package -DskipTests

# Stage 2: Run (Chỉ copy file jar đã build)
FROM eclipse-temurin:21-jre-alpine
WORKDIR /application
COPY --from=builder /application/target/*.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]

```

---

### Bảng so sánh Junior vs Senior Backend

| Đặc điểm | Junior Developer | Senior Developer |
| --- | --- | --- |
| **Ghi Log** | `System.out.println()` | SLF4J với chuẩn Log Levels & Correlation ID. |
| **Xử lý lỗi** | Trả về chuỗi String báo lỗi. | Custom Exception với mã lỗi (ErrorCode) chuẩn hóa. |
| **Database** | Cho Hibernate tự tạo bảng. | Dùng Flyway/Liquibase để quản lý version DB. |
| **API Call** | Gọi API trực tiếp, mặc kệ lỗi. | Dùng RestClient với Timeout và Circuit Breaker. |
| **Bảo mật** | Lưu mật khẩu dạng text thuần. | Mã hóa bằng BCrypt và cấu hình Spring Security. |

---

### ⚠️ Một "Best Practice" tối thượng:

> **"Code as if the person who ends up maintaining your code will be a violent psychopath who knows where you live."** (Hãy viết code như thể người bảo trì code của bạn sau này là một kẻ sát nhân điên rồ biết nhà bạn ở đâu).
> Luôn viết code tường minh, có comment ở những chỗ phức tạp và tuân thủ các quy tắc đặt tên.
