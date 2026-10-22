export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

export async function getGmailAuthToken(interactive = true): Promise<string> {
  if (typeof chrome === 'undefined' || !chrome.identity) {
    throw new Error('chrome.identity API is not available');
  }

  return new Promise<string>((resolve, reject) => {
    // Attempt standard Chrome identity getAuthToken first
    if (typeof chrome.identity.getAuthToken === 'function') {
      chrome.identity.getAuthToken(
        {
          interactive,
          scopes: [GMAIL_SCOPE],
        },
        (token) => {
          if (chrome.runtime.lastError) {
            // If getAuthToken failed and interactive is allowed, try launchWebAuthFlow fallback
            if (interactive && typeof chrome.identity.launchWebAuthFlow === 'function') {
              launchWebAuthFallback()
                .then(resolve)
                .catch(reject);
              return;
            }
            reject(new Error(chrome.runtime.lastError.message || 'Failed to acquire OAuth token'));
            return;
          }
          if (!token) {
            reject(new Error('No token returned from chrome.identity.getAuthToken'));
            return;
          }
          resolve(token);
        }
      );
      return;
    }

    // Direct fallback if getAuthToken is undefined (e.g. Brave/Edge non-Google profiles)
    if (typeof chrome.identity.launchWebAuthFlow === 'function') {
      launchWebAuthFallback()
        .then(resolve)
        .catch(reject);
      return;
    }

    reject(new Error('Neither getAuthToken nor launchWebAuthFlow is supported in this environment'));
  });
}

async function launchWebAuthFallback(): Promise<string> {
  const manifest = chrome.runtime.getManifest?.() || {};
  const clientId = (manifest as any).oauth2?.client_id || '';
  if (!clientId) {
    throw new Error('Missing client_id in manifest oauth2 configuration');
  }

  const redirectUri = chrome.identity.getRedirectURL?.() || `https://${chrome.runtime.id}.chromiumapp.org/`;
  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    new URLSearchParams({
      client_id: clientId,
      response_type: 'token',
      redirect_uri: redirectUri,
      scope: GMAIL_SCOPE,
    }).toString();

  return new Promise<string>((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      {
        url: authUrl,
        interactive: true,
      },
      (redirectResponseUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || 'launchWebAuthFlow failed'));
          return;
        }
        if (!redirectResponseUrl) {
          reject(new Error('No response URL returned from launchWebAuthFlow'));
          return;
        }
        try {
          const url = new URL(redirectResponseUrl);
          const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
          const token = hashParams.get('access_token');
          if (token) {
            resolve(token);
          } else {
            reject(new Error('No access_token found in web auth flow response'));
          }
        } catch (e: any) {
          reject(new Error(`Failed to parse redirect response URL: ${e?.message}`));
        }
      }
    );
  });
}

export async function removeGmailCachedAuthToken(token: string): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.identity?.removeCachedAuthToken) {
    return new Promise((resolve) => {
      chrome.identity.removeCachedAuthToken({ token }, () => {
        resolve();
      });
    });
  }
}
