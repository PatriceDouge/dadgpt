type Handler<T = unknown> = (payload: T) => void;

const handlers = new Map<string, Set<Handler>>();

export namespace Bus {
  export function publish<T>(event: string, payload: T): void {
    const eventHandlers = handlers.get(event);
    if (eventHandlers) {
      for (const handler of eventHandlers) {
        try {
          handler(payload);
        } catch (err) {
          console.error(`Error in event handler for ${event}:`, err);
        }
      }
    }
  }

  export function subscribe<T>(event: string, handler: Handler<T>): () => void {
    if (!handlers.has(event)) {
      handlers.set(event, new Set());
    }
    handlers.get(event)!.add(handler as Handler);

    // Return unsubscribe function
    return () => {
      handlers.get(event)?.delete(handler as Handler);
    };
  }

  export function clear(): void {
    handlers.clear();
  }
}

// Event types for type safety
export interface DadGPTEvents {
  "goal.created": { goal: unknown };
  "goal.updated": { goal: unknown; prev: unknown };
  "goal.completed": { goal: unknown };
  "todo.created": { todo: unknown };
  "todo.completed": { todo: unknown };
  "session.started": { sessionId: string };
  "session.ended": { sessionId: string };
  "message.received": { message: unknown };
}
