import {
  useEffect,
  useState,
} from "react";

import {
  railSyncRealtime,
  type RailSyncRealtimeEvent,
} from "../services/realtime";


type UseRailSyncRealtimeOptions = {
  onEvent?: (
    event: RailSyncRealtimeEvent
  ) => void;
};


export function useRailSyncRealtime(
  options: UseRailSyncRealtimeOptions = {}
) {
  const [
    connected,
    setConnected,
  ] = useState(
    railSyncRealtime.isConnected()
  );

  useEffect(() => {
    const unsubscribeStatus =
      railSyncRealtime.subscribeStatus(
        setConnected
      );

    const unsubscribeEvent =
      railSyncRealtime.subscribe(
        (event) => {
          options.onEvent?.(event);
        }
      );

    railSyncRealtime.connect();

    return () => {
      unsubscribeStatus();
      unsubscribeEvent();
    };
  }, [options.onEvent]);

  return {
    connected,
    reconnect:
      () =>
        railSyncRealtime.reconnect(),
  };
}
