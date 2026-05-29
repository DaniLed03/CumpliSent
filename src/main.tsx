import * as React from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./styles/index.css";
import "./app/cumplimientos-layer.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);


