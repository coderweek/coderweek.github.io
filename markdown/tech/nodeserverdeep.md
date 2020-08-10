
事先声明：本文分析基于nodejs 14版本; 以linux平台为例；
[TOC]
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

net模块，即/lib/net.js, 就是原生模块，也叫native模块；是由js语言开发的。

### net模块如何创建一个服务？
net常用的创建服务如下：
```js
// connectionListener就是一个普通的回调函数，负责处理业务逻辑。
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

那么此时你一定会想知道，请求事件是怎么传过来的呢？从网卡收到tcp数据包，到执行connectionListener，都经历了哪些过程呢？

接下来我们就来详细分析一下。

### net模块启动服务过程

一个普通的服务启动，无非要经过以下过程
* 创建一个socket;
* 绑定一个ip地址，即bind();
* 监听端口，即listen();

net.js模块也就是干了这些事情；只不过它把所有这些过程都放在了listen方法中。
```js
// 很简单，只是初始化一个Server,并不涉及底层socket调用
const server = net.createServer(connectionListener);
// listen是主角，它做了所有的事情，包括创建socket, 调用底层bind,listen等
server.listen(9090);
```
那么我们就来分析一下listen。

#### net模块中listen干了啥？
抽丝剥茧，listen最终调用了new TCP方法，即build-in模块tcp_wrap.cc模块中的void TCPWrap::New方法。
```js
// lib/net.js中createServerHandle函数，大概1218行。
handle = new TCP(TCPConstants.SERVER);
```
>（注：js模块，调用c++模块的方法，本文不展开，感兴趣的可以自己搜索。）

new TCP做了啥？
```js
// 调用 TCPWrap; /src/tcp_wrap.cc
new TCPWrap(env, args.This(), provider);
```

new TCPWrap则调用了libuv的uv_tcp_init

```js
int r = uv_tcp_init(env->event_loop(), &handle_);
```

至此，工作转交给libuv。下面我们来看libuv做了啥。

#### libuv在服务启动时承担什么角色

libuv是一个异步I/O的多平台支持库。当初主要是为了 Node.js而诞生；但它也被用在 Luvit 、 Julia 、 pyuv 和 其他项目 。

libuv全局管理一个handle，即loop，所有的异步处理对象，都会挂载到loop下，以方便需要时，直接从loop下查找。

上一节中，net调用tcp_wrap，最终调用uv_tcp_init，就是挂载一些东西到loop下。接下来，我们一步一步分析。

首先uv_tcp_init
```js
// 第一个参数，env->event_loop()即使loop对象；
// 第二个参数 &handle是全局唯一的服务对象，是一个uv_tcp_t实例
int r = uv_tcp_init(env->event_loop(), &handle_)
```
uv_tcp_init最终调用了uv_tcp_init_ex。
```js
// 位于/src/deps/uv/src/unix 114行

```

### net模块处理请求过程
