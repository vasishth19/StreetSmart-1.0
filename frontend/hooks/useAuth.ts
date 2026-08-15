'use client';

import { useState, useCallback, useEffect } from 'react';

export interface User {
  id:    number;
  name:  string;
  email: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

let _token: string | null = null;
let _user:  User   | null = null;

export function getToken() { return _token; }
export function getUser()  { return _user;  }

export function useAuth() {
  const [user,    setUser]    = useState<User | null>(null);
  const [token,   setToken]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ✅ Load from localStorage on mount
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem('ss_token');
      const savedUser  = localStorage.getItem('ss_user');
      if (savedToken && savedUser) {
        _token = savedToken;
        _user  = JSON.parse(savedUser);
        setToken(savedToken);
        setUser(_user);
      }
    } catch {}
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      // Demo mode
      if (email === 'demo@streetsmart.city' && password === 'demo123') {
        const demoUser = { id: 1, name: 'Demo User', email };
        _token = 'demo-token-xxx';
        _user  = demoUser;
        setToken(_token);
        setUser(demoUser);
        localStorage.setItem('ss_token', _token);
        localStorage.setItem('ss_user',  JSON.stringify(demoUser));
        return;
      }

      // Admin mode
      if (email === 'admin@streetsmart.app' && password === 'admin2026') {
        const adminUser = { id: 0, name: 'Admin', email };
        _token = 'admin-token-xxx';
        _user  = adminUser;
        setToken(_token);
        setUser(adminUser);
        localStorage.setItem('ss_token', _token);
        localStorage.setItem('ss_user',  JSON.stringify(adminUser));
        return;
      }

      let res: Response;
      try {
        res = await fetch(`${API}/auth/login`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body:    new URLSearchParams({ username: email, password }),
        });
      } catch (networkErr) {
        throw new Error(`Cannot reach the server at ${API}. Is the backend running?`);
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? 'Invalid credentials');
      }

      const data = await res.json();
      _token = data.access_token;

      const profileRes = await fetch(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${_token}` },
      });
      const profile: User = await profileRes.json();
      _user = profile;
      setToken(_token);
      setUser(profile);

      // ✅ Save to localStorage — survives refresh
      localStorage.setItem('ss_token', _token!);
      localStorage.setItem('ss_user',  JSON.stringify(profile));

    } finally {
      setLoading(false);
    }
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    setLoading(true);
    try {
      let res: Response;
      try {
        res = await fetch(`${API}/auth/signup`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ name, email, password }),
        });
      } catch (networkErr) {
        throw new Error(`Cannot reach the server at ${API}. Is the backend running?`);
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? 'Signup failed');
      }

      await login(email, password);
    } finally {
      setLoading(false);
    }
  }, [login]);

  const logout = useCallback(() => {
    _token = null;
    _user  = null;
    setToken(null);
    setUser(null);
    localStorage.removeItem('ss_token');
    localStorage.removeItem('ss_user');
  }, []);

  return { user, token, loading, login, signup, logout };
}