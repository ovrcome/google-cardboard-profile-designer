// WebSocket client module to replace Firebase functionality
const WebSocketClient = {
  ws: null,
  listeners: new Map(),
  channelId: null,
  connected: false,

  // Initialize WebSocket connection
  init() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.connected = true;
      this.notifyListeners('connected', true);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.connected = false;
      this.notifyListeners('connected', false);
      // Attempt to reconnect after 5 seconds
      setTimeout(() => this.init(), 5000);
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.channelId === this.channelId) {
          this.notifyListeners(message.type, message.data);
        }
        else {
          console.log('Received message from unknown channel:', {message, ourChannelId: this.channelId});
        }
      } catch (e) {
        console.error('Error parsing WebSocket message:', e);
      }
    };
  },

  // Generate a random user ID
  generateChannelId() {
    return 'channel_' + Math.random().toString(36).substr(2, 9);
  },

  // Set up a listener for a specific event type
  on(type, callback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(callback);
  },

  // Set up a one-time listener for a specific event type
  once(type, callback) {
    const onceCallback = (data) => {
      this.off(type, onceCallback);
      callback(data);
    };
    this.on(type, onceCallback);
  },

  // Remove a listener
  off(type, callback) {
    if (this.listeners.has(type)) {
      this.listeners.get(type).delete(callback);
    }
  },

  // Notify all listeners of a specific event type
  notifyListeners(type, data) {
    if (this.listeners.has(type)) {
      this.listeners.get(type).forEach(callback => callback(data));
    }
  },

  // Send data to the server
  send(type, data = null) {
    if (this.ws && this.connected) {
      const message = {
        type,
        channelId: this.channelId,
        data
      };
      this.ws.send(JSON.stringify(message));
    }
  },

  // Update user data
  updateDeviceData(data) {
    this.send('updateDeviceData', data);
  },

  // Get user data
  getDeviceData() {
    this.send('getDeviceData');
  }
};

// Initialize WebSocket connection when the script loads
WebSocketClient.init();