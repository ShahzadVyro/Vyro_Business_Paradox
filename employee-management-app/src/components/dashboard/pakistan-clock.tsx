"use client";

import { useEffect, useState } from "react";

const formatter = new Intl.DateTimeFormat("en-PK", {
  timeZone: "Asia/Karachi",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});

const PakistanClock = () => {
  const [time, setTime] = useState<string>(() => formatter.format(new Date()));

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(formatter.format(new Date()));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <strong className="text-slate-900" suppressHydrationWarning>
      {time}
    </strong>
  );
};

export default PakistanClock;

