import { createSlice } from '@reduxjs/toolkit';

const realtimeSlice = createSlice({
  name: 'realtime',
  initialState: {
    connected: false,
    lastEvent: null,
    tick: 0,
    unreadNotifications: 0,
    pendingPitchesCount: 0,
    latestNotifications: [],
  },
  reducers: {
    setSocketConnected: (state, action) => {
      state.connected = action.payload;
    },
    recordRealtimeChange: (state, action) => {
      state.lastEvent = action.payload;
      state.tick += 1;
    },
    setNotificationsState: (state, action) => {
      state.latestNotifications = action.payload.items || [];
      state.unreadNotifications = action.payload.unreadCount || 0;
      if (action.payload.pendingPitchesCount !== undefined) {
        state.pendingPitchesCount = action.payload.pendingPitchesCount;
      }
    },
    prependNotification: (state, action) => {
      state.latestNotifications = [action.payload, ...state.latestNotifications].slice(0, 50);
      state.unreadNotifications += 1;
    },
  },
});

export const {
  setSocketConnected,
  recordRealtimeChange,
  setNotificationsState,
  prependNotification,
} = realtimeSlice.actions;
export default realtimeSlice.reducer;
