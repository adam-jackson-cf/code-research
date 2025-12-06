# React TypeScript Patterns Reference

Modern React patterns with TypeScript.

## Component Patterns

### Function Components

```typescript
// Basic props
interface GreetingProps {
  name: string;
  greeting?: string;
}

function Greeting({ name, greeting = "Hello" }: GreetingProps) {
  return <h1>{greeting}, {name}!</h1>;
}

// With children
interface CardProps {
  title: string;
  children: React.ReactNode;
}

function Card({ title, children }: CardProps) {
  return (
    <div className="card">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
```

### Generic Components

```typescript
interface ListProps<T> {
  items: readonly T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T) => string;
}

function List<T>({ items, renderItem, keyExtractor }: ListProps<T>) {
  return (
    <ul>
      {items.map((item, index) => (
        <li key={keyExtractor(item)}>{renderItem(item, index)}</li>
      ))}
    </ul>
  );
}

// Usage
<List
  items={users}
  keyExtractor={(user) => user.id}
  renderItem={(user) => <UserCard user={user} />}
/>
```

### Polymorphic Components

```typescript
type AsProp<C extends React.ElementType> = {
  as?: C;
};

type PropsToOmit<C extends React.ElementType, P> = keyof (AsProp<C> & P);

type PolymorphicProps<
  C extends React.ElementType,
  Props = {}
> = React.PropsWithChildren<Props & AsProp<C>> &
  Omit<React.ComponentPropsWithoutRef<C>, PropsToOmit<C, Props>>;

interface ButtonOwnProps {
  variant?: "primary" | "secondary";
}

type ButtonProps<C extends React.ElementType = "button"> = PolymorphicProps<
  C,
  ButtonOwnProps
>;

function Button<C extends React.ElementType = "button">({
  as,
  variant = "primary",
  children,
  ...props
}: ButtonProps<C>) {
  const Component = as || "button";
  return (
    <Component className={`btn btn-${variant}`} {...props}>
      {children}
    </Component>
  );
}

// Usage
<Button>Click me</Button>
<Button as="a" href="/home">Go home</Button>
<Button as={Link} to="/about">About</Button>
```

## Hooks

### Custom Hooks

```typescript
// State hook with initialization
function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch {
      return initialValue
    }
  })

  const setValue = (value: T | ((prev: T) => T)) => {
    const valueToStore = value instanceof Function ? value(storedValue) : value
    setStoredValue(valueToStore)
    window.localStorage.setItem(key, JSON.stringify(valueToStore))
  }

  return [storedValue, setValue]
}
```

### Async Hook

```typescript
interface UseAsyncState<T> {
  data: T | null
  error: Error | null
  loading: boolean
}

function useAsync<T>(
  asyncFunction: () => Promise<T>,
  dependencies: unknown[] = [],
): UseAsyncState<T> {
  const [state, setState] = useState<UseAsyncState<T>>({
    data: null,
    error: null,
    loading: true,
  })

  useEffect(() => {
    let cancelled = false

    setState((prev) => ({ ...prev, loading: true }))

    asyncFunction()
      .then((data) => {
        if (!cancelled) {
          setState({ data, error: null, loading: false })
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState({ data: null, error, loading: false })
        }
      })

    return () => {
      cancelled = true
    }
  }, dependencies)

  return state
}
```

### Event Handler Hook

```typescript
function useEventCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
): T {
  const ref = useRef(callback)

  useLayoutEffect(() => {
    ref.current = callback
  })

  return useCallback((...args: Parameters<T>) => {
    return ref.current(...args)
  }, []) as T
}
```

## Context

### Typed Context

```typescript
interface AuthContextType {
  user: User | null;
  login: (credentials: Credentials) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const login = async (credentials: Credentials) => {
    setIsLoading(true);
    const user = await authService.login(credentials);
    setUser(user);
    setIsLoading(false);
  };

  const logout = () => {
    setUser(null);
    authService.logout();
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}
```

### Reducer Context

```typescript
type State = { count: number };

type Action =
  | { type: "INCREMENT" }
  | { type: "DECREMENT" }
  | { type: "SET"; payload: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "INCREMENT":
      return { count: state.count + 1 };
    case "DECREMENT":
      return { count: state.count - 1 };
    case "SET":
      return { count: action.payload };
  }
}

interface CounterContextType {
  state: State;
  dispatch: React.Dispatch<Action>;
}

const CounterContext = createContext<CounterContextType | null>(null);

function CounterProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { count: 0 });
  return (
    <CounterContext.Provider value={{ state, dispatch }}>
      {children}
    </CounterContext.Provider>
  );
}
```

## Event Handlers

### Form Events

```typescript
function Form() {
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const data = Object.fromEntries(formData);
    console.log(data);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log(event.target.value);
  };

  const handleSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    console.log(event.target.value);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="text" onChange={handleChange} />
      <select onChange={handleSelect}>
        <option value="a">A</option>
        <option value="b">B</option>
      </select>
      <button type="submit">Submit</button>
    </form>
  );
}
```

### Mouse and Keyboard Events

```typescript
function Interactive() {
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    console.log(event.clientX, event.clientY);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      console.log("Enter pressed");
    }
  };

  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    event.target.select();
  };

  return (
    <div>
      <button onClick={handleClick}>Click me</button>
      <input onKeyDown={handleKeyDown} onFocus={handleFocus} />
    </div>
  );
}
```

## Ref Patterns

### DOM Refs

```typescript
function FocusInput() {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.focus();
  };

  return (
    <div>
      <input ref={inputRef} />
      <button onClick={handleClick}>Focus</button>
    </div>
  );
}
```

### Forwarding Refs

```typescript
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, ...props }, ref) => {
    return (
      <label>
        {label}
        <input ref={ref} {...props} />
      </label>
    );
  }
);

Input.displayName = "Input";
```

### Imperative Handle

```typescript
interface ModalHandle {
  open: () => void;
  close: () => void;
}

interface ModalProps {
  title: string;
  children: React.ReactNode;
}

const Modal = forwardRef<ModalHandle, ModalProps>(
  ({ title, children }, ref) => {
    const [isOpen, setIsOpen] = useState(false);

    useImperativeHandle(ref, () => ({
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
    }));

    if (!isOpen) return null;

    return (
      <div className="modal">
        <h2>{title}</h2>
        {children}
      </div>
    );
  }
);

// Usage
function App() {
  const modalRef = useRef<ModalHandle>(null);

  return (
    <>
      <button onClick={() => modalRef.current?.open()}>Open</button>
      <Modal ref={modalRef} title="Hello">
        Modal content
      </Modal>
    </>
  );
}
```

## Render Props

```typescript
interface RenderProps<T> {
  data: T;
  isLoading: boolean;
  error: Error | null;
}

interface DataFetcherProps<T> {
  url: string;
  children: (props: RenderProps<T>) => React.ReactNode;
}

function DataFetcher<T>({ url, children }: DataFetcherProps<T>) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetch(url)
      .then((res) => res.json())
      .then(setData)
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, [url]);

  return <>{children({ data: data as T, isLoading, error })}</>;
}

// Usage
<DataFetcher<User[]> url="/api/users">
  {({ data, isLoading, error }) => {
    if (isLoading) return <Spinner />;
    if (error) return <Error message={error.message} />;
    return <UserList users={data} />;
  }}
</DataFetcher>
```

## Error Boundaries

```typescript
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback: React.ReactNode | ((error: Error) => React.ReactNode)
}

class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught:", error, errorInfo)
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const { fallback } = this.props
      return typeof fallback === "function"
        ? fallback(this.state.error)
        : fallback
    }

    return this.props.children
  }
}
```

## Compound Components

```typescript
interface TabsContextType {
  activeTab: string;
  setActiveTab: (id: string) => void;
}

const TabsContext = createContext<TabsContextType | null>(null);

interface TabsProps {
  defaultTab: string;
  children: React.ReactNode;
}

function Tabs({ defaultTab, children }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className="tabs">{children}</div>
    </TabsContext.Provider>
  );
}

interface TabProps {
  id: string;
  children: React.ReactNode;
}

function Tab({ id, children }: TabProps) {
  const context = useContext(TabsContext);
  if (!context) throw new Error("Tab must be used within Tabs");

  const { activeTab, setActiveTab } = context;

  return (
    <button
      className={activeTab === id ? "active" : ""}
      onClick={() => setActiveTab(id)}
    >
      {children}
    </button>
  );
}

function TabPanel({ id, children }: TabProps) {
  const context = useContext(TabsContext);
  if (!context) throw new Error("TabPanel must be used within Tabs");

  return context.activeTab === id ? <div>{children}</div> : null;
}

Tabs.Tab = Tab;
Tabs.Panel = TabPanel;

// Usage
<Tabs defaultTab="one">
  <Tabs.Tab id="one">Tab 1</Tabs.Tab>
  <Tabs.Tab id="two">Tab 2</Tabs.Tab>
  <Tabs.Panel id="one">Content 1</Tabs.Panel>
  <Tabs.Panel id="two">Content 2</Tabs.Panel>
</Tabs>
```

## External Resources

- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
- [React Documentation](https://react.dev/)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Radix Primitives](https://www.radix-ui.com/primitives)
