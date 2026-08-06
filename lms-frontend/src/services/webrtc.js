import websocketService from './websocket';

/**
 * Peer-to-peer video mesh for a classroom session.
 *
 * Every participant holds one RTCPeerConnection to every other participant.
 * Media flows browser-to-browser; the server only relays session negotiation
 * (SDP offers/answers and ICE candidates) through the existing STOMP topic and
 * never sees or interprets the media.
 *
 * Join protocol — deliberately asymmetric so two peers can never offer to each
 * other simultaneously (SDP glare):
 *
 *   1. Newcomer N broadcasts PEER_JOIN and then only ever answers.
 *   2. Each existing peer E creates the offer toward N.
 *   3. N answers, both sides trickle ICE candidates as they are gathered.
 *
 * Mesh topology is O(n²) connections, which is fine for a classroom of ~10 and
 * is the honest limit of this implementation — beyond that it needs an SFU.
 */

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

class PeerMesh {
  constructor() {
    this.reset();
  }

  reset() {
    this.peerId = null;
    this.sessionId = null;
    this.localStream = null;
    this.displayName = null;
    this.isTeacher = false;
    /** @type {Map<string, {pc: RTCPeerConnection, name: string, isTeacher: boolean, stream: MediaStream|null, pendingCandidates: any[], remoteDescriptionSet: boolean}>} */
    this.peers = new Map();
    this.onChange = null;
    this.unsubscribe = null;
    this.topic = null;
  }

  get isActive() {
    return this.peerId !== null;
  }

  /** Snapshot for React. Only peers with media are worth rendering as a tile. */
  getParticipants() {
    return Array.from(this.peers.entries()).map(([id, p]) => ({
      peerId: id,
      name: p.name,
      isTeacher: p.isTeacher,
      stream: p.stream,
      connectionState: p.pc.connectionState,
    }));
  }

  _notify() {
    this.onChange?.(this.getParticipants());
  }

  _send(message) {
    websocketService.send(`/app/signal/${this.sessionId}`, {
      ...message,
      sessionId: Number(this.sessionId),
      fromPeer: this.peerId,
      senderName: this.displayName,
      isTeacher: this.isTeacher,
    });
  }

  join({ sessionId, localStream, displayName, isTeacher = false, onChange }) {
    if (this.isActive) this.leave();

    // Per-tab identity: the same user may open two tabs, and each needs its own
    // peer connection.
    this.peerId =
      globalThis.crypto?.randomUUID?.() ??
      `peer-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    this.sessionId = sessionId;
    this.localStream = localStream || null;
    this.displayName = displayName || 'Participant';
    this.isTeacher = isTeacher;
    this.onChange = onChange;
    this.topic = `/topic/classroom/${sessionId}`;

    this.unsubscribe = websocketService.subscribe(this.topic, (msg) => this._onMessage(msg));

    // Announce once connected, otherwise the JOIN is dropped before the socket
    // is up and nobody ever offers to us.
    websocketService.connect(() => this._send({ type: 'PEER_JOIN' }));

    return this.peerId;
  }

  leave() {
    if (!this.isActive) return;
    this._send({ type: 'PEER_LEAVE' });
    this.peers.forEach((p) => p.pc.close());
    this.unsubscribe?.();
    this.reset();
  }

  _onMessage(msg) {
    if (!msg || !msg.fromPeer || msg.fromPeer === this.peerId) return;
    // Directed messages addressed to someone else are ignored; the relay is a
    // broadcast, so every peer sees every frame.
    if (msg.toPeer && msg.toPeer !== this.peerId) return;

    switch (msg.type) {
      case 'PEER_JOIN':
        // We were here first, so we make the offer.
        this._createConnection(msg.fromPeer, msg.senderName, !!msg.isTeacher, true);
        break;
      case 'PEER_SIGNAL':
        this._onSignal(msg);
        break;
      case 'PEER_LEAVE':
        this._removePeer(msg.fromPeer);
        break;
      default:
        break; // CHAT / HAND_RAISE / POLL are handled by the chat subscriber
    }
  }

  _createConnection(remotePeerId, name, remoteIsTeacher, isOfferer) {
    if (this.peers.has(remotePeerId)) return this.peers.get(remotePeerId);

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const entry = {
      pc,
      name: name || 'Participant',
      isTeacher: remoteIsTeacher,
      stream: null,
      pendingCandidates: [],
      remoteDescriptionSet: false,
    };
    this.peers.set(remotePeerId, entry);

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => pc.addTrack(track, this.localStream));
    } else if (isOfferer) {
      // With no camera we still need m-lines in the offer, or we would negotiate
      // a session that can never carry the other side's media.
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this._send({
          type: 'PEER_SIGNAL',
          toPeer: remotePeerId,
          signalData: { candidate: event.candidate.toJSON() },
        });
      }
    };

    pc.ontrack = (event) => {
      entry.stream = event.streams[0] || null;
      this._notify();
    };

    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
        // 'disconnected' can recover, so only tear down on terminal states.
        if (pc.connectionState !== 'disconnected') this._removePeer(remotePeerId);
      }
      this._notify();
    };

    if (isOfferer) {
      pc.onnegotiationneeded = async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          this._send({
            type: 'PEER_SIGNAL',
            toPeer: remotePeerId,
            signalData: { sdp: pc.localDescription },
          });
        } catch (err) {
          console.error('[WebRTC] offer failed', err);
        }
      };
    }

    this._notify();
    return entry;
  }

  async _onSignal(msg) {
    const { fromPeer, signalData } = msg;
    if (!signalData) return;

    // A signal from an unknown peer means they offered to us: answer, never offer.
    let entry = this.peers.get(fromPeer);
    if (!entry) {
      entry = this._createConnection(fromPeer, msg.senderName, !!msg.isTeacher, false);
    }
    const { pc } = entry;

    try {
      if (signalData.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
        entry.remoteDescriptionSet = true;

        // Candidates that arrived before the description could not be applied yet.
        for (const candidate of entry.pendingCandidates) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
        }
        entry.pendingCandidates = [];

        if (signalData.sdp.type === 'offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          this._send({
            type: 'PEER_SIGNAL',
            toPeer: fromPeer,
            signalData: { sdp: pc.localDescription },
          });
        }
      } else if (signalData.candidate) {
        if (entry.remoteDescriptionSet) {
          await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate)).catch(() => {});
        } else {
          entry.pendingCandidates.push(signalData.candidate);
        }
      }
    } catch (err) {
      console.error('[WebRTC] signal handling failed', err);
    }
  }

  _removePeer(remotePeerId) {
    const entry = this.peers.get(remotePeerId);
    if (!entry) return;
    entry.pc.close();
    this.peers.delete(remotePeerId);
    this._notify();
  }
}

export default new PeerMesh();
