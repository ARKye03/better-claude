declare module 'claude-code' {
  interface PluginState {
    narrator: {
      /** Whether Claude tells, out loud, what it did after each turn. */
      isEnabled: boolean
    }
  }
}
