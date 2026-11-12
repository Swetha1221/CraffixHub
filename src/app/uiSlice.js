import { createSlice } from '@reduxjs/toolkit';

const savedTheme = localStorage.getItem('cfx_theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    theme: savedTheme,
    sidebarCollapsed: false,
    mobileMenuOpen: false,
    toasts: [],
    superAdminDrawer: {
      open: false,
      group: 'Overview',
      itemPath: '/dashboard',
      expanded: false,
    },
  },
  reducers: {
    toggleTheme: (state) => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('cfx_theme', state.theme);
      document.documentElement.setAttribute('data-theme', state.theme);
    },
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setMobileMenuOpen: (state, action) => {
      state.mobileMenuOpen = action.payload;
    },
    openSuperAdminDrawer: (state, action) => {
      const { group, itemPath } = action.payload || {};
      state.superAdminDrawer.open = true;
      if (group) state.superAdminDrawer.group = group;
      if (itemPath) state.superAdminDrawer.itemPath = itemPath;
    },
    setSuperAdminDrawerItem: (state, action) => {
      state.superAdminDrawer.itemPath = action.payload;
    },
    toggleSuperAdminDrawerExpanded: (state) => {
      state.superAdminDrawer.expanded = !state.superAdminDrawer.expanded;
    },
    closeSuperAdminDrawer: (state) => {
      state.superAdminDrawer.open = false;
    },
    pushToast: (state, action) => {
      const id = `${Date.now()}-${Math.random()}`;
      state.toasts.push({ id, type: 'info', ...action.payload });
    },
    removeToast: (state, action) => {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
  },
});

export const {
  toggleTheme,
  toggleSidebar,
  setMobileMenuOpen,
  openSuperAdminDrawer,
  setSuperAdminDrawerItem,
  toggleSuperAdminDrawerExpanded,
  closeSuperAdminDrawer,
  pushToast,
  removeToast,
} = uiSlice.actions;
export default uiSlice.reducer;
