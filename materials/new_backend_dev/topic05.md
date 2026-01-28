Nếu ở Frontend, bạn thường xử lý lỗi bằng `try-catch` quanh các hàm gọi API hoặc dùng Axios Interceptors để bắt mã 400, 500 rồi hiển thị Toast Message, thì ở Backend, chúng ta cần một "tấm lưới" khổng lồ để bắt mọi sai sót trước khi chúng biến thành những dòng log Java loằng ngoằng gửi về cho người dùng.

---

# Chủ đề 5: Validation & Global Exception Handling

Trong Spring Boot 3, mục tiêu của chúng ta là: **Dữ liệu vào phải sạch, dữ liệu ra (lỗi) phải đẹp.**

### 1. Lý thuyết: Tầng phòng ngự và Tầng xử lý

* **Bean Validation (Jakarta Validation):** Sử dụng các Annotation như `@NotNull`, `@Size`, `@Min`, `@Email` trực tiếp trên các DTO. Đây là tầng phòng ngự đầu tiên ngay tại Controller.
* **@RestControllerAdvice:** Một "Interceptor đặc biệt" chuyên đi nhặt các Exception bị ném ra từ bất kỳ đâu (Controller, Service, Repository).
* **Error Response DTO:** Thay vì trả về lỗi mặc định của Spring (thường thiếu thông tin hoặc quá thô), chúng ta định nghĩa một cấu trúc JSON thống nhất để Frontend dễ dàng xử lý (ví dụ: luôn có `code`, `message`, và `timestamp`).

---

### 2. Ví dụ Code & Cấu hình

#### A. Định nghĩa DTO với Validation

Đừng bao giờ tin dữ liệu từ Frontend gửi lên, dù bạn đã check ở đó rồi!

```java
public record UserRegistrationDTO(
    @NotBlank(message = "Username không được để trống")
    @Size(min = 3, max = 20, message = "Username phải từ 3-20 ký tự")
    String username,

    @Email(message = "Email không hợp lệ")
    String email,

    @Min(value = 18, message = "Bạn phải trên 18 tuổi")
    int age
) {}

```

#### B. Controller nhận dữ liệu

Sử dụng Annotation `@Valid` để kích hoạt bộ kiểm tra.

```java
@PostMapping("/register")
public ResponseEntity<String> register(@Valid @RequestBody UserRegistrationDTO dto) {
    return ResponseEntity.ok("Đăng ký thành công!");
}

```

#### C. Global Exception Handler (Tấm lưới bảo hiểm)

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    // 1. Bắt lỗi Validation (400 Bad Request)
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidationExceptions(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(error -> 
            errors.put(error.getField(), error.getDefaultMessage()));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errors);
    }

    // 2. Bắt lỗi logic nghiệp vụ tự định nghĩa
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ErrorResponse> handleBusinessException(BusinessException ex) {
        ErrorResponse error = new ErrorResponse("BIZ_ERR", ex.getMessage());
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(error);
    }

    // 3. Bắt mọi lỗi không mong muốn (500 Internal Server Error)
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleAllExceptions(Exception ex) {
        // Ghi log lỗi tại đây để admin kiểm tra
        ErrorResponse error = new ErrorResponse("SYS_ERR", "Hệ thống đang bận, vui lòng thử lại sau");
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
    }
}

```

---

### 3. Tình huống thực tế (Real-world Scenarios)

**Tình huống 1: Hiển thị lỗi chi tiết trên Form Frontend**

* **Vấn đề:** Frontend cần biết chính xác field nào bị lỗi để tô đỏ (ví dụ: `email` không đúng định dạng).
* **Giải pháp:** Backend trả về một Map các lỗi validation với HTTP 400. Frontend chỉ cần loop qua cái Map này để hiển thị message tương ứng ngay dưới các ô Input.

**Tình huống 2: Xử lý lỗi "Bản ghi đã tồn tại" (Conflict)**

* **Vấn đề:** User đăng ký với Email đã có trong hệ thống.
* **Giải pháp:** Trong Service, bạn check DB, nếu tồn tại thì `throw new BusinessException("Email này đã được sử dụng")`. Global Handler sẽ bắt được và trả về JSON chuẩn thay vì làm sập luồng xử lý.

**Tình huống 3: Bảo mật thông tin hệ thống (Information Leakage)**

* **Vấn đề:** Khi DB bị sập, Spring mặc định có thể trả về cả một đoạn StackTrace dài dằng dặc, lộ tên bảng, tên cột và logic code.
* **Giải pháp:** Sử dụng cái "lưới" `ExceptionHandler(Exception.class)` để ẩn đi các chi tiết kỹ thuật và chỉ trả về một thông báo thân thiện: "Something went wrong".

---

### Bảng so sánh "Tư duy bắt lỗi"

| Đặc điểm | Frontend | Backend (Spring Boot) |
| --- | --- | --- |
| **Mục đích chính** | Trải nghiệm người dùng (UX) | Tính toàn vẹn dữ liệu & Bảo mật |
| **Công cụ** | `if/else`, `try-catch`, `Yup/Zod` | `Jakarta Validation`, `@RestControllerAdvice` |
| **Kết quả trả về** | Toast, Alert, Red Border | JSON Object + HTTP Status Code |
| **Phạm vi** | Từng Component / Page | Toàn bộ Application |

---

> **Mẹo nhỏ:** Đừng cố bắt lỗi trong từng hàm Controller. Hãy cứ để nó "ném" (throw) thoải mái, vì chúng ta đã có `@RestControllerAdvice` lo liệu mọi thứ ở một nơi tập trung rồi. Code của bạn sẽ cực kỳ sạch sẽ!
---

Việc tạo ra một **Custom Exception** riêng không chỉ giúp code của bạn "sạch" hơn mà còn giúp Frontend xử lý logic cực kỳ nhàn. Thay vì chỉ nhận về mã 500 chung chung, Frontend sẽ nhận được các **Error Code** cụ thể để hiển thị đúng thông báo hoặc thực hiện hướng xử lý riêng (ví dụ: code `TOKEN_EXPIRED` thì tự động đá user ra trang Login).

---

# Chủ đề 5.1: Xây dựng Hệ thống Custom Exception chuẩn Enterprise

### 1. Lý thuyết: Tại sao phải "tự chế" Exception?

Nếu bạn chỉ dùng các Exception có sẵn của Java (như `IllegalArgumentException`), bạn sẽ gặp 2 vấn đề:

1. **Thiếu ngữ cảnh:** Không phân biệt được lỗi này là do logic nghiệp vụ hay do hệ thống.
2. **Khó bắt lỗi tập trung:** Trong `@RestControllerAdvice`, bạn sẽ phải viết rất nhiều hàm `handle` cho từng loại Exception nhỏ lẻ.

**Giải pháp:** Tạo một lớp cha duy nhất (ví dụ: `AppException`) chứa thông tin về **ErrorCode** và **HTTP Status**.

---

### 2. Ví dụ Code & Cấu hình

#### A. Định nghĩa Danh mục lỗi (ErrorCode Enum)

Đây là "bảng mã" dùng chung giữa Backend và Frontend.

```java
public enum ErrorCode {
    USER_EXISTED("USER_001", "User đã tồn tại", HttpStatus.BAD_REQUEST),
    USER_NOT_FOUND("USER_002", "Không tìm thấy User", HttpStatus.NOT_FOUND),
    INSUFFICIENT_BALANCE("WALLET_001", "Số dư không đủ", HttpStatus.PAYMENT_REQUIRED),
    UNCATEGORIZED_EXCEPTION("SYS_999", "Lỗi không xác định", HttpStatus.INTERNAL_SERVER_ERROR);

    private final String code;
    private final String message;
    private final HttpStatus statusCode;

    ErrorCode(String code, String message, HttpStatus statusCode) {
        this.code = code;
        this.message = message;
        this.statusCode = statusCode;
    }
    // Getters...
}

```

#### B. Tạo lớp Exception tùy chỉnh

Lớp này sẽ kế thừa `RuntimeException` để không bắt buộc phải `try-catch` khắp nơi.

```java
@Getter
public class AppException extends RuntimeException {
    private final ErrorCode errorCode;

    public AppException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }
}

```

#### C. Cấu hình Global Handler để "đọc" Custom Exception

Lúc này, cái "lưới" của bạn sẽ cực kỳ gọn gàng.

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(AppException.class)
    public ResponseEntity<ApiResponse<Object>> handleAppException(AppException ex) {
        ErrorCode errorCode = ex.getErrorCode();
        
        ApiResponse<Object> response = new ApiResponse<>();
        response.setCode(errorCode.getCode());
        response.setMessage(errorCode.getMessage());

        return ResponseEntity
                .status(errorCode.getStatusCode())
                .body(response);
    }
}

```

---

### 3. Tình huống thực tế (Real-world Scenarios)

**Tình huống 1: Xử lý số dư ví (Fintech App)**

* **Vấn đề:** Khi user nhấn "Thanh toán", số dư trong ví không đủ.
* **Code xử lý:** ```java
if (balance < price) throw new AppException(ErrorCode.INSUFFICIENT_BALANCE);
```

```


* **Kết quả:** Frontend nhận được JSON `{"code": "WALLET_001", "message": "Số dư không đủ"}` với HTTP `402`. Frontend chỉ cần check `if (code === 'WALLET_001')` để hiện nút "Nạp tiền ngay".

**Tình huống 2: Tìm kiếm dữ liệu (Resource Mapping)**

* **Vấn đề:** User cố tình thay đổi ID trên URL để truy cập vào một sản phẩm không tồn tại.
* **Code xử lý:**
```java
Product product = repo.findById(id).orElseThrow(() -> new AppException(ErrorCode.PRODUCT_NOT_FOUND));

```


* **Kết quả:** Trả về HTTP `404`. Frontend sẽ tự động redirect sang trang "404 Not Found" xinh xắn thay vì hiện trang trắng.

**Tình huống 3: Đăng ký thành viên (Duplicate Entry)**

* **Vấn đề:** Hai người cùng nhấn đăng ký với một email tại cùng một thời điểm.
* **Code xử lý:** Trong tầng Service, trước khi lưu, bạn check `existsByEmail`. Nếu có, `throw new AppException(ErrorCode.USER_EXISTED)`.
* **Kết quả:** Frontend nhận lỗi và thông báo ngay tại ô nhập liệu: "Email này đã có người sử dụng".

---

### Bảng so sánh "Trước và Sau" khi dùng Custom Exception

| Tiêu chí | Cách làm truyền thống | Cách làm Custom Exception |
| --- | --- | --- |
| **Code trong Service** | `throw new RuntimeException("Lỗi rồi")` | `throw new AppException(ErrorCode.XY_Z)` |
| **Thông tin trả về** | String message thô sơ | Object gồm Code, Message, Metadata |
| **Phía Frontend** | Khó bắt lỗi theo loại (phải so khớp chuỗi) | Bắt lỗi cực nhanh qua mã Code định sẵn |
| **Maintainability** | Phải đi sửa từng chỗ `throw` | Chỉ cần sửa bản tin lỗi tại một file Enum duy nhất |

---

**Gợi ý cho bạn:** Trong các dự án thực tế, người ta thường đính kèm thêm một trường `details` kiểu Map hoặc List vào `AppException` để chứa các thông tin bổ sung (ví dụ: danh sách các field bị lỗi validation).

---

# Chủ đề 5.2: Hợp nhất Validation và Custom Exception

Mục tiêu của chúng ta là dù lỗi gì xảy ra, Frontend luôn nhận được:

```json
{
  "code": "ERROR_CODE",
  "message": "Thông báo chính",
  "details": { "field": "lỗi chi tiết" } 
}

```

### 1. Lý thuyết: Cơ chế chuyển đổi (Mapping)

Khi bộ lọc `@Valid` phát hiện dữ liệu sai, nó sẽ ném ra `MethodArgumentNotValidException`. Nhiệm vụ của chúng ta là:

1. Bắt lấy Exception này trong `GlobalExceptionHandler`.
2. Trích xuất danh sách các field bị lỗi và message tương ứng.
3. Đóng gói chúng vào cùng một định dạng mà `AppException` đang dùng.

---

### 2. Ví dụ Code & Cấu hình

#### A. Cập nhật ErrorCode Enum

Thêm một mã dành riêng cho việc sai dữ liệu đầu vào.

```java
public enum ErrorCode {
    INVALID_INPUT("VAL_001", "Dữ liệu đầu vào không hợp lệ", HttpStatus.BAD_REQUEST),
    // ... các code khác
}

```

#### B. Cấu hình ApiResponse DTO (Generic)

Cấu trúc này sẽ chứa cả dữ liệu thành công và thông tin lỗi.

```java
@Getter @Setter
@JsonInclude(JsonInclude.Include.NON_NULL) // Chỉ hiện các trường không null
public class ApiResponse<T> {
    private String code = "SUCCESS"; // Mặc định là thành công
    private String message;
    private T result;
    private Map<String, String> details; // Nơi chứa lỗi validation chi tiết
}

```

#### C. Xử lý tại GlobalExceptionHandler

Đây là nơi "hợp nhất" hai dòng lỗi về cùng một định dạng.

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    // 1. Xử lý lỗi nghiệp vụ (Custom Exception đã làm ở phần trước)
    @ExceptionHandler(AppException.class)
    public ResponseEntity<ApiResponse<Object>> handleAppException(AppException ex) {
        ApiResponse<Object> response = new ApiResponse<>();
        response.setCode(ex.getErrorCode().getCode());
        response.setMessage(ex.getMessage());
        return ResponseEntity.status(ex.getErrorCode().getStatusCode()).body(response);
    }

    // 2. Xử lý lỗi Validation (Hợp nhất vào đây)
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Object>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> details = new HashMap<>();
        
        // Trích xuất từng field bị lỗi
        ex.getBindingResult().getFieldErrors().forEach(error -> 
            details.put(error.getField(), error.getDefaultMessage())
        );

        ApiResponse<Object> response = new ApiResponse<>();
        response.setCode(ErrorCode.INVALID_INPUT.getCode());
        response.setMessage(ErrorCode.INVALID_INPUT.getMessage());
        response.setDetails(details); // Gắn danh sách lỗi vào đây

        return ResponseEntity.badRequest().body(response);
    }
}

```

---

### 3. Tình huống thực tế (Real-world Scenarios)

**Tình huống 1: Form Đăng ký phức tạp**

* **Vấn đề:** User nhập thiếu Email, Password quá ngắn và Age là số âm.
* **Kết quả:** Frontend nhận được JSON:
```json
{
  "code": "VAL_001",
  "message": "Dữ liệu đầu vào không hợp lệ",
  "details": {
    "email": "Email không được để trống",
    "password": "Password phải từ 8 ký tự",
    "age": "Tuổi không được là số âm"
  }
}

```


* **Frontend Xử lý:** Chỉ cần một hàm `mapping` duy nhất để hiển thị lỗi lên các input tương ứng.

**Tình huống 2: Thay đổi ngôn ngữ lỗi (i18n)**

* **Vấn đề:** Bạn muốn message trong `details` tự động đổi sang tiếng Anh hoặc tiếng Việt.
* **Giải pháp:** Bạn không cần sửa Handler. Chỉ cần tạo các file `messages.properties` và `messages_vi.properties`. Spring Validation sẽ tự động lấy message theo ngôn ngữ của Request và đưa vào `details`.

**Tình huống 3: Lỗi lồng nhau (Nested Objects)**

* **Vấn đề:** Bạn gửi lên một Order có danh sách nhiều `OrderItem`. Một item trong đó bị sai giá.
* **Giải pháp:** Bộ Handler trên vẫn sẽ bắt được và trả về `details` dạng: `"items[0].price": "Giá không được nhỏ hơn 0"`. Frontend vẫn biết chính xác dòng nào trong bảng bị lỗi.

---

### Bảng so sánh cho Dev Frontend

| Tiêu chí | Trước khi hợp nhất | Sau khi hợp nhất |
| --- | --- | --- |
| **Cấu trúc JSON** | Lúc thì mảng, lúc thì object | Luôn luôn là một chuẩn duy nhất |
| **Code phía Frontend** | Viết nhiều `if/else` cho từng loại lỗi | Dùng một bộ Parser duy nhất cho mọi API |
| **Thông tin chi tiết** | Thường chỉ có message chung | Biết chính xác lỗi ở đâu (field-level) |
| **Độ chuyên nghiệp** | Giống đồ án sinh viên | Đạt chuẩn Enterprise/Production |

---

**Lời khuyên:** Việc trả về `details` là một Map rất tiện cho Web, nhưng nếu bạn làm cho App Mobile, đôi khi họ thích một `List` các Object lỗi hơn. Bạn có thể dễ dàng thay đổi kiểu dữ liệu của `details` trong `ApiResponse` để phù hợp với team Frontend của mình.