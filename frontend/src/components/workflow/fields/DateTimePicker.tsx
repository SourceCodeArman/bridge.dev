"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface DateTimePickerProps {
    value?: string
    onChange: (value: string) => void
    label?: string
    required?: boolean
    error?: string
    placeholder?: string
}

export default function DateTimePicker({
    value,
    onChange,
    label,
    required = false,
    error,
    placeholder = "Select date and time",
}: DateTimePickerProps) {
    const [open, setOpen] = React.useState(false)
    const [dateValue, setDateValue] = React.useState<Date | undefined>(
        value ? new Date(value) : undefined
    )
    const [timeValue, setTimeValue] = React.useState<string>(
        value ? format(new Date(value), "HH:mm") : "09:00"
    )

    // Get user's timezone
    const [timeZone, setTimeZone] = React.useState<string | undefined>(undefined)
    React.useEffect(() => {
        setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
    }, [])

    const handleDateSelect = (date: Date | undefined) => {
        if (!date) {
            setDateValue(undefined)
            onChange("")
            return
        }

        setDateValue(date)

        // Combine date with existing time
        const [hours, minutes] = timeValue.split(":").map(Number)
        const combined = new Date(date)
        combined.setHours(hours || 0, minutes || 0, 0, 0)

        // Format to ISO 8601 with timezone
        onChange(combined.toISOString())
        setOpen(false)
    }

    const handleTimeChange = (time: string) => {
        setTimeValue(time)

        if (!dateValue) return

        // Combine existing date with new time
        const [hours, minutes] = time.split(":").map(Number)
        const combined = new Date(dateValue)
        combined.setHours(hours || 0, minutes || 0, 0, 0)

        onChange(combined.toISOString())
    }

    return (
        <div className="space-y-2">
            {label && (
                <Label>
                    {label}
                    {required && <span className="text-destructive ml-1">*</span>}
                </Label>
            )}
            <div className="flex gap-2">
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            className={cn(
                                "w-full justify-start text-left font-normal",
                                !dateValue && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateValue ? format(dateValue, "PPP") : <span>{placeholder}</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={dateValue}
                            onSelect={handleDateSelect}
                            initialFocus
                            timeZone={timeZone}
                        />
                    </PopoverContent>
                </Popover>
                <Input
                    type="time"
                    value={timeValue}
                    onChange={(e) => handleTimeChange(e.target.value)}
                    className="w-32 dark:[&::-webkit-calendar-picker-indicator]:invert"
                />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    )
}
