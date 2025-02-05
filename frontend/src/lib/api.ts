export interface Account {
  id: string;
  username: string;
}

const API_URL = 'http://localhost:8080/api';

export async function getAccounts(): Promise<Account[]> {
  const response = await fetch(`${API_URL}/accounts`);
  if (!response.ok) {
    throw new Error('Failed to fetch accounts');
  }
  return response.json();
}

export async function createAccount(username: string): Promise<Account> {
  const response = await fetch(`${API_URL}/accounts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username }),
  });
  if (!response.ok) {
    throw new Error('Failed to create account');
  }
  return response.json();
}

export async function deleteAccount(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/accounts/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete account');
  }
} 