"use client";

import { useEffect } from "react";

/**
 * Scroll reveals for every [data-reveal] element. Only elements that start
 * below the fold are hidden, and only once this has run, so content is never
 * hidden from a reader without JavaScript or with reduced motion.
 *
 * A [data-reveal-group] reveals its [data-reveal] children together, in order,
 * when the group itself enters view.
 */
export function MotionRoot() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const root = document.documentElement;
    root.classList.add("motion");

    const belowFold = (element: Element) => element.getBoundingClientRect().top > window.innerHeight * 0.92;

    const groups = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal-group]"));
    const grouped = new Set<Element>();
    const targets: Array<{ trigger: HTMLElement; members: HTMLElement[] }> = [];

    // A member belongs to its nearest enclosing group only, so nested groups
    // (lines inside a file inside a step) keep their own order and timing.
    const ownerOf = (element: Element) => element.parentElement?.closest("[data-reveal-group]") ?? null;

    for (const group of groups) {
      const members = Array.from(group.querySelectorAll<HTMLElement>("[data-reveal]")).filter(
        (member) => ownerOf(member) === group
      );
      members.forEach((member, index) => {
        grouped.add(member);
        if (!member.style.getPropertyValue("--i")) {
          member.style.setProperty("--i", String(index));
        }
      });
      targets.push({ trigger: group, members });
    }
    for (const element of document.querySelectorAll<HTMLElement>("[data-reveal]")) {
      if (!grouped.has(element)) {
        targets.push({ trigger: element, members: [element] });
      }
    }

    const byTrigger = new Map<Element, HTMLElement[]>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }
          for (const member of byTrigger.get(entry.target) ?? []) {
            member.classList.remove("is-pending");
            member.classList.add("is-in");
          }
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
    );

    for (const { trigger, members } of targets) {
      if (!belowFold(trigger)) {
        continue;
      }
      members.forEach((member) => member.classList.add("is-pending"));
      byTrigger.set(trigger, members);
      observer.observe(trigger);
    }

    return () => {
      observer.disconnect();
      root.classList.remove("motion");
    };
  }, []);

  return null;
}
