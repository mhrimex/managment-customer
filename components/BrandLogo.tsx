import React from "react";

/**
 * Company brand mark.
 * To use your own logo, replace /public/logo.svg (or point NEXT_PUBLIC_COMPANY_LOGO
 * at a PNG/SVG in /public, e.g. "/my-logo.png").
 */
export const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || "Reflection Solutions";
export const COMPANY_LOGO = process.env.NEXT_PUBLIC_COMPANY_LOGO || "/logo.svg";

interface BrandLogoProps {
  size?: number;
  showText?: boolean;
  subtitle?: string;
  className?: string;
}

export default function BrandLogo({
  size = 44,
  showText = true,
  subtitle = "Customer Management",
  className = "",
}: BrandLogoProps) {
  return (
    <div className={`flex items-center gap-3.5 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={COMPANY_LOGO}
        alt={`${COMPANY_NAME} logo`}
        width={size}
        height={size}
        className="shrink-0 rounded-2xl shadow-lg shadow-indigo-500/25 object-contain"
        style={{ width: size, height: size }}
      />
      {showText && (
        <div className="min-w-0 leading-tight">
          <div className="font-display font-extrabold text-lg tracking-tight text-white truncate">
            {COMPANY_NAME}
          </div>
          {subtitle && (
            <div className="text-sm text-slate-400 font-semibold tracking-wide truncate">
              {subtitle}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
