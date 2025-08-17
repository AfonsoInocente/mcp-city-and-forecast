import { createRoute, type RootRoute } from "@tanstack/react-router";
import { SimpleChat } from "@/components/simple-chat";

function HomePage() {
  return <SimpleChat />;
}

export default (parentRoute: RootRoute) =>
  createRoute({
    path: "/",
    component: HomePage,
    getParentRoute: () => parentRoute,
  });
