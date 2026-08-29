import { RouterProvider } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import SignIn from "./SignIn";
import { FullPageLoader } from "./components/ui";
import { router } from "./router";

// Auth gate: loading -> spinner, signed out -> sign in, signed in -> the routed app.
export default function App() {
  return (
    <>
      <AuthLoading>
        <FullPageLoader />
      </AuthLoading>
      <Unauthenticated>
        <SignIn />
      </Unauthenticated>
      <Authenticated>
        <RouterProvider router={router} />
      </Authenticated>
    </>
  );
}
