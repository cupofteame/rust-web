export interface Account {
  id: string;
  username: string;
  email: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  id: string;
  username: string;
  email: string;
  token: string;
}

const API_URL = 'http://localhost:8080/api';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

function getHeaders() {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  return headers;
}

export async function getAccounts(): Promise<Account[]> {
  const response = await fetch(`${API_URL}/accounts`, {
    headers: getHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to fetch accounts');
  }
  return response.json();
}

export async function deleteAccount(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/accounts/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete account');
  }
}

export async function register(data: RegisterRequest): Promise<Account> {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to register');
  }
  return response.json();
}

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to login');
  }
  return response.json();
} 