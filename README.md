# MonkeysSocket JS Client

🚀 **MonkeysSocket** is a production-grade, zero-dependency JavaScript client library for the MonkeysLegion Sockets ecosystem. Designed for extreme performance and reliability, it provides an adaptive reconnection engine, offline message queuing, and a robust event-driven API.

## 📦 Features

- **Zero-Dependency**: No external heavy libraries, pure modern JavaScript.
- **Adaptive Reconnection**: Exponential backoff with jitter to prevent server thundering herds.
- **Offline Queuing**: Automatically queues messages if the connection is lost and flushes them upon restoration.
- **EventEmitter API**: Intuitive event-based orchestration for your real-time application.
- **Universal Compatibility**: Works in modern Browsers and Node.js environments (with `ws` polyfill).
- **Security-First**: Enforces strict origin checks and protocol standard compliance.

---

## 🛠️ Installation

Simply include the source in your project, or if you're using a build system:

```javascript
import MonkeysSocket from './src/monkeys-sockets.js';
```

For **Node.js** usage, ensure you have a `WebSocket` polyfill available:

```javascript
import WebSocket from 'ws';
global.WebSocket = WebSocket;
```

### 🐒 MonkeysLegion (PHP) Integration
If you are using this inside a MonkeysLegion PHP application, you don't need to manually copy files. Simply run:

```bash
php ml socket:install
```
The installer will ask if you want to publish the JS assets to `public/js/vendor/monkeys-sockets.js` automatically.

---

## 🚀 Usage

### basic setup
```javascript
const socket = new MonkeysSocket('ws://your-server:9102', {
    autoConnect: true,
    reconnect: true,
    socketOptions: {
        origin: 'http://your-app.com'
    }
});

// Handling events
socket.on('connect', () => {
    console.log('Connected to MonkeysLegion!');
});

// Emitting data
socket.emit('chat:message', { text: 'Hello Monkeys!' });

// Listening for server events
socket.on('chat:message', (data) => {
    console.log('Received:', data.text);
});
```

### Configuration Options
| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `autoConnect` | `Boolean` | `true` | Connect immediately upon instantiation. |
| `reconnect` | `Boolean` | `true` | Enable automatic adaptive reconnection. |
| `maxReconnectAttempts` | `Number` | `Infinity` | Cap the number of retry attempts. |
| `initialDelay` | `Number` | `1000` | Starting delay for backoff (ms). |
| `maxDelay` | `Number` | `30000` | Maximum cap for backoff delay (ms). |
| `socketOptions` | `Object` | `{}` | Native WebSocket constructor options (Protocols, Headers, etc.). |

---

## 📡 Event System

MonkeysSocket uses an internal `EventEmitter` to bridge the gap between low-level socket events and high-level application logic.

### Standard Events
- `connect`: Fired when the connection is established.
- `disconnect`: Fired when the connection is closed or lost.
- `error`: Fired on transport-level errors.
- `message`: Fired for *every* incoming JSON message from the server.
- `reconnect`: Fired when a reconnection attempt starts.
- `reconnected`: Fired when a reconnection is successful.

---

## 📡 Communication Life-Cycles

To master the MonkeysLegion ecosystem, it is essential to understand the "Hub and Spoke" model. The architecture distinguishes between **Long-Lived** listeners and **Short-Lived** emitters to ensure maximum performance.

### 1. Server-to-Server (The Internal Bridge)
This flow connects your application logic (e.g., a Controller, Command, or Job) to the WebSocket cluster.

* **The Listener (Always Live):** When you run `php ml socket:serve`, the server starts a permanent loop. It keeps an "Eternal Ear" open to the **Redis Pub/Sub** or **Unix Socket** channel.
* **The Broadcaster (Flash Messenger):** When your app calls `$broadcaster->emit()`, it "lives" for a few milliseconds—just long enough to throw the message into the channel—and then "dies" immediately.
* **Benefit:** Your web request is never slowed down by the WebSocket delivery process. It's a "fire and forget" system.



### 2. Client-to-Server (The Upstream Flow)
Standard communication from the JS client to your backend logic.

* **The Flow:** The `MonkeysSocket` JS client initiates a handshake and remains "Live" in the browser. When it emits an event, the server's **Middleware** validates the request and triggers your defined event handlers.
* **Liveness:** Every message sent by the client resets the server-side "Heartbeat" timer, proving the connection is still active.

### 3. Client-to-Client (The Secure Relay)
Clients never talk directly to each other (P2P). Instead, the server acts as a secure **Mediator**.

* **The Process:** Client A emits to the server. The server verifies the permissions, looks up Client B in the **Registry**, and "relays" the message.
* **Echo Logic:** By default, the server broadcasts to "Everyone Else" (excluding the sender). This prevents "double-message" glitches in the sender's UI while ensuring the rest of the room is updated instantly.

---

### 📊 Summary Table

| Flow Type | Listener (Always Live) | Emitter (Lives & Dies) | Purpose |
| :--- | :--- | :--- | :--- |
| **Server-to-Server** | Socket Server (Worker) | App Broadcaster | Pushing logic updates to users |
| **Client-to-Server** | Socket Server (Worker) | JS Client | Sending user actions to backend |
| **Client-to-Client** | Other Connected Clients | The Sending Client | Private messaging / Chat rooms |

## 🛡️ Security & Performance

### Origin Verification
The client properly passes `Origin` headers through `socketOptions`. Ensure your server configuration matches the allowed origins to prevent unauthorized access.

### Message Limits
The server enforces a 10MB default message limit. While MonkeysSocket handles large payloads, it is recommended to keep message sizes small to maintain low latency.

### Reconnection Jitter
MonkeysSocket applies a random jitter to reconnection delays. This is critical in production to ensure that if a server goes down, thousands of clients don't all try to reconnect at the exact same millisecond.

---

## 🧪 Testing

The client includes a comprehensive test suite using **Vitest**.

### Prerequisites for Integration Tests
Integration tests run against a real PHP socket server implementation. To run these tests locally:
1.  **Option A (Default)**: Clone the [MonkeysLegion-Sockets (PHP)](https://github.com/MonkeysCloud/MonkeysLegion-Sockets) repository as a **sibling directory** to this one.
2.  **Option B (Custom Path)**: Set the `PHP_SERVER_PATH` environment variable to point to your PHP sockets project directory.

    ```bash
    # Via CLI
    PHP_SERVER_PATH=/path/to/MonkeysLegion-Sockets npm test
    
    # Or via .env file
    echo "PHP_SERVER_PATH=/path/to/MonkeysLegion-Sockets" > .env
    ```
2.  The test suite will automatically spawn the PHP server process during the integration phase. You do **not** need to have a manual server running.

### Running Tests
```bash
npm install
npm test
```

The suite includes **Core Transport Tests** (mocked environment) and **Integration Tests** (real end-to-end communication).

---

## 📜 License
MIT - Part of the MonkeysLegion Framework.
