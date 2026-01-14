/**
 * Event Bus - Pub/sub system for decoupled communication
 */

type Handler<T> = (payload: T) => void | Promise<void>

const handlers = new Map<string, Set<Handler<unknown>>>()

export namespace Bus {
  /**
   * Publish an event to all subscribers
   */
  export function publish<T>(event: string, payload: T): void {
    const eventHandlers = handlers.get(event)
    if (eventHandlers) {
      for (const handler of eventHandlers) {
        try {
          handler(payload)
        } catch (err) {
          // Handler errors do not break other handlers
          console.error(`Error in event handler for ${event}:`, err)
        }
      }
    }
  }

  /**
   * Subscribe to an event
   * @returns Unsubscribe function
   */
  export function subscribe<T>(
    event: string,
    handler: Handler<T>
  ): () => void {
    if (!handlers.has(event)) {
      handlers.set(event, new Set())
    }
    handlers.get(event)!.add(handler as Handler<unknown>)

    // Return unsubscribe function
    return () => {
      handlers.get(event)?.delete(handler as Handler<unknown>)
    }
  }

  /**
   * Remove all handlers
   */
  export function clear(): void {
    handlers.clear()
  }
}

/**
 * Type-safe event definitions
 */
export const Events = {
  // Goal events
  "goal.created": {} as { goalId: string },
  "goal.updated": {} as { goalId: string; changes: Record<string, unknown> },
  "goal.completed": {} as { goalId: string },
  "goal.deleted": {} as { goalId: string },

  // Todo events
  "todo.created": {} as { todoId: string },
  "todo.completed": {} as { todoId: string },
  "todo.deleted": {} as { todoId: string },

  // Project events
  "project.created": {} as { projectId: string },
  "project.updated": {} as { projectId: string; changes: Record<string, unknown> },
  "project.completed": {} as { projectId: string },
  "project.deleted": {} as { projectId: string },

  // Family events
  "family.added": {} as { memberId: string },
  "family.updated": {} as { memberId: string; changes: Record<string, unknown> },
  "family.removed": {} as { memberId: string },

  // Session events
  "session.created": {} as { sessionId: string },
  "session.message": {} as { sessionId: string; messageId: string },

  // Tool events
  "tool.start": {} as { toolId: string; args: unknown },
  "tool.complete": {} as { toolId: string; result: string },
  "tool.error": {} as { toolId: string; error: string },

  // Permission events
  "permission.asked": {} as { id: string; tool: string; resource: string },
  "permission.replied": {} as { id: string; answer: string },
} as const

export type EventName = keyof typeof Events
export type EventPayload<E extends EventName> = (typeof Events)[E]
