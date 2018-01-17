#!/usr/bin/env node

const http = require('http'),
    execa = require('execa')
    net = require('net'),
    url = require('url'),
    util = require('util'),
    debug = require('debug')('proxyStudy:bin:reverseProxy')
    httpProxy = require('http-proxy'),
    { TextDecoder } = require('text-encoding'),
    childProcess = require("child_process");

let questionSet = {},
    port = 8015;

var proxy = new httpProxy.createProxyServer();

proxy.on('open', function (proxySocket) {
    debug('触发open事件')
    proxySocket.on('data', function (data) {
        var string = new TextDecoder("utf-8").decode(data);
        if(string.indexOf('showQuestion') === -1 && string.indexOf('showAnswer') === -1){
            return;
        }
        var index = string.indexOf('[')
        var arr;
        try{
            arr = JSON.parse(string.slice(index))
        }catch(e){
            openBrowser(string)
            return;
        }
        debug('json解析出来的数据 %j', arr)
        var tag = arr[0]
        var data = arr[1]

        if (tag.trim() === 'showQuestion') {
            debug('问题出现')
            queryAnswer(data)
        } else if (tag.trim() === 'showAnswer') {
            debug('答案出现')
        } else {
            debug('其他情况 %j', string)
        }
    })
})

var proxyServer = http.createServer(function (req, res) {
    debug('请求的特定地址 %s',req.url)
    // debug(req)
    // proxy.web(req, res, {target: req.url});
    // return;
    let [host, port] = urlParse(req.url)
    // const arr = /http:\/\/([^:]+):([^\/]+)/.exec(req.url)
    proxy.web(req, res, {
        target: {
            host: host,
            port: port
        }
    });
});


proxyServer.on('connect', function (req, socket, head) {
    debug('请求一个https请求 %s',req.url)

    var serverUrl = url.parse('https://' + req.url);

    var srvSocket = net.connect(serverUrl.port, serverUrl.hostname, function() {
      socket.write('HTTP/1.1 200 Connection Established\r\n' +
      '\r\n');
      srvSocket.write(head);
      srvSocket.pipe(socket);
      socket.pipe(srvSocket);
    });
  });

proxyServer.on('upgrade', function (req, socket, head) {
    debug('upgrade事件 [req] %o [socket] %o [head] %o', req, socket, head)
    /*
        setTimeout(function () {
            proxy.ws(req, socket, head);
        }, 1000);
    */
    let [host, port] = urlParse(req.url)
    setTimeout(() => {
        proxy.ws(req, socket, {
            target: {
                host: host,
                port: port
            }
        });
    }, 10);
});

console.log('监控%i端口',port)
proxyServer.listen(port);

function queryAnswer(data) {
    debug('queryAnswer接收的数据 %j', data)
    let { desc, options, questionId } = data
    if (!questionId) {
        debug('没有questionId，返回')
        return;
    } else {
        debug('将requestid对应的数据存起来 %j', questionId)
        questionSet[questionId] = data;
    }
    console.debug('即将查询答案 %j', data)

    let query = desc
    options = JSON.parse(options)
    for (var i = 0; i < 3; i++) {
        query += (' ' + options[i] + ' ')
    }
    let queryUrl1 = "https://www.baidu.com/s?wd=" + query;
    let queryUrl2 = "https://www.baidu.com/s?wd=" + desc;
    debug('查询问题和答案 %s', queryUrl1)
    debug('查询问题 %s', queryUrl2)
    let encodeQueryUrl1 = encodeURI(queryUrl1)
    let encodeQueryUrl2 = encodeURI(queryUrl2)

    // 先只查问题
    queryInBrowser(encodeQueryUrl2);
    // 再查问题+答案
    queryInBrowser(encodeQueryUrl1);

    function queryInBrowser(url) {
        execa.shell("open " + url).catch(e => {
            return execa.shell("explorer " + url);
        }).catch(e => {
            console.error(e);
        });
    }
    // childProcess.exec("open " + encodeURI(queryUrl));
}

function openBrowser(str){
    debug('openBrowser接收的数据 %s',str)
    var index = str.indexOf('showQuestion');
    if (index > -1){
        str = str.slice(index + 20)
    }else{

    }
    let queryUrl2 = encodeURI( "https://www.baidu.com/s?wd=" + str)
    execa.shell("open " + queryUrl2).catch(e => {
        return execa.shell("explorer " + queryUrl2)
    }).catch(e=>{
        console.error(e)
    })

}

function urlParse(url){
    if(url.indexOf('http') === -1){
        let urlObj = url.parse(url)
        return [ urlObj.hostname, urlObj.port || 80 ]
    }
    const hostname = /\/\/([^/]+)\/?/.exec(url)[1]
    let [host, port] = hostname.split(':')
    if (!port) {
        if (/https/.test(url)) {
            port = 443
        } else {
            port = 80
        }
    }else{
        port = parseInt(port)
    }
    return [host, port]
}