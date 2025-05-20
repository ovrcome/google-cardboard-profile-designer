const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store device data in memory (in a real app, you'd use a database)
const deviceData = new Map();

// Serve static files from the www directory
app.use(express.static(path.join(__dirname, 'www')));

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('New WebSocket connection established');
  let channelId = null;

  ws.on('message', (rawMessage) => {
    console.log(`ws rx: ${rawMessage}`);
    try {
      const message = JSON.parse(rawMessage);

      // Handle different message types
      switch (message.type) {
        case 'updateDeviceData':
          if (message.channelId) {
            channelId = message.channelId;
            deviceData.set(channelId, message.data);
            // Broadcast the update to all clients
            broadcastToAll({
              type: 'deviceData',
              channelId,
              data: message.data
            });
          }
          break;

        case 'getDeviceData':
          if (message.channelId && deviceData.has(message.channelId)) {
            ws.send(JSON.stringify({
              type: 'deviceData',
              channelId: message.channelId,
              data: deviceData.get(message.channelId)
            }));
          }
          break;

        default:
          // For any other message type, broadcast to all clients
          broadcastToAll(message);
      }
    } catch (e) {
      console.error('Error processing message:', e);
    }
  });
});

// Helper function to broadcast to all connected clients
function broadcastToAll(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Static files are being served from ${path.join(__dirname, 'www')}`);
});