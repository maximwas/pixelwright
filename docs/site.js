// The site's behaviour. One orchestrated moment: the scene in the hero plays what Pixelwright does, the agent reading
// a card from the Figma file and then changing it; everything else reveals as it comes into view. People who ask for
// less motion, or whose browser has no scripts, see the scene's end state at once.
const Motion = window.Motion;
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const ease = [0.22, 1, 0.36, 1];
const chat = Object.fromEntries([...document.querySelectorAll(".chat [data-step]")].map((line) => [line.dataset.step, line]));
const nodes = Object.fromEntries([...document.querySelectorAll(".plan [data-node]")].map((node) => [node.dataset.node, node]));
const packets = Object.fromEntries([...document.querySelectorAll("[data-packet]")].map((packet) => [packet.dataset.packet, packet]));
const buttonText = document.querySelector(".button-text");
const replay = document.querySelector(".replay");
let run = 0;

clearTimeout(window.pixelwrightFallback);

for (const button of document.querySelectorAll("[data-copy]")) {
  button.addEventListener("click", async () => {
    const text = document.getElementById(button.dataset.copy)?.textContent ?? "";

    Motion?.animate(button, { scale: [0.92, 1] }, { type: "spring", stiffness: 500, damping: 15 });

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

function select(name) {
  for (const [key, node] of Object.entries(nodes)) {
    node.classList.toggle("selected", key === name);
  }
}

function endState() {
  for (const line of Object.values(chat)) {
    line.style.opacity = "1";
  }

  if (buttonText !== null) {
    buttonText.textContent = "Start free trial";
  }

  select("button");
}

if (Motion === undefined || reduced) {
  document.documentElement.classList.remove("js");
  endState();
} else {
  intro(Motion);
}

function intro({ animate, inView, stagger }) {
  const headline = document.querySelector("[data-words]");

  if (headline !== null) {
    headline.innerHTML = headline.textContent
      .split(" ")
      .map((word) => `<span class="word">${word}</span>`)
      .join(" ");
    animate(
      headline.querySelectorAll(".word"),
      { opacity: [0, 1], y: [24, 0] },
      { delay: stagger(0.05, { startDelay: 0.1 }), duration: 0.8, ease },
    );
  }

  animate(
    "[data-intro]",
    { opacity: [0, 1], y: [16, 0] },
    { delay: stagger(0.12, { startDelay: 0.4 }), duration: 0.7, ease },
  );

  const scene = document.querySelector(".scene");

  if (scene !== null) {
    let played = false;

    // Once, when it first comes into view; after that it plays again only when asked.
    inView(
      scene,
      () => {
        if (!played) {
          played = true;
          void play(animate);
        }
      },
      { amount: 0.5 },
    );
  }

  replay?.addEventListener("click", () => void play(animate));

  for (const group of document.querySelectorAll("[data-reveal]")) {
    inView(
      group,
      () => {
        animate(group.children, { opacity: [0, 1], y: [20, 0] }, { delay: stagger(0.08), duration: 0.65, ease });
      },
      { amount: 0.2 },
    );
  }

  // Questions open and close at their own height.
  for (const details of document.querySelectorAll("details")) {
    const summary = details.querySelector("summary");
    const answer = details.querySelector("p");

    summary?.addEventListener("click", async (event) => {
      if (answer === null) {
        return;
      }

      event.preventDefault();

      if (details.open) {
        await animate(answer, { height: [answer.offsetHeight, 0], opacity: [1, 0] }, { duration: 0.3, ease });
        details.open = false;
        answer.style.removeProperty("height");
        answer.style.removeProperty("opacity");

        return;
      }

      details.open = true;

      const height = answer.offsetHeight;

      answer.style.overflow = "hidden";
      await animate(answer, { height: [0, height], opacity: [0, 1] }, { duration: 0.4, ease });
      answer.style.removeProperty("height");
      answer.style.removeProperty("overflow");
    });
  }
}

/** The scene, start to end; a replay stops the one before it. */
async function play(animate) {
  const id = ++run;
  const wait = (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  const live = () => id === run;
  const vertical = window.matchMedia("(max-width: 1000px)").matches;
  const say = (line) => animate(line, { opacity: [0, 1], y: [8, 0] }, { duration: 0.45, ease });
  // A request goes from the agent to the file, an answer comes back: along the wire, whichever way it runs.
  const travel = async (packet, back) => {
    const from = back ? 1 : -1;
    const path = vertical ? { y: [from * 24, -from * 24] } : { x: [from * 24, -from * 24] };

    await animate(packet, { ...path, opacity: [0, 1, 1, 0] }, { duration: 0.9, ease: "easeInOut" });
  };

  replay?.setAttribute("hidden", "");

  for (const line of Object.values(chat)) {
    line.style.opacity = "0";
  }

  select(null);

  if (buttonText !== null) {
    buttonText.textContent = "Get started";
  }

  await wait(0.5);

  for (const step of [
    async () => say(chat.ask),
    async () => wait(0.5),
    async () => {
      say(chat.read);
      await travel(packets.read, false);
    },
    async () => {
      select("card");
      await travel(packets.xml, true);
    },
    async () => {
      for (const name of ["head", "badge", "price", "list", "button"]) {
        if (!live()) {
          return;
        }

        select(name);
        await wait(0.38);
      }
    },
    async () => {
      select(null);
      await say(chat.code);
    },
    async () => wait(0.9),
    async () => say(chat.ask2),
    async () => wait(0.5),
    async () => {
      say(chat.write);
      await travel(packets.write, false);
    },
    async () => {
      select("button");

      if (buttonText !== null) {
        await animate(buttonText, { opacity: [1, 0] }, { duration: 0.15 });
        buttonText.textContent = "Start free trial";
        await animate(buttonText, { opacity: [0, 1] }, { duration: 0.25 });
      }
    },
  ]) {
    if (!live()) {
      return;
    }

    await step();
  }

  if (live()) {
    replay?.removeAttribute("hidden");
  }
}
