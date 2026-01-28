# Chủ đề 6: Spring Security & JWT (Stateless Authentication)

Trong Spring Boot 3, Spring Security đã thay đổi hoàn toàn cách cấu hình (chuyển sang dạng Lambda). Chúng ta sẽ tập trung vào cơ chế **Stateless** (không lưu Session trên server), vốn là tiêu chuẩn cho các ứng dụng Web/App hiện đại.

### 1. Lý thuyết: Quy trình "Soi chiếu" của Security Filter Chain

Spring Security không phải là một đoạn code nằm trong Controller. Nó là một **chuỗi các bộ lọc (Filter Chain)** đứng chắn trước `DispatcherServlet`.

1. **Request tới:** Mang theo Header `Authorization: Bearer <token>`.
2. **JwtFilter:** Đây là chốt chặn quan trọng nhất bạn phải tự viết. Nó bóc tách Token, kiểm tra chữ ký (Signature) và thời hạn (Expiration).
3. **SecurityContextHolder:** Nếu Token hợp lệ, Filter sẽ "đóng dấu" và lưu thông tin User vào đây. Các tầng sau (Service/Controller) chỉ cần nhìn vào dấu này là biết User là ai.
4. **Authorization:** Kiểm tra xem User đó có quyền (Role) vào API này không.

---

### 2. Ví dụ Code & Cấu hình (Spring Boot 3 style)

#### A. JwtUtils (Lớp tiện ích để tạo và giải mã Token)

Sử dụng thư viện `jjwt`.

```java
@Component
public class JwtUtils {
    private String secretKey = "chuoi_bi_mat_cuc_ky_dai_va_an_toan_nay_nhe";

    public String generateToken(String username) {
        return Jwts.builder()
                .setSubject(username)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + 86400000)) // 1 ngày
                .signWith(SignatureAlgorithm.HS256, secretKey)
                .compact();
    }

    public String getUsernameFromToken(String token) {
        return Jwts.parser().setSigningKey(secretKey).parseClaimsJws(token).getBody().getSubject();
    }
}

```

#### B. JwtAuthenticationFilter (Chốt chặn cửa khẩu)

Mỗi request đều phải đi qua đây.

```java
public class JwtFilter extends OncePerRequestFilter {
    @Autowired private JwtUtils jwtUtils;
    @Autowired private UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) 
            throws ServletException, IOException {
        
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            String username = jwtUtils.getUsernameFromToken(token);

            if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                UserDetails userDetails = userDetailsService.loadUserByUsername(username);
                // "Đóng dấu" hợp lệ vào Context
                UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                        userDetails, null, userDetails.getAuthorities());
                SecurityContextHolder.getContext().setAuthentication(auth);
            }
        }
        chain.doFilter(request, response);
    }
}

```

#### C. Cấu hình Security (SecurityConfig)

Đây là nơi bạn phân luồng: API nào công khai, API nào cần đăng nhập.

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity // Cho phép dùng @PreAuthorize ở Controller
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.csrf(csrf -> csrf.disable()) // Tắt CSRF vì dùng JWT
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll() // API đăng nhập cho phép tất cả
                .anyRequest().authenticated() // Còn lại phải có Token
            );
        
        // Thêm JwtFilter vào trước bộ lọc UsernamePassword của Spring
        http.addFilterBefore(jwtFilter(), UsernamePasswordAuthenticationFilter.class);
        
        return http.build();
    }
}

```

---

### 3. Tình huống thực tế (Real-world Scenarios)

**Tình huống 1: Public vs Private API**

* **Vấn đề:** Bạn làm trang thương mại điện tử. Trang "Danh sách sản phẩm" ai cũng xem được, nhưng "Thêm vào giỏ hàng" thì phải đăng nhập.
* **Giải pháp:** Cấu hình `requestMatchers("/api/products/**").permitAll()` trong SecurityConfig. Lúc này, nếu khách vãng lai vào xem, `JwtFilter` sẽ chạy nhưng không tìm thấy Token, `SecurityContext` trống, nhưng Spring vẫn cho qua vì URL này nằm trong danh sách `permitAll`.

**Tình huống 2: Phân quyền theo Role (Admin/User)**

* **Vấn đề:** Bạn muốn chỉ Admin mới có quyền xóa sản phẩm.
* **Giải pháp:** Sử dụng Annotation ngay tại Controller:
```java
@DeleteMapping("/{id}")
@PreAuthorize("hasRole('ADMIN')")
public void delete(@PathVariable Long id) { ... }

```


Nếu một User thường cố tình gọi API này bằng Postman, Spring sẽ trả về mã `403 Forbidden` ngay lập tức.

**Tình huống 3: Token hết hạn (Token Expiration/Refresh)**

* **Vấn đề:** Token chỉ có hạn 1 tiếng để bảo mật. Frontend làm thế nào để user không phải đăng nhập lại liên tục?
* **Giải pháp:** Khi `JwtFilter` thấy Token hết hạn, nó trả về `401 Unauthorized`. Frontend (Axios Interceptor) bắt mã 401 này, gọi API `/api/auth/refresh` (dùng **Refresh Token** lưu trong HttpOnly Cookie) để lấy Access Token mới rồi tự động thực hiện lại request cũ. Người dùng sẽ không cảm thấy gì cả (Silent Refresh).

---

### Bảng so sánh cho Dev Frontend

| Khái niệm | Frontend | Backend (Spring Security) |
| --- | --- | --- |
| **Authentication** | Gửi Username/Password | Xác thực và trả về JWT |
| **Authorization** | Ẩn/Hiện nút trên UI | Chặn API từ tầng Filter (403) |
| **Trạng thái (State)** | Giữ Token trong Memory/Storage | Không giữ gì (Stateless), giải mã Token mỗi request |
| **Bảo mật** | Chống XSS (LocalStorage) | Chống SQL Injection, CORS, Brute force |

---

**Lời khuyên từ "hậu phương":** Đừng bao giờ lưu thông tin nhạy cảm (như quyền hạn hay số dư) vào Payload của JWT mà không có cơ chế kiểm tra lại ở DB. JWT có thể bị giải mã (Decode) cực dễ dàng bởi các công cụ online, nó chỉ an toàn vì có phần **Signature** để Backend biết nó có bị sửa đổi hay không thôi.

---
Chào bạn! Việc hiểu rõ **Refresh Token Flow** là điểm phân biệt giữa một hệ thống "chạy được" và một hệ thống "chạy an toàn, chuyên nghiệp".

Nếu Access Token (AT) giống như một cái **vé xem phim** (ngắn hạn, dùng để vào cửa), thì Refresh Token (RT) giống như cái **chứng minh thư** (dài hạn, dùng để xin cấp lại vé mới mà không cần check-in lại từ đầu).

---

# Chủ đề 6.1: Refresh Token Flow - Duy trì phiên đăng nhập an toàn

### 1. Lý thuyết: Tại sao không dùng Access Token vô hạn?

Nếu bạn để AT có hạn dùng 1 năm, khi user bị lộ Token, kẻ xấu sẽ có toàn quyền truy cập trong 1 năm đó mà bạn không có cách nào ngăn chặn (vì JWT là stateless).
**Giải pháp:**

* **Access Token (AT):** Sống cực ngắn (15 - 30 phút). Nếu mất, thiệt hại nhỏ.
* **Refresh Token (RT):** Sống dài (7 - 30 ngày). Chỉ dùng để đổi lấy AT mới. RT thường được Backend lưu vào Database để có thể **thu hồi (Revoke)** khi cần.

---

### 2. Ví dụ Code & Cấu hình

#### A. Refresh Token Entity (Lưu vào DB)

Khác với AT (không lưu DB), RT cần được lưu lại để chúng ta có thể "hủy" quyền truy cập của User nếu phát hiện nghi vấn.

```java
@Entity
@Getter @Setter
public class RefreshToken {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String token;

    @Column(nullable = false)
    private Instant expiryDate;

    @OneToOne
    @JoinColumn(name = "user_id", referencedColumnName = "id")
    private User user;
}

```

#### B. Refresh Service (Xử lý logic đổi vé)

```java
@Service
public class RefreshTokenService {
    @Autowired private RefreshTokenRepository refreshTokenRepository;
    @Autowired private JwtUtils jwtUtils;

    public String createRefreshToken(User user) {
        RefreshToken rt = new RefreshToken();
        rt.setUser(user);
        rt.setToken(UUID.randomUUID().toString());
        rt.setExpiryDate(Instant.now().plusSeconds(86400 * 7)); // 7 ngày
        return refreshTokenRepository.save(rt).getToken();
    }

    @Transactional
    public String refreshAccessToken(String requestToken) {
        return refreshTokenRepository.findByToken(requestToken)
            .filter(rt -> rt.getExpiryDate().isAfter(Instant.now())) // Check hết hạn
            .map(rt -> jwtUtils.generateAccessToken(rt.getUser().getUsername())) // Tạo AT mới
            .orElseThrow(() -> new AppException(ErrorCode.TOKEN_EXPIRED));
    }
}

```

#### C. Cấu hình HttpOnly Cookie (Bảo mật tối thượng)

Thay vì trả RT về JSON cho Frontend lưu vào LocalStorage (dễ bị XSS), Backend nên trả về qua **HttpOnly Cookie**. Trình duyệt sẽ tự giữ và gửi lên, Javascript không thể đọc được.

```java
// Trong AuthController
ResponseCookie cookie = ResponseCookie.from("refreshToken", refreshToken)
    .httpOnly(true)
    .secure(true) // Chỉ gửi qua HTTPS
    .path("/api/auth/refresh") // Chỉ gửi cookie khi gọi đúng API này
    .maxAge(7 * 24 * 60 * 60)
    .build();

return ResponseEntity.ok()
    .header(HttpHeaders.SET_COOKIE, cookie.toString())
    .body(new JwtResponse(accessToken));

```

---

### 3. Tình huống thực tế (Real-world Scenarios)

**Tình huống 1: Chức năng "Đăng xuất khỏi tất cả thiết bị"**

* **Vấn đề:** User bị mất điện thoại và muốn đăng xuất tài khoản từ xa.
* **Giải pháp:** Backend chỉ cần chạy lệnh `DELETE FROM refresh_tokens WHERE user_id = :id`. Khi đó, dù kẻ xấu có giữ Access Token thì cũng chỉ dùng được tối đa vài phút nữa. Khi AT hết hạn, chúng không thể dùng RT để lấy cái mới vì RT đã bị xóa khỏi DB.

**Tình huống 2: Refresh Token Rotation (Xoay vòng Token)**

* **Vấn đề:** Để tăng bảo mật, mỗi lần User dùng RT để lấy AT mới, Backend sẽ xóa luôn RT cũ và cấp một RT mới tinh.
* **Lợi ích:** Nếu kẻ xấu lấy trộm được RT và dùng nó trước User, khi User thật dùng lại RT cũ đó, Backend thấy RT này đã được dùng rồi -> Cảnh báo hệ thống bị xâm nhập và vô hiệu hóa toàn bộ phiên làm việc của User đó ngay lập tức.

**Tình huống 3: Silent Refresh phía Frontend**

* **Vấn đề:** Bạn không muốn trải nghiệm của User bị gián đoạn (hiện loading) khi đang cuộn trang mà Token hết hạn.
* **Giải pháp:** Frontend cài đặt một `Axios Interceptor`. Khi nhận mã `401`, nó sẽ tạm dừng các request khác, gọi ngầm API `/refresh`. Sau khi có AT mới, nó tự động thực hiện lại các request cũ. User vẫn thấy trang web chạy mượt mà dù thực tế đã được cấp "vé" mới.

---

### Bảng so sánh cho Dev Frontend

| Đặc điểm | Access Token | Refresh Token |
| --- | --- | --- |
| **Nơi lưu (Khuyên dùng)** | Memory (Biến trong JS) | **HttpOnly Cookie** |
| **Thời gian sống** | Ngắn (15 phút) | Dài (Nhiều ngày) |
| **Lưu ở Backend?** | Không (Stateless) | **Có (Để kiểm soát/hủy)** |
| **Kích thước** | Lớn (Chứa nhiều Claim) | Nhỏ (Thường là một chuỗi UUID) |

---

**Ghi chú quan trọng:** Với Spring Boot 3, khi dùng `Cookie`, bạn cần chú ý cấu hình **CORS** `allowCredentials(true)` để trình duyệt cho phép gửi Cookie đi cùng request API.