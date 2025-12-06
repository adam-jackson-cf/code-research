/**
 * TypeScript React Component Examples
 * Modern patterns with full type safety.
 */

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  createContext,
  useContext,
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";
import type { ReactNode, FormEvent, ChangeEvent, RefObject } from "react";

// ============================================================
// Types and Interfaces
// ============================================================

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ============================================================
// Generic List Component
// ============================================================

interface ListProps<T> {
  items: readonly T[];
  renderItem: (item: T, index: number) => ReactNode;
  keyExtractor: (item: T) => string;
  emptyMessage?: string;
  className?: string;
}

function List<T>({
  items,
  renderItem,
  keyExtractor,
  emptyMessage = "No items",
  className,
}: ListProps<T>) {
  if (items.length === 0) {
    return <div className="text-gray-500">{emptyMessage}</div>;
  }

  return (
    <ul className={className}>
      {items.map((item, index) => (
        <li key={keyExtractor(item)}>{renderItem(item, index)}</li>
      ))}
    </ul>
  );
}

// ============================================================
// User Card Component with Props
// ============================================================

interface UserCardProps {
  user: User;
  onSelect?: (user: User) => void;
  selected?: boolean;
  children?: ReactNode;
}

function UserCard({ user, onSelect, selected = false, children }: UserCardProps) {
  const handleClick = useCallback(() => {
    onSelect?.(user);
  }, [user, onSelect]);

  return (
    <div
      onClick={handleClick}
      className={`p-4 rounded-lg border ${
        selected ? "border-blue-500 bg-blue-50" : "border-gray-200"
      } cursor-pointer hover:shadow-md transition-shadow`}
    >
      <div className="flex items-center gap-3">
        {user.avatar && (
          <img
            src={user.avatar}
            alt={user.name}
            className="w-10 h-10 rounded-full"
          />
        )}
        <div>
          <h3 className="font-medium">{user.name}</h3>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// ============================================================
// Custom Hook: useAsync
// ============================================================

interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
}

function useAsync<T>(
  asyncFn: () => Promise<T>,
  deps: readonly unknown[] = []
): AsyncState<T> & { refetch: () => void } {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    isLoading: true,
  });

  const execute = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const data = await asyncFn();
      setState({ data, error: null, isLoading: false });
    } catch (error) {
      setState({
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
        isLoading: false,
      });
    }
  }, deps);

  useEffect(() => {
    execute();
  }, [execute]);

  return { ...state, refetch: execute };
}

// ============================================================
// Context with Type Safety
// ============================================================

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    // Simulate API call
    const response = await fetch("/api/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    const userData = await response.json();
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      login,
      logout,
    }),
    [user, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================================
// Form Component with Controlled Inputs
// ============================================================

interface FormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface LoginFormProps {
  onSubmit: (data: FormData) => void;
  isLoading?: boolean;
}

function LoginForm({ onSubmit, isLoading = false }: LoginFormProps) {
  const [formData, setFormData] = useState<FormData>({
    email: "",
    password: "",
    rememberMe: false,
  });

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const { name, value, type, checked } = e.target;
      setFormData((prev) => ({
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      }));
    },
    []
  );

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      onSubmit(formData);
    },
    [formData, onSubmit]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          required
          className="mt-1 block w-full rounded-md border-gray-300"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <input
          type="password"
          id="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          required
          className="mt-1 block w-full rounded-md border-gray-300"
        />
      </div>
      <div className="flex items-center">
        <input
          type="checkbox"
          id="rememberMe"
          name="rememberMe"
          checked={formData.rememberMe}
          onChange={handleChange}
          className="rounded border-gray-300"
        />
        <label htmlFor="rememberMe" className="ml-2 text-sm">
          Remember me
        </label>
      </div>
      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}

// ============================================================
// Forward Ref Component
// ============================================================

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
        <input
          ref={ref}
          className={`block w-full rounded-md border ${
            error ? "border-red-500" : "border-gray-300"
          } ${className}`}
          {...props}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

// ============================================================
// Imperative Handle
// ============================================================

interface ModalHandle {
  open: () => void;
  close: () => void;
}

interface ModalProps {
  title: string;
  children: ReactNode;
  onClose?: () => void;
}

const Modal = forwardRef<ModalHandle, ModalProps>(
  ({ title, children, onClose }, ref) => {
    const [isOpen, setIsOpen] = useState(false);

    useImperativeHandle(
      ref,
      () => ({
        open: () => setIsOpen(true),
        close: () => {
          setIsOpen(false);
          onClose?.();
        },
      }),
      [onClose]
    );

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full">
          <h2 className="text-xl font-bold mb-4">{title}</h2>
          {children}
        </div>
      </div>
    );
  }
);

Modal.displayName = "Modal";

// ============================================================
// Example Usage Component
// ============================================================

function App() {
  const modalRef = useRef<ModalHandle>(null);
  const { data: users, isLoading, error } = useAsync<User[]>(
    () => fetch("/api/users").then((r) => r.json()),
    []
  );

  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <AuthProvider>
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Users</h1>

        <List
          items={users ?? []}
          keyExtractor={(user) => user.id}
          renderItem={(user) => (
            <UserCard
              user={user}
              selected={selectedUser?.id === user.id}
              onSelect={setSelectedUser}
            />
          )}
          emptyMessage="No users found"
          className="space-y-4"
        />

        <button
          onClick={() => modalRef.current?.open()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
        >
          Open Modal
        </button>

        <Modal ref={modalRef} title="User Details">
          {selectedUser && (
            <div>
              <p>Name: {selectedUser.name}</p>
              <p>Email: {selectedUser.email}</p>
            </div>
          )}
          <button
            onClick={() => modalRef.current?.close()}
            className="mt-4 px-4 py-2 bg-gray-200 rounded"
          >
            Close
          </button>
        </Modal>
      </div>
    </AuthProvider>
  );
}

export {
  List,
  UserCard,
  useAsync,
  AuthProvider,
  useAuth,
  LoginForm,
  Input,
  Modal,
  App,
};
