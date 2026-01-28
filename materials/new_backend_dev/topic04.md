## Transaction Management. Đây là nơi ranh giới giữa một "Junior" và một "Senior" Backend được phân định rõ ràng nhất.

Nếu ở Frontend, bạn gọi 3 API liên tiếp và cái thứ 2 bị lỗi, bạn thường phải viết logic để "undo" cái thứ nhất (hoặc mặc kệ nó). Trong Spring Boot, chúng ta có **Transaction** để đảm bảo mọi thứ diễn ra theo quy tắc: **"Được ăn cả, ngã về không"**.

---

# Chủ đề 4: Transaction Management - Quản lý giao dịch

### 1. Lý thuyết: ACID và Phép màu của Proxy

Trong Backend, một "Transaction" (Giao dịch) là một đơn vị công việc không thể chia cắt. Nó tuân thủ tính chất **ACID** (Atomicity, Consistency, Isolation, Durability).

* **@Transactional:** Là Annotation quyền lực nhất. Khi bạn đánh dấu một hàm với `@Transactional`, Spring sẽ tạo một **Proxy** (người đại diện) bao quanh hàm đó.
* Bắt đầu hàm: Proxy mở một kết nối tới DB và tắt chế độ `auto-commit`.
* Hàm chạy xong xuôi: Proxy gọi `commit` để lưu vĩnh viễn dữ liệu.
* Có lỗi xảy ra (Exception): Proxy gọi `rollback` để đưa dữ liệu về trạng thái ban đầu như chưa có chuyện gì xảy ra.



> **Lưu ý quan trọng cho Dev Frontend:** Mặc định, Spring chỉ Rollback khi gặp **Unchecked Exception** (như `RuntimeException`, `NullPointerException`). Nếu bạn ném ra một **Checked Exception** (như `IOException`, `SQLException`), nó sẽ **KHÔNG** rollback trừ khi bạn cấu hình thêm.

---

### 2. Ví dụ Code & Cấu hình

#### A. Cách dùng cơ bản (Thanh toán đơn hàng)

Giả sử bạn cần trừ tiền khách hàng và trừ kho hàng cùng lúc.

```java
@Service
public class OrderService {

    @Autowired private WalletRepository walletRepository;
    @Autowired private StockRepository stockRepository;

    @Transactional(rollbackFor = Exception.class) // Rollback cho mọi loại lỗi
    public void placeOrder(Long userId, Long productId, Double amount) {
        // 1. Trừ tiền ví
        walletRepository.deductMoney(userId, amount);

        // 2. Giả sử đoạn này bị lỗi (ví dụ: mất điện, DB nghẽn)
        if (true) throw new RuntimeException("Lỗi bất ngờ!"); 

        // 3. Trừ kho (Dòng này sẽ không bao giờ chạy)
        stockRepository.decreaseStock(productId);
        
        // Nhờ @Transactional, tiền trong ví ở bước 1 sẽ được hoàn lại tự động!
    }
}

```

#### B. Cấu hình Isolation & Propagation (Nâng cao)

Đôi khi bạn muốn một hàm chạy trong một Transaction mới hoàn toàn, độc lập với hàm gọi nó.

```java
@Transactional(propagation = Propagation.REQUIRES_NEW)
public void logToDatabase(String message) {
    // Luôn lưu Log vào DB, kể cả khi giao dịch chính bị thất bại và rollback
}

```

---

### 3. Tình huống thực tế (Real-world Scenarios)

**Tình huống 1: Lỗi "Self-invocation" (Tự gọi chính mình)**

* **Vấn đề:** Bạn có hàm `A()` (không có Transaction) gọi hàm `B()` (có `@Transactional`) trong cùng một Class.
* **Kết quả:** Transaction ở hàm `B()` sẽ **không hoạt động**.
* **Lý do:** Spring dùng Proxy để bọc Class lại. Khi gọi nội bộ (internal call), nó không đi qua Proxy nên không có phép màu nào xảy ra cả. Đây là lỗi "vỡ lòng" mà hầu như dev nào cũng dính.

**Tình huống 2: Giao dịch với bên thứ ba (Third-party API)**

* **Vấn đề:** Bạn gọi API của PayPal để trừ tiền, sau đó cập nhật DB của mình. Nếu cập nhật DB lỗi, Spring sẽ rollback DB của bạn, nhưng **không thể** đòi lại tiền từ PayPal.
* **Giải pháp:** Luôn gọi các dịch vụ bên ngoài **cuối cùng** hoặc sử dụng mô hình **Saga Pattern/Two-phase Commit** nếu hệ thống cực kỳ phức tạp. Đừng bao giờ để API gọi ngoài nằm giữa các câu lệnh cập nhật DB nhạy cảm.

**Tình huống 3: Read-only Optimization**

* **Vấn đề:** Bạn chỉ muốn lấy dữ liệu để hiển thị (Dashboard).
* **Giải pháp:** Dùng `@Transactional(readOnly = true)`.
* **Lợi ích:** Hibernate sẽ tắt tính năng "Dirty checking" (kiểm tra thay đổi object), giúp API của bạn chạy nhanh hơn và giảm tải cho Database (DB có thể điều hướng sang Node Read-only).

---

### Bảng so sánh cho dễ nhớ

| Đặc điểm | Không dùng Transaction | Có dùng @Transactional |
| --- | --- | --- |
| **Khi lỗi xảy ra** | Dữ liệu dở dang (Inconsistent) | Dữ liệu sạch sẽ (Rollback) |
| **Hiệu năng** | Nhanh hơn một chút | Tốn thêm phí quản lý kết nối |
| **Tư duy** | "Lỗi đâu sửa đấy" | "Tất cả hoặc không gì cả" |
| **Phù hợp** | Các tác vụ đọc, log đơn giản | Thanh toán, Đăng ký, Đổi mật khẩu |

---

### ⚠️ Cạm bẫy cần tránh:

Đừng bao giờ để các tác vụ nặng (như gửi Email, upload file lên S3, xử lý ảnh) bên trong `@Transactional`. Nó sẽ giữ kết nối Database (Connection) rất lâu, khiến ứng dụng hết kết nối và bị treo (Connection Pool Exhaustion).

---
Lỗi **Self-invocation** là một trong những "hố đen" khiến nhiều Developer mất hàng giờ debug vì code nhìn hoàn toàn đúng nhưng Transaction lại không hoạt động.

Để hiểu rõ, bạn cần nhớ một nguyên tắc vàng: **Spring không trực tiếp chạy class của bạn, nó chạy một "bản sao giả" (Proxy) bao quanh class đó.**

---

# Hiểu sâu về Self-invocation & Proxy Pattern

### 1. Bản chất: Hiệu ứng "Vượt rào"

Hãy tưởng tượng Class của bạn là một **Cửa hàng**. `@Transactional` giống như một **anh bảo vệ** đứng ở cửa chính.

* **External Call:** Một vị khách (Controller) đi từ ngoài vào cửa chính -> Gặp bảo vệ -> Bảo vệ mở Transaction -> Khách vào mua hàng.
* **Self-invocation:** Bạn đang ở trong kho (Hàm A), bạn tự đi sang quầy thu ngân (Hàm B) mà không đi ra ngoài rồi quay lại cửa chính -> **Bạn không đi qua anh bảo vệ** -> Không có Transaction nào được mở.

---

### 2. Ví dụ Code gây lỗi

```java
@Service
public class OrderService {

    // Hàm này KHÔNG có Transaction
    public void createOrderSimple(Order order) {
        // ... logic kiểm tra đơn hàng
        saveOrderWithTransaction(order); // Tự gọi hàm trong cùng class (Self-invocation)
    }

    // Hàm này CÓ Transaction
    @Transactional
    public void saveOrderWithTransaction(Order order) {
        repository.save(order);
        // Nếu có lỗi ở đây, nó sẽ KHÔNG ROLLBACK 
        // vì hàm này được gọi trực tiếp, bypass qua Proxy của Spring.
    }
}

```

---

### 3. Cách xử lý (Solutions)

Có 3 cách phổ biến để "vá" lỗi này, sắp xếp theo thứ tự từ "Sạch" đến "Tạm bợ":

#### Cách 1: Tách Service (Khuyên dùng - Clean Code)

Đưa hàm có Transaction sang một Service khác. Đây là cách tuân thủ Single Responsibility Principle (SRP).

```java
@Service
@RequiredArgsConstructor
public class OrderService {
    private final OrderDbService orderDbService; // Inject service khác

    public void createOrder(Order order) {
        // ... logic
        orderDbService.save(order); // Gọi sang Proxy của Service khác -> OK!
    }
}

@Service
public class OrderDbService {
    @Transactional
    public void save(Order order) {
        repository.save(order);
    }
}

```

#### Cách 2: Tự Inject chính mình (Self-Injection)

Spring Boot cho phép bạn "tiêm" chính cái Proxy của mình vào bên trong. Cách này hơi "kỳ cục" về mặt thẩm mỹ nhưng cực kỳ hiệu quả.

```java
@Service
public class OrderService {
    @Autowired
    @Lazy // Dùng @Lazy để tránh lỗi lặp vòng khởi tạo (Circular Dependency)
    private OrderService self;

    public void createOrder(Order order) {
        self.saveOrderWithTransaction(order); // Gọi qua biến 'self' (chính là Proxy) -> OK!
    }

    @Transactional
    public void saveOrderWithTransaction(Order order) {
        repository.save(order);
    }
}

```

#### Cách 3: Sử dụng TransactionTemplate (Lập trình thủ công)

Nếu bạn không muốn dùng Annotation, bạn có thể tự quản lý Transaction bằng code. Cách này giống như cách bạn dùng `try-catch` trong JavaScript.

```java
@Service
public class OrderService {
    @Autowired private TransactionTemplate transactionTemplate;

    public void createOrder(Order order) {
        transactionTemplate.execute(status -> {
            repository.save(order); // Chạy trong Transaction thủ công
            return null;
        });
    }
}

```

---

### 4. Các tình huống thực tế hay gặp

**Tình huống 1: Cache không hoạt động (@Cacheable)**

* **Vấn đề:** Bạn dùng `@Cacheable` để lưu kết quả API vào Redis. Nhưng bạn lại gọi hàm đó từ một hàm khác cùng class.
* **Kết quả:** Spring không bao giờ kiểm tra Redis mà luôn chạy thẳng vào Database.
* **Lý do:** Giống hệt `@Transactional`, `@Cacheable` cũng dựa trên Proxy.

**Tình huống 2: Chạy bất đồng bộ bị treo (@Async)**

* **Vấn đề:** Bạn muốn hàm gửi Email chạy ngầm (`@Async`) để không bắt Frontend chờ lâu. Bạn gọi hàm `@Async` từ một hàm khác trong cùng Service.
* **Kết quả:** Email vẫn chạy đồng bộ, Frontend vẫn phải chờ "dài cổ".
* **Lý do:** Proxy không can thiệp được để đẩy hàm đó vào Thread Pool riêng.

**Tình huống 3: Bảo mật bị bỏ qua (@PreAuthorize)**

* **Vấn đề:** Bạn check quyền admin bằng `@PreAuthorize("hasRole('ADMIN')")`.
* **Kết quả:** User thường vẫn gọi được hàm admin nếu họ gọi thông qua một hàm "public" khác trong cùng class. Đây là một lỗ hổng bảo mật cực kỳ nguy hiểm.

---

### Tóm tắt "bỏ túi" cho bạn

| Đặc điểm | Gọi từ ngoài (External) | Gọi nội bộ (Self-invocation) |
| --- | --- | --- |
| **Đi qua Proxy?** | Có | **Không** |
| **Annotation có tác dụng?** | Có | **Mất tác dụng** |
| **Giải pháp tốt nhất** | Giữ nguyên | Tách Service |

---

**Lời khuyên:** Khi bạn thấy một Annotation của Spring (như `@Transactional`, `@Async`, `@Cacheable`, `@Secured`) bỗng nhiên "biến mất" không rõ lý do, hãy kiểm tra ngay xem bạn có đang gọi nội bộ hay không.