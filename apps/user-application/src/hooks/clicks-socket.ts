// TODO: Find libraries that manage web socket connections
import { durableObjectGeoClickArraySchema } from "@repo/data-ops/zod-schema/links";
import { useEffect, useRef, useState } from "react";
import { useGeoClickStore } from "@/hooks/geo-clicks-store";

const MAX_RETRIES = 5;

// Maps in the app are using a Geo click store which are powered by client socket
// apps/user-application/src/routes/app/_authed/index.tsx
export function useClickSocket() {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);

  // Zustand store for state management across big apps
  const { addClicks } = useGeoClickStore();

  useEffect(() => {
    const connect = () => {
      // wss is if you run in production (HTTPS)
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(
        // `${protocol}//localhost:8787/click-socket`,
        `${protocol}//${import.meta.env.VITE_BASE_HOST}/click-socket`,
        // `${protocol}//data-service.omarkawach.workers.dev/click-socket`,
      );

      socket.onopen = () => {
        console.log("WebSocket connected successfully");
        setIsConnected(true);
        retryCountRef.current = 0;
      };

      // Get message from server and pass data to 
      socket.onmessage = (event) => {
        // Handle incoming messages
        console.log(event);
        const data = durableObjectGeoClickArraySchema.parse(
          JSON.parse(event.data),
        );
        addClicks(data);
      };

      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      socket.onclose = (event) => {
        console.log("WebSocket closed:", event.code, event.reason);
        setIsConnected(false);

        if (retryCountRef.current < MAX_RETRIES) {
          const delay = 1000 * Math.pow(2, retryCountRef.current);
          retryCountRef.current++;

          retryTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      ws.current = socket;
    };

    connect();

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  return { isConnected };
}
