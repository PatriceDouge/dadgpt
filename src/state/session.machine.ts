import { createMachine, assign } from "xstate";

export type SessionState =
  | "idle"
  | "loading"
  | "processing"
  | "awaiting_permission"
  | "error";

export interface SessionContext {
  sessionId: string;
  error?: string;
  currentToolCall?: {
    id: string;
    name: string;
    args: unknown;
  };
  pendingPermission?: {
    tool: string;
    resource: string;
  };
}

export type SessionEvent =
  | { type: "USER_MESSAGE"; content: string }
  | { type: "LOAD_HISTORY" }
  | { type: "LOADED" }
  | { type: "TEXT_CHUNK"; content: string }
  | { type: "TOOL_CALL"; id: string; name: string; args: unknown }
  | { type: "TOOL_RESULT"; id: string; result: string }
  | { type: "TOOL_ERROR"; id: string; error: string }
  | { type: "PERMISSION_REQUIRED"; tool: string; resource: string }
  | { type: "PERMISSION_GRANTED" }
  | { type: "PERMISSION_DENIED" }
  | { type: "COMPLETE" }
  | { type: "ERROR"; message: string }
  | { type: "RETRY" }
  | { type: "DISMISS" }
  | { type: "ABORT" };

export const sessionMachine = createMachine({
  id: "session",
  initial: "idle",
  types: {} as {
    context: SessionContext;
    events: SessionEvent;
  },
  context: {
    sessionId: "",
  },
  states: {
    idle: {
      on: {
        USER_MESSAGE: {
          target: "processing",
        },
        LOAD_HISTORY: {
          target: "loading",
        },
      },
    },
    loading: {
      on: {
        LOADED: {
          target: "idle",
        },
        ERROR: {
          target: "error",
          actions: assign(({ event }) => ({
            error: event.message,
          })),
        },
      },
    },
    processing: {
      on: {
        TEXT_CHUNK: {
          // Stay in processing, handled externally
        },
        TOOL_CALL: {
          actions: assign(({ event }) => ({
            currentToolCall: {
              id: event.id,
              name: event.name,
              args: event.args,
            },
          })),
        },
        TOOL_RESULT: {
          actions: assign(() => ({
            currentToolCall: undefined,
          })),
        },
        TOOL_ERROR: {
          actions: assign(() => ({
            currentToolCall: undefined,
          })),
        },
        PERMISSION_REQUIRED: {
          target: "awaiting_permission",
          actions: assign(({ event }) => ({
            pendingPermission: {
              tool: event.tool,
              resource: event.resource,
            },
          })),
        },
        COMPLETE: {
          target: "idle",
          actions: assign(() => ({
            currentToolCall: undefined,
          })),
        },
        ERROR: {
          target: "error",
          actions: assign(({ event }) => ({
            error: event.message,
            currentToolCall: undefined,
          })),
        },
        ABORT: {
          target: "idle",
          actions: assign(() => ({
            currentToolCall: undefined,
          })),
        },
      },
    },
    awaiting_permission: {
      on: {
        PERMISSION_GRANTED: {
          target: "processing",
          actions: assign(() => ({
            pendingPermission: undefined,
          })),
        },
        PERMISSION_DENIED: {
          target: "processing",
          actions: assign(() => ({
            pendingPermission: undefined,
          })),
        },
      },
    },
    error: {
      on: {
        RETRY: {
          target: "processing",
          actions: assign(() => ({
            error: undefined,
          })),
        },
        DISMISS: {
          target: "idle",
          actions: assign(() => ({
            error: undefined,
          })),
        },
      },
    },
  },
});

export function createSessionContext(sessionId: string): SessionContext {
  return {
    sessionId,
  };
}
