const marked = require('marked');
const fs = require('fs');
const source = `./markdown/${process.argv[2]}/${process.argv[3]}.md`;
const target = `./html/${process.argv[2]}/${process.argv[3]}.html`;
const html = marked(fs.readFileSync(source,'utf8'));

let page = `
<!DOCTYPE html>
<head>
<title>码农周刊</title>
<link id="favicon" rel="icon" type="image/x-icon" href="../../img/favicon.ico">
<link rel="stylesheet" href="../../style/common.css">`;
if(process.argv[2] === 'tech'){
    page += `
<link rel="stylesheet" href="../../style/monokai/monokai.min.css">
<link rel="stylesheet" href="../../style/tech/index.css">
<script src="../../lib/highlightjs/highlight.min.js"></script>
`;
};
page += `
</head>
<body>
<div class = "pageContainer">
`;

page += html;
page += '</div>'
page += `
<script src="https://utteranc.es/client.js"
        repo="coderweek/coderweek.github.io"
        issue-term="pathname"
        label="fromgithubpages"
        theme="github-light"
        crossorigin="anonymous"
        async>
</script>
`;
if(process.argv[2] === 'tech'){
    page += `
<script>
    function highlightCode() {
        var pres = document.querySelectorAll("pre>code");
        for (var i = 0; i < pres.length; i++) {
            hljs.highlightBlock(pres[i]);
        }
    }
    highlightCode();
</script>
    `
};
page += `
</body>
</html>`;
fs.writeFile(target, page, () => {});