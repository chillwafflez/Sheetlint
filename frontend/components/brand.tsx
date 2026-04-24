import Link from "next/link";

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Sheetlint home">
      <span className="brand__mark">
        Sheet<span className="brand__dot" />lint
      </span>
      <span className="brand__tag">DATA QUALITY</span>
    </Link>
  );
}
