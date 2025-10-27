// Legacy auth service (for backwards compatibility)
// Use cloudAuthService for new features

const authService = {
  setToken: (token: string) => {
    localStorage.setItem('token', token);
  },
  
  getToken: (): string | null => {
    return localStorage.getItem('token');
  },
  
  setUser: (user: any) => {
    localStorage.setItem('user', JSON.stringify(user));
  },
  
  getUser: (): any => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },
  
  clearAuth: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
  
  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('token');
  }
};

export default authService;
