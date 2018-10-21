const http = require('http')
const WebSocket = require('ws');
const fs = require('fs')
const indexHtml = fs.readFileSync(__dirname + '/index.html').toString()
const log = require("cf-nodejs-logging-support")

const port = process.env.PORT || 8088
// const app = express();

var wss

function consoleLog() {
  // console.log.apply(console, arguments)
}

function broadcast(req, body, cb) {
  consoleLog('broadcast', body && body.length)
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      var payload = {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: body && Array.isArray(body) ? Buffer.concat(body).toString() : body
      }
      if (body != null) {
        payload.body = Array.isArray(body) ? Buffer.concat(body).toString() : body
      }
      client.send(JSON.stringify(payload));
    }
  })
  if (cb) { cb(); }
}

function onRequest(req, res) {
  if (req.url === '/ws') {
    const msg = http.STATUS_CODES[426];
    res.writeHead(426, {
      'Content-Length': msg.length,
      'Content-Type': 'text/plain'
    });
    res.end(msg);
  } else if (req.url === '/i') {
    const msg = indexHtml.replace(/\{PORT\}/g, port) //http.STATUS_CODES[200];
    res.writeHead(200, {
      'Content-Length': msg.length,
      'Content-Type': 'text/html'
    });
    res.end(msg);
  } else {
    const msg = http.STATUS_CODES[200];
    res.writeHead(200, {
      'Content-Length': msg.length,
      'Content-Type': 'text/plain'
    });
    if (req.url !== '/favicon.ico') {
      log.logNetwork(req, res)
      let body;
      let timeoutID = setTimeout(() => broadcast(req, body || 'timeout...', () => res.end(msg)), 120000)
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
        consoleLog('end', body ? body.length : 0)
        if (timeoutID != null) { clearTimeout(timeoutID) }
        broadcast(req, body, () => res.end(msg))
      });
    } else {
      res.end(msg);
    }
  }
}

const server = http.createServer(onRequest)

wss = new WebSocket.Server({ server });

server.listen(port, function () {
  var port = server.address().port
  log.logMessage(`[server] event: listening (port: ${port})`)
})
// listen for checkContinue events
server.on('checkContinue', function (req, res) {
  consoleLog("checkContinue")
  req.checkContinue = false;
  broadcast(req, 'loading...')
  // send 100 Continue response
  res.writeContinue();
  onRequest(req, res)
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