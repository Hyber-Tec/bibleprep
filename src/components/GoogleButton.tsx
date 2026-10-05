"use client";

import type { ReactNode } from "react";
import { FcGoogle } from "react-icons/fc";
import { Button } from "@/components/ui/button";

/** The Google button shared by the log in and sign up pages. */
export default function GoogleButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button type="button" variant="outline" className="w-full" disabled={disabled} onClick={onClick}>
      <FcGoogle data-icon="inline-start" />
      {children}
    </Button>
  );
}
