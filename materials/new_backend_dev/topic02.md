Chào mừng bạn đến với "linh hồn" của Spring Framework. Nếu ở Frontend, bạn thường xuyên dùng `import` hoặc `require` để sử dụng một module, thì ở Spring Boot, việc khởi tạo và quản lý đối tượng (Object) lại do hệ thống đảm nhận.

---

# Chủ đề 2: IoC Container & Dependency Injection (DI)

### 1. Lý thuyết: "Đừng gọi cho chúng tôi, chúng tôi sẽ gọi cho bạn"

#### **Inversion of Control (IoC) - Đảo ngược quyền điều khiển**

Trong lập trình truyền thống, nếu lớp `A` cần lớp `B`, bạn sẽ viết: `B objB = new B()`. Tức là bạn (người code) nắm quyền điều khiển việc tạo đối tượng.
Trong Spring, bạn chỉ cần khai báo: "Tôi cần một đối tượng kiểu `B`". Spring sẽ tự tìm, tự tạo và đưa nó cho bạn. Quyền điều khiển đã bị "đảo ngược" từ tay bạn sang tay Framework (IoC Container).

#### **Dependency Injection (DI) - Tiêm phụ thuộc**

DI là cách thức cụ thể để thực hiện IoC. Spring sẽ "tiêm" (inject) các phụ thuộc vào một class thông qua:

1. **Constructor Injection** (Khuyên dùng).
2. **Setter Injection**.
3. **Field Injection** (Dùng `@Autowired` trực tiếp lên biến - không khuyến khích cho logic phức tạp).

#### **Spring Bean là gì?**

Một cái tên nghe rất kêu cho một khái niệm đơn giản: **Bean là một Object được quản lý bởi Spring IoC Container**. Nếu bạn tự `new`, đó là Object thường. Nếu Spring `new` cho bạn, đó là Bean.

---

### 2. Ví dụ Code & Cấu hình

#### **A. Cách định nghĩa một Bean**

Sử dụng các Stereotype Annotations để đánh dấu class là một Bean.

```java
@Service // Đánh dấu đây là một Bean tầng nghiệp vụ
public class EmailService {
    public void sendEmail(String message) {
        System.out.println("Sending email: " + message);
    }
}

```

#### **B. Cách "Tiêm" (Inject) Bean - Constructor Injection**

Đây là cách tốt nhất vì nó giúp code dễ Unit Test và đảm bảo tính bất biến (Immutable).

```java
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final EmailService emailService;

    // Spring sẽ tự động tìm Bean EmailService và truyền vào đây
    // Từ Spring 4.3+, nếu chỉ có 1 constructor, không cần gắn @Autowired
    public NotificationController(EmailService emailService) {
        this.emailService = emailService;
    }

    @PostMapping("/send")
    public String notifyUser() {
        emailService.sendEmail("Chào mừng bạn đến với Spring Boot 3!");
        return "Sent!";
    }
}

```

#### **C. Cấu hình Bean thủ công bằng `@Bean**`

Dùng khi bạn muốn khởi tạo Object từ thư viện bên thứ 3 (ví dụ: ModelMapper, Jedis, v.v.) mà bạn không thể sửa code nguồn của họ để thêm `@Service`.

```java
@Configuration
public class AppConfig {

    @Bean
    public RestTemplate restTemplate() {
        // Tự cấu hình một lần, dùng ở mọi nơi trong App
        return new RestTemplate();
    }
}

```

---

### 3. Tình huống thực tế (Real-world Scenarios)

**Tình huống 1: Loose Coupling - Thay đổi triển khai mà không sửa code**

* **Vấn đề:** Bạn có giao diện `PaymentStorage`. Hiện tại bạn đang lưu vào `MySQL`. Sau này sếp muốn chuyển sang `S3`.
* **Giải pháp:** 1. Tạo Interface `StorageService`.
2. Tạo 2 class triển khai: `MysqlStorage` và `S3Storage` đều đánh dấu là Bean.
3. Khi cần đổi, bạn chỉ cần thay đổi Annotation `@Primary` hoặc dùng `@Qualifier` để chọn cái muốn dùng. Code ở Controller/Service sử dụng Interface nên **không phải thay đổi một dòng nào**.

**Tình huống 2: Quản lý Singleton (Tối ưu bộ nhớ)**

* **Vấn đề:** Bạn có một class `ConfigurationManager` chuyên đọc file config nặng. Nếu mỗi request bạn lại `new` nó một lần, server sẽ sớm hết RAM.
* **Giải pháp:** Mặc định mọi Bean trong Spring là **Singleton**. Spring chỉ tạo đúng một instance duy nhất của `ConfigurationManager` và dùng chung cho toàn bộ ứng dụng. Dev Frontend sẽ thấy nó giống như một `Global State` nhưng an toàn hơn.

**Tình huống 3: Circular Dependency (Lỗi vòng lặp)**

* **Vấn đề:** Class `A` cần class `B` trong constructor, và class `B` cũng lại cần class `A`.
* **Giải pháp:** Spring Boot 3 sẽ báo lỗi ngay khi khởi động để bảo vệ bạn. Điều này ép buộc bạn phải thiết kế lại kiến trúc (ví dụ: tách logic chung ra class `C`), giúp code Backend luôn mạch lạc, tránh sự chồng chéo "spaghetti" thường thấy khi dev frontend lạm dụng import vòng quanh.

---

### Tóm tắt so sánh cho Dev Frontend

| Khái niệm | Frontend (JS/TS) | Backend (Spring Boot) |
| --- | --- | --- |
| **Khởi tạo** | `import { S } from './S'; const s = new S();` | `@Autowired` hoặc Constructor Injection |
| **Quản lý** | Dev tự quản lý vòng đời | Spring IoC Container quản lý |
| **Phạm vi (Scope)** | Thường là module-based | Mặc định là Singleton (toàn App) |
| **Ràng buộc** | Khó kiểm soát phụ thuộc chéo | Phát hiện lỗi phụ thuộc ngay khi start app |

---
Việc chỉ dùng `@Service` hay `@Component` là quá đơn giản. Trong các dự án thực tế, việc cấu hình Bean thủ công bằng `@Bean` chính là nơi thể hiện trình độ thiết kế hệ thống.

---

# Chủ đề 2.1: Nâng cao về @Bean và Bí mật của Singleton Scope

### 1. Lý thuyết: Tại sao lại là Singleton?

Trong thế giới Spring, mặc định mọi Bean là **Singleton**. Điều này có nghĩa là Spring IoC Container chỉ tạo ra **duy nhất một thực thể (instance)** của Bean đó cho toàn bộ vòng đời của ứng dụng.

**Tại sao Spring lại chọn như vậy?**

1. **Tiết kiệm tài nguyên (Memory & CPU):** Việc khởi tạo một Object trong Java kèm theo việc "tiêm" hàng chục phụ thuộc khác vào nó tốn chi phí. Thay vì tạo mới cho mỗi Request (như cách JavaScript thường làm với các biến cục bộ), Spring dùng lại một instance duy nhất.
2. **Hiệu năng Garbage Collection (GC):** Ít object được tạo ra và hủy đi đồng nghĩa với việc bộ dọn rác (GC) của Java làm việc ít hơn, giúp ứng dụng chạy mượt mà, tránh tình trạng "Stop the world".
3. **Stateless Services:** Đa số các Service trong Backend là "không trạng thái" (stateless). Nó giống như một cái máy xay sinh tố: nó chỉ có logic (xay), không lưu trữ trái cây cũ bên trong. Do đó, cả nghìn người dùng chung một "máy xay" là hoàn toàn khả thi.

> **Cảnh báo cho Frontend Dev:** Nếu bạn khai báo một biến `private int count = 0;` trong một `@Service` và tăng nó mỗi khi có API gọi vào, thì **tất cả người dùng** sẽ cùng tăng cái biến đó. Đây là lỗi bảo mật và logic cực kỳ nghiêm trọng.

---

### 2. Ví dụ Code: Các trường hợp @Bean phức tạp

#### A. Bean có điều kiện (@Conditional)

Giả sử bạn muốn dùng Memcached khi ở môi trường thật, nhưng dùng Map (tạm thời) khi chạy máy local để đỡ phải cài đặt.

```java
@Configuration
public class CacheConfig {

    @Bean
    @ConditionalOnProperty(name = "app.cache.type", havingValue = "redis")
    public CacheService redisCacheService() {
        return new RedisCacheService(); // Chỉ khởi tạo nếu config là redis
    }

    @Bean
    @ConditionalOnMissingBean(CacheService.class)
    public CacheService localCacheService() {
        return new LocalMapCacheService(); // Khởi tạo nếu không có thằng nào ở trên khớp
    }
}

```

#### B. Nạp cấu hình từ bên ngoài vào Bean

Bạn không nên hardcode thông số. Hãy để `@Bean` đọc từ file `.yml` hoặc `.properties`.

```java
@Configuration
public class ThirdPartyConfig {

    @Value("${stripe.api.key}")
    private String apiKey;

    @Bean
    public StripeClient stripeClient() {
        // Khởi tạo thư viện bên thứ 3 với thông số từ config
        return new StripeClient(apiKey);
    }
}

```

---

### 3. Tình huống thực tế (Real-world Scenarios)

**Tình huống 1: Tích hợp SDK của bên thứ 3 (Ví dụ: Firebase/S3)**

* **Vấn đề:** SDK của Firebase yêu cầu bạn phải nạp file `serviceAccountKey.json` và khởi tạo một lần duy nhất. Bạn không thể sửa code của Google để thêm `@Service`.
* **Giải pháp:** Viết một class `@Configuration`, dùng `@Bean` để đọc file JSON, khởi tạo `FirebaseApp`. Sau đó, ở bất kỳ đâu trong dự án, bạn chỉ cần `@Autowired` cái `FirebaseApp` đó để dùng.

**Tình huống 2: Giải quyết bài toán "Đa chi nhánh" (Multi-tenancy)**

* **Vấn đề:** Hệ thống của bạn phục vụ nhiều công ty. Mỗi công ty có một Database khác nhau.
* **Giải pháp:** Bạn không thể định nghĩa cứng một Bean `DataSource`. Bạn cần dùng `@Bean` kết hợp với `AbstractRoutingDataSource`. Spring sẽ dựa vào mã công ty trong Request để "nhấc" đúng Bean Database tương ứng ra xử lý.

**Tình huống 3: Prototype Scope - Khi bạn CẦN trạng thái riêng**

* **Vấn đề:** Bạn viết một logic xử lý file Excel cực lớn, cần lưu trữ trạng thái hàng đang đọc để báo cáo tiến độ (Percent complete) riêng cho mỗi người dùng.
* **Giải pháp:** Lúc này Singleton sẽ làm hỏng dữ liệu của nhau. Bạn phải khai báo `@Bean` với `@Scope("prototype")`. Mỗi lần bạn gọi `getBean()`, Spring sẽ tạo ra một instance **mới tinh**.

---

### Bảng so sánh Scopes phổ biến

| Scope | Đặc điểm | Phù hợp cho |
| --- | --- | --- |
| **Singleton** (Mặc định) | 1 instance cho cả App | Service, Repository, Controller |
| **Prototype** | Mỗi lần inject là 1 instance mới | Object chứa dữ liệu tạm thời (Stateful) |
| **Request** | 1 instance cho mỗi HTTP request | Lưu thông tin User, Log cho từng request |
| **Session** | 1 instance cho mỗi phiên đăng nhập | Giỏ hàng (Shopping Cart) |

---

### Tóm tắt cho "Dân App/Frontend"

Hãy tưởng tượng **Singleton** giống như một cái **Global Store** nhưng chỉ chứa các **Hàm (Functions)**. Bạn không bao giờ lưu dữ liệu của user vào đó. Nếu muốn lưu dữ liệu tạm thời cho từng user, hãy dùng Database hoặc Redis.

---
Việc hiểu rõ **Bean Scope** là bước ngoặt giúp bạn kiểm soát được bộ nhớ và tránh những lỗi "data leak" (dữ liệu người này lẫn sang người kia) cực kỳ nguy hiểm trong Backend.

Dưới đây là nội dung chi tiết cho phần Bean Scopes.

---

# Chủ đề 2.2: Chi tiết về Bean Scopes - Khi nào tạo mới, khi nào dùng chung?

Trong Spring Boot 3, việc chọn Scope quyết định **vòng đời** và **phạm vi chia sẻ** của một đối tượng.

### 1. Lý thuyết: 4 loại Scope phổ biến nhất

1. **Singleton (Mặc định):** Spring IoC container tạo đúng 1 instance duy nhất. Mọi chỗ `@Autowired` đều dùng chung instance này.
2. **Prototype:** Mỗi lần `@Autowired` hoặc gọi `getBean()`, Spring sẽ tạo ra 1 instance **mới hoàn toàn**.
3. **Request Scope:** Mỗi HTTP Request đến sẽ có 1 instance riêng. Request kết thúc, Bean bị hủy. (Chỉ dùng trong Web App).
4. **Session Scope:** Instance tồn tại xuyên suốt một phiên làm việc của người dùng (từ lúc Login đến lúc Logout/Hết hạn).

---

### 2. Ví dụ Code & Cấu hình

#### A. Singleton & Prototype (Cơ bản)

```java
@Component
@Scope("singleton") // Có thể bỏ qua vì là mặc định
public class StatisticsService {
    // Dùng chung cho toàn App để đếm tổng số request
    private int totalCalls = 0;
    public synchronized void increment() { totalCalls++; }
}

@Component
@Scope("prototype")
public class DataExporter {
    // Mỗi lần export một file Excel, ta cần một "thằng thợ" mới 
    // để không bị lẫn lộn dữ liệu giữa các file
    public void export(List<?> data) { /* logic */ }
}

```

#### B. Request Scope: Lưu thông tin User từ Token

Đây là cách cực hay để bạn không phải truyền `userId` qua từng hàm trong Service.

```java
@Component
@WebScope // Tương đương @Scope(value = WebApplicationContext.SCOPE_REQUEST, proxyMode = ScopedProxyMode.TARGET_CLASS)
public class UserContext {
    private String currentUsername;
    private String userIp;

    // Getters/Setters...
}

// Cách dùng trong Filter (Trích xuất từ JWT)
@Component
public class JwtFilter extends OncePerRequestFilter {
    @Autowired private UserContext userContext;

    @Override
    protected void doFilterInternal(...) {
        String username = extractUsername(request); 
        userContext.setCurrentUsername(username); // Chỉ có tác dụng trong request này
        chain.doFilter(request, response);
    }
}

```

---

### 3. Tình huống thực tế (Real-world Scenarios)

**Tình huống 1: Singleton - "Cái phễu" tập trung dữ liệu**

* **Vấn đề:** Bạn cần một bộ nhớ đệm (In-memory Cache) để lưu danh sách các tỉnh thành Việt Nam (ít thay đổi).
* **Giải pháp:** Dùng **Singleton**. Dữ liệu được nạp 1 lần duy nhất khi Server khởi động. Tất cả người dùng đều truy cập vào cùng một danh sách này, giúp tiết kiệm RAM và không phải gọi Database liên tục.

**Tình huống 2: Request Scope - "Chiếc hộp" bí mật của mỗi yêu cầu**

* **Vấn đề:** Bạn muốn ghi Log cho mỗi API bao gồm: `TimeStart`, `UserId`, `Action`, `Duration`. Nếu dùng Singleton, dữ liệu các Request chạy song song sẽ đè lên nhau.
* **Giải pháp:** Dùng **Request Scope**. Khi Request A vào, Spring tạo một `LogContext`. Khi Request B vào, Spring tạo một `LogContext` khác. Hai cái này hoàn toàn độc lập. Cuối Request, bạn lấy dữ liệu ra ghi vào DB/File.

**Tình huống 3: Giải quyết bài toán "Singleton inject Prototype" (Bài toán khó)**

* **Vấn đề:** Một `OrderService` (Singleton) cần gọi một `ImageProcessor` (Prototype). Vì `OrderService` chỉ khởi tạo 1 lần, nên nó cũng chỉ được "tiêm" `ImageProcessor` đúng 1 lần. Kết quả là `ImageProcessor` vô tình trở thành Singleton!
* **Giải pháp (Code mẫu):** Dùng `ObjectProvider`.

```java
@Service
public class OrderService {
    // Thay vì @Autowired trực tiếp ImageProcessor
    @Autowired
    private ObjectProvider<ImageProcessor> imageProcessorProvider;

    public void processOrder() {
        // Mỗi lần gọi .getIfAvailable(), Spring sẽ tạo 1 instance Prototype mới
        ImageProcessor processor = imageProcessorProvider.getIfAvailable();
        processor.handle();
    }
}

```

---

### Tóm tắt so sánh cho Dev Frontend

| Scope | Tương ứng trong Frontend | Lưu ý quan trọng |
| --- | --- | --- |
| **Singleton** | Redux Store / Global Variable | Không được lưu dữ liệu riêng của User vào đây. |
| **Prototype** | `new ClassName()` mỗi khi cần | Spring không quản lý việc hủy Bean này (cẩn thận memory leak). |
| **Request** | Một biến trong hàm `useEffect` | Rất hữu ích để làm Audit Log hoặc Multi-tenancy. |
| **Session** | `sessionStorage` | Tốn RAM Server vì phải giữ Object chờ người dùng. |

---

### Bài tập nhỏ cho bạn:

Nếu bạn làm một trang **Giỏ hàng (Shopping Cart)** cho Web truyền thống (không dùng LocalStorage ở App), bạn sẽ chọn Scope nào cho `CartBean`?

1. Singleton
2. Prototype
3. Session
4. Request

*(Gợi ý: Giỏ hàng cần tồn tại khi user chuyển từ trang này sang trang khác nhưng mỗi user phải có giỏ hàng riêng).*
---