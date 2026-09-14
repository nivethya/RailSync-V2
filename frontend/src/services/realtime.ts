import {
  API_BASE_URL,
  getAccessToken,
} from "./api";


export type RailSyncRealtimeEvent = {
  type: string;
  message?: string;
  timestamp?: string;
  [key: string]: unknown;
};


type EventListener =
  (
    event: RailSyncRealtimeEvent
  ) => void;


type StatusListener =
  (
    connected: boolean
  ) => void;


class RailSyncRealtimeClient {
  private socket:
    WebSocket | null = null;

  private eventListeners =
    new Set<EventListener>();

  private statusListeners =
    new Set<StatusListener>();

  private reconnectTimer:
    number | null = null;

  private heartbeatTimer:
    number | null = null;

  private reconnectAttempt = 0;

  private shouldReconnect =
    true;


  private getWebSocketUrl() {
    const normalized =
      API_BASE_URL
        .replace(/\/+$/, "")
        .replace(
          /^http:\/\//,
          "ws://",
        )
        .replace(
          /^https:\/\//,
          "wss://",
        );

    return `${normalized}/ws`;
  }


  connect() {
    const token =
      getAccessToken();

    if (!token) {
      this.disconnect();
      return;
    }


    if (
      this.socket
      &&
      (
        this.socket.readyState
        === WebSocket.OPEN
        ||
        this.socket.readyState
        === WebSocket.CONNECTING
      )
    ) {
      return;
    }


    this.shouldReconnect =
      true;


    const url =
      `${this.getWebSocketUrl()}?token=${
        encodeURIComponent(
          token,
        )
      }`;


    this.socket =
      new WebSocket(
        url,
      );


    this.socket.onopen =
      () => {
        this.reconnectAttempt =
          0;

        this.notifyStatus(
          true,
        );

        this.startHeartbeat();
      };


    this.socket.onmessage =
      (message) => {
        try {
          const parsed =
            JSON.parse(
              message.data,
            ) as RailSyncRealtimeEvent;


          this.eventListeners
            .forEach(
              (listener) => {
                listener(
                  parsed,
                );
              },
            );

        } catch (error) {
          console.error(
            "RailSync realtime message parse error:",
            error,
          );
        }
      };


    this.socket.onerror =
      () => {
        this.notifyStatus(
          false,
        );
      };


    this.socket.onclose =
      () => {
        this.notifyStatus(
          false,
        );

        this.stopHeartbeat();

        this.socket =
          null;


        if (
          this.shouldReconnect
        ) {
          this.scheduleReconnect();
        }
      };
  }


  disconnect() {
    this.shouldReconnect =
      false;


    if (
      this.reconnectTimer
      !== null
    ) {
      window.clearTimeout(
        this.reconnectTimer,
      );

      this.reconnectTimer =
        null;
    }


    this.stopHeartbeat();


    if (this.socket) {
      this.socket.close();

      this.socket =
        null;
    }


    this.notifyStatus(
      false,
    );
  }


  reconnect() {
    this.disconnect();

    this.shouldReconnect =
      true;

    this.connect();
  }


  subscribe(
    listener:
      EventListener,
  ) {
    this.eventListeners.add(
      listener,
    );

    return () => {
      this.eventListeners.delete(
        listener,
      );
    };
  }


  subscribeStatus(
    listener:
      StatusListener,
  ) {
    this.statusListeners.add(
      listener,
    );

    return () => {
      this.statusListeners.delete(
        listener,
      );
    };
  }


  isConnected() {
    return (
      this.socket
        ?.readyState
      === WebSocket.OPEN
    );
  }


  private notifyStatus(
    connected: boolean,
  ) {
    this.statusListeners
      .forEach(
        (listener) => {
          listener(
            connected,
          );
        },
      );
  }


  private scheduleReconnect() {
    if (
      this.reconnectTimer
      !== null
    ) {
      return;
    }


    const delay =
      Math.min(
        1000
        * 2 ** this.reconnectAttempt,

        15000,
      );


    this.reconnectAttempt +=
      1;


    this.reconnectTimer =
      window.setTimeout(
        () => {
          this.reconnectTimer =
            null;

          this.connect();
        },

        delay,
      );
  }


  private startHeartbeat() {
    this.stopHeartbeat();


    this.heartbeatTimer =
      window.setInterval(
        () => {
          if (
            this.socket
              ?.readyState
            === WebSocket.OPEN
          ) {
            this.socket.send(
              "ping",
            );
          }
        },

        25000,
      );
  }


  private stopHeartbeat() {
    if (
      this.heartbeatTimer
      !== null
    ) {
      window.clearInterval(
        this.heartbeatTimer,
      );

      this.heartbeatTimer =
        null;
    }
  }
}


export const railSyncRealtime =
  new RailSyncRealtimeClient();
