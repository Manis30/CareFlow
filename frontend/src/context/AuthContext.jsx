import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { loginUserApi, logoutUserApi, getMeApi } from '../api/auth';
import { getMyPatientProfileApi } from '../api/patient';
import { getMyDoctorProfileApi } from '../api/doctor';
import { ROLES } from '../utils/constants';
import { normalizeRole, getRoleHomePath, getDashboardRoute } from '../utils/normalizeRole';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('careflow_user');
    if (!savedUser) return null;
    try {
      const parsed = JSON.parse(savedUser);
      if (parsed && parsed.role) {
        parsed.role = normalizeRole(parsed.role);
      }
      return parsed;
    } catch (e) {
      return null;
    }
  });

  const [loading, setLoading] = useState(true);
  const [authInitialized, setAuthInitialized] = useState(false);
  const isLoggingInRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      setLoading(true);
      try {
        const meRes = await getMeApi();
        if (!isMounted || isLoggingInRef.current) return;

        const authenticatedUser = meRes?.data?.data || meRes?.data;

        if (authenticatedUser && (authenticatedUser._id || authenticatedUser.id || authenticatedUser.role)) {
          const fetchedUser = {
            ...authenticatedUser,
            role: normalizeRole(authenticatedUser.role)
          };

          setUser(fetchedUser);
          localStorage.setItem('careflow_user', JSON.stringify(fetchedUser));

          // Fetch secondary sub-profiles safely without wiping active user session on error
          if (fetchedUser.role === ROLES.PATIENT) {
            try {
              const patRes = await getMyPatientProfileApi();
              if (patRes?.data && isMounted && !isLoggingInRef.current) {
                setUser((prev) => (prev ? { ...prev, profile: patRes.data } : prev));
              }
            } catch (e) {
              console.warn('Patient sub-profile fetch notice:', e?.message || e);
            }
          } else if (fetchedUser.role === ROLES.DOCTOR) {
            try {
              const docRes = await getMyDoctorProfileApi();
              if (docRes?.data && isMounted && !isLoggingInRef.current) {
                setUser((prev) => (prev ? { ...prev, doctorProfile: docRes.data } : prev));
              }
            } catch (e) {
              console.warn('Doctor sub-profile fetch notice:', e?.message || e);
            }
          }
        } else {
          if (!isLoggingInRef.current) {
            setUser(null);
            localStorage.removeItem('careflow_user');
          }
        }
      } catch (err) {
        console.warn('Session verification failed on mount:', err?.message || err);
        if (isMounted && !isLoggingInRef.current) {
          setUser(null);
          localStorage.removeItem('careflow_user');
        }
      } finally {
        if (isMounted) {
          setAuthInitialized(true);
          setLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (credentials) => {
    isLoggingInRef.current = true;
    try {
      const res = await loginUserApi(credentials);
      const rawUserData = res?.data?.data || res?.data;
      if (res.success && rawUserData) {
        const normalizedUser = {
          ...rawUserData,
          role: normalizeRole(rawUserData.role)
        };

        setUser(normalizedUser);
        localStorage.setItem('careflow_user', JSON.stringify(normalizedUser));

        // Attempt optional /auth/me fetch to enrich populated organization details
        try {
          const meRes = await getMeApi();
          const meUserData = meRes?.data?.data || meRes?.data;
          if (meUserData) {
            const fullUser = {
              ...normalizedUser,
              ...meUserData,
              role: normalizeRole(meUserData.role || normalizedUser.role)
            };
            setUser(fullUser);
            localStorage.setItem('careflow_user', JSON.stringify(fullUser));
            return fullUser;
          }
        } catch (e) {
          console.warn('Post-login /auth/me enrichment notice:', e?.message || e);
        }

        return normalizedUser;
      }
      throw new Error(res.message || 'Login failed');
    } finally {
      isLoggingInRef.current = false;
    }
  };

  const logout = async () => {
    try {
      await logoutUserApi();
    } catch (err) {
      console.warn('Logout API error:', err);
    } finally {
      setUser(null);
      localStorage.removeItem('careflow_user');
    }
  };

  const updateUser = (updatedFields) => {
    setUser((prev) => {
      const newUser = { ...prev, ...updatedFields };
      if (newUser.role) {
        newUser.role = normalizeRole(newUser.role);
      }
      localStorage.setItem('careflow_user', JSON.stringify(newUser));
      return newUser;
    });
  };

  const getDashboardPath = (rawRole) => {
    return getDashboardRoute(rawRole);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role ? normalizeRole(user.role) : null,
        isAuthenticated: !!user,
        authInitialized,
        loading,
        login,
        logout,
        updateUser,
        getDashboardPath,
        getDashboardRoute
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
