import { AppProviders } from "./providers/AppProviders";
import { AppRouter } from "./router/router";

export function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}
