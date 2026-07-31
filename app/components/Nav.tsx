"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Reminder } from "@/lib/reminders";

const LINKS = [
  { href: "/", label: "Today" },
  { href: "/inbox", label: "Inbox" },
  { href: "/compose", label: "Hook Lab" },
  { href: "/queue", label: "Queue" },
  { href: "/replies", label: "Replies" },
  { href: "/growth", label: "Growth" },
  { href: "/coach", label: "Coach" },
  { href: "/top", label: "Top" },
];

const POLL_MS = 60_000;

export default function Nav() {
  const pathname = usePathname();
  const [alerts, setAlerts] = useState(0);

  // Badge the Today link with the count of high-priority reminders (due tweets,
  // streak at risk). Goal-independent, so no query param needed here.
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch("/api/reminders");
        if (!res.ok) return;
        const { reminders } = (await res.json()) as { reminders: Reminder[] };
        if (alive) setAlerts(reminders.filter((r) => r.priority === "high").length);
      } catch {
        // Offline / app restarting — leave the last known count.
      }
    }
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <nav className="nav">
      <span className="nav-brand">
        Cockpit<span className="dot">.</span>
      </span>
      {LINKS.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className={`nav-link${active ? " active" : ""}`}>
            {l.label}
            {l.href === "/" && alerts > 0 && (
              <span className="nav-badge" aria-label={`${alerts} urgent reminders`}>
                {alerts}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
