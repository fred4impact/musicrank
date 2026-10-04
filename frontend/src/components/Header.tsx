import { NavLink } from "react-router-dom";

const NAV_LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/songs", label: "Songs" },
  { to: "/rankings", label: "Rankings" },
];

export function Header() {
  return (
    <header className="border-b border-zinc-800">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <NavLink to="/" className="text-lg font-semibold tracking-tight text-zinc-50">
          Music<span className="text-amber-400">Rank</span>
        </NavLink>
        <nav className="flex gap-6">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `text-sm transition-colors ${isActive ? "text-zinc-50" : "text-zinc-400 hover:text-zinc-200"}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
