"use client"

import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface ThemeToggleProps {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div
        className={cn(
          "w-16 h-8 p-1 rounded-full bg-zinc-950 border border-zinc-800",
          className
        )}
      />
    )
  }

  const isDark = resolvedTheme === "dark"

  return (
    <div
      className={cn(
        "flex w-16 h-8 p-1 rounded-full cursor-pointer transition-colors duration-300",
        isDark
          ? "bg-zinc-950 border border-zinc-800"
          : "bg-white border border-zinc-200",
        className
      )}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      role="button"
      tabIndex={0}
    >
      <div className="relative w-full h-full">
        {/* Sliding Circle */}
        <motion.div
          className={cn(
            "absolute top-0 flex justify-center items-center w-6 h-6 rounded-full",
            isDark ? "bg-zinc-800" : "bg-gray-200"
          )}
          animate={{
            left: isDark ? 0 : "calc(100% - 24px)"
          }}
          transition={{
            type: "spring",
            stiffness: 150,
            damping: 20
          }}
        >
          {isDark ? (
            <Moon className="w-4 h-4 text-white" strokeWidth={1.5} />
          ) : (
            <Sun className="w-4 h-4 text-gray-700" strokeWidth={1.5} />
          )}
        </motion.div>

        {/* Background Icon */}
        <div className="absolute top-0 right-0 flex justify-center items-center w-6 h-6">
          {isDark && (
            <Sun className="w-4 h-4 text-gray-500" strokeWidth={1.5} />
          )}
        </div>
        <div className="absolute top-0 left-0 flex justify-center items-center w-6 h-6">
          {!isDark && (
            <Moon className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
          )}
        </div>
      </div>
    </div>
  )
}
