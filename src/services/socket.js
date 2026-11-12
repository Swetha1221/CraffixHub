import { store } from '../app/store';
import { setSocketConnected } from '../app/realtimeSlice';

export function connectSocket(token) {
  if (!token) return null;
  store.dispatch(setSocketConnected(true));
  return { connected: true, mode: 'browser-localStorage' };
}

export function disconnectSocket() {
  store.dispatch(setSocketConnected(false));
}
