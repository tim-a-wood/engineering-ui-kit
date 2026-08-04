import React from "react";
import { createRoot } from "react-dom/client";
import Page from "../app/page";
import "../app/globals.css";

document.documentElement.style.setProperty(
  "--resource-samples-image",
  `url('${import.meta.env.BASE_URL}resource-samples.png')`,
);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode><Page /></React.StrictMode>,
);
