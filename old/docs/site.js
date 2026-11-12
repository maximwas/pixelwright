// The landing's behaviour. One living moment: the stage in the hero, where an agent works in a Figma file, one task
// after another, for as long as the stage is on screen. Everything else comes in once, as it comes into view. People
// who ask for less motion, or whose browser runs no scripts, see the first task finished.
const Motion = window.Motion;
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const ease = [0.22, 1, 0.36, 1];
const glide = [0.45, 0, 0.25, 1];

function copyButtons() {
  for (const button of document.querySelectorAll("[data-copy]")) {
    button.addEventListener("click", async () => {
      const text = document.getElementById(button.dataset.copy)?.textContent ?? "";

      if (Motion !== undefined && !reduced) {
        Motion.animate(button, { scale: [0.92, 1] }, { type: "spring", stiffness: 500, damping: 15 });
      }

      try {
        await navigator.clipboard.writeText(text);
        button.textContent = "Copied";
        button.dataset.copied = "";
      } catch {
        button.textContent = "Select and copy";
      }

      setTimeout(() => {
        button.textContent = "Copy";
        delete button.dataset.copied;
      }, 1600);
    });
  }
}

/** The headline's selected phrase shows its size, as Figma does under a selection. */
function measureSelection() {
  const phrase = document.querySelector(".selected-phrase");

  if (phrase === null) {
    return;
  }

  const show = () => {
    phrase.dataset.size = `${Math.round(phrase.offsetWidth)} × ${Math.round(phrase.offsetHeight)}`;
  };

  new ResizeObserver(show).observe(phrase);
  show();
}

/** The plugin's window in Safety: the switch decides whether a write goes through. */
function safetyDemo() {
  const toggle = document.querySelector("[data-allow]");
  const log = document.querySelector("[data-demo-log]");
  const hint = document.querySelector("[data-demo-hint]");

  if (toggle === null || log === null || hint === null) {
    return;
  }

  toggle.addEventListener("click", () => {
    const on = toggle.getAttribute("aria-pressed") !== "true";
    const line = document.createElement("li");

    toggle.setAttribute("aria-pressed", String(on));
    hint.textContent = on
      ? "On for this file: each call that writes is one undo step."
      : "Off: the plugin refuses every write.";
    line.className = on ? "applied" : "refused";
    line.innerHTML = on
      ? "<b>design_apply</b> applied: 1 layer, 1 undo step"
      : "<b>design_apply</b> refused: Allow edits is off";
    log.prepend(line);

    while (log.children.length > 5) {
      log.lastElementChild.remove();
    }

    if (Motion !== undefined && !reduced) {
      Motion.animate(line, { opacity: [0, 1], y: [-6, 0] }, { duration: 0.3, ease });
    }
  });
}

function intro({ animate, inView, stagger }) {
  animate("[data-intro]", { opacity: [0, 1], y: [18, 0] }, { delay: stagger(0.1, { startDelay: 0.1 }), duration: 0.8, ease });
  setTimeout(() => document.querySelector(".selected-phrase")?.classList.add("drawn"), 800);

  for (const group of document.querySelectorAll("[data-reveal]")) {
    inView(
      group,
      () => {
        // An array: Motion takes an HTMLCollection (children) for one plain object and animates nothing.
        animate([...group.children], { opacity: [0, 1], y: [20, 0] }, { delay: stagger(0.08), duration: 0.6, ease });
      },
      { amount: 0.15 },
    );
  }
}

/**
 * How it works: a layer of the design and its lines of XML light up together, one after another while on screen;
 * pointing at either shows its pair.
 */
function mapping({ animate, inView }) {
  const root = document.querySelector("[data-mapping]");

  if (root === null) {
    return;
  }

  const canvas = root.querySelector(".map-canvas");
  const selection = root.querySelector("[data-map-selection]");
  const size = root.querySelector("[data-map-size]");
  const layers = Object.fromEntries([...canvas.querySelectorAll("[data-map]")].map((node) => [node.dataset.map, node]));
  const lines = [...root.querySelectorAll(".xl")];
  const order = ["card", "head", "name", "badge", "price", "list", "button"];
  const components = new Set(["badge", "button"]);
  let step = 0;
  let timer = null;
  let pointing = false;

  const show = (key) => {
    const a = layers[key].getBoundingClientRect();
    const b = canvas.getBoundingClientRect();
    const to = { x: a.left - b.left - 3, y: a.top - b.top - 3, width: a.width + 6, height: a.height + 6 };

    selection.classList.toggle("component", components.has(key));
    size.textContent = `${Math.round(a.width)} × ${Math.round(a.height)}`;

    if (selection.hidden) {
      selection.hidden = false;
      animate(selection, to, { duration: 0 });
      animate(selection, { opacity: [0, 1] }, { duration: 0.25 });
    } else {
      animate(selection, to, { type: "spring", stiffness: 380, damping: 34 });
    }

    for (const line of lines) {
      line.classList.toggle("on", line.dataset.map === key);
      line.classList.toggle("component", components.has(line.dataset.map));
    }
  };
  const next = () => {
    if (!pointing) {
      show(order[step % order.length]);
      step += 1;
    }
  };
  const play = () => {
    next();
    timer = setInterval(next, 1500);
  };
  const pause = () => {
    clearInterval(timer);
    timer = null;
  };

  for (const element of [...Object.values(layers), ...lines]) {
    element.addEventListener("mouseenter", (event) => {
      pointing = true;
      event.stopPropagation();
      show(element.dataset.map);
    });
    element.addEventListener("mouseleave", () => {
      pointing = false;
    });
  }

  inView(
    root,
    () => {
      play();
      root.parentElement.querySelector(".chain")?.classList.add("live");

      return () => {
        pause();
        root.parentElement.querySelector(".chain")?.classList.remove("live");
      };
    },
    { amount: 0.35 },
  );
}

/** Questions open and close at their own height. */
function questions({ animate }) {
  for (const details of document.querySelectorAll(".faq details")) {
    const summary = details.querySelector("summary");
    const answer = details.querySelector(".answer");

    summary?.addEventListener("click", async (event) => {
      if (answer === null) {
        return;
      }

      event.preventDefault();

      if (details.open) {
        await animate(answer, { height: [answer.offsetHeight, 0], opacity: [1, 0] }, { duration: 0.28, ease });
        details.open = false;
        answer.style.removeProperty("height");
        answer.style.removeProperty("opacity");

        return;
      }

      details.open = true;

      const height = answer.offsetHeight;

      await animate(answer, { height: [0, height], opacity: [0, 1] }, { duration: 0.36, ease });
      answer.style.removeProperty("height");
    });
  }
}

/** Without motion: the first task done, its button selected. */
function showFinished() {
  document.querySelector(".selected-phrase")?.classList.add("drawn");

  const root = document.querySelector(".stage");
  const canvas = root?.querySelector(".canvas");
  const button = root?.querySelector('[data-node="button"]');
  const selection = root?.querySelector("[data-selection]");
  const label = root?.querySelector("[data-selection-label]");

  if (canvas == null || button == null || selection == null || label == null) {
    return;
  }

  const place = () => {
    const a = button.getBoundingClientRect();
    const b = canvas.getBoundingClientRect();

    selection.hidden = false;
    selection.classList.add("component");
    label.textContent = `${Math.round(a.width)} × ${Math.round(a.height)}`;
    Object.assign(selection.style, {
      left: `${a.left - b.left - 2}px`,
      top: `${a.top - b.top - 2}px`,
      width: `${a.width + 4}px`,
      height: `${a.height + 4}px`,
    });
  };

  new ResizeObserver(place).observe(canvas);
  place();
  root.querySelector('[data-layer="button"]')?.classList.add("active");
}

/** The tasks the stage plays, each in its own file and client. */
const SCENES = [
  {
    board: "pricing",
    client: "Claude Code",
    path: "~/orbit",
    file: "Orbit — Pricing",
    layers: [
      ["card", "frame", "Pro", 0],
      ["head", "frame", "Header", 1],
      ["badge", "instance", "Badge", 1],
      ["price", "text", "Price", 1],
      ["list", "frame", "Features", 1],
      ["button", "instance", "Button / Primary", 1],
    ],
    reset(board) {
      board.querySelector('[data-text="button"]').textContent = "Get started";
    },
    async play(s, board) {
      await s.ask("Build the Pro plan card from Figma with our components.");
      await s.call("design_read", "Pricing / Pro", "card");
      await s.walk(["head", "badge", "price", "list", "button"]);
      await s.back("XML", "card");
      await s.done("PlanCard.tsx: your <code>&lt;Button&gt;</code> and <code>--brand</code>");
      await s.ask("Make the button say “Start free trial”.");
      await s.call("design_apply", "1 layer changed", "button");
      await s.change(() => s.swap(board.querySelector('[data-text="button"]'), "Start free trial"));
      await s.done("Changed in the file: 1 undo step");
    },
  },
  {
    board: "signin",
    client: "Cursor",
    path: "~/halo",
    file: "Halo — App",
    layers: [
      ["screen", "frame", "Sign in", 0],
      ["logo", "frame", "Logo", 1],
      ["title", "text", "Welcome back", 1],
      ["email", "instance", "Input / Email", 1],
      ["cta", "instance", "Button / Primary", 1],
      ["tokens", "variables", "Theme: Light, Dark", 0],
    ],
    reset(board) {
      board.querySelector(".phone").classList.remove("dark");
      for (const mode of board.querySelectorAll(".mode")) {
        mode.classList.toggle("on", mode.dataset.mode === "light");
      }
    },
    async play(s, board) {
      await s.ask("Our app needs a dark mode. Add it to the theme.");
      await s.call("tokens_read", "Theme", "tokens");
      await s.back("CSS", "tokens");
      await s.done("14 variables: <code>--surface</code>, <code>--text</code>, <code>--brand</code>…");
      await s.call("tokens_apply", "mode “Dark”, 14 values", "screen");
      await s.change(() => {
        board.querySelector(".phone").classList.add("dark");
        for (const mode of board.querySelectorAll(".mode")) {
          mode.classList.toggle("on", mode.dataset.mode === "dark");
        }
      });
      await s.done("Dark mode in the file: 1 undo step");
    },
  },
  {
    board: "dashboard",
    client: "Codex",
    path: "~/pulse",
    file: "Pulse — Dashboard",
    layers: [
      ["row", "frame", "Stats (auto layout)", 0],
      ["revenue", "instance", "Stat / Revenue", 1],
      ["users", "instance", "Stat / Active users", 1],
    ],
    reset(board) {
      const card = board.querySelector(".stat-new");

      card.removeAttribute("style");
      card.style.display = "none";
    },
    async play(s, board) {
      await s.ask("Add a churn card next to active users.");
      await s.call("design_read", "Stats", "row");
      await s.walk(["revenue", "users"]);
      await s.back("XML", "row");
      await s.call("design_apply", "+ Instance “Stat”", "row");
      await s.change(async () => {
        const card = board.querySelector(".stat-new");

        card.style.display = "";
        s.addLayer(["churn", "instance", "Stat / Churn", 1]);
        await s.animate(
          card,
          { width: [0, 96], paddingLeft: [0, 11], paddingRight: [0, 11], opacity: [0, 1] },
          { duration: 0.7, ease },
        );
      });
      s.select("churn");
      await s.done("Added to the auto layout row: 1 undo step");
    },
  },
  {
    board: "kit",
    client: "Claude Code",
    path: "~/kit",
    file: "Kit — Components",
    layers: [
      ["set", "component", "Button", 0],
      ["primary", "variant", "Type=Primary", 1],
      ["secondary", "variant", "Type=Secondary", 1],
      ["ghost", "variant", "Type=Ghost", 1],
    ],
    reset() {},
    async play(s) {
      await s.ask("Which component in our code is this button?");
      await s.call("design_read", "Button / Primary", "primary");
      await s.back("XML", "primary");
      await s.done('<code>$code="Button"</code>, from Button.figma.ts');
      await s.code('&lt;Button variant="primary"&gt;Get started&lt;/Button&gt;');
      await s.wait(0.8);
    },
  },
];

const COMPONENT_KINDS = new Set(["instance", "component", "variant"]);

function stage({ animate, inView }) {
  const root = document.querySelector(".stage");

  if (root === null) {
    return;
  }

  const find = (selector) => root.querySelector(selector);
  const canvas = find(".canvas");
  const selection = find("[data-selection]");
  const selectionLabel = find("[data-selection-label]");
  const cursor = find("[data-cursor]");
  const cursorLabel = find("[data-cursor-label]");
  const term = find(".term");
  const lines = find("[data-term]");
  const client = find("[data-client]");
  const termPath = find(".term-path");
  const file = find("[data-file]");
  const layers = find("[data-layers]");
  const noodle = find("[data-noodle]");
  const noodleEnd = find("[data-noodle-end]");
  const packet = find("[data-packet]");
  const boards = Object.fromEntries(
    [...root.querySelectorAll("[data-artboard]")].map((board) => [board.dataset.artboard, board]),
  );
  const STOP = Symbol("stop");
  let board = boards.pricing;
  let scene = SCENES[0];
  let run = 0;
  let index = 0;
  let visible = false;

  /** Where an element is, inside another one's box. */
  const within = (element, box) => {
    const a = element.getBoundingClientRect();
    const b = box.getBoundingClientRect();

    return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height };
  };

  /** What a scene can do; every step stops the scene when the stage has gone off screen. */
  function steps(id) {
    const check = () => {
      if (id !== run) {
        throw STOP;
      }
    };
    const wait = async (seconds) => {
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      check();
    };
    const node = (key) => board.querySelector(`[data-node="${key}"]`);
    const layer = (key) => scene.layers.find(([name]) => name === key) ?? [key, "frame", key, 0];
    const line = (kind, html) => {
      const item = document.createElement("li");

      item.className = kind;
      item.innerHTML = html;
      lines.append(item);

      while (lines.children.length > 7) {
        lines.firstElementChild.remove();
      }

      animate(item, { opacity: [0, 1], y: [8, 0] }, { duration: 0.35, ease });

      return item;
    };

    let current = null;
    const s = {
      animate,
      wait,
      async ask(text) {
        const item = line("ask", "");

        for (const character of text) {
          item.textContent += character;
          await wait(0.016);
        }

        await wait(0.35);
      },
      async done(html) {
        line("done", html);
        await wait(0.7);
      },
      async code(html) {
        line("code", html);
        await wait(0.7);
      },
      async swap(element, text) {
        await animate(element, { opacity: [1, 0] }, { duration: 0.15 });
        element.textContent = text;
        await animate(element, { opacity: [0, 1] }, { duration: 0.25 });
      },
      addLayer([key, kind, name, depth]) {
        const row = document.createElement("li");

        scene.layers.push([key, kind, name, depth]);
        row.dataset.layer = key;
        row.classList.toggle("nested", depth > 0);
        row.innerHTML = `<i class="ico ${kind}"></i>${name}`;
        layers.append(row);
        animate(row, { opacity: [0, 1], x: [-6, 0] }, { duration: 0.35, ease });
      },
      /** Figma's selection on a layer: violet for components and instances, blue for the rest. */
      select(key) {
        const target = node(key);
        const [, kind] = layer(key);
        const box = within(target, canvas);
        const to = { x: box.x - 2, y: box.y - 2, width: box.w + 4, height: box.h + 4 };

        current = key;
        selection.classList.toggle("component", COMPONENT_KINDS.has(kind));
        selectionLabel.textContent = `${Math.round(box.w)} × ${Math.round(box.h)}`;

        if (selection.hidden) {
          selection.hidden = false;
          animate(selection, to, { duration: 0 });
          animate(selection, { opacity: [0, 1] }, { duration: 0.25 });
        } else {
          animate(selection, to, { type: "spring", stiffness: 420, damping: 36 });
        }

        for (const row of layers.children) {
          row.classList.toggle("active", row.dataset.layer === key);
        }
      },
      async walk(keys) {
        for (const key of keys) {
          s.select(key);
          await wait(0.42);
        }
      },
      /** The agent's cursor goes to a layer, and selects it. */
      async point(key) {
        const box = within(node(key), canvas);

        if (cursor.hidden) {
          cursor.hidden = false;
          animate(cursor, { x: box.x - 60, y: box.y + box.h + 30, opacity: 0 }, { duration: 0 });
        }

        await animate(cursor, { x: box.x + box.w * 0.62, y: box.y + box.h * 0.55, opacity: 1 }, { duration: 0.7, ease: glide });
        check();
        s.select(key);
      },
      /** A label along the noodle: from the terminal to a layer, or back. */
      async travel(label, key, back = false) {
        const from = within(term, root);
        const to = within(node(key), root);
        // Out of the terminal's side when the layer is to its right, else out of its top; into the layer's middle, bending
        // as a prototype noodle does.
        const end = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
        const beside = end.x > from.x + from.w;
        const start = beside
          ? { x: from.x + from.w, y: from.y + Math.min(from.h * 0.32, 80) }
          : { x: from.x + from.w * 0.5, y: from.y };
        const bend = Math.max(60, (beside ? Math.abs(end.x - start.x) : Math.abs(end.y - start.y)) * 0.5);
        const [c1, c2] = beside
          ? [`${start.x + bend} ${start.y}`, `${end.x - bend} ${end.y}`]
          : [`${start.x} ${start.y - bend}`, `${end.x} ${end.y + bend}`];

        noodle.setAttribute("d", `M ${start.x} ${start.y} C ${c1}, ${c2}, ${end.x} ${end.y}`);

        const length = noodle.getTotalLength();

        noodle.style.strokeDasharray = `${length}`;
        noodleEnd.setAttribute("cx", String(back ? start.x : end.x));
        noodleEnd.setAttribute("cy", String(back ? start.y : end.y));
        packet.textContent = label;
        packet.classList.toggle("back", back);

        await animate(
          noodle,
          { strokeDashoffset: back ? [-length, 0] : [length, 0], opacity: [0, 0.85] },
          { duration: 0.4, ease },
        );
        check();
        await animate(0, 1, {
          duration: 1.15,
          ease: glide,
          onUpdate: (progress) => {
            const point = noodle.getPointAtLength((back ? 1 - progress : progress) * length);

            packet.style.transform = `translate(${point.x}px, ${point.y}px) translate(-50%, -50%)`;
            packet.style.opacity = String(Math.min(1, progress * 8, (1 - progress) * 8));
          },
        });
        check();
        animate(noodleEnd, { opacity: [1, 0] }, { duration: 0.6 });
        animate(noodle, { opacity: 0 }, { duration: 0.45 });
      },
      async call(tool, detail, key) {
        line("call", `<b>${tool}</b>${detail}`);
        await wait(0.2);
        await s.travel(tool, key);
        await s.point(key);
        await wait(0.3);
      },
      async back(label, key) {
        await s.travel(label, key, true);
      },
      /** A write: the change itself, and the selection's flash where it landed. */
      async change(action) {
        await action();

        // The layer may have a new size now: the selection fits it again before it flashes.
        if (current !== null) {
          s.select(current);
          await wait(0.3);
        }

        animate(
          selection,
          { boxShadow: ["0 0 0 0 rgb(13 153 255 / 0.55)", "0 0 0 12px rgb(13 153 255 / 0)"] },
          { duration: 0.7 },
        );
        await wait(0.6);
      },
    };

    return s;
  }

  /** From one task to the next: the terminal clears, the file changes, its layers come in. */
  async function show(next, id) {
    const leaving = [...lines.children];

    await Promise.all([
      leaving.length > 0 ? animate(leaving, { opacity: 0 }, { duration: 0.3 }) : null,
      selection.hidden ? null : animate(selection, { opacity: 0 }, { duration: 0.25 }),
      cursor.hidden ? null : animate(cursor, { opacity: 0 }, { duration: 0.25 }),
    ]);

    if (id !== run) {
      throw STOP;
    }

    lines.replaceChildren();
    selection.hidden = true;
    cursor.hidden = true;
    scene = { ...next, layers: next.layers.map((row) => [...row]) };

    const nextBoard = boards[next.board];

    next.reset(nextBoard);

    if (nextBoard !== board) {
      await animate(board, { opacity: [1, 0], scale: [1, 0.96] }, { duration: 0.35, ease });
      board.hidden = true;
      nextBoard.hidden = false;
      board = nextBoard;
      await animate(board, { opacity: [0, 1], scale: [0.96, 1] }, { duration: 0.5, ease });

      if (id !== run) {
        throw STOP;
      }
    }

    file.textContent = next.file;
    client.textContent = next.client;
    termPath.textContent = next.path;
    cursorLabel.textContent = next.client;
    layers.replaceChildren(
      ...scene.layers.map(([key, kind, name, depth]) => {
        const row = document.createElement("li");

        row.dataset.layer = key;
        row.classList.toggle("nested", depth > 0);
        row.innerHTML = `<i class="ico ${kind}"></i>${name}`;

        return row;
      }),
    );
  }

  async function loop(id) {
    try {
      while (id === run) {
        const next = SCENES[index % SCENES.length];

        await show(next, id);
        await next.play(steps(id), board);
        await new Promise((resolve) => setTimeout(resolve, 2200));
        index += 1;
      }
    } catch (error) {
      if (error !== STOP) {
        throw error;
      }
    }
  }

  const start = () => {
    run += 1;
    void loop(run);
  };
  const stop = () => {
    run += 1;
  };

  // Plays while on screen and the tab is in front; picks up at the task it was on.
  inView(
    root,
    () => {
      visible = true;

      if (!document.hidden) {
        start();
      }

      return () => {
        visible = false;
        stop();
      };
    },
    { amount: 0.3 },
  );
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stop();
    } else if (visible) {
      start();
    }
  });
}

// Last, once everything above is defined (SCENES is a const).
clearTimeout(window.pixelwrightFallback);
copyButtons();
measureSelection();
safetyDemo();

if (Motion === undefined || reduced) {
  document.documentElement.classList.remove("js");
  showFinished();
} else {
  intro(Motion);
  stage(Motion);
  mapping(Motion);
  questions(Motion);
}
