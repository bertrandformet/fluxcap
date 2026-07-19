// Icônes SVG trait fin, cohérentes avec le design system (pas d'icon font).
// La couleur suit `currentColor` sauf iconCheck/iconPin qui encodent un état rempli/vide.

export function IconCheck({ filled, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden="true">
      <circle
        cx="11"
        cy="11"
        r="10"
        fill={filled ? "var(--tnv-success)" : "none"}
        stroke={filled ? "var(--tnv-success)" : "var(--tnv-text-muted)"}
        strokeWidth="1.6"
      />
      <path
        d="M6.5 11.2l2.8 2.8 6-6.4"
        fill="none"
        stroke={filled ? "#fff" : "transparent"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Coche seule (sans cercle), pour un badge/pastille déjà rond ailleurs (ex. sélection multiple).
export function IconCheckmark({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3 8.3l3.2 3.2L13 4.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconPin({ filled, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M10 1.6l2.35 5.02 5.53.62-4.1 3.78 1.13 5.46L10 13.75l-4.91 2.73 1.13-5.46-4.1-3.78 5.53-.62L10 1.6z"
        fill={filled ? "var(--tnv-accent)" : "none"}
        stroke={filled ? "var(--tnv-accent)" : "var(--tnv-text-muted)"}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconLoop({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 8a6 6 0 0110-4.2M16 12a6 6 0 01-10 4.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M14 2v3.2h-3.2M6 18v-3.2h3.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconTomato({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="13" r="7.2" fill="#E8483B" />
      <path d="M10 6.5v13M4 13h12" stroke="var(--tnv-text)" strokeWidth="0.6" strokeOpacity="0.15" />
      <polygon points="10,0.5 11.3,3.9 14.8,4 12,6.1 13,9.5 10,7.5 7,9.5 8,6.1 5.2,4 8.7,3.9" fill="#189067" />
    </svg>
  );
}

export function IconIgnore({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconBookmark({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M6 3h8v14l-4-3-4 3V3z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function IconArrowRight({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M4 10h10m0 0l-4-4m4 4l-4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconTrash({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M4 6h12M8 6V4.5a1 1 0 011-1h2a1 1 0 011 1V6m-7.5 0l.6 10.2a1.5 1.5 0 001.5 1.4h5.8a1.5 1.5 0 001.5-1.4L15.5 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconEdit({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M12.9 3.5l3.6 3.6-9 9-4 .8.8-4 9-9z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconDownload({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M10 3v10m0 0l-3.5-3.5M10 13l3.5-3.5M4 16.5h12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconColonneMasquer({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <rect x="2.5" y="4" width="15" height="12" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 4v12" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.5 7.5l-1.5 2.5 1.5 2.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconColonneSeule({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <rect x="2.5" y="4" width="15" height="12" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6 7.5l-2 2.5 2 2.5M14 7.5l2 2.5-2 2.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconPaperclip({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M13.5 6.5l-6 6a2.5 2.5 0 003.5 3.5l6-6a4 4 0 00-5.6-5.6l-6 6a5.5 5.5 0 007.8 7.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconPlay({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M6 4l10 6-10 6V4z" fill="currentColor" />
    </svg>
  );
}

export function IconPause({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <rect x="5" y="4" width="3.5" height="12" rx="1" fill="currentColor" />
      <rect x="11.5" y="4" width="3.5" height="12" rx="1" fill="currentColor" />
    </svg>
  );
}

export function IconSkip({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M5 4l8 6-8 6V4z" fill="currentColor" />
      <rect x="14" y="4" width="2" height="12" rx="1" fill="currentColor" />
    </svg>
  );
}

export function IconStop({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <rect x="5" y="5" width="10" height="10" rx="2" fill="currentColor" />
    </svg>
  );
}

export function IconSun({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M10 1.5v2M10 16.5v2M18.5 10h-2M3.5 10h-2M15.6 4.4l-1.4 1.4M5.8 14.2l-1.4 1.4M15.6 15.6l-1.4-1.4M5.8 5.8L4.4 4.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconMoon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M16.5 12.3A7 7 0 017.7 3.5a7 7 0 108.8 8.8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconDeconnexion({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M8 3H4.5a1 1 0 00-1 1v12a1 1 0 001 1H8M13 14l4-4-4-4M17 10H7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconChevronDown({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M5 8l5 5 5-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconCle({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="6" cy="14" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="6" cy="14" r="1" fill="currentColor" stroke="none" />
      <path
        d="M8.3 11.7L16.5 3.5M11.8 8.2l1.9 1.9M14.4 5.6l1.9 1.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
