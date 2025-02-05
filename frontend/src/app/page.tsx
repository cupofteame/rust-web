'use client';

import { useState, useEffect } from 'react';
import { Account, getAccounts, createAccount, deleteAccount } from '@/lib/api';

export default function Home() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    try {
      const data = await getAccounts();
      setAccounts(data);
      setError('');
    } catch (err) {
      setError('Failed to load accounts');
    }
  }

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      await createAccount(username);
      setUsername('');
      await loadAccounts();
      setError('');
    } catch (err) {
      setError('Failed to create account');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteAccount(id: string) {
    try {
      await deleteAccount(id);
      await loadAccounts();
      setError('');
    } catch (err) {
      setError('Failed to delete account');
    }
  }

  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">Account Management</h1>
          <p className="text-foreground/60">I am messing around with rust!</p>
        </div>
        
        <form onSubmit={handleCreateAccount} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              className="input flex-1"
              required
              disabled={isLoading}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>

        {error && (
          <div className="p-4 rounded-lg bg-error-light text-error text-center">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {accounts.length === 0 ? (
            <p className="text-center text-foreground/60 py-8">
              No accounts found. Create one to get started!
            </p>
          ) : (
            accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between p-4 border border-border rounded-lg hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-medium">
                      {account.username[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium">{account.username}</span>
                    <span className="text-sm text-foreground/60 font-mono">{account.id}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteAccount(account.id)}
                  className="btn btn-danger"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
