'use client';

import { useState, useEffect } from 'react';
import { Account, getAccounts, deleteAccount, setAuthToken } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const { user, token, logout } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    if (token) {
      setAuthToken(token);
      loadAccounts();
    } else {
      router.push('/login');
    }
  }, [token, router]);

  async function loadAccounts() {
    if (accounts.length === 0) {
      setIsLoading(true);
    }
    
    try {
      const data = await getAccounts();
      setAccounts(data);
      setError('');
    } catch (err) {
      setError('Failed to load accounts');
      if (err instanceof Error && err.message.includes('Invalid token')) {
        logout();
        router.push('/login');
      }
    } finally {
      setIsLoading(false);
      setIsInitialLoad(false);
    }
  }

  async function handleDeleteAccount(id: string) {
    try {
      const wasCurrentUser = await deleteAccount(id);
      if (wasCurrentUser) {
        logout();
        router.push('/login');
      } else {
        await loadAccounts();
      }
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
      if (err instanceof Error && err.message.includes('Invalid token')) {
        logout();
        router.push('/login');
      }
    }
  }

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div className="text-center flex-1">
            <h1 className="text-4xl font-bold mb-2">Account Management</h1>
            <p className="text-foreground/60">I am messing around with rust!</p>
          </div>
          <div className="flex gap-4 items-center">
            {user ? (
              <>
                <span className="text-sm text-foreground/60">
                  Logged in as <strong>{user.username}</strong>
                </span>
                <button
                  onClick={handleLogout}
                  className="btn btn-secondary"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/register"
                  className="btn btn-secondary"
                >
                  Register
                </Link>
                <Link
                  href="/login"
                  className="btn btn-primary"
                >
                  Login
                </Link>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-error-light text-error text-center">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {isInitialLoad ? (
            <p className="text-center text-foreground/60 py-8">Loading accounts...</p>
          ) : accounts.length === 0 ? (
            <p className="text-center text-foreground/60 py-8">
              No accounts found. Register to get started!
            </p>
          ) : (
            <>
              {isLoading && (
                <div className="text-center text-foreground/60 text-sm py-2">
                  Refreshing...
                </div>
              )}
              {accounts.map((account) => (
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
                      <span className="text-sm text-foreground/60">{account.email}</span>
                      <span className="text-xs text-foreground/60 font-mono">{account.id}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteAccount(account.id)}
                    className="btn btn-danger"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
