"use client";

import {
  faCircleInfo,
  faClipboardList,
  faSquarePollVertical,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./top-nav.module.css";

const links = [
  {
    href: "/questionnaires",
    label: "Questionnaires",
    icon: faClipboardList,
  },
  {
    href: "/about",
    label: "About",
    icon: faCircleInfo,
  },
] as const;

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            <FontAwesomeIcon icon={faSquarePollVertical} />
          </span>
          <span className={styles.brandText}>Questionnaires</span>
        </Link>

        <nav aria-label="Primary" className={styles.nav}>
          <ul className={styles.list}>
            {links.map((link) => {
              const isActive =
                pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`${styles.link} ${isActive ? styles.linkActive : ""}`}
                  >
                    <FontAwesomeIcon
                      icon={link.icon}
                      className={styles.linkIcon}
                    />
                    <span>{link.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
