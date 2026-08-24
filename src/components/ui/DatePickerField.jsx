import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react-native";

import { cn } from "@/lib/utils";
import Text from "./Text";

// Custom-built rather than @react-native-community/datetimepicker: that module has no web
// platform support at all (iOS/Android/Windows only per its own docs), and this app ships a real
// web build (package.json's `web`/`build:web` scripts via react-native-web) — a native-only picker
// would leave the DOB field broken there. This one is plain View/Pressable/Text, so it renders
// identically everywhere the rest of the app's custom controls (SegmentedControl, etc.) do.

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

const pad = (n) => String(n).padStart(2, "0");

// Local-calendar-date formatting, deliberately not toISOString(): that converts to UTC, which
// shifts the date backward by a day for any local midnight east of UTC (this app's primary
// timezone, IST, included) — e.g. a picked "1 Jan" would round-trip as "31 Dec".
export function toDateOnlyString(date) {
  if (!date) return undefined;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDisplay(date) {
  return `${pad(date.getDate())} ${MONTH_LABELS[date.getMonth()].slice(0, 3)} ${date.getFullYear()}`;
}

function isSameDay(a, b) {
  return !!a && !!b
    && a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function stripTime(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// 6 rows x 7 cols, `null` for the leading/trailing blanks outside the month.
function buildMonthGrid(year, month) {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array(firstWeekday).fill(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function DatePickerField({
  value,
  onChange,
  placeholder = "Select date",
  minimumDate,
  maximumDate,
  className,
}) {
  const today = new Date();

  function isDisabled(date) {
    if (minimumDate && date < stripTime(minimumDate)) return true;
    if (maximumDate && date > stripTime(maximumDate)) return true;
    return false;
  }

  // A `value` outside [minimumDate, maximumDate] — e.g. legacy bad data saved before this picker
  // existed — must never seed which month/year the calendar opens on: that's how "January 112233"
  // happened, with the header stuck on a nonsense year the picker's own year list doesn't even
  // include. Treat it as if nothing were selected instead.
  const validValue = value && !isDisabled(stripTime(value)) ? value : null;

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("days"); // "days" | "years"
  const [viewYear, setViewYear] = useState((validValue ?? maximumDate ?? today).getFullYear());
  const [viewMonth, setViewMonth] = useState((validValue ?? maximumDate ?? today).getMonth());

  function openPicker() {
    const base = validValue ?? maximumDate ?? today;
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
    setMode("days");
    setOpen(true);
  }

  function changeMonth(delta) {
    let month = viewMonth + delta;
    let year = viewYear;
    if (month < 0) {
      month = 11;
      year -= 1;
    } else if (month > 11) {
      month = 0;
      year += 1;
    }
    setViewMonth(month);
    setViewYear(year);
  }

  function selectDay(day) {
    if (!day) return;
    const picked = new Date(viewYear, viewMonth, day);
    if (isDisabled(picked)) return;
    onChange(picked);
    setOpen(false);
  }

  const minYear = minimumDate ? minimumDate.getFullYear() : today.getFullYear() - 100;
  const maxYear = maximumDate ? maximumDate.getFullYear() : today.getFullYear();
  const years = [];
  for (let year = maxYear; year >= minYear; year--) years.push(year);

  const cells = buildMonthGrid(viewYear, viewMonth);

  return (
    <>
      <Pressable
        onPress={openPicker}
        className={cn(
          "h-12 w-full flex-row items-center justify-between rounded-2xl border border-border bg-white px-4",
          className,
        )}
      >
        <Text className={cn("text-[16px]", validValue ? "text-foreground" : "text-muted-foreground")}>
          {validValue ? formatDisplay(validValue) : placeholder}
        </Text>
        <Calendar size={18} color="#999999" />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          className="flex-1 items-center justify-center bg-black/30 px-6"
          onPress={() => setOpen(false)}
        >
          {/* Swallow taps so they don't bubble to the backdrop Pressable behind it. */}
          <Pressable className="w-full max-w-[340px] gap-4 rounded-[24px] bg-white p-5 shadow-lg shadow-black/20">
            {mode === "days" ? (
              <>
                <View className="flex-row items-center justify-between">
                  <Pressable
                    onPress={() => changeMonth(-1)}
                    className="size-9 items-center justify-center rounded-full bg-muted"
                  >
                    <ChevronLeft size={18} color="#333333" />
                  </Pressable>
                  <Pressable onPress={() => setMode("years")} className="rounded-full px-3 py-1.5">
                    <Text className="font-jakarta-semibold text-[15px] text-foreground">
                      {MONTH_LABELS[viewMonth]} {viewYear}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => changeMonth(1)}
                    className="size-9 items-center justify-center rounded-full bg-muted"
                  >
                    <ChevronRight size={18} color="#333333" />
                  </Pressable>
                </View>

                <View className="flex-row">
                  {WEEKDAY_LABELS.map((label, i) => (
                    <View key={i} className="w-[14.28%] items-center">
                      <Text className="text-xs font-jakarta-medium text-muted-foreground">{label}</Text>
                    </View>
                  ))}
                </View>

                <View className="flex-row flex-wrap">
                  {cells.map((day, i) => {
                    const cellDate = day ? new Date(viewYear, viewMonth, day) : null;
                    const selected = isSameDay(cellDate, validValue);
                    const disabled = !cellDate || isDisabled(cellDate);
                    return (
                      <View key={i} className="w-[14.28%] items-center py-1">
                        {day && (
                          <Pressable
                            onPress={() => selectDay(day)}
                            disabled={disabled}
                            className={cn("size-9 items-center justify-center rounded-full", selected && "bg-primary")}
                          >
                            <Text
                              className={cn(
                                "text-sm",
                                selected
                                  ? "font-jakarta-semibold text-white"
                                  : disabled
                                    ? "text-border-strong"
                                    : "text-foreground",
                              )}
                            >
                              {day}
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                </View>
              </>
            ) : (
              <>
                <Text className="text-center font-jakarta-semibold text-[15px] text-foreground">
                  Select year
                </Text>
                <ScrollView className="max-h-[260px]" contentContainerClassName="gap-1">
                  {years.map((year) => {
                    const selected = year === viewYear;
                    return (
                      <Pressable
                        key={year}
                        onPress={() => {
                          setViewYear(year);
                          setMode("days");
                        }}
                        className={cn("items-center rounded-xl py-2.5", selected && "bg-primary-tint")}
                      >
                        <Text
                          className={cn(
                            "text-[15px]",
                            selected ? "font-jakarta-semibold text-primary-hover" : "text-foreground",
                          )}
                        >
                          {year}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            )}

            <Pressable onPress={() => setOpen(false)} className="items-center rounded-full py-2">
              <Text className="font-jakarta-semibold text-sm text-muted-foreground">Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
