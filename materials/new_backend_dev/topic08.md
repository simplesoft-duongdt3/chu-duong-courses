# 📘 Cẩm Nang Toàn Tập: JPA Relationships & Migration (2026 Edition)

Tài liệu này tổng hợp toàn bộ kiến thức từ thiết kế Database, code Java (Entity & Repository), SQL Migration và các ví dụ thực tế.

---

## 1. Mối quan hệ One-to-One (1 - 1)

Mỗi bản ghi ở bảng A liên kết với duy nhất một bản ghi ở bảng B.

### 📝 Hiện thực hóa & Migration

* **Cấu trúc:** Một bên giữ khóa ngoại (**Foreign Key**) kèm ràng buộc **UNIQUE**.
* **SQL Migration:**

```sql
CREATE TABLE passports (
    id BIGSERIAL PRIMARY KEY,
    passport_number VARCHAR(20) NOT NULL UNIQUE
);

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    passport_id BIGINT UNIQUE, -- UNIQUE tạo ra quan hệ 1-1
    CONSTRAINT fk_user_passport FOREIGN KEY (passport_id) REFERENCES passports(id)
);

```

### 💻 Code Implementation (User & Passport)

```java
@Entity
public class User {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "passport_id", referencedColumnName = "id", unique = true)
    private Passport passport;
}

@Entity
public class Passport {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String passportNumber;

    @OneToOne(mappedBy = "passport") // Passport là bên bị động (Inverse side)
    private User user;
}

```

### 💡 3 Ví dụ thực tế & Query

1. **User & Passport:** `userRepo.findByPassport_PassportNumber(String num)`
2. **Store & Manager:** `managerRepo.findByStore_Id(Long id)` (1 cửa hàng - 1 quản lý).
3. **Order & Invoice:** `invoiceRepo.findByOrder_OrderCode(String code)` (1 đơn hàng - 1 hóa đơn).

---

## 2. Mối quan hệ One-to-Many & Many-to-One (1 - N)

Phía "Nhiều" luôn là phía giữ khóa ngoại. Đây là quan hệ phổ biến nhất.

### 📝 Hiện thực hóa & Migration

* **Cấu trúc:** Bảng "Nhiều" (Con) chứa FK trỏ về bảng "Một" (Cha).
* **SQL Migration:**

```sql
CREATE TABLE posts (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL
);

CREATE TABLE comments (
    id BIGSERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    post_id BIGINT,
    CONSTRAINT fk_comment_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

```

### 💻 Code Implementation (Post & Comment)

```java
@Entity
public class Post {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String title;

    @OneToMany(mappedBy = "post", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<Comment> comments = new ArrayList<>();
}

@Entity
public class Comment {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String content;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "post_id")
    private Post post;
}

```

### 💡 3 Ví dụ thực tế & Query

1. **Post & Comment:** `commentRepo.findByPostId(Long id)`
2. **Department & Employee:** `employeeRepo.findByDepartment_Name(String name)`
3. **Category & Product:** `productRepo.findByCategory_Id(Long catId)`

---

## 3. Mối quan hệ Many-to-Many (N - N)

Cần một bảng trung gian (**Join Table**) để kết nối hai thực thể.

### 📝 Hiện thực hóa & Migration

* **Cấu trúc:** Tạo bảng thứ 3 chứa 2 cột FK trỏ về 2 bảng chính.
* **SQL Migration:**

```sql
CREATE TABLE students (id BIGSERIAL PRIMARY KEY, name VARCHAR(100));
CREATE TABLE courses (id BIGSERIAL PRIMARY KEY, title VARCHAR(100));

CREATE TABLE student_course (
    student_id BIGINT NOT NULL,
    course_id BIGINT NOT NULL,
    PRIMARY KEY (student_id, course_id),
    CONSTRAINT fk_sc_student FOREIGN KEY (student_id) REFERENCES students(id),
    CONSTRAINT fk_sc_course FOREIGN KEY (course_id) REFERENCES courses(id)
);

```

### 💻 Code Implementation (Student & Course)

```java
@Entity
public class Student {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String name;

    @ManyToMany
    @JoinTable(
        name = "student_course",
        joinColumns = @JoinColumn(name = "student_id"),
        inverseJoinColumns = @JoinColumn(name = "course_id")
    )
    private Set<Course> courses = new HashSet<>();
}

@Entity
public class Course {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String title;

    @ManyToMany(mappedBy = "courses") // Course là bên bị động
    private Set<Student> students = new HashSet<>();
}

```

### 💡 3 Ví dụ thực tế & Query

1. **Student & Course:** `courseRepo.findByStudents_Id(Long id)`
2. **Post & Tag:** `postRepo.findByTags_Name(String tagName)`
3. **User & Role:** `userRepo.findByRoles_Name(String roleName)`

---

## ⚙️ Bảng Tóm Tắt Kỹ Thuật

| Đặc điểm | One-to-One | One-to-Many | Many-to-Many |
| --- | --- | --- | --- |
| **Phía giữ FK** | Bên nào cũng được | Phía "Nhiều" (Con) | Bảng trung gian |
| **mappedBy** | Ở phía không giữ FK | Ở phía "Một" (Cha) | Ở phía "Bị động" |
| **FetchType** | Mặc định EAGER | Mặc định LAZY | Mặc định LAZY |
| **Kiểu Collection** | Không có | `List` hoặc `Set` | Ưu tiên dùng `Set` |

---

## 🚀 Quy trình Migration & Vận hành Chuẩn

1. **Cấu hình An toàn:** Luôn dùng `spring.jpa.hibernate.ddl-auto=validate` trên Production.
2. **Công cụ gen Migration:** Sử dụng **JPA Buddy** trên IntelliJ IDEA. Công cụ này sẽ giúp bạn gen SQL từ Entity cực kỳ chính xác và nhanh chóng.
3. **Đặt tên Constraint:** Đừng để Hibernate tự đặt tên. Hãy đặt tên tường minh (ví dụ: `FK_COMMENT_POST`) trong `@JoinColumn` để dễ debug.
4. **Xử lý hiệu năng:** Luôn dùng `FetchType.LAZY` để tránh tải dữ liệu thừa. Nếu bị lỗi `LazyInitializationException`, hãy cân nhắc sử dụng `@EntityGraph` hoặc `JOIN FETCH` trong Query.

---

# 🚀 Thấu hiểu FetchType: EAGER vs LAZY

Trong JPA, có hai chiến lược tải dữ liệu chính. Việc chọn sai chiến lược là nguyên nhân hàng đầu dẫn đến ứng dụng chạy chậm hoặc lỗi "huyền thoại" `LazyInitializationException`.

## 1. FetchType.EAGER (Tải tức thì)

Khi bạn tải thực thể cha, Hibernate sẽ dùng câu lệnh `JOIN` để lấy luôn tất cả thực thể con liên quan ngay lập tức.

* **Cơ chế:** "Lấy tất cả một lần cho xong".
* **Mặc định cho:** `@ManyToOne` và `@OneToOne`.
* **Ví dụ thực tế:** **User & Role**.
* Khi một người dùng đăng nhập, bạn **luôn luôn** cần biết họ có quyền gì (ADMIN hay USER) để phân quyền. Việc tải Role ngay cùng lúc với User là hợp lý vì dữ liệu Role thường rất nhỏ và luôn được sử dụng.



```java
@ManyToOne(fetch = FetchType.EAGER)
@JoinColumn(name = "role_id")
private Role role; 
// Ngay khi findById(user), Hibernate sẽ thực hiện LEFT JOIN roles để lấy dữ liệu.

```

---

## 2. FetchType.LAZY (Tải trì hoãn)

Khi bạn tải thực thể cha, thực thể con sẽ **không** được tải lên. Hibernate chỉ tạo ra một đối tượng "giả" (Proxy). Chỉ khi nào bạn thực sự gọi đến hàm getter của thực thể con, Hibernate mới chạy thêm một câu lệnh SQL để lấy dữ liệu.

* **Cơ chế:** "Khi nào cần thì mới lấy".
* **Mặc định cho:** `@OneToMany` và `@ManyToMany`.
* **Ví dụ thực tế:** **Post & Comment**.
* Một bài báo có thể có 1000 bình luận. Nếu người dùng chỉ lướt qua danh sách tiêu đề bài báo, việc tải 1000 bình luận cho mỗi bài báo là một thảm họa về hiệu năng (gây tốn RAM và chậm Database). Chỉ khi người dùng click vào xem chi tiết bài báo, chúng ta mới tải bình luận.



```java
@OneToMany(mappedBy = "post", fetch = FetchType.LAZY)
private List<Comment> comments;
// findById(post) -> Chỉ lấy thông tin Post.
// post.getComments() -> Lúc này SQL mới được thực thi để lấy Comments.

```

---

## 📊 So sánh và Lời khuyên

| Đặc điểm | EAGER | LAZY |
| --- | --- | --- |
| **Tốc độ tải cha** | Chậm hơn (do phải JOIN nhiều bảng) | Rất nhanh |
| **Sử dụng bộ nhớ** | Tốn nhiều RAM hơn | Tiết kiệm RAM |
| **Số lượng Query** | Thường là 1 câu lệnh JOIN phức tạp | Ban đầu 1, sau đó thêm N câu lệnh (N+1) |
| **Rủi ro** | Gây nặng hệ thống nếu data con lớn | Lỗi `LazyInitializationException` |

### 💡 Quy tắc "vàng" từ các chuyên gia:

1. **Luôn ưu tiên LAZY cho tất cả các quan hệ.** Kể cả `@ManyToOne` (vốn mặc định là EAGER), bạn cũng nên chuyển sang LAZY nếu không chắc chắn luôn cần dữ liệu đó.
2. **Chỉ dùng EAGER** khi bạn chắc chắn 100% rằng: "Cứ hễ đụng đến thằng A là chắc chắn phải dùng đến thằng B" và dữ liệu thằng B rất nhỏ.
3. **Cách xử lý LAZY trong Query:** Nếu bạn dùng LAZY nhưng trong một số trường hợp cụ thể lại muốn lấy hết dữ liệu trong 1 câu Query để tối ưu, hãy sử dụng `JOIN FETCH` trong JPQL hoặc `@EntityGraph`.

---

## ⚠️ Cảnh báo lỗi: LazyInitializationException

Đây là lỗi xảy ra khi bạn cố gắng truy cập dữ liệu LAZY (ví dụ: `post.getComments()`) sau khi Session của Hibernate đã đóng (thường là sau khi kết thúc tầng Service).

* **Cách fix 1:** Thêm `@Transactional` vào method ở Service để giữ Session mở lâu hơn.
* **Cách fix 2:** Sử dụng DTO để map dữ liệu ngay tại tầng Service trước khi trả về Controller.
* **Cách fix 3 (Khuyên dùng):** Sử dụng `JOIN FETCH` trong Repository để lấy dữ liệu chủ động cho những trường hợp cần thiết.

---

Đây là "vũ khí" tối thượng để bạn giải quyết triệt để vấn đề hiệu năng trong JPA. Khi bạn sử dụng `JOIN FETCH`, Hibernate sẽ thực hiện một câu lệnh SQL `JOIN` duy nhất để lấy cả thực thể Cha và các thực thể Con, thay vì thực hiện N+1 câu lệnh riêng lẻ.

---

### 1. Vấn đề N+1 là gì? (Nhắc lại nhanh)

Giả sử bạn có 10 bài viết (**Post**), mỗi bài có nhiều bình luận (**Comment**).

* **Không có JOIN FETCH:** 1. Một câu lệnh lấy 10 Posts.
2. Với mỗi Post, Hibernate chạy thêm 1 câu lệnh lấy Comments -> Tổng cộng **1 + 10 = 11 queries**.
* **Có JOIN FETCH:** Chỉ **1 query** duy nhất lấy tất cả Posts và Comments đi kèm.

---

### 2. Cách viết Query JOIN FETCH

Bạn có thể thực hiện việc này ngay trong tầng **Repository** bằng cách sử dụng annotation `@Query`.

#### A. Đối với quan hệ One-to-Many (Ví dụ: Post & Comments)

```java
public interface PostRepository extends JpaRepository<Post, Long> {

    @Query("SELECT p FROM Post p LEFT JOIN FETCH p.comments WHERE p.id = :id")
    Optional<Post> findByIdWithComments(@Param("id") Long id);

    @Query("SELECT DISTINCT p FROM Post p LEFT JOIN FETCH p.comments")
    List<Post> findAllWithComments();
}

```

* **`LEFT JOIN FETCH`**: Lấy Post ngay cả khi nó không có Comment nào.
* **`DISTINCT`**: Cần thiết khi dùng `JOIN FETCH` với `List` để tránh kết quả bị trùng lặp (do cơ chế Cartesian Product của SQL).

#### B. Đối với quan hệ Many-to-One (Ví dụ: Employee & Department)

Mặc dù `@ManyToOne` thường là `EAGER`, nhưng nếu bạn đã chuyển nó sang `LAZY` để tối ưu, hãy dùng `JOIN FETCH` khi cần:

```java
public interface EmployeeRepository extends JpaRepository<Employee, Long> {

    @Query("SELECT e FROM Employee e JOIN FETCH e.department")
    List<Employee> findAllEmployeesWithDepartment();
}

```

---

### 3. Giải pháp thay thế hiện đại: `@EntityGraph`

Nếu bạn không muốn viết câu query JPQL dài dòng, Spring Data JPA cung cấp `@EntityGraph`. Đây là cách "cấu hình" Fetch Plan một cách linh hoạt.

```java
public interface PostRepository extends JpaRepository<Post, Long> {

    @EntityGraph(attributePaths = {"comments"})
    List<Post> findAll(); 
    // Phương thức này giờ đây sẽ tự động FETCH comments trong 1 query
}

```

---

### 4. So sánh nhanh

| Đặc điểm | JPQL JOIN FETCH | @EntityGraph |
| --- | --- | --- |
| **Độ linh hoạt** | Rất cao, tùy biến được WHERE, GROUP BY... | Thấp hơn, chủ yếu dùng để khai báo các trường cần lấy. |
| **Sự tường minh** | Nhìn vào thấy ngay câu SQL sẽ chạy. | Ngắn gọn, code sạch (clean code). |
| **Khuyên dùng** | Khi câu truy vấn phức tạp, nhiều điều kiện. | Khi bạn chỉ muốn lấy thêm dữ liệu con một cách đơn giản. |

---

### ⚠️ Lưu ý quan trọng khi dùng JOIN FETCH

1. **Đừng Fetch quá nhiều:** Đừng `JOIN FETCH` 3-4 bảng cùng lúc (ví dụ: Post -> Comments -> Authors -> Tags). Điều này tạo ra "Cartesian Product" cực lớn, làm tràn bộ nhớ và chậm Database.
2. **Pagination (Phân trang):** Hibernate **không thể** phân trang (`Pageable`) chính xác trong SQL khi dùng `JOIN FETCH` với bộ sưu tập (`Collection`). Nó sẽ tải hết dữ liệu vào RAM rồi mới phân trang (rất nguy hiểm).
* *Giải pháp:* Nếu cần phân trang, hãy fetch phía "Nhiều" bằng cách dùng `@BatchSize` hoặc dùng 2 câu query riêng biệt.


Đây là một trong những chủ đề "nâng cao" nhất và dễ gây lỗi hệ thống nhất trong Spring Boot JPA. Nếu bạn dùng `Pageable` kết hợp với `JOIN FETCH` cho một quan hệ Một-Nhiều, Hibernate sẽ quăng một cảnh báo cực kỳ nguy hiểm:

> *“firstResult/maxResults specified with collection fetch; applying in memory!”*

**Điều này có nghĩa là:** Hibernate sẽ lôi **toàn bộ** dữ liệu từ Database vào RAM, sau đó mới tự cắt xén để phân trang trong bộ nhớ. Nếu bảng của bạn có 1 triệu dòng, Server của bạn sẽ "đắp chiếu" ngay lập tức (OutOfMemory).

Dưới đây là 3 cách xử lý an toàn và chuyên nghiệp nhất:

---

### Cách 1: Sử dụng `@BatchSize` (Đơn giản & Hiệu quả)

Thay vì cố gắng lấy tất cả trong một câu Query duy nhất, chúng ta chia để trị. Bạn lấy danh sách "Cha" trước, sau đó Hibernate sẽ tự động gom các ID của cha để lấy "Con" theo từng đợt (Batch).

**Entity:**

```java
@Entity
public class Post {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @BatchSize(size = 20) // Hibernate sẽ lấy comments bằng câu lệnh: WHERE post_id IN (?, ?, ..., ?)
    @OneToMany(mappedBy = "post")
    private List<Comment> comments;
}

```

**Repository:**

```java
// Query bình thường, không dùng JOIN FETCH cho comments
Page<Post> findAll(Pageable pageable);

```

* **Ưu điểm:** Phân trang cực nhanh ở mức Database (SQL dùng `LIMIT`, `OFFSET` chuẩn).
* **Nhược điểm:** Vẫn tốn thêm một vài câu query phụ, nhưng số lượng query được giảm thiểu đáng kể nhờ `size`.

---

### Cách 2: Truy vấn 2 bước (Bí kíp thực chiến)

Đây là cách các "pro" thường dùng để tối ưu hóa tuyệt đối. Chúng ta tách việc phân trang và việc lấy dữ liệu liên quan ra làm 2 bước riêng biệt.

**Bước 1:** Lấy danh sách ID của các bản ghi "Cha" đã được phân trang.
**Bước 2:** Lấy toàn bộ dữ liệu kèm các quan hệ dựa trên danh sách ID đó.

**Repository:**

```java
public interface PostRepository extends JpaRepository<Post, Long> {
    
    // 1. Chỉ lấy danh sách ID (nhẹ và nhanh)
    @Query("SELECT p.id FROM Post p")
    Page<Long> findAllIds(Pageable pageable);

    // 2. Lấy dữ liệu đầy đủ theo danh sách ID (dùng IN)
    @Query("SELECT DISTINCT p FROM Post p LEFT JOIN FETCH p.comments WHERE p.id IN :ids")
    List<Post> findAllByIdInWithComments(@Param("ids") List<Long> ids);
}
```

**Service:**

```java
// 1. Lấy danh sách ID đã phân trang
Page<Long> postIds = postRepository.findAllIds(pageable);

// 2. Fetch toàn bộ dữ liệu dựa trên danh sách ID đó
List<Post> posts = postRepository.findAllByIdInWithComments(postIds.getContent());

// 3. Trả về đối tượng Page thủ công
return new PageImpl<>(posts, pageable, postIds.getTotalElements());
```

---

### Cách 3: Cấu hình Global (Khuyên dùng)

Thay vì đặt `@BatchSize` ở từng Entity, bạn có thể cấu hình cho toàn bộ dự án trong file `application.yml`. Đây là cách làm "sạch" code nhất.

```yaml
spring:
  jpa:
    properties:
      hibernate:
        default_batch_fetch_size: 20

```

Khi có cấu hình này, bất cứ khi nào bạn truy cập vào một quan hệ `LAZY`, Hibernate sẽ tự động chờ để gom đủ 20 ID rồi mới thực hiện một câu Query lấy dữ liệu con một thể. Nó giải quyết được 80% vấn đề N+1 mà vẫn cho phép phân trang an toàn.

---

### Phân trang an toàn (Safe Pagination)

**Vấn đề:** Không dùng `JOIN FETCH` cùng với `Pageable` cho quan hệ Một-Nhiều.
**Giải pháp:**

* **Bước 1:** Cấu hình `default_batch_fetch_size: 20` trong `application.yml`.
* **Bước 2:** Truy vấn phân trang bình thường trên thực thể Cha.
* **Bước 3:** Để Hibernate tự động batch-fetch thực thể con khi cần.

### 📊 Bảng tổng kết chiến lược

| Tình huống | Chiến lược | Annotation/Config |
| --- | --- | --- |
| Cần lấy 1 đối tượng duy nhất | `JOIN FETCH` | `@Query` |
| Cần lấy danh sách, không phân trang | `JOIN FETCH` + `DISTINCT` | `@Query` |
| Cần lấy danh sách + Phân trang | **Batch Fetching** | `default_batch_fetch_size` |
| Quan hệ 1-1 hoặc N-1 | `JOIN FETCH` thoải mái | N/A |

### Orphan Removal

`orphanRemoval = true` là một thiết lập cực kỳ quan trọng trong JPA, thường bị nhầm lẫn với `CascadeType.REMOVE`.

Hiểu một cách đơn giản nhất: **"Khi đứa con bị bỏ rơi (không còn liên kết với cha), nó sẽ bị xóa khỏi xã hội (Database)."**

Dưới đây là chi tiết về cách nó hoạt động và sự khác biệt cốt lõi:

---

#### Ý nghĩa của `orphanRemoval = true`

Trong mối quan hệ **Một - Nhiều** hoặc **Một - Một**, khi bạn loại bỏ một thực thể con ra khỏi danh sách (Collection) của thực thể cha, JPA sẽ coi thực thể con đó là một "trẻ mồ côi" (orphan).

* **Nếu `orphanRemoval = false` (Mặc định):** JPA chỉ ngắt kết nối (set `post_id = NULL` trong DB). Bản ghi con vẫn tồn tại "vất vưởng" trong Database.
* **Nếu `orphanRemoval = true`:** JPA sẽ tự động thực thi lệnh `DELETE` bản ghi con đó trong Database ngay khi nó bị xóa khỏi danh sách của cha.

---

#### So sánh `orphanRemoval = true` vs `CascadeType.REMOVE`

Đây là phần dễ gây lú nhất. Hãy nhìn vào bảng so sánh này:

| Tình huống | `CascadeType.REMOVE` | `orphanRemoval = true` |
| --- | --- | --- |
| **Xóa thực thể Cha** | Thực thể Con bị xóa theo. | Thực thể Con bị xóa theo. |
| **Xóa Con khỏi danh sách của Cha** | **Không xóa** Con trong DB (chỉ ngắt liên kết). | **Xóa luôn** bản ghi Con trong DB. |

> **Chốt lại:** `orphanRemoval` mạnh hơn `CascadeType.REMOVE` ở chỗ nó kiểm soát được cả việc "ngắt kết nối" giữa hai thực thể.

---

#### Ví dụ Code thực tế

Hãy quay lại ví dụ **Post (Bài viết)** và **Comment (Bình luận)**:

```java
@Entity
public class Post {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Khi xóa một Comment khỏi list này, Comment đó sẽ bị DELETE khỏi DB
    @OneToMany(mappedBy = "post", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Comment> comments = new ArrayList<>();
}

```

**Cách thực hiện xóa trong Service:**

```java
@Transactional
public void removeComment(Long postId, Long commentId) {
    Post post = postRepository.findById(postId).orElseThrow();
    
    // Chỉ cần xóa khỏi List trong Java
    post.getComments().removeIf(c -> c.getId().equals(commentId));
    
    // JPA sẽ tự động sinh ra câu lệnh: DELETE FROM comments WHERE id = :commentId
}

```

---

### 4. Khi nào nên dùng?

* **Nên dùng:** Khi thực thể con **không thể tồn tại độc lập** nếu thiếu thực thể cha.
* *Ví dụ:* Một `Comment` không thể tồn tại nếu không thuộc về `Post` nào. Một `OrderItem` (dòng hàng) không thể tồn tại nếu không có `Order` (đơn hàng).


* **Không nên dùng:** Khi thực thể con có thể tồn tại độc lập hoặc có thể chuyển sang "cha" khác.
* *Ví dụ:* `Employee` và `Department`. Nếu nhân viên rời phòng ban này, họ có thể sang phòng ban khác hoặc chờ phân công, không nên xóa họ khỏi công ty.



---

### ⚠️ Lưu ý quan trọng

Để `orphanRemoval` hoạt động chính xác, bạn nên:

1. **Sử dụng trên phía chủ động (Parent side):** Thường là `@OneToMany` hoặc `@OneToOne`.
2. **Không gán danh sách mới:** Thay vì `post.setComments(newArrayList)`, hãy dùng `post.getComments().clear()` và `post.getComments().addAll(newList)` để Hibernate có thể theo dõi các đối tượng bị loại bỏ.