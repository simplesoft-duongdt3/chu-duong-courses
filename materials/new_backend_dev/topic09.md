# Chủ đề 9: Concurrency & Multi-threading

Chào mừng bạn đến với một trong những chủ đề "khó nhằn" nhất nhưng cũng quyền năng nhất của Java Backend.

Nếu ở Frontend (JavaScript), bạn sống trong thế giới **Single-threaded** (đơn luồng) với **Event Loop**, nơi mọi thứ dường như chạy cùng lúc nhưng thực chất chỉ có một việc được xử lý tại một thời điểm. Thì ở Spring Boot, bạn bước vào thế giới **Multi-threading** (đa luồng). Một biến số có thể bị hàng nghìn "người" (thread) cùng lúc nhào vào thay đổi.

---

### 1. Lý thuyết: Thread-per-request vs Event Loop

* **Mô hình của Spring Boot (Tomcat):** Mỗi Request từ Frontend gửi lên sẽ được "giao khoán" cho một Thread riêng biệt từ **Thread Pool**. Nếu có 200 request cùng lúc, sẽ có 200 thread chạy song song.
* **Vấn đề Thread-safety:** Vì các Service trong Spring mặc định là **Singleton** (dùng chung 1 instance duy nhất), nên nếu bạn khai báo một biến "global" trong Service, tất cả các Thread sẽ dùng chung biến đó. Đây là nơi thảm họa bắt đầu nếu bạn không kiểm soát được việc tranh chấp dữ liệu (Race Condition).
* **Virtual Threads (Java 21 + Spring Boot 3.2+):** Đây là cuộc cách mạng giúp Java có thể xử lý hàng triệu request đồng thời mà không tốn nhiều RAM như Thread truyền thống (Platform Threads).

---

### 2. Ví dụ Code & Cấu hình

#### A. Race Condition - Sai lầm kinh điển của Dev Frontend

Trong React, bạn dùng `useState` rất an toàn. Trong Spring, biến instance là "của chung".

```java
@Service
public class CounterService {
    private int count = 0; // BIẾN NÀY CỰC KỲ NGUY HIỂM TRONG SINGLETON BEAN

    public int increment() {
        return ++count; // Nếu 2 thread cùng chạy dòng này, kết quả sẽ sai lệch!
    }
    
    // GIẢI PHÁP: Dùng Thread-safe classes
    private AtomicInteger safeCount = new AtomicInteger(0);

    public int safeIncrement() {
        return safeCount.incrementAndGet(); // Đảm bảo luôn đúng dù bao nhiêu luồng gọi
    }
}

```

#### B. Xử lý bất đồng bộ với `@Async`

Giống như bạn đẩy một việc vào `Web Worker` hoặc chạy một `Promise` mà không `await`.

```java
@Configuration
@EnableAsync // Bật tính năng chạy ngầm
public class AsyncConfig {
    @Bean
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);
        executor.setMaxPoolSize(10);
        executor.setQueueCapacity(500);
        executor.setThreadNamePrefix("MyAsync-");
        executor.initialize();
        return executor;
    }
}

@Service
@Slf4j
public class EmailService {
    @Async // Hàm này sẽ chạy ở thread khác, không bắt user chờ
    public void sendHeavyEmail(String target) {
        log.info("Đang gửi email cho {} tại thread: {}", target, Thread.currentThread().getName());
        // Giả lập tốn 5 giây
        Thread.sleep(5000); 
        log.info("Đã gửi xong!");
    }
}

```

#### C. Bật Virtual Threads (Spring Boot 3.2+)

Chỉ cần 1 dòng cấu hình để biến app của bạn thành "siêu nhân" xử lý đồng thời.

```yaml
spring:
  threads:
    virtual:
      enabled: true

```

---

### 3. Tình huống thực tế (Real-world Scenarios)

**Tình huống 1: Xuất báo cáo Excel nghìn trang**

* **Vấn đề:** User nhấn nút "Export". Nếu chạy bình thường, API sẽ xoay vòng chờ 1 phút mới xong. Trình duyệt có thể bị Timeout (504).
* **Giải pháp:** Khi nhận yêu cầu, Backend lưu trạng thái "Processing" vào DB và bắn ngay mã `202 Accepted` về cho Frontend. Đồng thời, dùng `@Async` để bắt đầu quá trình tạo file ở một luồng ngầm. Khi xong, gửi thông báo (Socket hoặc Push) cho Frontend.

**Tình huống 2: Cập nhật số dư kho hàng (Flash Sale)**

* **Vấn đề:** 1000 người cùng nhấn mua 1 món hàng cuối cùng.
* **Giải pháp:** Không dùng biến `int` bình thường. Bạn phải dùng **Pessimistic Locking** (Khóa ở cấp Database) hoặc **Optimistic Locking** (Dùng version) để đảm bảo tại một thời điểm chỉ có 1 người mua thành công, những người còn lại sẽ nhận lỗi "Hết hàng" một cách chính xác.

**Tình huống 3: Gọi nhiều API bên thứ ba cùng lúc (Aggregator)**

* **Vấn đề:** Bạn cần thông tin từ 3 bên: Tỉ giá, Thời tiết, và Giá vàng để hiển thị Dashboard. Nếu gọi tuần tự, tổng thời gian là .
* **Giải pháp:** Dùng `CompletableFuture` (giống như `Promise.all` của JS) để gọi cả 3 API cùng lúc. Tổng thời gian chỉ bằng thằng lâu nhất ().

---

### Bảng so sánh tư duy luồng

| Đặc điểm | Frontend (JS) | Backend (Spring Boot) |
| --- | --- | --- |
| **Bản chất luồng** | Đơn luồng, không bao giờ lo tranh chấp biến. | Đa luồng, biến global là "tử địa". |
| **Xử lý lâu** | Dùng Web Workers hoặc Async/Await. | Dùng `@Async`, Thread Pool hoặc Virtual Threads. |
| **Sự cố thường gặp** | UI bị đóng băng (Main thread bị block). | Hệ thống hết Thread (Thread starvation) hoặc sai lệch dữ liệu. |
| **Độ ưu tiên** | Phản hồi mượt mà cho 1 User. | Phản hồi chính xác cho hàng triệu User. |

---

**Lời khuyên từ "hậu phương":** Đừng bao giờ lạm dụng tạo Thread mới bằng `new Thread().start()`. Hãy luôn dùng **Thread Pool** (ExecutorService) để quản lý tài nguyên. Việc tạo một Thread trong Java truyền thống rất tốn kém (khoảng **1MB** RAM mỗi thread), nên nếu tạo vô tội vạ, server sẽ "bay màu" vì `OutOfMemoryError` rất nhanh.

---

Chào bạn! Việc nắm vững `CompletableFuture` là bước nâng cấp cực kỳ quan trọng đối với một Backend dev. Nếu ở Frontend bạn có `Promise.all()` để thực hiện nhiều request cùng lúc, thì trong Java, `CompletableFuture` chính là "vũ khí" tương đương để tối ưu hóa hiệu năng và giảm độ trễ (latency).

Dưới đây là chi tiết về cách dùng `CompletableFuture` trong Spring Boot 3.

---

# Chủ đề 8.1: CompletableFuture - Song song hóa tác vụ

### 1. Lý thuyết: Bridge từ JS Promise sang Java CompletableFuture

Hãy tưởng tượng bạn cần lấy dữ liệu từ 3 nguồn khác nhau. Nếu chạy tuần tự (Sequential), tổng thời gian sẽ là tổng của 3 request. Nếu chạy song song (Parallel), tổng thời gian chỉ bằng request lâu nhất.

| JavaScript (Frontend) | Java (Spring Boot) | Ý nghĩa |
| --- | --- | --- |
| `new Promise((res, rej) => ...)` | `CompletableFuture.supplyAsync(() -> ...)` | Tạo một tác vụ chạy ngầm. |
| `.then(data => ...)` | `.thenApply(data -> ...)` | Xử lý dữ liệu sau khi xong. |
| `Promise.all([p1, p2])` | `CompletableFuture.allOf(f1, f2)` | Đợi tất cả hoàn thành. |
| `.catch(err => ...)` | `.exceptionally(ex -> ...)` | Xử lý lỗi. |

---

### 2. Ví dụ Code & Cấu hình

#### A. Cấu hình Thread Pool (Executor)

Để `CompletableFuture` hoạt động hiệu quả, bạn nên định nghĩa một `ThreadPool` riêng thay vì dùng chung `ForkJoinPool` mặc định của hệ thống.

```java
@Configuration
public class AsyncConfig {
    @Bean(name = "apiExecutor")
    public Executor apiExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(10);
        executor.setMaxPoolSize(20);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("API-Thread-");
        executor.initialize();
        return executor;
    }
}

```

#### B. Code triển khai gọi song song 3 API

Giả sử bạn cần xây dựng một Dashboard tổng hợp thông tin.

```java
@Service
@RequiredArgsConstructor
public class DashboardService {

    private final ExternalApiService apiService; // Giả định service gọi API ngoài
    private final Executor apiExecutor;

    public DashboardDTO getFullDashboard() {
        // 1. Khởi chạy 3 tác vụ song song
        CompletableFuture<Double> exchangeRateFuture = CompletableFuture.supplyAsync(
            () -> apiService.getExchangeRate(), apiExecutor);

        CompletableFuture<String> weatherFuture = CompletableFuture.supplyAsync(
            () -> apiService.getWeather(), apiExecutor);

        CompletableFuture<Integer> goldPriceFuture = CompletableFuture.supplyAsync(
            () -> apiService.getGoldPrice(), apiExecutor);

        // 2. Chờ cả 3 thằng xong (Giống Promise.all)
        CompletableFuture.allOf(exchangeRateFuture, weatherFuture, goldPriceFuture).join();

        // 3. Thu thập kết quả
        try {
            return new DashboardDTO(
                exchangeRateFuture.get(),
                weatherFuture.get(),
                goldPriceFuture.get()
            );
        } catch (Exception e) {
            throw new RuntimeException("Lỗi khi tổng hợp dữ liệu");
        }
    }
}

```

---

### 3. Tình huống thực tế (Real-world Scenarios)

**Tình huống 1: "Enrichment" Dữ liệu (Bổ sung thông tin)**

* **Vấn đề:** Khi user xem chi tiết đơn hàng, bạn cần: Thông tin đơn hàng (từ DB1), Thông tin vận chuyển (từ API Giao hàng), và Thông tin khuyến mãi (từ DB2).
* **Giải pháp:** Thay vì gọi tuần tự tốn 1.5 giây, bạn bắn cả 3 request cùng lúc. Thời gian phản hồi giảm xuống còn 0.6 giây (bằng request lâu nhất).

**Tình huống 2: Xử lý lỗi từng phần (Resilience)**

* **Vấn đề:** Bạn gọi 3 API, nhưng API "Thời tiết" bị sập. Bạn không muốn cả Dashboard bị lỗi theo.
* **Giải pháp:** Dùng `.exceptionally()` để trả về giá trị mặc định nếu API đó lỗi.
```java
CompletableFuture<String> weatherFuture = CompletableFuture.supplyAsync(() -> apiService.getWeather())
    .exceptionally(ex -> "Dữ liệu thời tiết tạm thời không khả dụng");

```



**Tình huống 3: Gửi thông báo đa kênh (Multi-channel Notification)**

* **Vấn đề:** Khi có đơn hàng mới, bạn cần gửi đồng thời Email, SMS và Push Notification.
* **Giải pháp:** Bạn không thể bắt User chờ gửi xong cả 3 cái mới hiện "Thành công". Bạn dùng `CompletableFuture.runAsync()` để đẩy cả 3 việc này ra các luồng chạy ngầm và trả về kết quả cho User ngay lập tức.

---

### Bảng so sánh "Wait" vs "Non-wait"

| Phương thức | Ý nghĩa | Frontend tương ứng |
| --- | --- | --- |
| `.join()` / `.get()` | Chờ cho đến khi có kết quả (Blocking). | `await promise` |
| `.thenAccept()` | Khi xong thì làm gì đó (Non-blocking). | `.then(data => ...)` |
| `.anyOf()` | Chỉ cần 1 thằng nhanh nhất xong là được. | `Promise.race()` |

---

**Mẹo nhỏ cho bạn:** Trong Spring Boot 3, nếu bạn sử dụng **Virtual Threads** (Java 21), việc dùng `CompletableFuture` thậm chí còn "khủng" hơn vì nó không làm tốn tài nguyên Thread thật của hệ điều hành.

---

**Virtual Threads** (Project Loom)

Đúng là Virtual Threads giúp chúng ta xử lý hàng triệu request mà không tốn nhiều RAM, nhưng nó **không phải là chiếc đũa thần**. Nếu sử dụng sai cách, bạn sẽ gặp những lỗi cực kỳ khó chịu mà hệ thống dùng Thread truyền thống không bao giờ gặp phải.

---

# Chủ đề 8.2: Những "Cạm bẫy" khi sử dụng Virtual Threads

Trong Spring Boot 3.2+, việc bật Virtual Threads rất dễ (`spring.threads.virtual.enabled=true`), nhưng dưới đây là những vấn đề bạn phải đối mặt.

### 1. Lý thuyết: Hiện tượng "Pinning" (Bị găm luồng)

Virtual Thread (VT) chạy trên một luồng thật của hệ điều hành gọi là **Carrier Thread**.

* **Bình thường:** Khi VT gặp một tác vụ chờ (như gọi API, đọc DB), nó sẽ tự động "nhường ghế" cho VT khác chạy trên Carrier Thread đó.
* **Vấn đề (Pinning):** Nếu bạn thực hiện tác vụ chờ đó bên trong một khối **`synchronized`** hoặc gọi code **Native** (C/C++), VT sẽ bị "dính chặt" vào Carrier Thread.
* **Hậu quả:** Carrier Thread bị chiếm dụng hoàn toàn, không thể phục vụ các VT khác. Nếu tất cả Carrier Threads đều bị "pin", hệ thống của bạn sẽ bị treo (Deadlock) dù CPU vẫn đang rảnh.

---

### 2. Ví dụ Code & Cấu hình

#### A. Code gây lỗi Pinning (Sử dụng `synchronized`)

Đây là lỗi cực kỳ phổ biến vì nhiều thư viện cũ vẫn dùng từ khóa này.

```java
@Service
public class LegacyService {
    private final Object lock = new Object();

    // LỖI: Khi chạy với Virtual Thread, hàm này sẽ gây 'Pinning'
    public void processData() {
        synchronized(lock) { 
            // Thực hiện I/O bên trong synchronized là 'tử địa'
            callExternalApi(); 
        }
    }
    
    // GIẢI PHÁP: Thay thế bằng ReentrantLock
    private final ReentrantLock reentrantLock = new ReentrantLock();

    public void safeProcessData() {
        reentrantLock.lock();
        try {
            callExternalApi(); // Virtual Thread có thể 'nhường ghế' an toàn ở đây
        } finally {
            reentrantLock.unlock();
        }
    }
}

```

#### B. Cấu hình kiểm tra Pinning

Bạn có thể yêu cầu JVM cảnh báo khi có hiện tượng Pinning xảy ra bằng cách thêm tham số khi chạy App:

```bash
-Djdk.tracePinnedThreads=full

```

---

### 3. Tình huống thực tế (Real-world Scenarios)

**Tình huống 1: "Nghẽn cổ chai" tại Database Connection Pool**

* **Vấn đề:** Bạn tự tin bật Virtual Threads để xử lý 10,000 request đồng thời. Nhưng `HikariCP` (DB Pool) của bạn chỉ cấu hình có 10 kết nối.
* **Hậu quả:** 10 luồng lấy được kết nối, 9,990 luồng còn lại sẽ đứng xếp hàng chờ. Virtual Threads giúp bạn "mở cửa" cho nhiều người vào nhà, nhưng "nhà vệ sinh" (Database) của bạn vẫn chỉ có bấy nhiêu đó chỗ. Hệ thống sẽ báo lỗi `Connection is not available` hàng loạt.

**Tình huống 2: Lạm dụng ThreadLocal (Memory Leak)**

* **Vấn đề:** Ở Frontend/App, bạn thường lưu dữ liệu tạm vào biến toàn cục. Ở Backend, dev thường dùng `ThreadLocal` để lưu thông tin User.
* **Hậu quả:** Virtual Threads được tạo và hủy cực nhanh với số lượng lớn. Nếu bạn lưu các Object nặng vào `ThreadLocal`, bộ nhớ RAM sẽ bị ngốn khủng khiếp vì mỗi VT trong số hàng triệu luồng đều giữ một bản sao dữ liệu đó.
* **Giải pháp:** Sử dụng **Scoped Values** (Tính năng mới của Java 21) để thay thế `ThreadLocal`.

**Tình huống 3: Thư viện bên thứ ba chưa tương thích**

* **Vấn đề:** Bạn dùng một thư viện JDBC cũ hoặc SDK cũ của một bên cung cấp thanh toán.
* **Hậu quả:** Bên trong thư viện đó dùng rất nhiều `synchronized`. Khi bạn bật Virtual Threads, toàn bộ hệ thống chậm lại một cách khó hiểu dù bạn đã tối ưu code của mình.
* **Giải pháp:** Phải kiểm tra (Profile) hệ thống thường xuyên để phát hiện các thư viện gây nghẽn.

---

### Bảng so sánh rủi ro

| Đặc điểm | Platform Thread (Cũ) | Virtual Thread (Mới) |
| --- | --- | --- |
| **Số lượng** | Giới hạn (vài trăm/nghìn) | Gần như vô hạn (triệu) |
| **Chi phí tạo** | Rất đắt (1MB/thread) | Rất rẻ (vài KB) |
| **Nguy cơ lớn nhất** | Hết RAM (OutOfMemory) | **Pinning** & **Resource Exhaustion** |
| **Từ khóa kiêng kị** | Không có | `synchronized` |

---

### Tóm tắt cho "Dân Frontend" chuyển hệ:

Hãy tưởng tượng **Platform Threads** là những chiếc **xe Bus** cồng kềnh (ít xe, tốn xăng). **Virtual Threads** là những chiếc **xe máy** (nhẹ, cực nhiều).

* Nếu đường tắc (Database chậm), xe máy vẫn tắc như xe bus.
* Nếu bạn bắt xe máy chạy vào làn đường của xe bus (khối `synchronized`), bạn sẽ làm hỏng cả hệ thống giao thông.

**Bạn thấy sao về Virtual Threads?** Nếu bạn đang bắt đầu một dự án mới hoàn toàn với Spring Boot 3.2+, lời khuyên là hãy bật nó lên, nhưng hãy tránh xa `synchronized` và kiểm soát kỹ các Pool tài nguyên (DB, Redis).