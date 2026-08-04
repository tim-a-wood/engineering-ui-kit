import React from "react";
import { createRoot } from "react-dom/client";
import Page from "../app/page";
import "../app/globals.css";

document.documentElement.style.setProperty("--font-geist-sans", "Inter, Arial, sans-serif");
document.documentElement.style.setProperty("--font-geist-mono", "SFMono-Regular, Consolas, monospace");

createRoot(document.getElementById("root")!).render(
  <React.StrictMode><Page /></React.StrictMode>,
);
