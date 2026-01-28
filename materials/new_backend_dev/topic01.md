# Chủ đề 1: Request-Response Cycle & The Middleware Chain

Trong Frontend (như React/Vue), bạn chỉ quan tâm đến việc gửi Request qua `axios` và nhận về JSON. Nhưng trong Spring Boot, một Request phải đi qua một "đường ống" (pipeline) với nhiều chốt chặn trước khi đến được logic của bạn.

### 1. Lý thuyết: Luồng đi của một Request

Khi một request HTTP gửi đến Spring Boot 3, nó trải qua các bước sau:

1. **Filter (Servlet Filter):** Là lớp bảo vệ ngoài cùng (nằm ở tầng Servlet Container như Tomcat). Nó can thiệp vào Request trước cả khi Spring MVC nhận diện được đó là gì. Thường dùng cho: Bảo mật (Security), Logging thô, CORS.
2. **DispatcherServlet:** "Trái tim" của Spring. Nó tiếp nhận request và hỏi **Handler Mapping** xem: "Cái URL này thì thằng Controller nào xử lý?".
3. **Interceptor (HandlerInterceptor):** Nằm trong tầm kiểm soát của Spring MVC. Nó có thể can thiệp trước (`preHandle`) và sau (`postHandle`) khi Controller chạy. Thường dùng cho: Check quyền hạn (Authorization), kiểm tra Header.
4. **Controller:** Nơi bạn định nghĩa API. Nó chỉ nên làm nhiệm vụ điều hướng.
5. **Service & Repository:** Nơi xử lý logic và DB.
6. **Message Converter:** Chuyển đổi Object Java thành JSON (thường dùng thư viện Jackson) để trả về cho Frontend.

---

### 2. Ví dụ Code & Cấu hình

#### A. Tạo một Interceptor để log thời gian xử lý API

Đây là thứ mà Dev Frontend rất cần để debug xem tại sao API chạy chậm.

```java
// 1. Định nghĩa Interceptor
@Component
public class ExecutionTimeInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        long startTime = System.currentTimeMillis();
        request.setAttribute("startTime", startTime);
        return true; // Cho phép request đi tiếp
    }

    @Override
    public void postHandle(HttpServletRequest request, HttpServletResponse response, Object handler, ModelAndView modelAndView) {
        long startTime = (long) request.getAttribute("startTime");
        long endTime = System.currentTimeMillis();
        System.out.println("API " + request.getRequestURI() + " processed in: " + (endTime - startTime) + "ms");
    }
}

```

#### B. Cấu hình (Configuration)

Để Spring "biết" và sử dụng Interceptor trên, bạn phải đăng ký nó.

```java
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Autowired
    private ExecutionTimeInterceptor executionTimeInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // Áp dụng cho tất cả các API bắt đầu bằng /api/
        registry.addInterceptor(executionTimeInterceptor).addPathPatterns("/api/**");
    }
}

```

#### C. Controller mẫu

```java
@RestController
@RequestMapping("/api")
public class ProductController {

    @GetMapping("/products")
    public ResponseEntity<List<String>> getProducts() {
        return ResponseEntity.ok(List.of("iPhone 15", "Macbook M3", "iPad Pro"));
    }
}

```

---

### 3. Tình huống thực tế (Real-world Scenarios)

**Tình huống 1: Kiểm tra "App-Version" từ Mobile/Frontend**

* **Vấn đề:** Bạn muốn tất cả các request từ App phải đính kèm Header `X-App-Version`. Nếu không có hoặc phiên bản quá cũ, Backend sẽ từ chối ngay lập tức để tránh lỗi logic.
* **Giải pháp:** Viết một **Interceptor**. Nếu Header thiếu, trả về `400 Bad Request` hoặc `426 Upgrade Required` ngay tại `preHandle`, không cần để request chạy vào tận Controller tốn tài nguyên.

**Tình huống 2: Xử lý đa ngôn ngữ (Internationalization - i18n)**

* **Vấn đề:** Frontend gửi Header `Accept-Language: vi`. Bạn muốn toàn bộ thông báo lỗi trả về phải là tiếng Việt.
* **Giải pháp:** Sử dụng `LocaleChangeInterceptor`. Nó sẽ tự động bắt Header này, set vào `LocaleContextHolder`. Khi đó, ở bất kỳ tầng nào (Service/Controller), bạn chỉ cần gọi `messageSource.getMessage(...)` là có đúng ngôn ngữ user cần.

**Tình huống 3: Tracking User Activity (Audit Log)**

* **Vấn đề:** Sếp muốn biết User ID nào đã gọi API nào, vào lúc nào để thống kê hành vi.
* **Giải pháp:** Sử dụng **Filter** (vì nó bắt được cả những request lỗi hoặc request không tồn tại - 404). Tại Filter, bạn lấy `Principal` (User hiện tại) từ `SecurityContext` và lưu thông tin Request URL vào database hoặc đẩy vào Kafka/Logstash.

---

Để tiếp nối chủ đề **Request-Response Cycle**, chúng ta sẽ đi sâu vào hai "ông trùm" đứng ở tiền tuyến của Spring Boot: **Filter** và **DispatcherServlet**.

Nếu bạn từ Frontend chuyển qua:

* **Filter** giống như một cái Proxy hoặc Middleware ở tầng thấp nhất (như Nginx hay Cloudflare Rules).
* **DispatcherServlet** giống như bộ Router trung tâm (như React Router nhưng ở phía Server) có nhiệm vụ tìm xem Component nào sẽ xử lý URL này.

---

# Chủ đề 1 (Tiếp theo): Filter & DispatcherServlet

### 1. Lý thuyết: Ai mạnh hơn ai?

* **Filter (Servlet Filter):**
* Nằm ngoài cùng, thuộc về **Servlet Container** (Tomcat).
* Nó không biết gì về các Controller của Spring. Nó chỉ thấy một "cục" HTTP Request thô.
* Phù hợp cho các tác vụ "vĩ mô": Bảo mật (Spring Security thực chất là một chuỗi Filter), nén dữ liệu (Gzip), Log IP khách truy cập.


* **DispatcherServlet:**
* Là một **Servlet** duy nhất, đóng vai trò "Front Controller".
* Nó là cầu nối giữa HTTP thô và thế giới Object-Oriented của Spring.
* Nó sẽ hỏi `HandlerMapping` để tìm Controller và `HandlerAdapter` để thực thi Controller đó.



---

### 2. Ví dụ Code & Cấu hình

#### A. Filter: Gắn "Trace-ID" vào mọi Request

Để debug hệ thống lớn, ta cần một mã định danh (Trace-ID) xuyên suốt từ Request tới Log.

```java
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import java.io.IOException;
import java.util.UUID;

@Component
public class TraceIdFilter implements Filter {
    
    private static final String TRACE_ID_HEADER = "X-Trace-Id";

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) 
            throws IOException, ServletException {
        
        // 1. Tạo một mã ID ngẫu nhiên
        String traceId = UUID.randomUUID().toString();
        
        // 2. Gắn vào MDC (Mapped Diagnostic Context) để mọi dòng Log sau này đều có ID này
        MDC.put("traceId", traceId);
        
        // 3. Gắn vào Header của Response trả về cho Frontend dễ kiểm tra
        HttpServletResponse httpServletResponse = (HttpServletResponse) response;
        httpServletResponse.setHeader(TRACE_ID_HEADER, traceId);

        try {
            // Cho phép request đi tiếp vào DispatcherServlet
            chain.doFilter(request, response);
        } finally {
            // Xóa sau khi xong để tránh memory leak trong ThreadPool
            MDC.remove("traceId");
        }
    }
}

```

#### B. DispatcherServlet: Cấu hình tùy chỉnh

Thường bạn không viết code cho `DispatcherServlet` vì Spring Boot đã làm sẵn. Tuy nhiên, bạn sẽ cần cấu hình nó qua file `application.properties` để kiểm soát các tình huống đặc biệt.

```properties
# Ví dụ: Nếu không tìm thấy Controller nào khớp với URL, 
# thay vì hiện trang 404 mặc định, hãy ném ra một Exception để ta xử lý Global.
spring.mvc.throw-exception-if-no-handler-found=true
spring.web.resources.add-mappings=false

```

---

### 3. Tình huống thực tế (Real-world Scenarios)

**Tình huống 1: Chống tấn công Brute Force / Rate Limiting (Tầng Filter)**

* **Vấn đề:** Bạn muốn chặn ngay các IP gửi 1000 request/giây trước khi nó làm treo Database.
* **Giải pháp:** Dùng **Filter**. Vì Filter chạy trước khi vào Spring MVC, bạn có thể check IP trong Redis, nếu vượt quá giới hạn, trả về `429 Too Many Requests` ngay lập tức. Điều này bảo vệ CPU của server không phải chạy các logic phức tạp trong Controller.

**Tình huống 2: Xử lý file Upload quá lớn (Tầng DispatcherServlet)**

* **Vấn đề:** Frontend gửi một file 1GB lên trong khi bạn chỉ cho phép 10MB.
* **Giải pháp:** `DispatcherServlet` sử dụng `MultipartResolver` để parse file. Bạn cấu hình trong `application.properties`. Khi file quá lớn, `DispatcherServlet` sẽ ném lỗi `MaxUploadSizeExceededException` trước cả khi nó tìm thấy Service của bạn.

**Tình huống 3: Centralized Error Handling (Sự kết hợp)**

* **Vấn đề:** Bạn muốn mọi lỗi (404, 500, Validate lỗi) đều trả về một format JSON chung cho App dễ đọc: `{"code": "ERR_001", "message": "..."}`.
* **Giải pháp:** `DispatcherServlet` sẽ chuyển hướng mọi Exception về một `@RestControllerAdvice`. Tại đây, bạn "túm" cổ tất cả các lỗi xảy ra trong luồng để format lại JSON trước khi gửi về cho Frontend.

---

### Tóm tắt so sánh cho Dev Frontend

| Đặc điểm | Filter (Vòng ngoài) | DispatcherServlet (Vòng trong) |
| --- | --- | --- |
| **Biết về User?** | Chưa (Trừ khi bạn parse Token thủ công) | Có (Đã có thông tin SecurityContext) |
| **Biết về Controller?** | Không | Có (Biết rõ method nào sắp chạy) |
| **Trả về JSON?** | Phải dùng `ObjectMapper` viết tay | Chỉ cần `return Object` là xong |
| **Nên dùng khi nào?** | CORS, Log IP, Auth thô, Nén ảnh | Validation, Business Logic, Format Data |


---

# Chủ đề 1.2: Bảo mật tầng giao tiếp - CORS & CSRF

### 1. Giải thích chi tiết các thuật ngữ

#### **CORS (Cross-Origin Resource Sharing)**

* **Nó là gì?** Là một cơ chế bảo mật của **Trình duyệt** (không phải của Server). Nó ngăn chặn các trang web tải tài nguyên từ một "Origin" khác với Origin của chính nó.
* **Origin là gì?** Gồm 3 thành phần: `Protocol` + `Domain` + `Port`.
* Ví dụ: `http://localhost:3000` (React) và `http://localhost:8080` (Spring Boot) là **khác Origin** vì lệch Port.


* **Cơ chế hoạt động:** Khi bạn gọi API khác Origin, trình duyệt sẽ gửi một request "nháp" gọi là **Preflight Request** (phương thức `OPTIONS`) để hỏi Server: "Tôi là thằng `localhost:3000`, tôi có được phép lấy data không?". Nếu Server không trả lời đúng các Header cho phép, trình duyệt sẽ chặn kết quả API đó lại.

#### **CSRF (Cross-Site Request Forgery)**

* **Nó là gì?** "Tấn công giả mạo yêu cầu chéo trang". Đây là kịch bản kẻ xấu lợi dụng việc bạn đã đăng nhập vào một trang web (ví dụ: `nganhang.com`) và dùng cookie của bạn để gửi yêu cầu bất hợp pháp từ một trang web khác.
* **Ví dụ:** Bạn đang đăng nhập ngân hàng, sau đó bấm vào một link "Trúng thưởng" ở trang web lạ. Trang web đó chạy ngầm một đoạn code gửi request `POST` tới `nganhang.com/transfer?amount=1000` để chuyển tiền. Vì trình duyệt tự động đính kèm Cookie của bạn, ngân hàng tưởng đó là bạn thật.
* **Cách chống:** Server cấp cho Frontend một cái "mật mã" gọi là **CSRF Token**. Mỗi khi gửi request thay đổi dữ liệu (POST, PUT, DELETE), Frontend phải gửi kèm Token này. Kẻ xấu ở trang web khác sẽ không thể biết Token này để giả mạo.

---

### 2. Ví dụ Code & Cấu hình trong Spring Boot 3

Trong Spring Boot 3, cấu hình bảo mật nằm tập trung ở tầng **Spring Security**.

#### **Cấu hình CORS (Cho phép Frontend truy cập)**

Bạn có thể cấu hình global trong một Bean `SecurityFilterChain`.

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(request -> {
                CorsConfiguration config = new CorsConfiguration();
                config.setAllowedOrigins(List.of("http://localhost:3000")); // Chỉ cho phép React
                config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE"));
                config.setAllowedHeaders(List.of("*"));
                config.setAllowCredentials(true); // Quan trọng nếu dùng Cookie/Auth Header
                return config;
            }))
            // ... các cấu hình khác
        return http.build();
    }
}

```

#### **Cấu hình CSRF**

Thông thường, nếu bạn làm API cho Mobile hoặc dùng Token (JWT) lưu trong LocalStorage thay vì Cookie, bạn có thể tắt CSRF (vì JWT không tự động đính kèm như Cookie nên không sợ CSRF).

```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
        .csrf(csrf -> csrf.disable()) // Tắt nếu dùng JWT/Stateless API
        // .csrf(csrf -> csrf.csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())) // Bật nếu dùng Cookie/Session
    return http.build();
}

```

---

### 3. Tình huống thực tế (Real-world Scenarios)

**Tình huống 1: Lỗi "CORS error" khi vừa mới Deploy**

* **Vấn đề:** Ở máy local, bạn cấu hình `allowedOrigins("*")` nên chạy ngon. Khi lên Production, bạn đổi domain Backend thành `api.myapp.com` và Frontend thành `myapp.com`. Trình duyệt lập tức chặn API.
* **Giải pháp:** Phải liệt kê chính xác domain Production vào danh sách `AllowedOrigins`. Đừng dùng `*` ở Production vì nó cực kỳ kém bảo mật.

**Tình huống 2: Tại sao GET chạy được mà POST/PUT lại bị lỗi 403?**

* **Vấn đề:** Đây là dấu hiệu của việc **CSRF đang bật**. Theo mặc định của Spring Security, các phương thức "đọc" (GET, HEAD, OPTIONS) không cần Token, nhưng các phương thức "ghi" (POST, PUT, DELETE) bắt buộc phải có CSRF Token.
* **Giải pháp:** 1. Nếu dùng Cookie: Frontend phải lấy Token từ Cookie và gửi ngược lên Header `X-XSRF-TOKEN`.
2. Nếu dùng JWT: Tắt CSRF trong config vì JWT bản chất đã chống được CSRF (do kẻ tấn công không thể đọc được JWT trong LocalStorage của bạn).

**Tình huống 3: Mobile App không bị lỗi CORS nhưng Web App thì có**

* **Vấn đề:** Bạn phát triển một ứng dụng Mobile (Flutter/React Native) gọi API bình thường, nhưng khi làm bản Web thì bị lỗi CORS.
* **Giải pháp:** Hiểu rằng **CORS là luật của Trình duyệt**. Mobile App không chạy trên trình duyệt nên nó không quan tâm đến các Header CORS. Điều này giải thích tại sao cùng một API mà Web lỗi còn Mobile thì không. Đừng vì thấy Mobile chạy được mà nghĩ Backend đã ổn.

---

### Bảng so sánh nhanh

| Đặc điểm | CORS | CSRF |
| --- | --- | --- |
| **Bản chất** | Cho phép chia sẻ tài nguyên | Ngăn chặn giả mạo yêu cầu |
| **Đối tượng thực thi** | Trình duyệt (Browser) | Server (Spring Security) |
| **Dấu hiệu lỗi** | Console hiện "Blocked by CORS policy" | API trả về 403 Forbidden |
| **Cách xử lý phổ biến** | Thêm Header `Access-Control-Allow-Origin` | Dùng CSRF Token hoặc dùng JWT (Stateless) |

---