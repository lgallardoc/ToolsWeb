/**
 * Plain JS injected into the browser — mirrors @toolsweb/shared isSensitiveAuthUrl.
 * Keep host/path lists aligned with packages/shared/src/privacy.ts.
 */
export const AUTH_HOST_PAGE_JS = `
  function isAuthHostPage() {
    try {
      var host = location.hostname.toLowerCase();
      var suffixes = [
        'accounts.google.com',
        'accounts.youtube.com',
        'myaccount.google.com',
        'oauth2.googleapis.com',
        'login.microsoftonline.com',
        'login.live.com',
        'appleid.apple.com',
        'github.com',
        'gitlab.com',
        'auth0.com',
        'okta.com'
      ];
      var i;
      for (i = 0; i < suffixes.length; i++) {
        var h = suffixes[i];
        if (host === h || host.slice(-(h.length + 1)) === '.' + h) {
          if (host === 'github.com' || host.slice(-12) === '.github.com') {
            var ghPath = location.pathname.toLowerCase();
            if (ghPath.indexOf('/login') === -1 && ghPath.indexOf('/sessions') === -1 &&
                ghPath.indexOf('/auth') === -1 && ghPath.indexOf('/login/oauth') === -1) {
              return false;
            }
          }
          if (host.indexOf('gitlab') !== -1) {
            var glPath = location.pathname.toLowerCase();
            if (glPath.indexOf('/users/sign_in') === -1 && glPath.indexOf('/oauth') === -1) {
              return false;
            }
          }
          return true;
        }
      }
      var pq = (location.pathname + location.search).toLowerCase();
      var markers = [
        '/o/oauth2',
        '/signin/oauth',
        '/signin/identifier',
        '/signin/challenge',
        '/signin/accountchooser',
        '/interactivelogin',
        '/oauth2/v2/auth',
        '/login/oauth',
        '/authorize'
      ];
      for (i = 0; i < markers.length; i++) {
        if (pq.indexOf(markers[i]) !== -1) return true;
      }
    } catch (e) { /* ignore */ }
    return false;
  }
`;
