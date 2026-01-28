# Giải thích chi tiết về workflow `.github/workflows/static.yml`

File này định nghĩa một quy trình tự động (workflow) sử dụng **GitHub Actions** để deploy nội dung website tĩnh lên **GitHub Pages**. Dưới đây là phân tích chi tiết từng phần của file và cách GitHub xử lý nó.

## 1. Trigger (Sự kiện kích hoạt)

```yaml
on:
  push:
    branches: ["main", "master"]
  workflow_dispatch:
```

- **`push`**: Workflow sẽ tự động chạy khi có bất kỳ commit nào được đẩy (push) lên nhánh `main` hoặc `master`.
- **`workflow_dispatch`**: Cho phép bạn chạy workflow này thủ công từ tab "Actions" trên giao diện web của GitHub.

## 2. Permissions (Quyền hạn)

```yaml
permissions:
  contents: read
  pages: write
  id-token: write
```

- **`contents: read`**: Cho phép workflow đọc mã nguồn từ repository.
- **`pages: write`**: Cấp quyền để workflow có thể deploy lên GitHub Pages.
- **`id-token: write`**: Cần thiết để xác thực bằng OpenID Connect (OIDC) với GitHub Pages deployment API mà không cần tạo personal access token thủ công.

## 3. Concurrency (Đồng thời)

```yaml
concurrency:
  group: "pages"
  cancel-in-progress: false
```

- **`group: "pages"`**: Đảm bảo rằng các lần chạy workflow được nhóm lại để tránh xung đột khi deploy.
- **`cancel-in-progress: false`**: Nếu có một workflow đang chạy dở, GitHub sẽ *không* hủy nó khi có workflow mới được kích hoạt. Điều này giúp đảm bảo quá trình deploy hiện tại hoàn tất trước khi quá trình mới bắt đầu (hoặc xếp hàng).

## 4. Jobs (Công việc)

File này chỉ định nghĩa một job duy nhất tên là `deploy`.

### Môi trường và Runner

```yaml
deploy:
  environment:
    name: github-pages
    url: ${{ steps.deployment.outputs.page_url }}
  runs-on: ubuntu-latest
```

- **`environment`**: Chỉ định môi trường là `github-pages`. GitHub sẽ hiển thị URL của trang web sau khi deploy thành công trong phần deployments của repo.
- **`runs-on: ubuntu-latest`**: Job sẽ chạy trên một máy ảo Linux (Ubuntu) mới nhất do GitHub cung cấp.

### Các bước thực hiện (Steps)

1.  **Checkout**:
    ```yaml
    - name: Checkout
      uses: actions/checkout@v4
    ```
    Tải mã nguồn của repository về máy ảo runner.

2.  **Setup Node**:
    ```yaml
    - name: Setup Node
      uses: actions/setup-node@v4
      with:
        node-version: "20"
    ```
    Cài đặt môi trường Node.js phiên bản 20 để chạy script build.

3.  **Build Site**:
    ```yaml
    - name: Build Site
      run: |
        cd documentation-site
        npm install
        node build.js
    ```
    - Di chuyển vào thư mục `documentation-site`.
    - Chạy `npm install` để cài đặt các package cần thiết.
    - Chạy `node build.js` để thực hiện quá trình build (tạo ra các file tĩnh HTML/CSS/JS). Kết quả build thường nằm trong một thư mục output (trong trường hợp này là `public`).
    - **Lưu ý quan trọng**: Quá trình này tạo ra các file HTML *mới* ngay trên server của GitHub (Runner), dựa trên mã nguồn Markdown và code JavaScript mới nhất. Nó **không** sử dụng thư mục `public` cũ (nếu có) trong source code của bạn, trừ khi script `build.js` của bạn được lập trình để copy chúng.

4.  **Setup Pages**:
    ```yaml
    - name: Setup Pages
      uses: actions/configure-pages@v5
    ```
    Cấu hình metadata cho GitHub Pages để đảm bảo trang hoạt động đúng (ví dụ: xử lý đường dẫn base URL).

5.  **Upload artifact**:
    ```yaml
    - name: Upload artifact
      uses: actions/upload-pages-artifact@v3
      with:
        # Upload the 'public' folder inside 'documentation-site'
        path: "documentation-site/public"
    ```
    Đóng gói nội dung trong thư mục `documentation-site/public` (vừa được tạo ra ở bước Build Site) thành một "artifact" (gói file) chuẩn để chuẩn bị deploy.

6.  **Deploy to GitHub Pages**:
    ```yaml
    - name: Deploy to GitHub Pages
      id: deployment
      uses: actions/deploy-pages@v4
    ```
    Lấy artifact đã upload ở bước trước và deploy nó lên hạ tầng GitHub Pages. Sau bước này, website sẽ online với nội dung mới nhất.

---

## Câu hỏi thường gặp

### Build mới vs. File có sẵn?
**Hỏi**: Khi push code, GitHub có dùng file HTML có sẵn trong source code không?
**Đáp**: **KHÔNG**. Trong workflow này, bước `Build Site` chạy `node build.js` để sinh ra (generate) một thư mục `public` hoàn toàn mới ngay trên máy chủ của GitHub. GitHub sau đó dùng thư mục mới này để deploy. Điều này đảm bảo trang web luôn phản ánh đúng nhất logic code và nội dung Markdown hiện tại, tránh lỗi do quên update file HTML thủ công trước khi commit.
