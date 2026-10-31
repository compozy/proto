import "./theme.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { Root } from "./app/app";

const root = document.getElementById("root");
if (!root) throw new Error("The shell document has no #root");
createRoot(root).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
