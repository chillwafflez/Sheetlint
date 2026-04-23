/**
 * Inline SVG icon set — ported from the Claude Design export.
 *
 * Kept in-tree (rather than pulled from lucide-react) because the design
 * uses a small, deliberate set with a 1.4 stroke-width house style that
 * reads at the 12–14px sizes we paint them at.
 */

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Svg({ size = 14, children, ...props }: IconProps & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
      {...props}
    >
      <path
        d="M2.5 6.5l2.5 2.5 4.5-5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EyeOffIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2 2l12 12" strokeLinecap="round" />
      <path d="M6.5 6.5a2 2 0 002.83 2.83M3.5 4.5C2 5.8 1 8 1 8s2.5 5 7 5c1.1 0 2.1-.3 3-.7M13 12.2c1.2-1 2-2.2 2-2.2s-2.5-5-7-5c-.6 0-1.2.1-1.7.2" />
    </Svg>
  );
}

export function ArrowIcon(props: IconProps) {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      aria-hidden
      {...props}
    >
      <path d="M3 6h6M6 3l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowBackIcon(props: IconProps) {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      aria-hidden
      {...props}
    >
      <path d="M9 6H3m3 3L3 6l3-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" strokeLinecap="round" />
    </Svg>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      aria-hidden
      {...props}
    >
      <path
        d="M6 2v6M3.5 5.5L6 8l2.5-2.5M2 10h8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DocIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 2h6l3 3v9H3z" />
      <path d="M9 2v3h3" />
    </Svg>
  );
}

export function SparkleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M8 2v4M8 10v4M2 8h4M10 8h4M4 4l2 2M10 10l2 2M12 4l-2 2M6 10l-2 2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M2 13l3-4 3 2 4-6 2 3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M2 2v12h12" strokeLinecap="round" />
    </Svg>
  );
}

export function GridIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="2" y="2" width="5" height="5" />
      <rect x="9" y="2" width="5" height="5" />
      <rect x="2" y="9" width="5" height="5" />
      <rect x="9" y="9" width="5" height="5" />
    </Svg>
  );
}

export function ListIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M4 4h10M4 8h10M4 12h10M1.5 4v.01M1.5 8v.01M1.5 12v.01"
        strokeLinecap="round"
      />
    </Svg>
  );
}
