import { registerRootComponent } from "expo";
import React from "react";
import { AuthProvider } from "./AuthContext.js";
import App from "./App.js";

function Root() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}

registerRootComponent(Root);