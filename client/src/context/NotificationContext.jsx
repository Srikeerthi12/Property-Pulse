import { createContext, useContext, useMemo, useState } from 'react';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [message, setMessage] = useState(null);

  const value = useMemo(
    () => ({
      message,
      notify: (text) => setMessage({ text, at: Date.now() }),
      clear: () => setMessage(null),
    }),
    [message],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider');
  return ctx;
}
