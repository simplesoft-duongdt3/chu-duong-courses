# Chủ đề 3: Persistence với Spring Data JPA & Hibernate

Trong Frontend, dữ liệu thường là các JSON Object lồng nhau. Trong Database quan hệ (SQL), dữ liệu được chia nhỏ thành các hàng và cột. **JPA (Java Persistence API)** chính là "người phiên dịch" giúp biến các hàng đó thành Java Object và ngược lại.

### 1. Lý thuyết: Những khái niệm "phải nằm lòng"

* **Entity:** Là một class Java đại diện cho một bảng trong DB. Mỗi instance của class này tương ứng với một hàng (row).
* **Hibernate:** Là "thợ máy" thực hiện việc chuyển đổi. JPA chỉ là "bản thiết kế" (specification).
* **Persistence Context (First-level Cache):** Hãy tưởng tượng đây là một "vùng đệm". Khi bạn lấy một Entity ra, nó nằm trong vùng này. Nếu bạn sửa nó, Hibernate sẽ tự động nhận biết và cập nhật xuống DB khi kết thúc giao dịch (Transaction) mà không cần bạn gọi hàm `save`.
* **Derived Queries:** Spring Data JPA cho phép bạn tạo truy vấn chỉ bằng cách đặt tên hàm. Ví dụ: `findByEmail(String email)` sẽ tự động được dịch thành `SELECT * FROM users WHERE email = ?`.

---

### 2. Ví dụ Code & Cấu hình

#### A. Cấu hình Database (`application.yml`)

Thay vì viết code kết nối loằng ngoằng, bạn chỉ cần khai báo:

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/mydb
    username: admin
    password: password
  jpa:
    hibernate:
      ddl-auto: update # Tự động tạo/sửa bảng dựa trên class Java
    show-sql: true    # Hiện câu lệnh SQL ở console để debug
    properties:
      hibernate:
        format_sql: true

```

#### B. Định nghĩa Entity & Repository

```java
@Entity
@Table(name = "products")
public class Product {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private Double price;

    // Getters/Setters
}

// Chỉ cần khai báo Interface, Spring sẽ tự viết code triển khai!
public interface ProductRepository extends JpaRepository<Product, Long> {
    List<Product> findByPriceGreaterThan(Double price);
}

```

---

### 3. Tình huống thực tế (Real-world Scenarios)

**Tình huống 1: Mối quan hệ Cha-Con (One-to-Many)**

* **Vấn đề:** Một `Category` có nhiều `Product`. Frontend muốn khi lấy Category thì thấy luôn danh sách Product.
* **Giải pháp:** Dùng `@OneToMany` với `fetch = FetchType.LAZY`.
* **Lưu ý:** Dev Frontend thường muốn lấy hết một lần, nhưng trong DB, nếu danh sách con quá lớn (triệu hàng), việc lấy hết sẽ làm sập server. Đây là lý do ta phải dùng **Pagination** (phân trang).

**Tình huống 2: Lỗi kinh điển  Query (Performance)**

* **Vấn đề:** Bạn muốn lấy 10 bài viết, và với mỗi bài viết bạn lại lấy tên tác giả.
* **Hậu quả:** Hibernate sẽ chạy 1 câu SELECT lấy 10 bài viết, sau đó chạy thêm 10 câu SELECT nữa để lấy tác giả của từng bài. Tổng cộng  câu lệnh (trong khi chỉ cần 1 câu `JOIN` là đủ).
* **Giải pháp:** Sử dụng `@EntityGraph` hoặc `JOIN FETCH` trong câu truy vấn để ép Hibernate lấy dữ liệu trong 1 lần duy nhất.

**Tình huống 3: Entity vs. DTO (Data Transfer Object)**

* **Vấn đề:** Entity của bạn có trường `passwordHash` hoặc `internalNote`. Nếu bạn trả trực tiếp Entity về Frontend, bạn đang hở lỗ hổng bảo mật.
* **Giải pháp:** Luôn chuyển đổi Entity sang một class trung gian gọi là **DTO** trước khi gửi về cho Frontend. Điều này giúp bạn kiểm soát chính xác những gì Frontend được thấy và bảo vệ cấu trúc DB bên dưới.

---

### Bảng so sánh "Tư duy dữ liệu"

| Đặc điểm | Frontend (JSON) | Backend (JPA/SQL) |
| --- | --- | --- |
| **Liên kết** | Nesting (Object trong Object) | Foreign Key (ID tham chiếu) |
| **Định danh** | Tùy chọn (ID hoặc không) | Bắt buộc phải có `@Id` (Primary Key) |
| **Thay đổi** | Gán giá trị mới (`obj.a = 1`) | Phải nằm trong `@Transactional` để lưu |
| **Số lượng** | Thường xử lý tập dữ liệu nhỏ | Phải xử lý hàng triệu hàng (Limit/Offset) |

---

### Mẹo nhỏ cho bạn:

Đừng bao giờ tin vào `ddl-auto: update` ở môi trường Production. Nó có thể xóa cột hoặc thay đổi kiểu dữ liệu của bạn chỉ vì một lỗi nhỏ trong code. Hãy dùng các công cụ quản lý version DB như **Liquibase** hoặc **Flyway** (chúng ta có thể thảo luận ở chủ đề sau).


---

# Chủ đề 3.1: No-DB Service & Multi-DB Configuration

### 1. Service không có Database (No-DB Service)

Trong Frontend, bạn gọi là "Proxy" hoặc "BFF" (Backend For Frontend). Ở Spring Boot, đây là những Service chỉ làm nhiệm vụ logic, tính toán, hoặc điều hướng request.

**Lý thuyết:**

* **Loại bỏ Dependency:** Nếu dự án hoàn toàn không dùng DB, đơn giản là đừng khai báo `spring-boot-starter-data-jpa` trong file `pom.xml` hoặc `build.gradle`.
* **Loại bỏ Auto-Configuration:** Nếu bạn lỡ cài thư viện JPA nhưng chưa muốn cấu hình DB ngay, Spring Boot sẽ báo lỗi "Failed to configure a DataSource". Bạn phải chủ động tắt nó đi.

**Cấu hình & Code mẫu:**

```java
// Tắt tự động cấu hình Database trong class Main
@SpringBootApplication(exclude = {DataSourceAutoConfiguration.class })
public class ProxyServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(ProxyServiceApplication.class, args);
    }
}

```

---

### 2. Service dùng nhiều Database (Multi-DB Service)

Đây là kịch bản phức tạp hơn. Mặc định Spring Boot chỉ mong đợi **một** DataSource. Để dùng hai cái, bạn phải tự tay "đạo diễn" việc khởi tạo các Bean.

**Lý thuyết:**
Để dùng 2 DB (ví dụ MySQL và PostgreSQL), bạn cần chia dự án thành các Package riêng biệt:

1. **DB1 (Primary):** Chứa Entity và Repository của MySQL.
2. **DB2 (Secondary):** Chứa Entity và Repository của PostgreSQL.
Spring sẽ dựa vào đường dẫn Package để biết "thằng Repository này thì dùng kết nối của DB nào".

**Cấu hình (`application.yml`):**

```yaml
spring:
  datasource:
    primary:
      jdbc-url: jdbc:mysql://localhost:3306/db_chinh
      username: root
      password: 123
      driver-class-name: com.mysql.cj.jdbc.Driver
    secondary:
      jdbc-url: jdbc:postgresql://localhost:5432/db_phu
      username: postgres
      password: 123
      driver-class-name: org.postgresql.Driver

```

**Code ví dụ cho cấu hình DB thứ hai:**

```java
@Configuration
@EnableJpaRepositories(
    basePackages = "com.example.repository.secondary", // Chỉ định repository dùng DB này
    entityManagerFactoryRef = "secondaryEntityManagerFactory",
    transactionManagerRef = "secondaryTransactionManager"
)
public class SecondaryDbConfig {

    @Bean
    @ConfigurationProperties("spring.datasource.secondary")
    public DataSource secondaryDataSource() {
        return DataSourceBuilder.create().build();
    }

    @Bean
    public LocalContainerEntityManagerFactoryBean secondaryEntityManagerFactory(
            EntityManagerFactoryBuilder builder) {
        return builder
                .dataSource(secondaryDataSource())
                .packages("com.example.entity.secondary") // Chỉ định Entity dùng DB này
                .build();
    }
    // ... Cần thêm TransactionManager tương ứng
}

```

---

### 3. Tình huống thực tế (Real-world Scenarios)

**Tình huống 1: API Gateway / Aggregator (No-DB)**

* **Vấn đề:** Bạn có 10 Microservices khác nhau. Frontend không muốn gọi 10 lần. Bạn cần 1 Service trung gian gọi cả 10 cái đó, gộp dữ liệu lại thành 1 JSON duy nhất rồi trả về.
* **Giải pháp:** Dùng Spring Boot với `WebClient` (non-blocking). Service này không có DB riêng, nó chỉ dùng RAM để xử lý dữ liệu tạm thời. Nó đóng vai trò như một "nhà điều phối".

**Tình huống 2: Tách biệt Read/Write (Multi-DB)**

* **Vấn đề:** Hệ thống của bạn có lượng truy vấn (Read) cực lớn. Bạn muốn các thao tác ghi (Write) vào DB chính (MySQL), còn các thao tác đọc báo cáo thì lấy từ một DB bản sao (Read-Replica) để giảm tải.
* **Giải pháp:** Cấu hình 2 DataSource. Trong code, các Service làm nhiệm vụ báo cáo sẽ được "tiêm" (Inject) Repository thuộc về DB Read-only.

**Tình huống 3: Đồng bộ dữ liệu cũ và mới (Migration Service)**

* **Vấn đề:** Công ty đang chuyển từ SQL Server cũ sang PostgreSQL mới. Bạn cần viết một công cụ chạy ngầm để đọc từng dòng từ SQL Server, xử lý logic, rồi ghi vào PostgreSQL.
* **Giải pháp:** Đây là lúc Multi-DB tỏa sáng. Bạn mở đồng thời 2 kết nối. Dùng một `Scheduler` (hẹn giờ) để quét DB1 và `save` sang DB2.

---

### Tóm tắt cho Dev Frontend chuyển hệ

* **No-DB:** Giống như bạn viết một con bot Telegram hoặc một cái Proxy bằng Node.js mà không dùng MongoDB/SQL. Cực nhẹ và nhanh.
* **Multi-DB:** Đừng coi Backend là một "cục" duy nhất nữa. Hãy coi nó là một **hub kết nối**. Bạn có thể cắm bao nhiêu "ổ điện" (Database) tùy thích, miễn là bạn khai báo rõ ràng "dây nào cắm vào ổ nào" thông qua cấu hình Java Config.

---

# Chủ đề 3.2: Multi-tenancy - Điều hướng Database động - Dynamic Routing DataSource

### 1. Lý thuyết: Cơ chế "Phễu điều hướng"

Thay vì trả về một kết nối cố định, Spring sử dụng một lớp trung gian gọi là `AbstractRoutingDataSource`.

1. **Request tới:** Một **Filter** hoặc **Interceptor** sẽ soi vào Header (ví dụ: `X-Tenant-ID`), JWT, hoặc Domain để biết Request này thuộc về khách hàng nào.
2. **Lưu trữ ID:** ID của khách hàng (Tenant ID) được lưu vào một biến **ThreadLocal** (biến này tồn tại xuyên suốt luồng xử lý của request đó).
3. **Lấy Connection:** Khi Repository cần gọi DB, nó hỏi `RoutingDataSource`. Thằng này sẽ liếc vào `ThreadLocal`, lấy cái ID ra và "bốc" đúng kết nối của DB tương ứng để đưa cho Repository.

---

### 2. Ví dụ Code & Cấu hình

#### A. Nơi lưu trữ Tenant ID (ThreadLocal)

Vì Backend xử lý đa luồng, ta dùng `ThreadLocal` để đảm bảo ID của khách hàng A không bị lẫn sang khách hàng B.

```java
public class TenantContext {
    private static final ThreadLocal<String> CURRENT_TENANT = new ThreadLocal<>();

    public static void setCurrentTenant(String tenantId) {
        CURRENT_TENANT.set(tenantId);
    }

    public static String getCurrentTenant() {
        return CURRENT_TENANT.get();
    }

    public static void clear() {
        CURRENT_TENANT.remove();
    }
}

```

#### B. Triển khai Routing Logic

Đây là nơi Spring "hỏi" bạn: "Giờ dùng DB nào?"

```java
public class TransactionRoutingDataSource extends AbstractRoutingDataSource {
    @Override
    protected Object determineCurrentLookupKey() {
        // Trả về ID của Tenant hiện tại
        return TenantContext.getCurrentTenant();
    }
}

```

#### C. Filter bóc tách Tenant ID từ Request

Giống như nhân viên lễ tân hỏi "Anh từ công ty nào đến?"

```java
@Component
public class TenantFilter implements Filter {
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) {
        HttpServletRequest req = (HttpServletRequest) request;
        String tenantId = req.getHeader("X-Tenant-ID"); // Lấy ID từ Header
        
        if (tenantId != null) {
            TenantContext.setCurrentTenant(tenantId);
        }
        
        try {
            chain.doFilter(request, response);
        } finally {
            TenantContext.clear(); // Quan trọng: Phải xóa để tránh memory leak
        }
    }
}

```

---

### 3. Tình huống thực tế (Real-world Scenarios)

**Tình huống 1: Mô hình SaaS (Software as a Service)**

* **Vấn đề:** Bạn bán phần mềm kế toán cho 100 công ty. Theo luật, dữ liệu của Công ty A không được nằm chung bảng với Công ty B để đảm bảo bảo mật tuyệt đối.
* **Giải pháp:** Mỗi công ty có 1 Database riêng (Physical Isolation). Khi nhân viên Công ty A đăng nhập, hệ thống tự động lái mọi câu lệnh SQL về phía Server DB của công ty đó.

**Tình huống 2: White-labeling (Tùy biến thương hiệu)**

* **Vấn đề:** Bạn làm một App đặt đồ ăn. Khách hàng `foody.com` dùng DB tại Singapore, khách hàng `delivery.vn` dùng DB tại Việt Nam.
* **Giải pháp:** Dựa vào **Domain name** của request gửi đến để quyết định DB. Nếu domain kết thúc bằng `.vn`, RoutingDataSource sẽ bốc kết nối từ cụm Server Việt Nam để giảm latency.

**Tình huống 3: Dùng chung DB nhưng khác Schema**

* **Vấn đề:** Bạn muốn tiết kiệm tiền, chỉ mua 1 Instance DB lớn trên AWS (như PostgreSQL), nhưng mỗi khách hàng nằm ở 1 **Schema** khác nhau.
* **Giải pháp:** Lúc này thay vì đổi `DataSource`, bạn sẽ gửi một câu lệnh `SET search_path TO tenant_id` ngay khi kết nối vừa được thiết lập.

---

### Tóm tắt cho "Dân Frontend"

| Đặc điểm | Cách làm thủ công (Dễ sai) | Cách làm của Spring (Multi-tenancy) |
| --- | --- | --- |
| **Logic chọn DB** | Viết `if/else` trong từng hàm Service | Viết 1 lần duy nhất ở tầng Configuration |
| **Truyền tham số** | Phải truyền `tenantId` vào mọi hàm | Tự động lấy từ "Ngữ cảnh" (Context) |
| **Bảo mật** | Dễ quên `WHERE tenant_id = ...` | Cách ly hoàn toàn ở tầng kết nối, không thể đọc nhầm |

---

**Cảnh báo nhẹ:** Việc quản lý nhiều DB rất tốn tài nguyên (Connection Pool). Nếu bạn có 1000 khách hàng mà mỗi khách hàng mở 10 kết nối thì server sẽ "ngất" ngay. Người ta thường dùng kết hợp với **Dynamic DataSource Loading** (chỉ nạp DB khi có request và giải phóng khi không dùng).


---

# Chủ đề 3.1: Cấu hình Chi tiết Multi-DataSource trong Spring Boot 3

Để dùng được từ 2 Database trở lên, bạn cần thực hiện 3 bước: Khai báo cấu hình, viết lớp Java Config riêng cho từng DB và chia package cho Entity/Repository.

### 1. Cấu hình Properties (`application.yml`)

Chúng ta sẽ định nghĩa hai nguồn dữ liệu: một cho **Order** (MySQL) và một cho **Inventory** (PostgreSQL).

```yaml
spring:
  datasource:
    # Database thứ nhất (Primary)
    orders:
      jdbc-url: jdbc:mysql://localhost:3306/db_orders
      username: root
      password: password
      driver-class-name: com.mysql.cj.jdbc.Driver
    # Database thứ hai
    inventory:
      jdbc-url: jdbc:postgresql://localhost:5432/db_inventory
      username: postgres
      password: password
      driver-class-name: org.postgresql.Driver
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: true

```

---

### 2. Java Configuration (Phần quan trọng nhất)

Bạn cần tạo các lớp Config riêng biệt để chỉ định: "Repository ở package nào thì đi với Database nào".

#### A. Cấu hình Database 1 (Orders - Primary)

```java
@Configuration
@EnableTransactionManagement
@EnableJpaRepositories(
    basePackages = "com.example.repository.orders", // Chỉ quét repository trong package này
    entityManagerFactoryRef = "ordersEntityManagerFactory",
    transactionManagerRef = "ordersTransactionManager"
)
public class OrdersDbConfig {

    @Primary
    @Bean(name = "ordersDataSource")
    @ConfigurationProperties("spring.datasource.orders")
    public DataSource dataSource() {
        return DataSourceBuilder.create().build();
    }

    @Primary
    @Bean(name = "ordersEntityManagerFactory")
    public LocalContainerEntityManagerFactoryBean entityManagerFactory(
            EntityManagerFactoryBuilder builder, @Qualifier("ordersDataSource") DataSource dataSource) {
        return builder
                .dataSource(dataSource)
                .packages("com.example.entity.orders") // Chỉ quét Entity trong package này
                .persistenceUnit("orders")
                .build();
    }

    @Primary
    @Bean(name = "ordersTransactionManager")
    public PlatformTransactionManager transactionManager(
            @Qualifier("ordersEntityManagerFactory") EntityManagerFactory entityManagerFactory) {
        return new JpaTransactionManager(entityManagerFactory);
    }
}

```

#### B. Cấu hình Database 2 (Inventory)

Cấu hình tương tự nhưng **không có** `@Primary` và trỏ vào package khác.

```java
@Configuration
@EnableJpaRepositories(
    basePackages = "com.example.repository.inventory",
    entityManagerFactoryRef = "inventoryEntityManagerFactory",
    transactionManagerRef = "inventoryTransactionManager"
)
public class InventoryDbConfig {

    @Bean(name = "inventoryDataSource")
    @ConfigurationProperties("spring.datasource.inventory")
    public DataSource dataSource() {
        return DataSourceBuilder.create().build();
    }

    @Bean(name = "inventoryEntityManagerFactory")
    public LocalContainerEntityManagerFactoryBean entityManagerFactory(
            EntityManagerFactoryBuilder builder, @Qualifier("inventoryDataSource") DataSource dataSource) {
        return builder
                .dataSource(dataSource)
                .packages("com.example.entity.inventory")
                .persistenceUnit("inventory")
                .build();
    }

    @Bean(name = "inventoryTransactionManager")
    public PlatformTransactionManager transactionManager(
            @Qualifier("inventoryEntityManagerFactory") EntityManagerFactory entityManagerFactory) {
        return new JpaTransactionManager(entityManagerFactory);
    }
}

```

---

### 3. Tổ chức thư mục (Project Structure)

Đây là chìa khóa để Spring không bị lẫn lộn giữa các DB:

```text
src/main/java/com/example/
 ├── config/
 │    ├── OrdersDbConfig.java
 │    └── InventoryDbConfig.java
 ├── entity/
 │    ├── orders/       <-- Entity cho DB Orders
 │    └── inventory/    <-- Entity cho DB Inventory
 └── repository/
      ├── orders/       <-- Repository cho DB Orders
      └── inventory/    <-- Repository cho DB Inventory

```

---

### 4. Tình huống thực tế (Real-world Scenarios)

**Tình huống 1: Tách biệt dữ liệu nhạy cảm**

* **Vấn đề:** Bạn làm ứng dụng Fintech. Thông tin cá nhân (KYC) phải lưu ở một DB có mã hóa cực mạnh, còn lịch sử giao dịch lưu ở DB khác để tối ưu tốc độ đọc.
* **Giải pháp:** Dùng Multi-DataSource. Khi lưu User, bạn gọi `KycRepository`. Khi lưu giao dịch, bạn gọi `TransactionRepository`. Spring sẽ tự động mở đúng kết nối tương ứng.

**Tình huống 2: Tích hợp hệ thống cũ (Legacy System)**

* **Vấn đề:** Bạn viết một Service mới bằng Spring Boot nhưng phải đọc dữ liệu User từ một DB Oracle "cổ đại" của công ty, đồng thời lưu dữ liệu mới vào PostgreSQL.
* **Giải pháp:** Cấu hình DB Oracle là `Secondary` (chỉ đọc) và PostgreSQL là `Primary`. Bạn có thể dễ dàng JOIN dữ liệu ở tầng Java Service sau khi lấy từ 2 Repository khác nhau.

**Tình huống 3: CQRS đơn giản (Command Query Responsibility Segregation)**

* **Vấn đề:** DB chính bị chậm do quá nhiều người vào xem báo cáo.
* **Giải pháp:** Bạn tạo một DB bản sao (Read-only Replica). Trong Spring Boot, bạn cấu hình 2 DataSource trỏ vào 2 DB này. Các hàm `get...` sẽ dùng `ReadOnlyRepository`, các hàm `save/update` dùng `WriteRepository`.

---

**Ghi chú cho Dev Frontend:**
Việc cấu hình này giống như bạn đang thiết lập nhiều **Base URL** khác nhau trong Axios cho từng loại dữ liệu vậy. Điểm khác biệt là ở Backend, việc "chọn URL nào" được thực hiện dựa trên package của code thay vì chuỗi string trong code.

---

Tiếp nối chủ đề Multi-tenancy, chúng ta sẽ đi sâu vào **AbstractRoutingDataSource**. Đây là giải pháp "tối thượng" khi bạn không muốn (hoặc không thể) cấu hình cứng từng Database một.

Nếu ở Frontend bạn dùng **Environment Variables** để đổi API URL, thì ở Backend, chúng ta dùng **RoutingDataSource** để đổi "đầu dây" kết nối Database ngay khi code đang chạy.

---

# Chủ đề 3.2: Điều hướng Database động với AbstractRoutingDataSource

### 1. Lý thuyết: Cơ chế "Tổng đài viên"

Hãy tưởng tượng `AbstractRoutingDataSource` như một tổng đài điện thoại. Khi một câu lệnh SQL (Request) gọi đến, tổng đài viên sẽ hỏi: "Anh là ai?". Dựa trên câu trả lời, họ sẽ cắm dây vào đúng ổ cắm Database của người đó.

**Quy trình 3 bước:**

1. **Xác định (Identification):** Lấy `tenantId` từ Request (Header, Token, hoặc Domain).
2. **Lưu trữ (Storage):** Cất `tenantId` vào `ThreadLocal` để mọi tầng code (Service, Repository) đều biết đang phục vụ ai.
3. **Điều hướng (Routing):** `AbstractRoutingDataSource` nhìn vào `ThreadLocal` và trả về kết nối DB tương ứng.

---

### 2. Ví dụ Code & Cấu hình

#### A. Bộ lưu trữ ngữ cảnh (TenantContext)

Sử dụng `ThreadLocal` để đảm bảo thông tin khách hàng không bị "lẫn" giữa các Request chạy song song.

```java
public class TenantContext {
    private static final ThreadLocal<String> currentTenant = new ThreadLocal<>();

    public static void setTenantId(String tenantId) {
        currentTenant.set(tenantId);
    }

    public static String getTenantId() {
        return currentTenant.get();
    }

    public static void clear() {
        currentTenant.remove();
    }
}

```

#### B. Lớp điều hướng (RoutingDataSource)

Lớp này ghi đè logic chọn "Key" để tìm Database.

```java
import org.springframework.jdbc.datasource.lookup.AbstractRoutingDataSource;

public class TenantRoutingDataSource extends AbstractRoutingDataSource {
    @Override
    protected Object determineCurrentLookupKey() {
        // Spring sẽ gọi hàm này mỗi khi cần kết nối DB
        return TenantContext.getTenantId();
    }
}

```

#### C. Cấu hình Bean (Configuration)

Bạn cần một Map để chứa danh sách các Database.

```java
@Configuration
public class DataSourceConfig {

    @Bean
    public DataSource dataSource() {
        TenantRoutingDataSource routingDataSource = new TenantRoutingDataSource();

        // 1. Tạo danh sách các DB thực tế
        Map<Object, Object> targetDataSources = new HashMap<>();
        targetDataSources.put("TENANT_A", createDataSource("jdbc:mysql://localhost:3306/db_a"));
        targetDataSources.put("TENANT_B", createDataSource("jdbc:mysql://localhost:3306/db_b"));

        routingDataSource.setTargetDataSources(targetDataSources);
        
        // 2. DB mặc định nếu không tìm thấy tenantId
        routingDataSource.setDefaultTargetDataSource(createDataSource("jdbc:mysql://localhost:3306/db_default"));

        return routingDataSource;
    }

    private DataSource createDataSource(String url) {
        return DataSourceBuilder.create()
                .url(url)
                .username("root")
                .password("password")
                .build();
    }
}

```

#### D. Lấy Tenant ID từ Request (Interceptor)

Đây là nơi bạn "bắt" thông tin từ Frontend.

```java
@Component
public class TenantInterceptor implements HandlerInterceptor {
    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String tenantId = request.getHeader("X-Tenant-ID");
        TenantContext.setTenantId(tenantId);
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        TenantContext.clear(); // Bắt buộc phải xóa để tránh rò rỉ dữ liệu (Security Risk)
    }
}

```

---

### 3. Tình huống thực tế (Real-world Scenarios)

**Tình huống 1: Hệ thống SaaS bán hàng cho các Shop**

* **Vấn đề:** Mỗi Shop (Tenant) có hàng triệu đơn hàng. Nếu lưu chung một DB sẽ cực kỳ chậm và khó backup riêng lẻ cho từng khách.
* **Giải pháp:** Khi chủ Shop A đăng nhập, Frontend gửi Header `X-Tenant-ID: shop_a`. Backend tự động lái toàn bộ query vào DB của Shop A. Khi Shop B đăng nhập, dữ liệu lại được lái sang DB của Shop B.

**Tình huống 2: Tách biệt môi trường Demo và Real**

* **Vấn đề:** Bạn muốn khách hàng dùng thử (Demo) trên dữ liệu thật nhưng không muốn họ làm hỏng dữ liệu đang chạy (Production).
* **Giải pháp:** Dựa vào User Role. Nếu Role là `GUEST`, RoutingDataSource sẽ trỏ vào `db_sandbox`. Nếu Role là `ADMIN`, nó sẽ trỏ vào `db_production`.

**Tình huống 3: Hệ thống đa quốc gia (Data Residency)**

* **Vấn đề:** Luật pháp yêu cầu dữ liệu người dùng EU phải lưu tại máy chủ EU, dữ liệu Mỹ lưu tại Mỹ.
* **Giải pháp:** Dựa vào IP hoặc địa chỉ email của User khi đăng nhập. RoutingDataSource sẽ điều hướng kết nối tới cụm Database vật lý đặt tại vùng lãnh thổ tương ứng.

---

### Lưu ý "sương máu" cho Dev Frontend chuyển hệ:

1. **Connection Pool:** Mỗi Database trong Map sẽ chiếm một lượng kết nối nhất định. Đừng mở quá nhiều DB cùng lúc kẻo treo server.
2. **Transaction:** Việc chuyển đổi DB phải xảy ra **trước** khi một `@Transactional` bắt đầu. Nếu đã vào trong Transaction rồi mà bạn đổi `TenantContext`, nó sẽ không có tác dụng.
3. **Liquibase/Flyway:** Việc cập nhật cấu trúc bảng (Migration) cho 100 DB cùng lúc là một thử thách lớn. Bạn sẽ cần viết script để lặp qua danh sách DB và chạy migration cho từng cái.

---