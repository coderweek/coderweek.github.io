# nodejs服务启动以及工作全过程分析
事先声明：本文分析基于nodejs 14版本。

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
这里使用了nodejs原生模块http来启动一个服务；

实际上，http模块是调用了nodejs的另外一个原生模块net。那么net启动一个服务，是什么样子呢？我们看下直接使用net启动一个服务的样例：

```js
// 1.引入net
const net = require('net');
// 2.创建一个服务
const server = net.createServer((c) => {
  // 'connection' listener.
  console.log('client connected');
  c.on('end', () => {
    console.log('end');
  });
  c.on('data', () => {
      console.log('data event');
      c.write('HTTP/1.1 200 OK\r\n');
        c.write('Connection: keep-alive\r\n');
        c.write('Content-Length: 12\r\n');
        c.write('\r\n');
        c.write('hello world!');
  })
});
server.on('error', (err) => {
  throw err;
});
// 3.监听端口
server.listen(9090, () => {
  console.log('server bound');
});
```

分析一下过程：
* 引入net模块
* 调用net.createServer创建一个服务
* 监听9090端口
  
如果有请求到来，则执行第2步中设置的回调函数。

所以，一个普通的nodejs服务，实际上是由net模块来事先的。

接下来我们就看下net模块的主要功能，以及它是如何启动，并处理客户端请求的。

## net模块
### net模块是什么？
* 内建模块
  * nodejs是由c++编写的。核心的处理逻辑，都是c++语言开发的，这些模块官方称为build-in模块；
  * 代码放置在/src目录下。
  * 举例：node.cc, node_file.cc, node_buffer.cc等
* 原生模块
  * 由于nodejs是给js开发者写的，因此又封装了一层js模块给js开发者使用，这部分模块官方称为native模块（相对于js开发者自己写的逻辑模块而言）；
  * 代码放置在/lib目录下。
  * 举例：net.js, http.js, fs.js, util.js等

net模块，即/lib/net.js, 就是native模块，是由js语言开发的。

### net如何创建一个服务？
net常用的创建服务如下：
```js
const server = net.createServer(connectionListener);
```
在/lib/net.js中，net.createServer代码如下：

```js
function createServer(options, connectionListener) {
  return new Server(options, connectionListener);
}
```

可见，createServer是初始化了一个Server的实例。

Server这里是一个构建函数，里面的代码大概50行，但核心主要做了两件事：
* 继承EventEmitter的方法和属性。
* 把创建服务时传入的回调函数connectionListener注册监听一下。this.on('connection', connectionListener);
  
这样，一旦有请求事件过来，则执行connectionListener。

那么此时你一定会想知道，请求事件是怎么过来的呢？

接下来我们就来详细分析一下。