# 🛡️ Spring Boot 3 Survival Guide: 12 "Black Holes" & Deep Debugging

Tài liệu này tổng hợp 12 lỗi logic "ngầm" cực kỳ phổ biến trong Spring Boot 3, giải thích từ gốc rễ cơ chế (Proxy, Threading, Hibernate) kèm code mẫu và giải pháp.

---

## 1. Self-invocation (Tự gọi nội bộ)

### 📖 Lý thuyết chuyên sâu

Spring sử dụng **AOP (Aspect Oriented Programming)** dựa trên cơ chế **Proxy**. Khi một Bean được tạo ra, Spring không trả về instance thực mà trả về một "vỏ bọc" (Proxy).

* **Cơ chế:** Khi gọi từ bên ngoài, Proxy sẽ đánh chặn (intercept) để thực hiện logic phụ (mở Transaction, kiểm tra Cache).
* **Hố đen:** Nếu gọi nội bộ (`this.method()`), bạn đang gọi trực tiếp vào instance thực, bỏ qua hoàn toàn Proxy. Do đó, các Annotation trên method bị gọi sẽ vô hiệu.

### ❌ Code lỗi

```java
@Service
public class UserService {
    public void register() {
        saveData(); // Gọi nội bộ: Transaction bị phớt lờ hoàn toàn!
    }

    @Transactional
    public void saveData() { /* Lưu DB */ }
}

```

### ✅ Cách fix

**Cách 1 (Khuyên dùng):** Tách logic sang một Service khác.
**Cách 2 (Self-injection):** Tự inject chính mình để gọi qua Proxy.

```java
@Service
public class UserService {
    @Autowired @Lazy private UserService self;

    public void register() {
        self.saveData(); // Gọi qua Proxy thành công
    }
}

```

---

## 2. @Transactional & Checked Exception

### 📖 Lý thuyết chuyên sâu

Theo thiết kế mặc định của Spring (kế thừa từ chuẩn EJB), hệ thống chỉ tự động rollback khi gặp **Unchecked Exception** (`RuntimeException` và `Error`). Các **Checked Exception** (những lỗi bắt buộc phải `try-catch` hoặc `throws`) được coi là lỗi nghiệp vụ mà lập trình viên phải tự xử lý, nên Spring sẽ vẫn **Commit** dữ liệu.

### ❌ Code lỗi

```java
@Transactional
public void processOrder() throws IOException {
    repo.save(order);
    if (fileError) throw new IOException("Lỗi lưu file"); // DB vẫn commit dù throw lỗi!
}

```

### ✅ Cách fix

```java
@Transactional(rollbackFor = Exception.class) // Rollback cho mọi loại Exception

```

---

## 3. "Mất tích" Context trong @Async

### 📖 Lý thuyết chuyên sâu

Thông tin người dùng (`SecurityContext`) hoặc dữ liệu Request (`RequestContext`) được Spring lưu trữ trong **ThreadLocal**. `@Async` sẽ đẩy tác vụ sang một Thread mới từ Thread Pool. Vì `ThreadLocal` mặc định không tự sao chép sang Thread con, nên Thread mới sẽ thấy các Context này là `null`.

### ❌ Code lỗi

```java
@Async
public void sendAuditLog() {
    // Trả về null hoặc AnonymousUser vì chạy ở Thread khác
    String user = SecurityContextHolder.getContext().getAuthentication().getName(); 
}

```

### ✅ Cách fix

Dùng `DelegatingSecurityContextAsyncTaskExecutor` để copy Context hoặc truyền dữ liệu trực tiếp vào tham số hàm.

---

## 4. LazyInitializationException (Ngoài ranh giới Transaction)

### 📖 Lý thuyết chuyên sâu

Hibernate sử dụng cơ chế **Lazy Loading** (chỉ tải dữ liệu khi cần). Việc này yêu cầu một Hibernate Session (kết nối) còn mở. Thông thường, Session này gắn liền với Transaction ở tầng Service. Khi method Service kết thúc, Transaction đóng, Session đóng. Nếu tầng Controller hoặc View (Jackson) cố truy cập field Lazy, lỗi sẽ xảy ra.

### ❌ Code lỗi

```java
// Controller
User user = userService.findById(id); 
return user; // Jackson gọi user.getRoles() -> Session đã đóng -> Exception!

```

### ✅ Cách fix

Sử dụng **Entity Graph** hoặc **Join Fetch** trong Repository để lấy dữ liệu ngay tại tầng Service.

```java
@Query("SELECT u FROM User u JOIN FETCH u.roles WHERE u.id = :id")
User findByIdWithRoles(Long id);

```

---

## 5. Cạm bẫy Class/Method `final`

### 📖 Lý thuyết chuyên sâu

Thư viện **CGLIB** (mặc định trong Spring) tạo Proxy bằng cách tạo ra một Class con kế thừa Class của bạn. Trong Java, không thể kế thừa Class `final` hoặc ghi đè (override) Method `final`. Do đó, Spring không thể chèn logic Proxy vào.

### ❌ Code lỗi

```java
@Service
public final class MyService { // Spring không thể tạo Proxy cho Class này
    @Transactional
    public final void update() {} // Method này sẽ không bao giờ có Transaction
}

```

### ✅ Cách fix

Loại bỏ từ khóa `final` ở những nơi cần dùng Annotation của Spring.

---

## 6. @ManyToMany và Foreign Key "Mất tích"

### 📖 Lý thuyết chuyên sâu

Trong quan hệ `@ManyToMany`, Hibernate yêu cầu bạn xác định bên nào là "chủ" (owner - không có `mappedBy`) và bên nào là "nghịch". Nếu bạn chỉ thêm đối tượng vào danh sách của bên "nghịch", Hibernate sẽ không lưu gì vào bảng trung gian.

### ❌ Code lỗi

```java
// Giả sử Category là bên nghịch (có mappedBy)
product.getCategories().add(category); 
categoryRepo.save(category); // Bảng trung gian product_category không có dữ liệu!

```

### ✅ Cách fix

Luôn cập nhật cả hai đầu của quan hệ thông qua Helper Method.

---

## 7. `@TransactionalEventListener` & AFTER_COMMIT

### 📖 Lý thuyết chuyên sâu

Khi sử dụng pha `AFTER_COMMIT`, Listener chỉ chạy khi DB đã thực hiện lệnh Commit xong. Tại thời điểm này, Transaction cũ đã kết thúc và Connection thường đã ở trạng thái Read-only hoặc đã đóng. Mọi lệnh `save()` bình thường sẽ bị lờ đi.

### ❌ Code lỗi

```java
@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
public void onUserRegistered(UserEvent event) {
    logRepo.save(new Log(event.userId())); // Không báo lỗi nhưng DB không có log mới
}

```

### ✅ Cách fix

Sử dụng `Propagation.REQUIRES_NEW` để mở một Transaction hoàn toàn mới.

```java
@Transactional(propagation = Propagation.REQUIRES_NEW)
public void onUserRegistered(...) { ... }

```

---

## 8. Lỗi HashCode/Equals với Hibernate Entity

### 📖 Lý thuyết chuyên sâu

Khi một Entity được đưa vào `Set` (như `HashSet`), vị trí của nó phụ thuộc vào `hashCode()`. Đối với Entity dùng ID tự tăng (Identity), ID sẽ là `null` trước khi save và có giá trị sau khi save. Điều này làm thay đổi `hashCode`, khiến `Set` không tìm thấy Object đó nữa dù nó vẫn ở đó.

### ❌ Code lỗi

```java
@EqualsAndHashCode(of = "id") // ID thay đổi từ null -> Long khiến HashCode thay đổi
public class Product { ... }

```

### ✅ Cách fix

Dùng một **Business Key** (như mã UUID cố định hoặc Email) hoặc so sánh theo tham chiếu nếu không có Business Key.

---

## 9. Virtual Thread Pinning (Spring Boot 3.2+)

### 📖 Lý thuyết chuyên sâu

Virtual Threads (Java 21) rất nhẹ, nhưng chúng sẽ bị "ghim" (pinning) vào Thread vật lý nếu gặp khối `synchronized`. Nếu khối này chứa các tác vụ I/O lâu, toàn bộ Thread vật lý bị chặn, làm mất đi lợi thế của Virtual Threads.

### ❌ Code lỗi

```java
public synchronized void heavyIO() { // Pinning xảy ra ở đây
    // Thực hiện gọi API bên ngoài hoặc truy vấn DB
}

```

### ✅ Cách fix

Sử dụng `ReentrantLock` thay cho `synchronized`.

---

## 10. Thứ tự thực thi Aspect (@Order)

### 📖 Lý thuyết chuyên sâu

Spring quản lý các Aspect theo một chuỗi (Interceptor Chain). Nếu bạn có một Aspect tùy chỉnh (ví dụ Logging) và `@Transactional`, mà Logging chạy "sâu" hơn Transaction, nó có thể ghi nhận dữ liệu đã lưu thành công ngay cả khi Transaction sau đó bị Rollback.

### ✅ Cách fix

Sử dụng Annotation `@Order` để xác định thứ tự. Số nhỏ hơn sẽ chạy "vòng ngoài" (được thực thi trước và kết thúc sau).

---

## 11. Thứ tự Load Bean với @ConditionalOnMissingBean

### 📖 Lý thuyết chuyên sâu

Trong Spring Boot, các Bean được load theo thứ tự quét Component. Nếu Bean của bạn được khởi tạo **sau** Bean của một thư viện nào đó có dùng `@ConditionalOnMissingBean`, thì điều kiện của thư viện đã được check xong và Bean của bạn không thể ghi đè (override) được nữa.

### ✅ Cách fix

Sử dụng `@AutoConfigureBefore` hoặc `@AutoConfigureAfter` trong các lớp `@Configuration` để chỉ định thứ tự load Bean chính xác.

---

## 12. Quên @StepScope trong Spring Batch

### 📖 Lý thuyết chuyên sâu

Trong Spring Batch, các tham số như `jobParameters` không có sẵn khi ứng dụng khởi động. Chúng chỉ có giá trị khi một Step bắt đầu chạy. Nếu không có `@StepScope`, Spring sẽ cố gắng khởi tạo Bean ngay lập tức (Eagerly) và gây lỗi vì thiếu tham số.

### ❌ Code lỗi

```java
@Bean
public ItemReader reader(@Value("#{jobParameters['input.file']}") String path) {
    return new FlatFileItemReader(path); // 'path' luôn là null khi khởi động
}

```

### ✅ Cách fix

Thêm `@StepScope` để trì hoãn việc tạo Bean cho đến khi Step thực sự chạy.

---

### 💡 Bảng tổng kết nhanh

| Lỗi | Nguyên nhân gốc | Keyword tìm kiếm |
| --- | --- | --- |
| **Self-invocation** | Bỏ qua AOP Proxy | `Spring AOP internal call` |
| **Checked Rollback** | Mặc định chỉ bắt Runtime | `Transactional rollbackFor` |
| **Missing Context** | ThreadLocal không copy | `SecurityContext Async` |
| **Lazy Init** | Session đã đóng | `FetchType.LAZY Proxy` |
| **No Save (After Commit)** | Transaction đã hoàn tất | `TransactionalEventListener REQUIRES_NEW` |
| **Virtual Thread Slow** | Thread Pinning | `Virtual Thread synchronized` |

---