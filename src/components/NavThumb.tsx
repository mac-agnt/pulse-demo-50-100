import { useLayoutEffect, useRef } from "react";
import { css } from "../runtime/template";

type Props = {
  /** Static look of the pill (colour, radius, transition). */
  style: string;
  /** Changes whenever the tabs or the active tab change, so we re-measure. */
  tabsKey: string;
};

/* The sliding highlight under the active top-bar tab.
   It measures the real active button rather than assuming every tab is the
   same width, so it stays on its tab however many tabs there are and however
   long their labels get. Width and offset are written straight to the DOM:
   React never owns them, so nothing re-renders and there is no feedback loop. */
export default function NavThumb({ style, tabsKey }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);

  useLayoutEffect(() => {
    const thumb = ref.current;
    const group = thumb?.parentElement;
    if (!thumb || !group) return;

    const place = () => {
      const btn = group.querySelector<HTMLElement>('[data-nav-active="1"]');
      if (!btn) {
        thumb.style.opacity = "0";
        return;
      }
      // First placement jumps into position instead of sliding in from 0.
      const transition = thumb.style.transition;
      if (!placed.current) thumb.style.transition = "none";
      thumb.style.width = btn.offsetWidth + "px";
      thumb.style.transform = "translateX(" + btn.offsetLeft + "px)";
      thumb.style.opacity = "1";
      if (!placed.current) {
        void thumb.offsetWidth;
        thumb.style.transition = transition;
        placed.current = true;
      }
      // If the tabs overflow, keep the active one in view.
      const left = btn.offsetLeft;
      const right = left + btn.offsetWidth;
      if (left < group.scrollLeft) group.scrollLeft = left;
      else if (right > group.scrollLeft + group.clientWidth) group.scrollLeft = right - group.clientWidth;
    };

    place();
    // Re-measure when fonts load, the window resizes or a label changes width.
    const ro = new ResizeObserver(place);
    ro.observe(group);
    group.querySelectorAll("button").forEach((b) => ro.observe(b));
    return () => ro.disconnect();
  }, [tabsKey]);

  return <span ref={ref} style={css(style)} />;
}
