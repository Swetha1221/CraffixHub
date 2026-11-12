import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../services/api';

const storedToken = localStorage.getItem('cfx_access_token');
const storedRefresh = localStorage.getItem('cfx_refresh_token');
const storedUser = localStorage.getItem('cfx_user');

export const fetchCurrentUser = createAsyncThunk('auth/me', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/auth/me');
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Session expired');
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: storedUser ? JSON.parse(storedUser) : null,
    accessToken: storedToken || null,
    refreshToken: storedRefresh || null,
    loading: false,
    error: null,
  },
  reducers: {
    setSession: (state, action) => {
      const { user, accessToken, refreshToken } = action.payload;
      state.user = user;
      state.accessToken = accessToken;
      state.refreshToken = refreshToken;
      state.error = null;
      if (accessToken) localStorage.setItem('cfx_access_token', accessToken);
      if (refreshToken) localStorage.setItem('cfx_refresh_token', refreshToken);
      if (user) localStorage.setItem('cfx_user', JSON.stringify(user));
    },
    updateUserProfile: (state, action) => {
      state.user = action.payload;
      if (action.payload) {
        localStorage.setItem('cfx_user', JSON.stringify(action.payload));
      }
    },
    clearSession: (state) => {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.error = null;
      localStorage.removeItem('cfx_access_token');
      localStorage.removeItem('cfx_refresh_token');
      localStorage.removeItem('cfx_user');
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCurrentUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        localStorage.setItem('cfx_user', JSON.stringify(action.payload));
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        state.loading = false;
        state.user = null;
        state.accessToken = null;
        state.refreshToken = null;
        localStorage.removeItem('cfx_access_token');
        localStorage.removeItem('cfx_refresh_token');
        localStorage.removeItem('cfx_user');
      });
  },
});

export const { setSession, updateUserProfile, clearSession } = authSlice.actions;
export default authSlice.reducer;
