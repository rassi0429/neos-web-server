import express from "express"
import http from "http"
import { WebSocketServer } from "ws"
import { v4 as uuidv4 } from 'uuid';

const app = express()
const server = new http.createServer(app)
const wss = new WebSocketServer({ server: server })
app.set("trust proxy", true)
server.listen(3000)

const domainMap = new Map()
const resMap = new Map()

app.get("*", (req, res) => {
    console.log("host", req.headers.host) // hogehoge.neorb.app
    console.log("path", req.path) // /hoge/hage/hagame
    const sessionId = uuidv4()
    if (domainMap.has(req.headers.host)) {
        resMap.set(sessionId, res)
        setTimeout(() => {
            res.status(500).send("SERVER_TIMEOUT")
            resMap.delete(sessionId)
        }, 30 * 1000)
        const servers = domainMap.get(req.headers.host)
        servers.forEach(s => {
            s.send(`GET\n${req.path}\n${sessionId}`)
        })
    } else {
        res.status(404).send("NO_SERVER_FOUND")
    }
})


wss.on('connection', (ws, request) => {
    const room = request.headers.host
    console.log(request.url, request.headers.host)
    if (!domainMap.has(room)) {
        domainMap.set(room, [ws])
    } else {
        domainMap.set(room, [ws, ...domainMap.get(room)])
    }

    ws.on('message', (message) => {
        // const room = domainMap.get(request.headers.host)
        // if (!room) return
        const msg = message.toString()
        const sessionId = msg.split("\n")[0]
        if (!sessionId) return
        const res = resMap.get(sessionId)
        if (!res) return
        res.send(removeHeads(msg, 1))
    });
});
const removeHeads = (s, n) => s.split('\n').slice(n).join('\n')

app.on('upgrade', function (request, socket, head) {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});