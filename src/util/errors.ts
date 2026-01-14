/**
 * Custom error types for DadGPT
 */

/**
 * Base error class for all DadGPT errors
 */
export class DadGPTError extends Error {
  readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = "DadGPTError"
    this.code = code
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

/**
 * Error for configuration issues
 */
export class ConfigError extends DadGPTError {
  constructor(message: string, code = "CONFIG_ERROR") {
    super(message, code)
    this.name = "ConfigError"
  }
}

/**
 * Error for storage operations
 */
export class StorageError extends DadGPTError {
  constructor(message: string, code = "STORAGE_ERROR") {
    super(message, code)
    this.name = "StorageError"
  }
}

/**
 * Error for LLM provider issues
 */
export class ProviderError extends DadGPTError {
  constructor(message: string, code = "PROVIDER_ERROR") {
    super(message, code)
    this.name = "ProviderError"
  }
}

/**
 * Error for tool execution failures
 */
export class ToolError extends DadGPTError {
  constructor(message: string, code = "TOOL_ERROR") {
    super(message, code)
    this.name = "ToolError"
  }
}
