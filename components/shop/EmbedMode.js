"use client";

import { useEffect } from "react";

export default function EmbedMode() {
  useEffect(() => {
    const embed = new URLSearchParams(window.location.search).get("embed") === "1";
    document.documentElement.classList.toggle("embed-mode", embed);
    return () => document.documentElement.classList.remove("embed-mode");
  }, []);
  return null;
}
