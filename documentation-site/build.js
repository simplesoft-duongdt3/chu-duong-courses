const fs = require('fs');
const path = require('path');
const marked = require('marked');

const SOURCE_DIR = '../materials/new_backend_dev';
const OUTPUT_DIR = './public';
const TEMPLATE_PATH = './layout.html';

// Ensure output dir exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const hljs = require('highlight.js');

// Config marked
marked.setOptions({
    gfm: true,
    breaks: true,
    highlight: function(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
            return hljs.highlight(code, { language: lang }).value;
        }
        return hljs.highlightAuto(code).value;
    }
});

// Helper to get files
const getFiles = () => {
    const files = fs.readdirSync(SOURCE_DIR);
    return files.filter(f => f.endsWith('.md')).sort(); // Simple sort
};

// Helper to parse title
const parseTitle = (content) => {
    const match = content.match(/^# (.*)/m);
    return match ? match[1] : 'Untitled';
};

// Clean filename for URL
const getSlug = (filename) => {
    if (filename === 'index.md') return 'index.html';
    return filename.replace('.md', '.html');
};

const build = () => {
    const files = getFiles();
    const template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');

    // Build Navigation HTML
    const navigationLinks = files.map(file => {
        const content = fs.readFileSync(path.join(SOURCE_DIR, file), 'utf-8');
        const title = parseTitle(content);
        const slug = getSlug(file);
        // Highlight active link logic could be handled if we generated different navs, 
        // but for simplicity we make one static nav.
        return `<a href="${slug}" class="block px-2 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 group flex items-center">
            ${title}
        </a>`;
    }).join('\n');

    // Process each file
    files.forEach((file, index) => {
        const content = fs.readFileSync(path.join(SOURCE_DIR, file), 'utf-8');
        const title = parseTitle(content);
        let htmlContent = marked.parse(content);
        const slug = getSlug(file);

        // Prev/Next Links
        let footerNav = '';
        const prevFile = index > 0 ? files[index - 1] : null;
        const nextFile = index < files.length - 1 ? files[index + 1] : null;

        if (prevFile) {
            const prevTitle = parseTitle(fs.readFileSync(path.join(SOURCE_DIR, prevFile), 'utf-8'));
            footerNav += `<a href="${getSlug(prevFile)}" class="text-indigo-600 font-medium hover:text-indigo-800">← ${prevTitle}</a>`;
        } else {
            footerNav += `<span></span>`;
        }
        
        if (nextFile) {
            const nextTitle = parseTitle(fs.readFileSync(path.join(SOURCE_DIR, nextFile), 'utf-8'));
            footerNav += `<a href="${getSlug(nextFile)}" class="text-indigo-600 font-medium hover:text-indigo-800">${nextTitle} →</a>`;
        }

        // Inject into template
        let finalHtml = template
            .replace('<!-- TITLE -->', title)
            .replace('<!-- CONTENT -->', htmlContent)
            .replace('<!-- NAVIGATION_LINKS -->', navigationLinks)
            .replace('<!-- NAV_FOOTER -->', footerNav);
            
        // Highlight active link (simple string replace for "simplest")
        // We replace the class of the current link to appear active
        const activeLinkString = `href="${slug}" class="block px-2 py-2 text-sm font-medium text-gray-700`;
        const activeLinkReplacement = `href="${slug}" class="block px-2 py-2 text-sm font-medium text-indigo-600 bg-indigo-50`;
        finalHtml = finalHtml.replace(activeLinkString, activeLinkReplacement);

        fs.writeFileSync(path.join(OUTPUT_DIR, slug), finalHtml);
        console.log(`Generated: ${slug}`);
    });
};

build();
