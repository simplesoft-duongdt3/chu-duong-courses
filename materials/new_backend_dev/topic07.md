Chào bạn! Chào mừng bạn đến với "trạm kiểm soát" cuối cùng trong chuỗi hành trình. Ở Frontend, khi có lỗi, bạn mở **Chrome DevTools** hoặc xem **Sentry**. Nhưng ở Backend, khi server đã "lên sóng" (Deploy), bạn không thể nhảy vào máy chủ để xem nó đang chạy thế nào.

Đó là lý do **Logging** và **Actuator** ra đời. Nếu Logging là "đôi mắt" giúp bạn nhìn thấy diễn biến bên trong code, thì Actuator là "nhịp tim" giúp bạn biết hệ thống còn sống hay đã "ngất".

---

# Chủ đề 7: Logging & Monitoring (Actuator)

### 1. Lý thuyết: Quản lý hộp đen

#### **Logging (Ghi nhật ký)**

Đừng bao giờ dùng `System.out.println()` trong Spring Boot! Tại sao? Vì nó làm giảm hiệu năng và không thể quản lý. Chúng ta dùng **SLF4J** (Giao diện) kết hợp với **Logback** (Bộ máy thực thi).

* **Log Levels:** 1. `ERROR`: Lỗi nghiêm trọng (cần sửa ngay).
2. `WARN`: Cảnh báo (có thể gây lỗi tương lai).
3. `INFO`: Thông tin quan trọng (App bắt đầu, User đăng nhập).
4. `DEBUG`: Thông tin chi tiết để gỡ lỗi (chỉ bật ở môi trường Dev).
5. `TRACE`: Chi tiết nhất từng bước chạy.

#### **Spring Boot Actuator**

Đây là một thư viện cung cấp các **Endpoints** (đường dẫn API) để bạn "soi" vào bên trong ứng dụng. Bạn có thể xem lượng RAM đang dùng, số lượng Request đang chờ, hoặc thậm chí là danh sách tất cả các Beans đang chạy.

---

### 2. Ví dụ Code & Cấu hình

#### **A. Logging chuyên nghiệp với Lombok**

Thay vì khai báo Logger thủ công, hãy dùng `@Slf4j`.

```java
@Service
@Slf4j // Tự động tạo biến 'log'
public class PaymentService {

    public void processPayment(String orderId, double amount) {
        log.info("Bắt đầu xử lý thanh toán cho đơn hàng: {}", orderId);
        
        try {
            // Logic thanh toán...
            if (amount < 0) {
                log.warn("Phát hiện số tiền âm cho đơn hàng {}: {}", orderId, amount);
            }
        } catch (Exception e) {
            log.error("Lỗi nghiêm trọng khi thanh toán đơn hàng {}: {}", orderId, e.getMessage());
        }
    }
}

```

#### **B. Cấu hình Actuator (`application.yml`)**

Mặc định Actuator khóa hầu hết các cổng vì lý do bảo mật. Bạn cần mở chúng ra.

```yaml
management:
  endpoints:
    web:
      exposure:
        include: "health,info,metrics,prometheus" # Mở các cổng cần thiết
  endpoint:
    health:
      show-details: always # Hiện chi tiết trạng thái DB, Disk, v.v.

```

#### **C. Custom Health Indicator**

Bạn có thể tự viết code để báo cho hệ thống biết khi nào Service của bạn "không ổn".

```java
@Component
public class ExternalApiHealthIndicator implements HealthIndicator {
    @Override
    public Health health() {
        boolean isExternalApiUp = checkApi(); // Hàm check API bên thứ 3
        if (isExternalApiUp) {
            return Health.up().withDetail("External API", "Active").build();
        }
        return Health.down().withDetail("External API", "Down").build();
    }
}

```

---

### 3. Tình huống thực tế (Real-world Scenarios)

**Tình huống 1: Debug lỗi "chỉ xảy ra trên Production"**

* **Vấn đề:** Ở máy local (Dev) thì chạy ngon, nhưng lên server (Prod) thì thi thoảng bị lỗi 500 mà không rõ nguyên nhân.
* **Giải pháp:** Bạn vào cấu hình Log, nâng level lên `DEBUG` cho riêng package đó. Sau đó xem log file để thấy giá trị biến tại thời điểm lỗi. Với `Logback`, bạn có thể cấu hình để log tự động nén và xóa sau 30 ngày để không làm đầy ổ cứng.

**Tình huống 2: Hệ thống tự động phục hồi (Auto-healing)**

* **Vấn đề:** Server bị treo do tràn bộ nhớ (Memory Leak) hoặc Database bị ngắt kết nối.
* **Giải pháp:** Các công cụ như **Kubernetes** hoặc **AWS** sẽ liên tục gọi vào endpoint `/actuator/health`. Nếu nó nhận về trạng thái `DOWN`, nó sẽ tự động "giết" con Server cũ và khởi động một con mới ngay lập tức. User sẽ không hề hay biết.

**Tình huống 3: Theo dõi hiệu năng (Metrics)**

* **Vấn đề:** Bạn muốn biết API nào đang bị chậm nhất để tối ưu.
* **Giải pháp:** Dùng Actuator kết hợp với **Prometheus** và **Grafana**. Bạn sẽ có một Dashboard biểu đồ cực đẹp (giống như Google Analytics cho Backend) để xem: "À, API `/api/orders` đang mất tận 2 giây để phản hồi, cần check lại Database Index!".

---

### Bảng so sánh cho "Thanh niên Frontend"

| Đặc điểm | Frontend (DevTools) | Backend (Logging/Actuator) |
| --- | --- | --- |
| **Ghi vết** | `console.log()` | `log.info()`, `log.error()` |
| **Kiểm tra trạng thái** | Network Tab | `/actuator/health` |
| **Phân tích hiệu năng** | Lighthouse, Performance Tab | `/actuator/metrics`, Grafana |
| **Lưu trữ** | Mất khi F5 trang | Lưu vào File hoặc Log Central (ELK Stack) |

---

> **Lời khuyên chân thành:** Đừng bao giờ log các thông tin nhạy cảm của User như **Password**, **Số thẻ tín dụng**, hay **Token** vào file log. Nếu file log này bị lộ, đó sẽ là một thảm họa bảo mật!

---

Nếu ở Frontend bạn chỉ có một cái "hố" duy nhất là `console.log`, thì ở Backend, Logging là một **hệ thống quản trị dữ liệu**.

Ở Spring Boot 3, công cụ mặc định là **Logback** (đi kèm với SLF4J). Chúng ta sẽ đi từ cấu hình đơn giản đến những thiết lập "chuẩn công nghiệp" để bảo vệ ổ cứng server.

---

# Chi tiết về Logging: Từ Console đến Chiến lược Rotation

### 1. Cấu hình cơ bản (application.yml)

Với những dự án nhỏ, bạn có thể cấu hình nhanh ngay trong file `application.yml`.

```yaml
logging:
  level:
    root: INFO
    com.example.demo: DEBUG # Log chi tiết cho code của bạn
    org.hibernate.SQL: DEBUG # Xem câu lệnh SQL của JPA
  pattern:
    # Cấu hình màu sắc và định dạng hiển thị trên Console
    console: "%d{yyyy-MM-dd HH:mm:ss} %-5level [%thread] %logger{36} : %msg%n"
  file:
    name: logs/app-backend.log # Tự động tạo folder logs và file

```

---

### 2. Cấu hình nâng cao với `logback-spring.xml`

Khi bạn cần **Log Rotation** (Xoay vòng log - ví dụ: mỗi ngày một file, hoặc file đầy 10MB thì cắt), bạn **phải** dùng file `src/main/resources/logback-spring.xml`. Spring Boot sẽ ưu tiên file này hơn mọi cấu hình trong `.yml`.

#### Ví dụ file cấu hình chuẩn:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <property name="LOG_PATH" value="./logs" />

    <appender name="Console" class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <pattern>%d{HH:mm:ss.SSS} [%thread] %highlight(%-5level) %cyan(%logger{36}) - %msg%n</pattern>
        </encoder>
    </appender>

    <appender name="RollingFile" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>${LOG_PATH}/application.log</file>
        
        <rollingPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedRollingPolicy">
            <fileNamePattern>${LOG_PATH}/archived/app.%d{yyyy-MM-dd}.%i.log.gz</fileNamePattern>
            
            <maxFileSize>10MB</maxFileSize>
            
            <maxHistory>30</maxHistory>
            
            <totalSizeCap>1GB</totalSizeCap>
        </rollingPolicy>

        <encoder>
            <pattern>%d{yyyy-MM-dd HH:mm:ss} [%thread] %-5level %logger{36} - %msg%n</pattern>
        </encoder>
    </appender>

    <root level="INFO">
        <appender-ref ref="Console" />
        <appender-ref ref="RollingFile" />
    </root>
</configuration>

```

---

### 3. Tình huống thực tế (Real-world Scenarios)

**Tình huống 1: "Cứu nguy" ổ cứng Server**

* **Vấn đề:** Bạn deploy app lên server, sau 1 tháng app sập vì... đầy ổ cứng. Nguyên nhân là file log lên tới 50GB.
* **Giải pháp:** Sử dụng `SizeAndTimeBasedRollingPolicy` như ví dụ trên. Việc giới hạn `maxFileSize` và `maxHistory` đảm bảo hệ thống luôn tự dọn dẹp (delete) các bản tin cũ, giữ cho ổ cứng luôn "thở" được.

**Tình huống 2: Log tập trung (Centralized Logging với ELK Stack)**

* **Vấn đề:** Bạn có 5 con server chạy cùng lúc. Khi có lỗi, bạn không thể SSH vào từng con để đọc file `.log` được.
* **Giải pháp:** Thay vì log dạng text thuần túy, bạn cấu hình Logback xuất ra định dạng **JSON**. Các hệ thống như Logstash sẽ "hút" các file JSON này về một kho chung (Elasticsearch) để bạn dùng giao diện (Kibana) tìm kiếm lỗi như dùng Google.

**Tình huống 3: Mute (Tắt bớt) Log của thư viện bên thứ 3**

* **Vấn đề:** Khi bạn bật mode `DEBUG`, các thư viện như Spring Security hay Hibernate in ra hàng nghìn dòng log khiến bạn không tìm thấy log của chính mình.
* **Giải pháp:** Cấu hình level riêng biệt cho từng package.
```yaml
logging:
  level:
    org.springframework: WARN # Chỉ hiện lỗi của Spring
    com.yourproject: DEBUG    # Hiện chi tiết log của bạn

```



---

### Các mẹo "bỏ túi" cho bạn:

* **MDC (Mapped Diagnostic Context):** Đây là kỹ thuật cực hay để gán `userId` hoặc `traceId` vào mọi dòng log. Khi user báo lỗi, bạn chỉ cần search `traceId` đó là thấy toàn bộ lịch sử di chuyển của request đó qua các Service.
* **Async Logging:** Việc ghi log ra file là thao tác I/O chậm. Trong các hệ thống chịu tải cao, người ta bọc Appender trong lớp `AsyncAppender` để việc ghi log không làm chậm logic chính của API.

**Tóm tắt cho Dev Frontend:**

* **Console:** Để xem khi code (giống `console.log`).
* **File:** Để lưu vết khi chạy thật.
* **Rotation:** Để Server không bị "chết chùm" vì đầy bộ nhớ.