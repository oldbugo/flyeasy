"use client";

import { usePathname, useSearchParams } from "next/navigation";

type SessionCurrentPathInputProps = {
  fallback: string;
  name?: string;
};

export function SessionCurrentPathInput({
  fallback,
  name = "returnTo"
}: SessionCurrentPathInputProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const value = pathname ? `${pathname}${search ? `?${search}` : ""}` : fallback;

  return <input type="hidden" name={name} value={value} />;
}
