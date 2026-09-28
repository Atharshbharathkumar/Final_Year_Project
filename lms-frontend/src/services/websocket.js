import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:8080/ws';

/**
 * Single shared STOMP connection.
 *
 * Subscriptions are requested by topic and replayed once the socket is up, so
 * callers never have to care whether the connection has finished handshaking.
 * Every teardown path is defensive: React unmounts (and StrictMode's double
 * effect invocation in development) routinely try to unsubscribe from a socket
 * that is already gone, and stompjs throws if you let that reach it.
 */
class WebSocketService {
  constructor() {
    this.client = null;
    this.subscriptions = new Map(); // topic -> StompSubscription
    this.handlers = new Map();      // topic -> callback, kept for replay
    this.connected = false;
  }

  connect(onConnected) {
    if (this.connected) {
      if (onConnected) onConnected();
      return;
    }

    if (this.client) {
      // A connection attempt is already in flight — queue the callback.
      if (onConnected) this.pending = [...(this.pending || []), onConnected];
      return;
    }

    this.pending = onConnected ? [onConnected] : [];

    this.client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        this.connected = true;
        // Re-attach every topic we were asked to watch.
        this.handlers.forEach((callback, topic) => this._attach(topic, callback));
        const queued = this.pending || [];
        this.pending = [];
        queued.forEach(cb => {
          try { cb(); } catch { /* a subscriber callback must not kill the socket */ }
        });
      },
      onDisconnect: () => {
        this.connected = false;
        this.subscriptions.clear();
      },
      onWebSocketClose: () => {
        this.connected = false;
        this.subscriptions.clear();
      },
      onStompError: (frame) => {
        console.error('[WebSocket] STOMP error:', frame?.headers?.message);
      },
    });

    this.client.activate();
  }

  /**
   * Watch a topic. Safe to call before the socket is open — the subscription is
   * recorded and attached on connect.
   */
  subscribe(topic, callback) {
    this.handlers.set(topic, callback);

    if (!this.client) {
      this.connect();
      return;
    }
    if (this.connected) this._attach(topic, callback);
  }

  _attach(topic, callback) {
    if (!this.client || !this.connected) return;
    if (this.subscriptions.has(topic)) return;

    try {
      const sub = this.client.subscribe(topic, (message) => {
        let payload = message.body;
        try {
          payload = JSON.parse(message.body);
        } catch {
          /* server sent a plain string */
        }
        try {
          callback(payload);
        } catch (err) {
          console.error('[WebSocket] handler threw for', topic, err);
        }
      });
      this.subscriptions.set(topic, sub);
    } catch (err) {
      console.warn('[WebSocket] could not subscribe to', topic, err?.message);
    }
  }

  unsubscribe(topic) {
    this.handlers.delete(topic);

    const sub = this.subscriptions.get(topic);
    this.subscriptions.delete(topic);
    if (!sub) return;

    // The socket may already be closed — stompjs throws in that case, and this
    // runs inside React cleanup where a throw would unmount the whole tree.
    try {
      if (this.connected) sub.unsubscribe();
    } catch {
      /* connection already gone; nothing to release */
    }
  }

  send(destination, payload) {
    if (!this.client || !this.connected) return false;
    try {
      this.client.publish({ destination, body: JSON.stringify(payload) });
      return true;
    } catch (err) {
      console.warn('[WebSocket] publish failed:', err?.message);
      return false;
    }
  }

  disconnect() {
    if (!this.client) return;
    this.subscriptions.forEach((sub) => {
      try { sub.unsubscribe(); } catch { /* already closed */ }
    });
    this.subscriptions.clear();
    this.handlers.clear();
    try { this.client.deactivate(); } catch { /* already stopping */ }
    this.client = null;
    this.connected = false;
  }
}

export default new WebSocketService();