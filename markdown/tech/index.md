# nodejs服务启动以及工作全过程分析
本文将分析一个普通的nodejs服务启动和工作的全部过程；将会涉及libuv；

## 回顾一下nodejs如何启动服务
按照nodejs官网上的样例，启动一个服务如下：
```js
const http = require('http');

const hostname = '127.0.0.1';
const port = 3000;

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello World');
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
```