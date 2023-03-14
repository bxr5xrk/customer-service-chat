import express, { Request, Response } from 'express';
import WebSocket, { Server as WebSocketServer } from 'ws';
import cors from 'cors';
import url from 'url';
import { uuid } from './utils/uuid';

const app = express();
const port = 4000;
const DEFAULT_NAME = 'anon';
const DEFAULT_ID = uuid();

interface Message {
  id: string;
  username: string;
  content: string;
}

interface Room {
  title: string;
  messages: Message[];
  sessions: Set<WebSocket>;
}

const rooms: { [key: string]: Room } = {};

app.use(express.json());
app.use(cors()); // add cors middleware

app.get('/rooms', (req: Request, res: Response) => {
  const data = Object.entries(rooms).map((i) => ({
    id: i[0],
    title: i[1].title,
    messages: i[1].messages,
  }));

  res.json(data);
});

app.get('/rooms/:roomId/messages', (req: Request, res: Response) => {
  const roomId = req.params.roomId;
  if (!rooms[roomId]) {
    res.status(404).send('Room not found');
  } else {
    const messages = rooms[roomId].messages;
    res.json(messages);
  }
});

const server = app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});

const webSocketServer = new WebSocketServer({ server });

const parseQuery = (uri: string) => {
  const { pathname, query } = url.parse(decodeURIComponent(uri));

  const roomId = pathname?.slice(1) ?? DEFAULT_ID;
  const username = DEFAULT_NAME;
  // query
  //   ?.split('&')
  //   .map((i) => i.split('='))
  //   .find((i) => i[0] === 'name')
  //   ?.at(1) || DEFAULT_NAME;

  return { roomId, username };
};

webSocketServer.on('connection', (webSocket: WebSocket, req: Request) => {
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

  webSocket.on('message', (data: string) => {
    const message: Message = JSON.parse(data);
    rooms[roomId].messages.push({ ...message, id: uuid() });
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
