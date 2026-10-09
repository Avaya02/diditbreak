"use client";

import { useEffect, useRef, useState } from "react";

import { CopyCommand } from "./CopyCommand";
import { GitHubMark, Mark } from "./icons";
import styles from "./Nav.module.css";

const REPO = "https://github.com/Avaya02/diditbreak";

/**
 * Takes the theme of whichever section sits under it, so it inverts as the
 * page crosses from a light section into a dark one.
 */
export function Nav() {
  const ref = useRef<HTMLElement>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [scrolled, setScrolled] = useState(false);
  const [heroCta, setHeroCta] = useState(true);

  useEffect(() => {
    const cta = document.getElementById("hero-cta");
    if (!cta) {
      setHeroCta(false);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setHeroCta(Boolean(entry?.isIntersecting)), {
      rootMargin: "-64px 0px 0px 0px"
    });
    observer.observe(cta);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const probe = (ref.current?.offsetHeight ?? 64) / 2;
      setScrolled(window.scrollY > 8);
      for (const section of document.querySelectorAll<HTMLElement>("[data-theme]")) {
        if (section === ref.current) {
          continue;
        }
        const box = section.getBoundingClientRect();
        if (box.top <= probe && box.bottom > probe) {
          setTheme(section.dataset.theme === "dark" ? "dark" : "light");
          return;
        }
      }
    };
    const schedule = () => {
      if (!frame) {
        frame = window.requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header ref={ref} className={styles.nav} data-theme={theme} data-scrolled={scrolled} data-cta={heroCta ? "hero" : "nav"}>
      <div className={`wrap ${styles.inner}`}>
        <a className={styles.brand} href="#top" aria-label="diditbreak, back to top">
          <Mark />
          <span>diditbreak</span>
        </a>
        <nav className={styles.links} aria-label="Sections">
          <a href="#run">The run</a>
          <a href="#how">How it works</a>
          <a href="#numbers">Statistics</a>
          <a href="#evidence">Evidence</a>
        </nav>
        <div className={styles.actions}>
          <div className={styles.copy}>
            <CopyCommand command="npx diditbreak init --demo" />
          </div>
          <a className={styles.github} href={REPO} target="_blank" rel="noreferrer">
            <GitHubMark />
            <span>GitHub</span>
          </a>
        </div>
      </div>
    </header>
  );
}
