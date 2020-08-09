const marked = require('marked');
const fs = require('fs');
const html = marked(fs.readFileSync('./markdown/tech/index.md','utf8'));
let page = `
<!DOCTYPE html>
<head></head>
<body>
`;

page += html;
page += `</body></html>`;
fs.writeFile('./html/tech/index.html', page, () => {});