/**
 * OWNER    : Tanmay
 * DUE      : D3 11:00
 * TASK     :
 *   Cognito Hosted UI (aws-amplify Auth / signInWithRedirect), read cognito:groups from id token.
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { Amplify } from 'aws-amplify';
import { signInWithRedirect, signOut, getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
import { useAuthStore } from '../stores/authStore';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || 'us-east-1_dummy',
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || 'dummy',
      loginWith: {
        oauth: {
          domain: import.meta.env.VITE_COGNITO_DOMAIN || 'dummy.auth.us-east-1.amazoncognito.com',
          scopes: ['email', 'openid', 'profile'],
          redirectSignIn: [window.location.origin + '/login'],
          redirectSignOut: [window.location.origin + '/login'],
          responseType: 'code'
        }
      }
    }
  }
});

export const handleLogin = () => signInWithRedirect();

export const handleLogout = async () => {
  try {
    await signOut();
  } catch (e) {
    console.error('Logout error', e);
  }
  useAuthStore.getState().logout();
};

export const checkAuthSession = async () => {
  try {
    const isMock = import.meta.env.VITE_USE_MOCKS === '1';
    if (isMock) {
      useAuthStore.getState().login(
        { idToken: 'mock-token' },
        { username: 'Mock Admin' },
        ['admin']
      );
      return true;
    }

    const session = await fetchAuthSession();
    if (session.tokens) {
      const user = await getCurrentUser();
      const idToken = session.tokens.idToken?.toString();
      const payload = session.tokens.idToken?.payload;
      const groups = payload?.['cognito:groups'] || [];
      
      useAuthStore.getState().login({ idToken }, user, groups);
      return true;
    }
    return false;
  } catch (error) {
    console.log('No active auth session');
    return false;
  }
};
