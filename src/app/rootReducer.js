import { combineReducers } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import uiReducer from './uiSlice';
import realtimeReducer from './realtimeSlice';

const rootReducer = combineReducers({
  auth: authReducer,
  ui: uiReducer,
  realtime: realtimeReducer,
});

export default rootReducer;
