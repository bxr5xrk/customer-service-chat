"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const ws_1 = require("ws");
const cors_1 = __importDefault(require("cors"));
const url_1 = __importDefault(require("url"));
const uuid_1 = require("./utils/uuid");
const app = (0, express_1.default)();
const port = 4000;
const DEFAULT_NAME = 'anon';
const DEFAULT_ID = (0, uuid_1.uuid)();
const rooms = {};
app.use(express_1.default.json());
app.use((0, cors_1.default)()); // add cors middleware
app.get('/rooms', (req, res) => {
    const data = Object.entries(rooms).map((i) => ({
        id: i[0],
        title: i[1].title,
        messages: i[1].messages,
    }));
    res.json(data);
});
app.get('/rooms/:roomId/messages', (req, res) => {
    const roomId = req.params.roomId;
    if (!rooms[roomId]) {
        res.status(404).send('Room not found');
    }
    else {
        const messages = rooms[roomId].messages;
        res.json(messages);
    }
});
const server = app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});
const webSocketServer = new ws_1.Server({ server });
const parseQuery = (uri) => {
    var _a, _b;
    const { pathname, query } = url_1.default.parse(decodeURIComponent(uri));
    const roomId = (_a = pathname === null || pathname === void 0 ? void 0 : pathname.slice(1)) !== null && _a !== void 0 ? _a : DEFAULT_ID;
    const username = ((_b = query === null || query === void 0 ? void 0 : query.split('&').map((i) => i.split('=')).find((i) => i[0] === 'name')) === null || _b === void 0 ? void 0 : _b.at(1)) || DEFAULT_NAME;
    return { roomId, username };
};
webSocketServer.on('connection', (webSocket, req) => {
    const { roomId, username } = parseQuery(req.url);
    const room = rooms[roomId];
    // create new room if not created
    if (!room) {
        rooms[roomId] = {
            title: username,
            messages: [],
            sessions: new Set(),
        };
    }
    const sessions = rooms[roomId].sessions;
    sessions.add(webSocket);
    webSocket.on('message', (data) => {
        const message = JSON.parse(data);
        rooms[roomId].messages.push(Object.assign(Object.assign({}, message), { id: (0, uuid_1.uuid)() }));
        for (const session of sessions) {
            session.send(JSON.stringify(message));
        }
    });
    webSocket.on('close', () => {
        sessions.delete(webSocket);
        if (sessions.size === 0) {
            delete rooms[roomId]; // Remove the room when there are no active sessions left
        }
    });
});
