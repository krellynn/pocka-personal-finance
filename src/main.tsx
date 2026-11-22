import React from "react";
import ReactDOM from "react-dom/client";
import { AppProviders } from "./app/providers";
import { App } from "./app/App";
import "./i18n";
import "./styles/index.css";
const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Missing #root application mount.");
ReactDOM.createRoot(rootElement).render(<React.StrictMode><AppProviders><App /></AppProviders></React.StrictMode>);