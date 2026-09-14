import {
  useCallback,
  useMemo,
  useState,
} from "react";

import {
  type RailSyncRealtimeEvent,
} from "../services/realtime";

import {
  useRailSyncRealtime,
} from "./useRailSyncRealtime";


export type ManagerRealtimeNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  event: RailSyncRealtimeEvent;
};


type UseManagerRealtimeOptions = {
  onRefresh?: () => void | Promise<void>;
};


const MANAGER_REFRESH_EVENTS = new Set([
  "WORKER_AVAILABILITY_CHANGED",
  "JOB_STARTED",
  "JOB_PAUSED",
  "JOB_RESUMED",
  "JOB_PROGRESS_UPDATED",
  "JOB_COMPLETED",
  "EXTENSION_REQUESTED",
]);


function eventTitle(
  event: RailSyncRealtimeEvent
) {
  switch (event.type) {
    case "WORKER_AVAILABILITY_CHANGED":
      return "Worker Availability Changed";

    case "JOB_STARTED":
      return "Maintenance Started";

    case "JOB_PAUSED":
      return "Maintenance Paused";

    case "JOB_RESUMED":
      return "Maintenance Resumed";

    case "JOB_PROGRESS_UPDATED":
      return "Maintenance Progress Updated";

    case "JOB_COMPLETED":
      return "Maintenance Completed";

    case "EXTENSION_REQUESTED":
      return "Extension Requested";

    default:
      return "RailSync Update";
  }
}


function eventMessage(
  event: RailSyncRealtimeEvent
) {
  const employeeCode =
    typeof event.employee_code === "string"
      ? event.employee_code
      : "Worker";

  const jobCode =
    typeof event.job_code === "string"
      ? event.job_code
      : "maintenance job";

  switch (event.type) {
    case "WORKER_AVAILABILITY_CHANGED":
      return `${employeeCode} is now ${
        String(
          event.availability_status ?? "updated"
        ).replaceAll("_", " ")
      }.`;

    case "JOB_STARTED":
      return `${employeeCode} started ${jobCode}.`;

    case "JOB_PAUSED":
      return `${employeeCode} paused ${jobCode}.`;

    case "JOB_RESUMED":
      return `${employeeCode} resumed ${jobCode}.`;

    case "JOB_PROGRESS_UPDATED":
      return `${jobCode} progress is now ${
        event.progress_percent ?? 0
      }%.`;

    case "JOB_COMPLETED":
      return `${employeeCode} completed ${jobCode}.`;

    case "EXTENSION_REQUESTED":
      return `${employeeCode} requested ${
        event.requested_minutes ?? "additional"
      } minutes for ${jobCode}.`;

    default:
      return (
        typeof event.message === "string"
          ? event.message
          : "New RailSync realtime update."
      );
  }
}


export function useManagerRealtime(
  options: UseManagerRealtimeOptions = {}
) {
  const [
    notifications,
    setNotifications,
  ] = useState<
    ManagerRealtimeNotification[]
  >([]);

  const [
    unreadCount,
    setUnreadCount,
  ] = useState(0);


  const handleEvent =
    useCallback(
      (
        event: RailSyncRealtimeEvent
      ) => {
        if (
          !MANAGER_REFRESH_EVENTS.has(
            event.type
          )
        ) {
          return;
        }

        const timestamp =
          typeof event.timestamp === "string"
            ? event.timestamp
            : new Date().toISOString();

        const notification:
          ManagerRealtimeNotification = {
            id:
              `${event.type}-${timestamp}-${Math.random()}`,

            type:
              event.type,

            title:
              eventTitle(event),

            message:
              eventMessage(event),

            timestamp,

            event,
          };

        setNotifications(
          (current) => [
            notification,
            ...current,
          ].slice(0, 50)
        );

        setUnreadCount(
          (current) =>
            current + 1
        );

        void options.onRefresh?.();
      },
      [
        options.onRefresh,
      ]
    );


  const {
    connected,
    reconnect,
  } = useRailSyncRealtime({
    onEvent:
      handleEvent,
  });


  const latestNotification =
    useMemo(
      () =>
        notifications[0]
        ?? null,
      [
        notifications,
      ]
    );


  const markAllRead =
    useCallback(
      () => {
        setUnreadCount(0);
      },
      []
    );


  const clearNotifications =
    useCallback(
      () => {
        setNotifications([]);
        setUnreadCount(0);
      },
      []
    );


  return {
    connected,
    reconnect,

    notifications,
    latestNotification,
    unreadCount,

    markAllRead,
    clearNotifications,
  };
}
