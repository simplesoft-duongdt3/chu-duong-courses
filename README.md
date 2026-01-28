# Documentation Site Generator

This folder contains the simple static site generator used to build the "Spring Boot for Frontend Devs" website.

## 🛠 How it works
This project takes Markdown (`.md`) files from the `../materials/new_backend_dev` directory and converts them into a static HTML website in the `public/` directory.

- **No Frameworks**: Uses raw HTML + Tailwind CSS (via CDN).
- **No Complex Build**: Just a single Node.js script.
- **Mobile Responsive**: Full-screen mobile menu.

## 📂 Project Structure

```text
documentation-site/
├── build.js          # The magic script that converts MD -> HTML
├── layout.html       # The master HTML template (includes Header, Sidebar, Footer)
├── public/           # The GENERATED website. Open index.html here.
├── src/              # Source for custom CSS (minimized use)
└── tailwind.config.js # Tailwind config (used by CDN script in layout.html)
```

## 🚀 How to Update Content

1. **Edit Markdown Files**:
   - Go to `../materials/new_backend_dev`.
   - Edit any `.md` file or add new ones.
   - The filename (e.g., `topic01.md`) will become the URL (e.g., `topic01.html`).
   - The first line (`# Title`) will be used as the Page Title and Navigation Link text.

2. **Rebuild the Site**:
   - Open your terminal in this `documentation-site` folder.
   - Run the build script:
     ```bash
     node build.js
     ```
   - You should see output like:
     ```text
     Generated: index.html
     Generated: topic01.html
     ...
     ```

3. **Preview**:
   - Open `public/index.html` in any web browser.
   - Refresh to see your changes.

## 🎨 Customizing the Design
- **Layout**: Edit `layout.html`. This file contains the header, sidebar structure, and the logic to inject content.
- **Styles**:
  - Most styles are utility classes in `layout.html`.
  - Content styling is handled by `@tailwindcss/typography` (the `prose` class).
  - Syntax highlighting theme can be changed by replacing the `atom-one-dark.min.css` link in `layout.html`.

## 🐳 Deployment with Docker

I included a Docker setup to easily deploy the site as a container.

1. **Prerequisite**: Make sure Docker and Docker Compose are installed.
2. **One-Click Deploy**:
   - Run the deployment script:
     ```bash
     ./deploy.sh
     ```
   - This script will:
     1. Run `node build.js` to regenerate the HTML.
     2. Build the Docker image (using lightweight `nginx:alpine`).
     3. Start the container on port `8080`.
3. **Manual Deploy**:
   ```bash
   node build.js
   docker-compose up -d --build
   ```
4. **Access**: Open `http://localhost:8080`.

## 🚀 Deploy to GitHub Pages

Yes, you can host this on GitHub Pages! Since the valid HTML files are inside a subfolder (`documentation-site/public`), you cannot just choose "docs folder" in GitHub settings.

I have created a **GitHub Action** (`.github/workflows/static.yml`) to handle this automatically.

### Setup Steps:
1. Push this code to GitHub.
2. Go to your Repository **Settings** > **Pages**.
3. Under **Build and deployment** > **Source**, select **GitHub Actions**.
4. That's it! GitHub will automatically trigger the Action, build the site, and deploy it.
5. You can view your site at `https://<your-username>.github.io/<repo-name>/`.

