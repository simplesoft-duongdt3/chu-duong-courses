# Chủ đề 10: Audit Log - Camera giám sát Database

---

Chào bạn! Đây là một chủ đề cực kỳ quan trọng trong các dự án thực tế. Nếu ở Frontend, bạn có "Undo/Redo" hoặc "History" trong bộ nhớ tạm, thì ở Backend, **Audit Log** giống như một chiếc camera an ninh 24/7. Nó ghi lại mọi biến động của dữ liệu: "Ai đã tạo?", "Khi nào sửa?", và "Trước khi sửa nó trông thế nào?".

Trong Spring Boot 3, chúng ta chia Audit Log làm 2 cấp độ:

1. **Basic Auditing:** Chỉ ghi lại dấu mốc (Ngày tạo, ngày sửa, người tạo, người sửa).
2. **Full Auditing (Versioning):** Ghi lại toàn bộ lịch sử thay đổi của từng trường dữ liệu (Dùng Hibernate Envers).

### 1. Lý thuyết: Cơ chế "Lắng nghe" (Entity Listeners)

Thay vì bạn phải viết tay `product.setCreatedAt(new Date())` trong mọi hàm Service, Spring Data JPA sử dụng các **Listeners**. Khi một Entity chuẩn bị được lưu xuống DB, Spring sẽ tự động "nhảy vào" để điền các thông tin này.

* **@CreatedDate / @LastModifiedDate:** Tự động lấy thời gian hệ thống.
* **@CreatedBy / @LastModifiedBy:** Lấy thông tin User hiện tại từ `SecurityContext` (Spring Security).
* **Hibernate Envers:** Tạo ra các bảng phụ (có đuôi `_AUD`) để lưu lại từng phiên bản của dữ liệu mỗi khi có lệnh `UPDATE` hoặc `DELETE`.

---

### 2. Ví dụ Code & Cấu hình

#### A. Cấu hình cơ bản

Đầu tiên, bạn cần bật tính năng Auditing trong App.

```java
@Configuration
@EnableJpaAuditing(auditorAwareRef = "auditorProvider")
public class AuditConfig {
    @Bean
    public AuditorAware<String> auditorProvider() {
        // Trả về username từ Spring Security
        return () -> Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication())
                .map(Authentication::getName);
    }
}

```

#### B. Tạo Base Entity (Dùng chung cho mọi bảng)

Bạn không muốn copy-paste 4 trường này vào tất cả các Class. Hãy dùng `@MappedSuperclass`.

```java
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter
public abstract class BaseEntity {
    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    @CreatedBy
    @Column(updatable = false)
    private String createdBy;

    @LastModifiedBy
    private String updatedBy;
}

```

#### C. Full Audit với Hibernate Envers

Để ghi lại lịch sử "trước và sau", bạn chỉ cần thêm thư viện `hibernate-envers` và dùng Annotation `@Audited`.

```java
@Entity
@Audited // <--- Phép màu ở đây: Mọi thay đổi sẽ được lưu vào bảng product_aud
public class Product extends BaseEntity {
    @Id @GeneratedValue
    private Long id;
    private String name;
    private Double price;
}

```

---

### 3. Tình huống thực tế (Real-world Scenarios)

**Tình huống 1: Giải quyết tranh chấp "Ai đã đổi giá?"**

* **Vấn đề:** Giá sản phẩm bỗng dưng giảm từ 10tr xuống 1tr khiến công ty lỗ nặng. Nhân viên A đổ lỗi cho nhân viên B.
* **Giải pháp:** Nhờ **Full Audit**, bạn truy vấn bảng `product_aud`. Bạn thấy rõ ràng vào lúc 2:00 sáng, Account của nhân viên A đã thực hiện lệnh Update. Bạn thậm chí thấy được giá cũ là 10tr và giá mới là 1tr.

**Tình huống 2: Chức năng "Khôi phục dữ liệu đã xóa" (Restore)**

* **Vấn đề:** User lỡ tay xóa một bài viết quan trọng.
* **Giải pháp:** Hibernate Envers không chỉ lưu thay đổi mà lưu cả bản ghi trước khi bị xóa. Bạn có thể dễ dàng lấy lại dữ liệu từ "quá khứ" và lưu ngược lại vào bảng chính mà không cần lục tìm bản backup DB.

**Tình huống 3: Hiển thị "Lịch sử cập nhật" cho người dùng**

* **Vấn đề:** Trong các ứng dụng như Google Docs hay Jira, user muốn xem danh sách các lần chỉnh sửa.
* **Giải pháp:** Thay vì tự thiết kế bảng lịch sử phức tạp, bạn dùng `AuditReader` của Envers để lấy ra danh sách các `Revision`. Mỗi Revision sẽ cho biết ai đã sửa trường nào vào lúc nào để hiển thị lên UI cho Frontend.

---

### Bảng so sánh cho "Dân App/Frontend"

| Tiêu chí | Manual Coding (Tự code) | JPA Auditing & Envers |
| --- | --- | --- |
| **Công sức** | Phải nhớ set Date/User ở mọi nơi | Cấu hình 1 lần, chạy mãi mãi |
| **Độ chính xác** | Dễ quên, dễ sai lệch múi giờ | Đồng bộ hoàn toàn ở tầng Persistence |
| **Dữ liệu lịch sử** | Thường chỉ lưu bản cuối cùng | Lưu tất cả các version (Time Travel) |
| **Hiệu năng** | Không ảnh hưởng đáng kể | Tốn thêm dung lượng DB (do bảng Audit) |

---

### ⚠️ Lưu ý cho bạn:

Việc dùng **Full Audit** (Envers) sẽ khiến Database của bạn phình to rất nhanh vì mỗi lần sửa 1 dấu phẩy nó cũng tạo ra 1 dòng mới trong bảng `_AUD`.

* **Mẹo:** Chỉ dùng `@Audited` cho những bảng thực sự quan trọng (Giao dịch, User, Cấu hình hệ thống). Đừng dùng cho những bảng chứa log rác hoặc dữ liệu thay đổi theo từng giây.

---

Nếu ở Frontend bạn dùng `git` để quản lý phiên bản code, thì ở Backend, chúng ta dùng **Database Migration** (Flyway hoặc Liquibase) để quản lý phiên bản của cấu trúc bảng (Schema).

Tuyệt đối không nên để Hibernate tự tạo bảng bằng `ddl-auto: update` ở môi trường thực tế. Dưới đây là cách bạn thiết kế các file Migration (SQL) để hỗ trợ tính năng **Audit Log** đã thảo luận.

---

# Database Migration cho Audit Log (Flyway/SQL style)

### 1. Migration cho Basic Auditing (Created/Updated)

Khi bạn dùng `@CreatedDate`, `@LastModifiedBy`, các cột này phải **nằm trực tiếp** trong bảng chính của bạn.

**File: `V1__create_product_table.sql**`

```sql
CREATE TABLE products (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price DOUBLE NOT NULL,
    
    -- Các cột phục vụ Basic Audit
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_by VARCHAR(50)
);

```

---

### 2. Migration cho Full Audit (Hibernate Envers)

Khi bạn thêm Annotation `@Audited`, Hibernate Envers yêu cầu 2 loại bảng:

#### A. Bảng thông tin phiên bản chung (`REVINFO`)

Đây là bảng "tổng", ghi lại mỗi khi có một giao dịch (transaction) bất kỳ làm thay đổi dữ liệu. Một hàng trong bảng này đại diện cho một lần nhấn nút "Save" của user.

**File: `V2__create_envers_revinfo.sql**`

```sql
CREATE TABLE revinfo (
    rev INTEGER NOT NULL AUTO_INCREMENT, -- ID của phiên bản (Revision ID)
    revtstmp BIGINT,                     -- Thời gian xảy ra thay đổi (Unix Timestamp)
    PRIMARY KEY (rev)
);

```

#### B. Bảng lịch sử thực thể (`{table_name}_AUD`)

Mỗi bảng cần Audit sẽ có một bảng "bóng ma" đi kèm. Nó lưu lại trạng thái của dữ liệu tại thời điểm đó.

**File: `V3__create_product_audit_table.sql**`

```sql
CREATE TABLE products_aud (
    id BIGINT NOT NULL,    -- ID của product
    rev INTEGER NOT NULL,  -- ID phiên bản (khóa ngoại sang bảng revinfo)
    revtype TINYINT,       -- Loại thay đổi: 0 (Add), 1 (Update), 2 (Delete)
    
    -- Copy lại các cột cần theo dõi lịch sử từ bảng chính
    name VARCHAR(255),
    price DOUBLE,
    
    PRIMARY KEY (id, rev),
    CONSTRAINT fk_product_aud_revinfo FOREIGN KEY (rev) REFERENCES revinfo (rev)
);

```

---

### 3. Tình huống thực tế & Cách Migration vận hành

**Tình huống 1: Thêm Audit vào một bảng đã có sẵn dữ liệu**

* **Vấn đề:** Bảng `users` đã chạy 1 năm, giờ sếp mới yêu cầu thêm cột `created_at`.
* **Giải pháp:** Bạn tạo một file migration mới. Lưu ý phải set giá trị mặc định cho dữ liệu cũ, nếu không DB sẽ báo lỗi `NOT NULL`.
```sql
ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

```



**Tình huống 2: Schema thay đổi (Thêm cột mới)**

* **Vấn đề:** Bạn thêm cột `description` vào bảng `Product`.
* **Giải pháp:** Bạn phải thêm cột này vào **cả 2 nơi**: bảng `products` và bảng `products_aud`. Nếu quên thêm ở bảng `_aud`, Hibernate Envers sẽ ném lỗi ngay khi bạn cố gắng update dữ liệu.

**Tình huống 3: Quản lý Revision lồng nhau**

* **Vấn đề:** Một lần thanh toán (1 Revision) làm thay đổi cả bảng `Order` và bảng `Wallet`.
* **Cơ chế:** Cả 2 bảng `orders_aud` và `wallets_aud` sẽ cùng trỏ chung về một `rev` duy nhất trong bảng `revinfo`. Khi truy vấn, bạn chỉ cần tìm theo `rev` đó là thấy toàn bộ "hiện trường" của vụ thanh toán đó.

---

### Bảng tóm tắt Checklist cho Dev

| Loại Audit | Cần làm gì trong Migration? | Lưu ý |
| --- | --- | --- |
| **Basic** | Thêm 4 cột vào bảng hiện tại. | `created_at`, `updated_at`, `created_by`, `updated_by`. |
| **Envers (Global)** | Tạo bảng `revinfo`. | Chỉ cần tạo 1 lần duy nhất cho cả dự án. |
| **Envers (Entity)** | Tạo bảng `{table}_aud`. | Phải có cột `rev` và `revtype`. |

---

### Tại sao Dev Frontend nên quan tâm cái này?

Vì khi bạn muốn làm chức năng **"Lịch sử chỉnh sửa"** trên giao diện, bạn sẽ phải hỏi Backend: "Ông lấy dữ liệu từ bảng chính hay bảng `_aud`?".

* Nếu lấy từ bảng chính: Chỉ hiện được người sửa cuối cùng.
* Nếu lấy từ bảng `_aud`: Bạn có thể vẽ được một biểu đồ hoặc bảng so sánh *Version 1* khác gì *Version 2*.

---

Việc từ bỏ **Hibernate Envers** là một quyết định khá phổ biến khi dự án yêu cầu sự linh hoạt cao hơn hoặc bạn không muốn làm "rác" Database với hàng chục bảng `_AUD`.

Khi không dùng Envers, chúng ta có 2 hướng đi chính: Một là dùng "hàng hiệu" chuyên dụng (**JaVers**), hai là tự xây dựng một hệ thống **JSON-based Audit** (lưu mọi thay đổi vào 1 bảng duy nhất dưới dạng JSON).

---

# Chủ đề 10.1: Full Audit Log - Thay thế Hibernate Envers

### Cách 1: Sử dụng JaVers (Open Source "vô đối" cho Auditing)

**JaVers** giống như Git dành cho dữ liệu. Thay vì lưu theo bảng, nó lưu theo "Snapshot" (ảnh chụp thực thể) và có khả năng so sánh (Diff) cực mạnh.

* **Ưu điểm:** Hỗ trợ cực tốt cho Spring Boot, query dữ liệu lịch sử rất dễ, không cần tạo nhiều bảng phụ.
* **Cấu hình:** Chỉ cần thêm thư viện `javers-spring-boot-starter-sql`.

#### Code ví dụ:

Bạn chỉ cần đánh dấu Repository, JaVers sẽ lo phần còn lại.

```java
@JaversSpringDataAuditable
public interface ProductRepository extends JpaRepository<Product, Long> {
    // Mọi thao tác save/delete qua đây đều được tự động ghi Log
}

```

#### Migration Tables cho JaVers:

JaVers sẽ tự tạo các bảng sau (hoặc bạn có thể tạo thủ công):

* `jv_snapshots`: Lưu trữ trạng thái của object dưới dạng JSON.
* `jv_commit`: Lưu thông tin về người thực hiện, thời gian.
* `jv_global_id`: Lưu định danh của thực thể.

---

### Cách 2: Tự Custom (JSON-based Audit Log)

Đây là cách "thuần khiết" nhất. Chúng ta sẽ gom tất cả lịch sử của toàn bộ hệ thống vào **một bảng duy nhất** gọi là `audit_logs`.

#### 1. Lý thuyết: Cơ chế Diffing

Chúng ta sẽ bắt sự kiện trước khi lưu, so sánh Object cũ và Object mới, sau đó lưu phần khác biệt vào bảng Log dưới dạng JSON.

#### 2. Migration Table cho Custom Audit

```sql
CREATE TABLE audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    entity_name VARCHAR(100) NOT NULL, -- Ví dụ: 'Product', 'User'
    entity_id VARCHAR(50) NOT NULL,
    action VARCHAR(20) NOT NULL,       -- 'CREATE', 'UPDATE', 'DELETE'
    old_value JSON,                    -- Dữ liệu cũ (JSON)
    new_value JSON,                    -- Dữ liệu mới (JSON)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100)
);

```

#### 3. Code ví dụ: Entity Listener

Chúng ta sử dụng `@PostUpdate` để ghi log sau khi dữ liệu đã thay đổi thành công.

```java
@Component
@Slf4j
public class CustomAuditListener {

    @PostUpdate
    public void onPostUpdate(Object entity) {
        // Logic: 
        // 1. Lấy dữ liệu cũ từ Database (trước khi transaction commit)
        // 2. So sánh với 'entity' (dữ liệu mới)
        // 3. Nếu có khác biệt, insert vào bảng audit_logs
        log.info("Ghi log thay đổi cho thực thể: {}", entity.getClass().getSimpleName());
    }
}

```

> **Mẹo:** Để thực hiện việc so sánh (Diff) nhanh nhất, bạn nên dùng thư viện **Jackson** hoặc **Google Gson** để convert Object sang Map rồi so sánh các Key.

---

### 3. Tình huống thực tế (Real-world Scenarios)

**Tình huống 1: Kiểm tra "Ai đã đổi số điện thoại?"**

* **Vấn đề:** Trong bảng `audit_logs`, bạn search theo `entity_name = 'User'` và `entity_id = '123'`.
* **Kết quả:** Bạn thấy một dòng `UPDATE`. Cột `old_value` là `{"phone": "0912..."}`, cột `new_value` là `{"phone": "0988..."}`.
* **Lợi ích:** Bạn biết chính xác thuộc tính nào bị đổi mà không cần xem toàn bộ object.

**Tình huống 2: Phân tích hiệu năng ghi Log**

* **Vấn đề:** Nếu bảng `audit_logs` lên tới hàng triệu dòng, việc ghi log đồng bộ sẽ làm API bị chậm.
* **Giải pháp:** Kết hợp với **Chủ đề 8 (@Async)**. Khi có thay đổi, bạn bắn một Event (Spring Events), sau đó một luồng ngầm sẽ xử lý việc ghi vào bảng `audit_logs`. API trả kết quả về cho Frontend ngay lập tức.

**Tình huống 3: Hiển thị "Timeline" thay đổi dữ liệu**

* **Vấn đề:** Frontend muốn vẽ một Timeline như Facebook Activity Log.
* **Giải pháp:** Vì dữ liệu nằm trong 1 bảng duy nhất, bạn chỉ cần 1 API `GET /api/audit?entityId=123`. Bạn có thể dễ dàng map JSON thành các câu thông báo thân thiện: "Nguyễn Văn A đã cập nhật giá từ 100k thành 120k".

---

### Bảng so sánh 3 cách tiếp cận

| Tiêu chí | Hibernate Envers | JaVers (Open Source) | Custom JSON Audit |
| --- | --- | --- | --- |
| **Số lượng bảng** | Rất nhiều (`_AUD`) | Cố định (4 bảng jv_*) | **Duy nhất 1 bảng** |
| **Dễ Query** | Khó (phải Join nhiều) | Rất dễ (có API riêng) | Trung bình (Dùng JSON query) |
| **Linh hoạt** | Thấp (gắn chặt JPA) | Cao (SQL/NoSQL) | **Tối đa (Tự chủ hoàn toàn)** |
| **Phù hợp cho** | Dự án truyền thống | Dự án cần Time-travel | Dự án Microservices / High-flex |

---

**Lời khuyên từ "hậu phương":** Nếu dự án của bạn có quy mô vừa và lớn, hãy dùng **JaVers**. Đừng tự code lại cái bánh xe vì việc xử lý so sánh các Object lồng nhau (Nested Objects) cực kỳ phức tạp và dễ gây bug.

---

Việc lựa chọn **JaVers** là một bước đi rất thông minh. JaVers không chỉ là một thư viện ghi log, nó là một hệ thống "Time Travel" (du hành thời gian) cho dữ liệu. Thay vì tạo ra hàng chục bảng phụ như Envers, JaVers quản lý mọi thứ trong 4 bảng cố định, lưu trữ dưới dạng JSON, cực kỳ linh hoạt và dễ mở rộng.

Dưới đây là chi tiết về Migration và Code thực tế để triển khai JaVers trong dự án Spring Boot 3 của bạn.

---

# Chủ đề 10.2: Triển khai JaVers Audit Log (SQL-based)

### 1. Lý thuyết: Cơ chế Snapshots & Shadows

JaVers không lưu "dòng dữ liệu", nó lưu **Snapshots** (ảnh chụp).

* **Snapshot:** Là một bản ghi JSON chứa trạng thái của đối tượng tại một thời điểm.
* **Shadow:** Là một đối tượng Java "hồi sinh" từ Snapshot. Bạn có thể yêu cầu JaVers: "Hãy cho tôi xem đối tượng Product ID = 1 trông như thế nào vào ngày hôm kia". JaVers sẽ tự động tạo lại Object đó cho bạn.

---

### 2. Migration Tables (SQL)

Mặc dù JaVers có thể tự tạo bảng, nhưng trong môi trường chuyên nghiệp, bạn nên dùng SQL Migration (Flyway/Liquibase). Dưới đây là cấu trúc bảng chuẩn cho MySQL/PostgreSQL.

**File: `V1__create_javers_tables.sql**`

```sql
-- 1. Lưu danh tính duy nhất của các Object (Global ID)
CREATE TABLE jv_global_id (
    global_id_pk BIGINT AUTO_INCREMENT PRIMARY KEY,
    local_id VARCHAR(255),
    fragment VARCHAR(255),
    owner_id_fk BIGINT,
    type_name VARCHAR(255),
    CONSTRAINT jv_global_id_owner_id_fk FOREIGN KEY (owner_id_fk) REFERENCES jv_global_id (global_id_pk)
);

-- 2. Lưu thông tin về lần Commit (Ai sửa, lúc nào sửa)
CREATE TABLE jv_commit (
    commit_pk BIGINT AUTO_INCREMENT PRIMARY KEY,
    author VARCHAR(200),
    commit_date TIMESTAMP,
    commit_date_instant VARCHAR(30),
    commit_id DECIMAL(12, 2)
);

-- 3. Lưu các thuộc tính tùy chỉnh của Commit (ví dụ: IP, User-Agent)
CREATE TABLE jv_commit_property (
    property_key VARCHAR(255) NOT NULL,
    property_value VARCHAR(600),
    commit_fk BIGINT NOT NULL,
    PRIMARY KEY (commit_fk, property_key),
    CONSTRAINT jv_commit_property_commit_fk FOREIGN KEY (commit_fk) REFERENCES jv_commit (commit_pk)
);

-- 4. Lưu dữ liệu thực tế (Ảnh chụp trạng thái dưới dạng JSON)
CREATE TABLE jv_snapshot (
    snapshot_pk BIGINT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(200),
    version BIGINT,
    state JSON, -- Lưu toàn bộ Object dưới dạng JSON
    changed_properties TEXT,
    managed_type VARCHAR(200),
    global_id_fk BIGINT,
    commit_fk BIGINT,
    CONSTRAINT jv_snapshot_global_id_fk FOREIGN KEY (global_id_fk) REFERENCES jv_global_id (global_id_pk),
    CONSTRAINT jv_snapshot_commit_fk FOREIGN KEY (commit_fk) REFERENCES jv_commit (commit_pk)
);

```

---

### 3. Ví dụ Code thực tế

#### A. Khai báo Dependency (pom.xml)

```xml
<dependency>
    <groupId>org.javers</groupId>
    <artifactId>javers-spring-boot-starter-sql</artifactId>
    <version>7.4.1</version> </dependency>

```

#### B. Đánh dấu Repository

Bạn chỉ cần thêm một Annotation, JaVers sẽ tự động "nghe ngóng" mọi thay đổi.

```java
@Repository
@JaversSpringDataAuditable // <--- Kích hoạt tự động ghi log cho mọi hàm save()
public interface ProductRepository extends JpaRepository<Product, Long> {
}

```

#### C. Truy vấn lịch sử (Shadows)

Đây là phần "ăn tiền" nhất. Frontend có thể yêu cầu xem lịch sử thay đổi của một sản phẩm.

```java
@Service
@RequiredArgsConstructor
public class AuditService {
    private final Javers javers;

    public List<Shadow<Product>> getProductHistory(Long productId) {
        JqlQuery jqlQuery = QueryBuilder.byInstanceId(productId, Product.class)
                .withChildValueObjects() // Lấy cả các object con lồng bên trong
                .build();

        // Trả về danh sách các "bóng ma" - các trạng thái trong quá khứ
        return javers.findShadows(jqlQuery);
    }
}

```

---

### 4. Tình huống thực tế (Real-world Scenarios)

**Tình huống 1: So sánh hai phiên bản (Diffing)**

* **Vấn đề:** User muốn biết bản sửa lúc 9h sáng và bản sửa lúc 10h sáng khác nhau ở những trường nào.
* **Giải pháp:** JaVers cung cấp hàm `compare`. Bạn lấy 2 Snapshot ra và JaVers sẽ trả về chính xác: `Property 'price' changed from 100 to 120`. Bạn chỉ cần gửi list thay đổi này về cho Frontend.

**Tình huống 2: Phục hồi dữ liệu bị lỗi (Object Recovery)**

* **Vấn đề:** Nhân viên cập nhật sai thông tin hàng loạt sản phẩm.
* **Giải pháp:** Nhờ cơ chế **Shadow**, bạn có thể lấy lại Object của 1 tiếng trước:
```java
List<Shadow<Product>> shadows = javers.findShadows(query);
Product oldVersion = shadows.get(1).get(); // Lấy bản ghi cũ
productRepository.save(oldVersion); // Ghi đè lại vào bảng chính

```



**Tình huống 3: Kiểm soát "Dấu chân" User (Author Tracking)**

* **Vấn đề:** Bạn muốn ghi log không chỉ Username mà cả **IP Address** của người thực hiện thay đổi.
* **Giải pháp:** JaVers cho phép đính kèm "Commit Properties". Bạn có thể viết một `AuthorProvider` để tự động lấy IP từ Request và gắn vào mỗi lần ghi log. Dữ liệu này sẽ nằm trong bảng `jv_commit_property`.

---

### Bảng tóm tắt cho Dev Frontend chuyển hệ

| Tính năng | JaVers | Tại sao Frontend sẽ thích? |
| --- | --- | --- |
| **Format dữ liệu** | JSON | Rất dễ để map vào các Component hiển thị lịch sử. |
| **Cấu trúc bảng** | Cố định (4 bảng) | Không làm rối sơ đồ ERD của Database chính. |
| **Khả năng Diff** | Có sẵn | Giúp bạn làm tính năng "Show changes" (như Git) cực nhanh. |
| **Dung lượng** | Tối ưu | Chỉ lưu những gì thay đổi, không copy nguyên cả hàng dữ liệu thừa. |

---

**Gợi ý cuối cùng cho bạn:** JaVers hoạt động cực kỳ mượt mà với **Spring Security**. Nó sẽ tự động lấy thông tin từ `SecurityContextHolder` để điền vào cột `author` trong bảng `jv_commit`.

---
JaVers còn "hạnh phúc" hơn khi làm việc với NoSQL (đặc biệt là MongoDB) so với SQL truyền thống.

Lý do là vì JaVers bản chất lưu trữ dữ liệu dưới dạng **JSON**. Trong SQL, nó phải tìm cách "nhét" JSON vào các cột Text hoặc JSONB, còn trong NoSQL, nó được sống đúng với bản ngã của mình.

---

# Chủ đề 10.3: JaVers với NoSQL (MongoDB)

Khi sử dụng với MongoDB, JaVers sẽ không tạo ra 4 bảng như SQL mà sẽ tạo ra các **Collections** (tương đương với Table trong NoSQL).

### 1. Tại sao NoSQL + JaVers là "cặp bài trùng"?

1. **Schema-less:** Nếu bạn thêm một field mới vào Entity, JaVers NoSQL tự động nhận và lưu vào JSON mà không cần chạy Script `ALTER TABLE` phức tạp.
2. **Performance:** Việc ghi và đọc JSON trong MongoDB nhanh hơn đáng kể so với việc xử lý các cột JSON trong RDBMS.
3. **Nested Objects:** NoSQL hỗ trợ lưu trữ các đối tượng lồng nhau (Embedded Objects) rất tốt, và JaVers tận dụng điều này để chụp ảnh (Snapshot) toàn bộ cây dữ liệu của bạn.

---

### 2. Cách sử dụng (Spring Boot 3 + MongoDB)

#### A. Khai báo Dependency

Thay vì bản `sql`, bạn hãy dùng bản `mongo`.

```xml
<dependency>
    <groupId>org.javers</groupId>
    <artifactId>javers-spring-boot-starter-mongo</artifactId>
    <version>7.4.1</version>
</dependency>

```

#### B. Cấu hình (application.yml)

Bạn không cần tạo Migration Table vì MongoDB sẽ tự động tạo Collections khi có dữ liệu đầu tiên.

```yaml
spring:
  data:
    mongodb:
      uri: mongodb://localhost:27017/audit_db
      
javers:
  mappingStyle: FIELD
  algorithm: LEVENSHTEIN_DISTANCE # Thuật toán so sánh sự khác biệt giữa các chuỗi

```

#### C. Code thực tế

Vẫn là những Annotation quen thuộc, giúp bạn chuyển đổi từ SQL sang NoSQL mà gần như không phải sửa code logic.

```java
// 1. Entity của bạn
@Document(collection = "customers")
@Getter @Setter
public class Customer {
    @Id
    private String id;
    private String name;
    private Address address; // Object lồng nhau
}

// 2. Repository
@JaversSpringDataAuditable
public interface CustomerRepository extends MongoRepository<Customer, String> {
}

```

---

### 3. Tình huống thực tế (Real-world Scenarios)

**Tình huống 1: Lưu vết thay đổi của các Document phức tạp**

* **Vấn đề:** Bạn có một Document `Order` chứa mảng `List<Item>`. Mỗi Item lại có `Price`.
* **Giải pháp:** JaVers NoSQL lưu toàn bộ cấu trúc này. Khi bạn đổi giá của một Item ở sâu bên trong, JaVers vẫn phát hiện ra và ghi lại: `items[2].price changed from 50 to 60`. Việc này trong SQL truyền thống là cực kỳ khó khăn.

**Tình huống 2: Hệ thống đa quốc gia (Global Scale)**

* **Vấn đề:** Bạn dùng MongoDB Atlas (Cloud) để chạy app toàn cầu.
* **Giải pháp:** JaVers hỗ trợ cấu hình `MongoJaversCache`. Dù dữ liệu của bạn nằm ở nhiều Node khác nhau trên thế giới, JaVers vẫn đảm bảo việc ghi log được đồng bộ và không làm nghẽn hệ thống nhờ cơ chế ghi không đồng bộ (nếu cấu hình thêm).

**Tình huống 3: Kiểm tra lịch sử (Time-travel) ngay trên giao diện App**

* **Vấn đề:** App của bạn có tính năng "Xem lịch sử thay đổi" giống như Google Docs.
* **Giải pháp:** Với NoSQL, JaVers trả về kết quả dưới dạng BSON/JSON. Bạn chỉ cần viết một API đơn giản để trả thẳng cục JSON này về cho Frontend (React/Vue/App). Frontend chỉ việc map và hiển thị, không cần chuyển đổi phức tạp.

---

### Bảng so sánh JaVers: SQL vs NoSQL

| Đặc điểm | JaVers SQL (MySQL/Postgre) | JaVers NoSQL (MongoDB) |
| --- | --- | --- |
| **Lưu trữ** | 4 bảng cố định | 2 collections chính (`jv_snapshots`, `jv_head_id`) |
| **Migration** | Cần file `.sql` (Flyway/Liquibase) | **Không cần** (Auto-create) |
| **Cấu trúc phức tạp** | Khó xử lý nếu lồng nhau quá sâu | **Xử lý cực tốt** các cấu trúc lồng nhau |
| **Tốc độ ghi** | Trung bình (phụ thuộc Transaction) | **Rất nhanh** |

---

### ⚠️ Một lưu ý nhỏ:

Mặc dù NoSQL không cần Migration, nhưng bạn vẫn nên quản lý Index cho các Collection của JaVers (như `global_id_fk` hay `commit_date`) để đảm bảo khi dữ liệu log lên tới hàng triệu bản ghi, việc truy vấn lịch sử vẫn mượt mà.


---

Khi sử dụng **JaVers** với **MongoDB**, cấu hình thực tế khá đơn giản vì Spring Boot Starter của JaVers sẽ tự động tìm kiếm Bean `MongoDatabase` hoặc các thông số kết nối từ `spring.data.mongodb`.

Dưới đây là chi tiết cấu hình để kết nối và vận hành JaVers trong hệ sinh thái NoSQL.

---

# Chủ đề 10.4: Cấu hình kết nối JaVers với MongoDB

### 1. Lý thuyết: Cơ chế kết nối

JaVers sử dụng một Bean có tên là `JaversSqlRepository` cho SQL và `MongoRepository` cho NoSQL. Khi bạn thêm starter `javers-spring-boot-starter-mongo`, JaVers sẽ tự động cấu hình một `Javers` bean bằng cách sử dụng kết nối MongoDB hiện có của ứng dụng.

Nếu bạn đã có cấu hình `spring.data.mongodb` để ứng dụng chạy, JaVers sẽ "mượn" kết nối đó để tạo các Collection của nó.

---

### 2. Ví dụ Code & Cấu hình

#### A. Cấu hình trong `application.yml`

Đây là cách đơn giản nhất. JaVers sẽ tự động đi theo cấu hình này.

```yaml
spring:
  data:
    mongodb:
      uri: mongodb://admin:password@localhost:27017/my_audit_db
      # Hoặc cấu hình tách rời:
      # host: localhost
      # port: 27017
      # database: my_audit_db

javers:
  # Cấu hình tên Collection nếu muốn khác mặc định (jv_snapshots, jv_head_id)
  snapshotsCacheSize: 1000
  mappingStyle: FIELD
  algorithm: LEVENSHTEIN_DISTANCE
  # Tắt tự động tạo bảng nếu bạn muốn quản lý thủ công (ít dùng với Mongo)
  # sqlSchemaManagementEnabled: false 

```

#### B. Cấu hình bằng Java (Nếu cần tùy chỉnh sâu)

Trong trường hợp bạn dùng nhiều Database Mongo hoặc muốn tách biệt Database dành riêng cho Audit Log, bạn cần định nghĩa Bean thủ công:

```java
@Configuration
public class JaversMongoConfig {

    @Bean
    public Javers javers(MongoDatabase mongoDatabase) {
        // mongoDatabase này được Spring tự động inject từ kết nối chính
        MongoRepository javersRepository = new MongoRepository(mongoDatabase);

        return JaversBuilder.javers()
                .registerJaversRepository(javersRepository)
                .build();
    }
}

```

---

### 3. Tình huống thực tế (Real-world Scenarios)

**Tình huống 1: Tách biệt Database Audit (Audit Isolation)**

* **Vấn đề:** Bạn muốn dữ liệu chính nằm ở DB `app_data`, nhưng toàn bộ Log của JaVers phải nằm ở DB `app_audit` để tránh làm chậm các truy vấn nghiệp vụ.
* **Giải pháp:** Bạn tạo 2 Mongo Client. Một cái dùng cho ứng dụng chính, một cái dùng để khởi tạo `MongoRepository` cho JaVers như ví dụ Java Config ở trên. Điều này giúp bạn dễ dàng backup hoặc dọn dẹp log mà không ảnh hưởng tới dữ liệu khách hàng.

**Tình huống 2: Quản lý "Hết hạn" dữ liệu Log (TTL Index)**

* **Vấn đề:** Dữ liệu Audit Log trong MongoDB ngày càng lớn và bạn chỉ muốn giữ lại log trong vòng 2 năm.
* **Giải pháp:** Vì MongoDB hỗ trợ **TTL Index**, bạn có thể tạo một index trên trường `commitDate` trong collection `jv_snapshots` của JaVers.
```javascript
// Chạy lệnh này trong Mongo Shell
db.jv_snapshots.createIndex({ "commitDate": 1 }, { expireAfterSeconds: 63072000 })

```


MongoDB sẽ tự động xóa các log cũ, giúp hệ thống luôn gọn nhẹ mà không cần viết code xóa thủ công.

**Tình huống 3: Tracking User thông qua JWT**

* **Vấn đề:** JaVers cần biết ai là người thực hiện thay đổi để ghi vào cột `author`.
* **Giải pháp:** Tích hợp với `AuthorProvider`. Khi User từ App/Frontend gửi request kèm JWT, Spring Security giải mã ra Username, JaVers sẽ gọi hàm này để lấy tên ghi vào log.

```java
@Component
public class SpringSecurityAuthorProvider implements AuthorProvider {
    @Override
    public String provide() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return "system_user";
        }
        return auth.getName();
    }
}

```

---

### Tóm tắt cho Dev chuyển hệ:

Việc dùng JaVers với Mongo giống như bạn đang dùng một thư viện "Auto-save history" cho các JSON Object.

* **Frontend:** Không cần quan tâm Backend lưu thế nào, chỉ cần gọi API `GET /history` và nhận về danh sách JSON các thay đổi.
* **Backend:** Chỉ cần quan tâm đến việc cấu hình đúng `uri` của Mongo và đảm bảo `AuthorProvider` lấy được tên User.