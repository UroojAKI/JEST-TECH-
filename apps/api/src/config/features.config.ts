/**
 * Global Feature Flags Configuration.
 * Toggled via environment variables or set directly.
 */
export const FeatureFlags = {
  get REPORTS(): boolean {
    return process.env.FEATURE_REPORTS !== 'false';
  },

  get AUDITING(): boolean {
    return process.env.FEATURE_AUDITING !== 'false';
  },

  get NOTIFICATIONS(): boolean {
    return process.env.FEATURE_NOTIFICATIONS !== 'false';
  },

  get OPTIMISTIC_LOCKING(): boolean {
    return process.env.FEATURE_OPTIMISTIC_LOCKING !== 'false';
  },

  get GLOBAL_SEARCH(): boolean {
    return process.env.FEATURE_GLOBAL_SEARCH !== 'false';
  },
};
