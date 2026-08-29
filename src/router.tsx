import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import AppShell from "./components/AppShell";
import Dashboard from "./routes/Dashboard";
import Suppliers from "./routes/Suppliers";
import TenderDetail from "./routes/TenderDetail";

const rootRoute = createRootRoute({ component: AppShell });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Dashboard,
});

const tenderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tenders/$tenderId",
  component: TenderDetail,
});

const suppliersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/suppliers",
  component: Suppliers,
});

const routeTree = rootRoute.addChildren([indexRoute, tenderRoute, suppliersRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
