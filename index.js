const http = require('http')
const express = require('express');
const WebSocket = require('ws');
const fs = require('fs')
const indexHtml = fs.readFileSync(__dirname+'/index.html').toString()

const port = process.env.PORT || 8088
const app = express();

var wss

function consoleLog () {
  console.log.apply(console, arguments)
}

function broadcast(req, body) {
  consoleLog('broadcast', body && body.length)
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: body && Array.isArray(body) ? Buffer.concat(body).toString() : body
      }));
    }
  })
}

const server = http.createServer(app)
app.use((req, res) => {
  if (req.url === '/ws') {
    const body = http.STATUS_CODES[426];
    res.writeHead(426, {
      'Content-Length': body.length,
      'Content-Type': 'text/plain'
    });
    res.end(body);
  } else if (req.url === '/i') {
    const body = indexHtml.replace(/\{PORT\}/g, port) //http.STATUS_CODES[200];
    res.writeHead(200, {
      'Content-Length': body.length,
      'Content-Type': 'text/html'
    });
    res.end(body);
  } else {
    // was this a conditional request?
    if (req.checkContinue === true) {
      req.checkContinue = false;
      broadcast(req, 'pending...')
      // send 100 Continue response
      res.writeContinue();
      // client will now send us the request body
    }
    const body = http.STATUS_CODES[200];
    res.writeHead(200, {
      'Content-Length': body.length,
      'Content-Type': 'text/plain'
    });
    res.end(body);
    if (req.url !== '/favicon.ico') {
      let body;
      let timeoutID = setTimeout(() => broadcast(req, body || 'timeout...'), 120000)
      req.on('data', (chunk) => {
        if (body == null) {
          body = []
        }
        consoleLog('chunk', body.length)
        body.push(chunk);
      }).on('end', (chunk) => {
        if (chunk != null) {
          body.push(chunk)
        }
        consoleLog('end', body.length)
        if (timeoutID != null) { clearTimeout(timeoutID) }
        broadcast(req, body)
      });
      
    }
  }
});

wss = new WebSocket.Server({ server });

server.listen(port, function() {
  var port = server.address().port
  console.info('[server] event: listening (port: %d)', port)
})
// listen for checkContinue events
server.on('checkContinue', function(req, res) {
  consoleLog("checkContinue")
  req.checkContinue = true;
  app(req, res); // call express directly to route the request
})
// Broadcast to all.
wss.broadcast = function broadcast(data) {
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
};

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(data) {
    // Broadcast to everyone else.
    wss.clients.forEach(function each(client) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  });
  wss.clients.forEach(function each(client) {
    if (client !== ws && client.readyState === WebSocket.OPEN) {
      client.send('hi!');
    }
  });
});