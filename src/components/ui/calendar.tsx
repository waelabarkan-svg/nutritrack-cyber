"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-0 w-full max-w-full", className)}
      classNames={{
        months: "flex flex-col w-full",
        month: "space-y-4 w-full",
        caption: "flex justify-center pt-1 relative items-center mb-6",
        caption_label: "text-[10px] font-black uppercase tracking-[0.3em] text-primary neon-text-red",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 border-primary/30"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse flex flex-col",
        head: "w-full",
        head_row: "grid grid-cols-7 w-full mb-3",
        head_cell: "text-muted-foreground font-black text-[9px] uppercase tracking-widest text-center flex items-center justify-center h-8",
        tbody: "w-full flex flex-col gap-1",
        row: "grid grid-cols-7 w-full",
        cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 flex items-center justify-center aspect-square",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-full w-full p-0 font-black text-[10px] sm:text-xs aria-selected:opacity-100 hover:bg-primary/20 hover:text-primary rounded-none transition-all flex items-center justify-center"
        ),
        day_range_end: "day-range-end",
        day_selected: "bg-primary text-black hover:bg-primary hover:text-black focus:bg-primary focus:text-black shadow-[0_0_15px_rgba(253,224,71,0.5)]",
        day_today: "border border-accent/50 text-accent",
        day_outside: "day-outside text-muted-foreground/20 aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ...props }) => (
          <ChevronLeft className="h-4 w-4 text-primary" />
        ),
        IconRight: ({ ...props }) => (
          <ChevronRight className="h-4 w-4 text-primary" />
        ),
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
