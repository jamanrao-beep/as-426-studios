export const IST_OFFSET = 330 * 60 * 1000;

export function indiaDate(now = new Date()) {
  return new Date(now.getTime() + IST_OFFSET).toISOString().slice(0, 10);
}

export function yesterdayIndiaDate(now = new Date()) {
  return new Date(now.getTime() + IST_OFFSET - 86400000).toISOString().slice(0, 10);
}

export function dayRange(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw Error("Invalid date");
  const start = new Date(day + "T00:00:00+05:30");
  if (!Number.isFinite(start.getTime()) || indiaDate(start) !== day) throw Error("Invalid date");
  return { start: start.toISOString(), end: new Date(start.getTime() + 86400000).toISOString() };
}

export function monthRange(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw Error("Invalid month");
  const [y, m] = month.split("-").map(Number);
  if (y < 2020 || y > 2100) throw Error("Invalid month");
  return {
    start: dayRange(month + "-01").start,
    end: new Date(Date.UTC(y, m, 1) - IST_OFFSET).toISOString(),
    days: new Date(Date.UTC(y, m, 0)).getUTCDate(),
  };
}

export function lastMonth(now = new Date()) {
  const currentMonth = indiaDate(now).slice(0, 7);
  const [y, m] = currentMonth.split("-").map(Number);
  if (m === 1) {
    return `${y - 1}-12`;
  }
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

export function customDateRange(startDay: string, endDay: string) {
  const r1 = dayRange(startDay);
  const r2 = dayRange(endDay);
  if (r1.start > r2.end) {
    throw new Error("Start date must be before or equal to end date");
  }
  return {
    start: r1.start,
    end: r2.end,
    label: `${startDay} to ${endDay}`,
  };
}

export function orderTime(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatISTTime(value: string | Date = new Date()) {
  return new Date(value).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
