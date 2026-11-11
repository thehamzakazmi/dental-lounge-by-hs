"use client";

import { ViewTransition } from "react";

export default function RootTemplate({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ViewTransition enter="route-enter" exit="route-exit" default="none">
      {children}
    </ViewTransition>
  );
}
