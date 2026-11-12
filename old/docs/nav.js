// Shared by the landing and the docs: the header's line once the page moves, the reading progress along the top, and
// the menus marked [data-follow] showing which section is on screen.
(() => {
  const header = document.querySelector(".top");
  const progress = document.querySelector(".progress");
  const menus = [...document.querySelectorAll("[data-follow]")];
  const links = menus.flatMap((menu) => [...menu.querySelectorAll('a[href^="#"]')]);
  const targets = [...new Set(links.map((link) => link.getAttribute("href").slice(1)))]
    .map((id) => document.getElementById(id))
    .filter((target) => target !== null);
  let frame = null;

  function update() {
    frame = null;

    const y = window.scrollY;
    const page = document.documentElement.scrollHeight - window.innerHeight;

    header?.classList.toggle("scrolled", y > 8);

    if (progress !== null) {
      progress.style.transform = `scaleX(${page > 0 ? Math.min(1, y / page) : 0})`;
    }

    // The current section is the last one whose top has passed under the header; at the very end of the page, the
    // last one, though its top may never get there.
    const line = (header?.offsetHeight ?? 0) + 48;
    const passed = targets.filter((target) => target.getBoundingClientRect().top <= line);
    // A contents list marked data-follow="first" shows its first entry before any section has passed.
    const first = menus.some((menu) => menu.dataset.follow === "first") ? targets[0] : undefined;
    const current = page > 0 && y >= page - 2 ? targets.at(-1) : (passed.at(-1) ?? first);

    for (const link of links) {
      const on = current !== undefined && link.getAttribute("href") === `#${current.id}`;

      link.classList.toggle("active", on);

      if (on) {
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
    }

    // A long contents column keeps its current link in sight, without moving the page.
    for (const menu of menus) {
      const active = menu.querySelector("a.active");

      if (active !== null && menu.scrollHeight > menu.clientHeight) {
        const top = active.offsetTop - menu.offsetTop;

        if (top < menu.scrollTop || top + active.offsetHeight > menu.scrollTop + menu.clientHeight) {
          menu.scrollTop = top - menu.clientHeight / 3;
        }
      }
    }
  }

  const schedule = () => {
    if (frame === null) {
      frame = requestAnimationFrame(update);
    }
  };

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  update();
})();
