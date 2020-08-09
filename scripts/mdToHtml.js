const marked = require('marked');
const fs = require('fs');
const source = `./markdown/${process.argv[2]}/index.md`;
const target = `./html/${process.argv[2]}/index.html`;
const html = marked(fs.readFileSync(source,'utf8'));
let page = `
<!DOCTYPE html>
<head></head>
<body>
`;

page += html;
page += `
<script src="https://utteranc.es/client.js"
        repo="coderweek/coderweek.github.io"
        issue-term="pathname"
        label="fromgithubpages"
        theme="github-light"
        crossorigin="anonymous"
        async>
</script>
</body>
</html>`;
fs.writeFile(target, page, () => {});