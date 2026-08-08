import { oneTapClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

import { envConfigs } from '@/config';

function getAuthBaseUrl() {
  // Authentication is same-origin in the browser. Using the active origin
  // avoids CORS/network failures when local ports, preview URLs, or custom
  // domains differ from the URL present during the build.
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return envConfigs.auth_url;
}

// create default auth client, without plugins
export const authClient = createAuthClient({
  baseURL: getAuthBaseUrl(),
  fetchOptions: {
    // Auth mutations must not be retried automatically. Better Auth already
    // handles session state and server-side rate limiting.
    retry: 0,
  },
});

// export default auth client methods
export const { useSession, signIn, signUp, signOut } = authClient;

// get auth client with plugins
export function getAuthClient(configs: Record<string, string>) {
  const authClient = createAuthClient({
    baseURL: getAuthBaseUrl(),
    plugins: getAuthPlugins(configs),
    fetchOptions: {
      retry: 0,
    },
  });

  return authClient;
}

// get auth plugins with configs
function getAuthPlugins(configs: Record<string, string>) {
  const authPlugins = [];

  // google one tap plugin
  if (configs.google_client_id && configs.google_one_tap_enabled === 'true') {
    authPlugins.push(
      oneTapClient({
        clientId: configs.google_client_id,
        // Optional client configuration:
        autoSelect: false,
        cancelOnTapOutside: false,
        context: 'signin',
        additionalOptions: {
          // Any extra options for the Google initialize method
        },
        // Configure prompt behavior and exponential backoff:
        promptOptions: {
          baseDelay: 1000, // Base delay in ms (default: 1000)
          maxAttempts: 1, // Only attempt once to avoid multiple error logs (default: 5)
        },
      })
    );
  }

  return authPlugins;
}
