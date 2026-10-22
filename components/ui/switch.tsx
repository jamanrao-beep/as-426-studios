"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  const isSm = size === "sm"
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        isSm ? "h-4 w-7" : "h-[22px] w-[40px]",
        "data-[state=checked]:bg-[#16a34a] data-[state=unchecked]:bg-[#dcd4cd] dark:data-[state=unchecked]:bg-[#4a382e]",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out",
          isSm
            ? "size-3 data-[state=checked]:translate-x-3 data-[state=unchecked]:translate-x-0"
            : "size-4 data-[state=checked]:translate-x-[18px] data-[state=unchecked]:translate-x-0.5",
          "dark:bg-white"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
