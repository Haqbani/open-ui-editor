// Tabler Icons, MIT, Copyright (c) 2020-2026 Paweł Kuna.
// Vendored from commit a4ce1404bc6d24d3c365afe7b258d6bf6f48d62d; license: public/icons/tabler/LICENSE.
import type { ReactNode } from "react";
import { HandleIcon } from "../blocks/handle-icons";
import { familyHeaderIcons } from "./family-header-icons";
import { insertionIcons } from "./insertion-icons";
import { measuredIcons } from "./measured-icons";

const paths: Record<string, ReactNode> = {
  Home: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12l-2 0l9 -9l9 9l-2 0" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7" />
      <path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6" />
    </g>
  ),
  Templates: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 4l-8 4l8 4l8 -4l-8 -4" />
      <path d="M4 12l8 4l8 -4" />
      <path d="M4 16l8 4l8 -4" />
    </g>
  ),
  "More actions": (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
      <path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
      <path d="M18 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    </g>
  ),
  Editor: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" />
      <path d="M13.5 6.5l4 4" />
    </g>
  ),
  Code: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 8l-4 4l4 4" />
      <path d="M17 8l4 4l-4 4" />
      <path d="M14 4l-4 16" />
    </g>
  ),
  Text: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 20l3 0" />
      <path d="M14 20l7 0" />
      <path d="M6.9 15l6.9 0" />
      <path d="M10.2 6.3l5.8 13.7" />
      <path d="M5 20l6 -16l2 0l7 16" />
    </g>
  ),
  Image: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 8h.01" />
      <path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12" />
      <path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" />
      <path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" />
    </g>
  ),
  Components: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12l3 3l3 -3l-3 -3l-3 3" />
      <path d="M15 12l3 3l3 -3l-3 -3l-3 3" />
      <path d="M9 6l3 3l3 -3l-3 -3l-3 3" />
      <path d="M9 18l3 3l3 -3l-3 -3l-3 3" />
    </g>
  ),
  Variables: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 4c-2.5 5 -2.5 10 0 16m14 -16c2.5 5 2.5 10 0 16m-10 -11h1c1 0 1 1 2.016 3.527c.984 2.473 .984 3.473 1.984 3.473h1" />
      <path d="M8 16c1.5 0 3 -2 4 -3.5s2.5 -3.5 4 -3.5" />
    </g>
  ),
  "Hide sidebar": (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12" />
      <path d="M9 4v16" />
      <path d="M15 10l-2 2l2 2" />
    </g>
  ),
  "Theme options": (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 21a9 9 0 0 1 0 -18c4.97 0 9 3.582 9 8c0 1.06 -.474 2.078 -1.318 2.828c-.844 .75 -1.989 1.172 -3.182 1.172h-2.5a2 2 0 0 0 -1 3.75a1.3 1.3 0 0 1 -1 2.25" />
      <path d="M7.5 10.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
      <path d="M11.5 7.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
      <path d="M15.5 10.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    </g>
  ),
  "Change text type": (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9l6 6l6 -6" />
    </g>
  ),
  "Clear color": (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6l-12 12" />
      <path d="M6 6l12 12" />
    </g>
  ),
  "Go to source": (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11.5 12a.5 .5 0 1 0 1 0a.5 .5 0 1 0 -1 0" fill="currentColor" />
      <path d="M5 12a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" />
      <path d="M12 3l0 2" />
      <path d="M3 12l2 0" />
      <path d="M12 19l0 2" />
      <path d="M19 12l2 0" />
    </g>
  ),
  "Add Link": (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5l0 14" />
      <path d="M5 12l14 0" />
    </g>
  ),
  "Remove Spacing": (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12l14 0" />
    </g>
  ),
  "Add Background": (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5l0 14" />
      <path d="M5 12l14 0" />
    </g>
  ),
  "Add Border": (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5l0 14" />
      <path d="M5 12l14 0" />
    </g>
  ),
};

export function Icon({ name, size = 16 }: { name: string; size?: number }) {
  if (name === "AI") return <HandleIcon name="Edit with AI" size={size} />;
  if (name === "Quote") return <HandleIcon name="Quote" size={size} />;
  if (name === "X (former Twitter)") name = "X (Twitter)";
  if (name === "Link Preview") name = "Social Links";
  return (
    <svg
      aria-hidden="true"
      fill="none"
      width={size}
      height={size}
      viewBox="0 0 24 24"
    >
      {insertionIcons[name] ??
        familyHeaderIcons[name] ??
        measuredIcons[name] ??
        paths[name]}
    </svg>
  );
}
