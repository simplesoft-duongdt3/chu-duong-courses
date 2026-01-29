# Chủ đề 11: External API Call & Backend For Frontend (BFF)

Trong kỷ nguyên Microservices, Backend không chỉ là nơi lưu trữ dữ liệu mà còn đóng vai trò là một **Consumer** (khách hàng) đi gọi các Service khác. Việc quản lý các kết nối này đòi hỏi sự chặt chẽ về hiệu năng và bảo mật.

## 1. Kiến trúc BFF (Backend for Frontend)

BFF là lớp trung gian nằm giữa Client (Web/Mobile) và các Microservices lõi.

* **Mục đích:**
* **Aggregation:** Gộp kết quả từ nhiều API thành một JSON duy nhất.
* **Transformation:** Chuyển đổi định dạng dữ liệu (ví dụ: Mobile cần ít field hơn Web).
* **Security:** Che giấu API Key, Secret Key của hệ thống nội bộ.
* **Latency:** Giảm số lượng request từ Client lên Server qua mạng mobile.

---

## 2. RestClient: "Vũ khí" gọi API trong Spring Boot 3

Từ bản 3.2, Spring giới thiệu `RestClient` – một bộ công cụ gọi API đồng bộ (Synchronous) nhưng mang phong cách hiện đại (Fluent API).

### So sánh các công cụ

| Công cụ | Trạng thái | Đặc điểm |
| --- | --- | --- |
| **RestTemplate** | Maintenance Mode | Cũ, cú pháp cồng kềnh, khó cấu hình hiện đại. |
| **WebClient** | Active | Mạnh mẽ, hỗ trợ Reactive (Non-blocking). Phức tạp khi học. |
| **RestClient** | **Recommended** | Hiện đại, dễ dùng, thay thế hoàn hảo cho RestTemplate. |

---

## 3. Chiến lược tái sử dụng Client (Reuse Like OkHttp)

Để tối ưu tài nguyên, chúng ta không khởi tạo Client mới cho mỗi request mà chia làm 3 cấp độ tái sử dụng:

### Cấp độ 1: Cỗ máy thực thi (ClientHttpRequestFactory)

Tương đương với `OkHttpClient` instance, quản lý Connection Pool vật lý.

```java
@Bean
public ClientHttpRequestFactory commonRequestFactory() {
    HttpComponentsClientHttpRequestFactory factory = new HttpComponentsClientHttpRequestFactory();
    factory.setConnectTimeout(Duration.ofSeconds(5));
    return factory;
}

```

### Cấp độ 2: Cấu hình chung (RestClient.Builder)

Tương đương với `OkHttpClient.Builder`, dùng để cài đặt Header, Interceptor dùng chung cho toàn bộ dự án.

```java
@Bean
public RestClient.Builder commonRestClientBuilder(ClientHttpRequestFactory factory) {
    return RestClient.builder()
            .requestFactory(factory)
            .defaultHeader("Content-Type", "application/json")
            .requestInterceptor(new LoggingInterceptor()); // Tự động Log mọi request
}

```

### Cấp độ 3: Chuyên biệt hóa tại Service

Mỗi Service lấy Builder chung để tạo Client riêng với `baseUrl` tương ứng.

```java
public UserService(RestClient.Builder builder) {
    this.restClient = builder.baseUrl("https://api.user.com").build();
}

```

---

## 4. Cấu hình "Sống còn" trên Production

Đừng bao giờ sử dụng cấu hình mặc định khi đi Deploy.

### Connection Pooling & Timeouts

Dùng **Apache HttpClient 5** để quản lý hồ chứa kết nối:

* **Max Total:** 200 (Tổng kết nối ra ngoài).
* **Max Per Route:** 50 (Kết nối tối đa cho mỗi Domain, tránh việc 1 API sập làm nghẽn toàn bộ hệ thống).
* **Connect Timeout:** 2-5s.
* **Response Timeout (Read Timeout):** 5-10s.

### Interceptors (Bộ lọc)

Dùng để tự động gắn Token bảo mật (JWT) vào Header:

```java
public class AuthInterceptor implements ClientHttpRequestInterceptor {
    @Override
    public ClientHttpResponse intercept(HttpRequest req, byte[] body, ClientHttpRequestExecution exec) {
        String token = SecurityContextHolder.getContext().getAuthentication().getCredentials().toString();
        req.getHeaders().setBearerAuth(token);
        return exec.execute(req, body);
    }
}

```

---

## 5. Kỹ thuật gọi song song (Parallel Aggregation)

Trong mô hình BFF, hãy dùng `CompletableFuture` để gọi đồng thời nhiều API, giảm thời gian phản hồi (Latency).

```java
public CompletableFuture<DataDTO> fetchData() {
    var future1 = CompletableFuture.supplyAsync(() -> clientA.get(), executor);
    var future2 = CompletableFuture.supplyAsync(() -> clientB.get(), executor);
    
    return CompletableFuture.allOf(future1, future2)
            .thenApply(v -> new DataDTO(future1.join(), future2.join()));
}

```

---

## 6. Checklist khi thực hiện External Call

* [ ] Luôn cấu hình **Timeout** (Connect & Read).
* [ ] Luôn sử dụng **Connection Pool**.
* [ ] Sử dụng **RestClient.Builder** để tái sử dụng cấu hình.
* [ ] Có cơ chế **Error Handling** tập trung (`onStatus`).
* [ ] (Nâng cao) Tích hợp **Circuit Breaker** để "ngắt cầu dao" khi API đối tác sập.

---

## Hiện thực hóa Checklist External Call

### 1 & 2. Cấu hình Timeout và Connection Pool

Chúng ta gộp hai mục này vào tầng `ClientHttpRequestFactory`. Đây là "trái tim" quản lý các kết nối vật lý.

```java
@Configuration
public class HttpClientConfig {

    @Bean
    public ClientHttpRequestFactory customRequestFactory() {
        // 1. Cấu hình Connection Pool (Sử dụng Apache HttpClient 5)
        PoolingHttpClientConnectionManager connectionManager = new PoolingHttpClientConnectionManager();
        connectionManager.setMaxTotal(200);           // Tổng số kết nối tối đa trong Pool
        connectionManager.setDefaultMaxPerRoute(50);  // Giới hạn kết nối cho mỗi Domain/Route

        // 2. Cấu hình Timeout (Connect & Read)
        RequestConfig requestConfig = RequestConfig.custom()
                .setConnectTimeout(Timeout.ofSeconds(5))    // Thời gian chờ thiết lập kết nối
                .setResponseTimeout(Timeout.ofSeconds(10))  // Thời gian chờ nhận phản hồi (Read Timeout)
                .build();

        CloseableHttpClient httpClient = HttpClients.custom()
                .setConnectionManager(connectionManager)
                .setDefaultRequestConfig(requestConfig)
                .build();

        return new HttpComponentsClientHttpRequestFactory(httpClient);
    }
}

```

---

### 3 & 4. Tái sử dụng Builder và Error Handling tập trung

Tại đây, chúng ta tạo một "khuôn mẫu" (Template) chung cho mọi Request gửi đi.

```java
@Configuration
public class RestClientTemplateConfig {

    @Bean
    public RestClient.Builder sharedRestClientBuilder(ClientHttpRequestFactory factory) {
        return RestClient.builder()
                .requestFactory(factory)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                // 4. Error Handling tập trung: Bắt lỗi 4xx và 5xx cho TẤT CẢ Client dùng Builder này
                .defaultStatusHandler(HttpStatusCode::isError, (request, response) -> {
                    // Log lỗi chi tiết tại đây
                    log.error("External Call Error: {} - Status: {}", 
                              request.getURI(), response.getStatusCode());
                    
                    // Ném Custom Exception để GlobalExceptionHandler xử lý trả về cho Frontend
                    throw new AppException(ErrorCode.EXTERNAL_SERVICE_ERROR);
                });
    }
}

```

---

### 5. Tích hợp Circuit Breaker (Ngắt cầu dao)

Sử dụng **Resilience4j**. Khi API đối tác gặp sự cố liên tục, Circuit Breaker sẽ "mở mạch" để chặn các request vô ích, giúp hệ thống của bạn không bị treo theo đối tác.

#### **Bước A: Thêm Dependency**

```xml
<dependency>
    <groupId>io.github.resilience4j</groupId>
    <artifactId>resilience4j-spring-boot3</artifactId>
</dependency>

```

#### **Bước B: Cấu hình trong `application.yml**`

```yaml
resilience4j:
  circuitbreaker:
    instances:
      externalService:
        failureRateThreshold: 50        # Ngắt mạch nếu > 50% request lỗi
        minimumNumberOfCalls: 10        # Chỉ tính toán sau khi đã gọi ít nhất 10 lần
        waitDurationInOpenState: 30s    # Chờ 30 giây trước khi thử kết nối lại

```

#### **Bước C: Sử dụng trong Service**

```java
@Service
@RequiredArgsConstructor
public class PaymentService {
    private final RestClient.Builder builder;

    // 5. Annotation @CircuitBreaker giúp bảo vệ phương thức này
    @CircuitBreaker(name = "externalService", fallbackMethod = "handlePaymentFallback")
    public String callPaymentGateway(PaymentDTO payment) {
        return builder.baseUrl("https://checkout.partner.com")
                .build()
                .post()
                .body(payment)
                .retrieve()
                .body(String.class);
    }

    // Hàm dự phòng (Fallback) khi mạch bị ngắt hoặc API đối tác lỗi
    public String handlePaymentFallback(PaymentDTO payment, Exception ex) {
        log.warn("Circuit Breaker activated! Trả về thông báo bảo trì cho khách hàng.");
        return "Cổng thanh toán đang bảo trì, vui lòng thử lại sau 30 giây.";
    }
}

```

---

### Tóm tắt luồng vận hành

1. **Request Factory:** Đảm bảo không bao giờ hết kết nối (Pool) và không chờ đợi vô tận (Timeout).
2. **Builder:** Đảm bảo mọi API call đều có cùng tiêu chuẩn (Header, Auth) và luôn được xử lý lỗi thống nhất (`onStatus`).
3. **Circuit Breaker:** Đóng vai trò là "lớp giáp" cuối cùng. Nếu Service bên ngoài "chết thật", app của bạn vẫn "sống khỏe" nhờ hàm Fallback.
