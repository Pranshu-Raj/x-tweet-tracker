"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Today" },
  { href: "/inbox", label: "Inbox" },
  { href: "/compose", label: "Hook Lab" },
  { href: "/queue", label: "Queue" },
  { href: "/replies", label: "Replies" },
  { href: "/growth", label: "Growth" },
  { href: "/top", label: "Top" },
];

export default function Nav() {
  const pathname = usePathname();
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
          </Link>
        );
      })}
    </nav>
  );
}
