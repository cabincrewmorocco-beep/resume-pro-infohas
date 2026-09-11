import React from "react";
import { useApp } from "@/lib/store";

export default function Link({
  href,
  children,
  className,
  onClick,
  ...props
}: {
  href: string;
  children?: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  [key: string]: any;
}) {
  const setView = useApp((s) => s.setView);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onClick) onClick(e);
    if (!e.defaultPrevented && (href === "/" || href === "#" || href.startsWith("/#"))) {
      e.preventDefault();
      setView("landing");
    }
  };

  return (
    <a href={href} className={className} onClick={handleClick} {...props}>
      {children}
    </a>
  );
}
