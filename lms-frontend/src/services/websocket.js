import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { SERVER_ORIGIN } from './api';

/**
 * STOMP connection shared by the whole app.
 *
 * Several features listen to the same topic — chat and WebRTC signalling both
 * use /topic/classroom/{id} — so a topic keeps a SET of handlers and holds one
 * STOMP subscription for all of them. Subscribing used to replace the previous
 * handler for a topic, which silently broke whichever feature subscribed first.
 */
class WebSocketService {
  constructor() {
    this.client = null;
    this.connected = false;
    /** @type {Map<string, {sub: any, handlers: Set<Function>}>} */
    this.topics = new Map();
    /** One-shot callbacks waiting for the socket to come up. */
    this.pendingOnConnect = [];
  }

  connect(onConnectedCallback) {
    if (this.connected) {
      onConnectedCallback?.();
      return;
    }

    // Queue rather than attach to the client, so a caller that arrives after
    // activation still runs. Dropping these silently would mean, for example,
    // a WebRTC PEER_JOIN never being announced.
    if (onConnectedCallback) this.pendingOnConnect.push(onConnectedCallback);

    if (!this.client) {
      this.client = new Client({
        webSocketFactory: () => new SockJS(`${SERVER_ORIGIN}/ws`),
        reconnectDelay: 3000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        onConnect: () => {
          this.connected = true;
          // Re-establish every topic that has live handlers. Without this a
          // reconnect would leave the app subscribed to nothing.
          this.topics.forEach((entry, topic) => this._openSubscription(topic, entry));

          const queued = this.pendingOnConnect;
          this.pendingOnConnect = [];
          queued.forEach((cb) => {
            try { cb(); } catch (err) { console.error('[WebSocket] onConnect handler failed', err); }
          });
        },
        onWebSocketClose: () => {
          this.connected = false;
          this.topics.forEach((entry) => { entry.sub = null; });
        },
        onStompError: (frame) => {
          console.error('[WebSocket] STOMP error:', frame.headers['message']);
        },
      });
      this.client.activate();
    }
  }

  _openSubscription(topic, entry) {
    if (entry.sub || !this.connected) return;
    entry.sub = this.client.subscribe(topic, (message) => {
      let payload;
      try {
        payload = JSON.parse(message.body);
      } catch {
        payload = message.body;
      }
      // Copy before iterating: a handler may unsubscribe itself.
      Array.from(entry.handlers).forEach((handler) => {
        try {
          handler(payload);
        } catch (err) {
          console.error(`[WebSocket] handler failed for ${topic}`, err);
        }
      });
    });
  }

  /**
   * @returns {Function} call to remove just this handler
   */
  subscribe(topic, callback) {
    let entry = this.topics.get(topic);
    if (!entry) {
      entry = { sub: null, handlers: new Set() };
      this.topics.set(topic, entry);
    }
    entry.handlers.add(callback);

    if (this.connected) {
      this._openSubscription(topic, entry);
    } else {
      this.connect();
    }

    return () => this.unsubscribe(topic, callback);
  }

  /** Omitting `callback` removes every handler for the topic. */
  unsubscribe(topic, callback) {
    const entry = this.topics.get(topic);
    if (!entry) return;

    if (callback) entry.handlers.delete(callback);
    else entry.handlers.clear();

    if (entry.handlers.size === 0) {
      entry.sub?.unsubscribe();
      this.topics.delete(topic);
    }
  }

  send(destination, payload) {
    if (this.client && this.connected) {
      this.client.publish({ destination, body: JSON.stringify(payload) });
      return true;
    }
    return false;
  }

  disconnect() {
    this.pendingOnConnect = [];
    this.topics.forEach((entry) => entry.sub?.unsubscribe());
    this.topics.clear();
    this.client?.deactivate();
    this.client = null;
    this.connected = false;
  }
}

export default new WebSocketService();
