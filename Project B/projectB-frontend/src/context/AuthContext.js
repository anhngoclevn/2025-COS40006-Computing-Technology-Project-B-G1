// src/context/AuthContext.js
import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage on app start
  useEffect(() => {
    console.log('AuthContext: Loading user from localStorage...');
    const savedUser = localStorage.getItem('user');
    console.log('AuthContext: Saved user data:', savedUser);

    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        console.log('AuthContext: Parsed user data:', userData);
        setUser(userData);
      } catch (error) {
        console.error('Error parsing saved user data:', error);
        localStorage.removeItem('user');
      }
    }
    setIsLoading(false); // Set loading to false after checking localStorage
    console.log('AuthContext: Initialization complete');
  }, []);

  const login = (userData) => {
    console.log('AuthContext: Login called with userData:', userData);
    setUser(userData);
    setIsLoading(false);
    // Save to localStorage for persistence
    localStorage.setItem('user', JSON.stringify(userData));
    console.log('AuthContext: User data saved to localStorage');
  };

  const logout = () => {
    console.log('User logging out...');
    setUser(null);
    setIsLoading(false);
    // Clear localStorage
    localStorage.removeItem('user');
    // Clear any other session data if needed
    sessionStorage.clear();
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
