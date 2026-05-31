// ELVISH terminal landing component
const { useState, useEffect, useRef } = React;

function useTypewriter(lines, opts = {}) {
  const { charDelay = 18, lineDelay = 220, startDelay = 200 } = opts;
  const [out, setOut] = useState([]);
  const [done, setDone] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let timeouts = [];
    const t = (fn, d) => { const id = setTimeout(fn, d); timeouts.push(id); return id; };
    const run = async () => {
      await new Promise(r => t(r, startDelay));
      const acc = [];
      for (let i = 0; i < lines.length; i++) {
        if (cancelled) return;
        const line = lines[i];
        acc.push("");
        const idx = acc.length - 1;
        for (let c = 0; c <= line.text.length; c++) {
          if (cancelled) return;
          acc[idx] = { ...line, text: line.text.slice(0, c) };
          setOut([...acc]);
          await new Promise(r => t(r, charDelay));
        }
        await new Promise(r => t(r, lineDelay));
      }
      if (!cancelled) setDone(true);
    };
    run();
    return () => { cancelled = true; timeouts.forEach(clearTimeout); };
  }, []);
  return { lines: out, done };
}

function Terminal({ onComplete }) {
  const bootLines = [
    { kind: "sys", text: "elvish:~$ ./boot --mail" },
    { kind: "log", text: "[ OK ] mounting local key vault" },
    { kind: "log", text: "[ OK ] resolving mail + delivery modules" },
    { kind: "log", text: "[ OK ] telemetry default: off. anonymous export only." },
    { kind: "log", text: "[ OK ] storage mode: ciphertext at rest" },
    { kind: "log", text: "[ OK ] handshake: ELVISH/0.8.0-nightly" },
    { kind: "blank", text: "" },
    { kind: "head", text: "// END-TO-END MAIL. BROWSER KEYS. CIPHERTEXT AT REST." },
    { kind: "head", text: "// OPENPGP INBOXES. PROTECTED LINKS. PLAINTEXT RELAY." },
    { kind: "blank", text: "" },
    { kind: "prompt", text: "elvish:~$ open /mail" },
  ];
  const { lines, done } = useTypewriter(bootLines, { charDelay: 10, lineDelay: 80, startDelay: 100 });
  useEffect(() => { if (done && onComplete) onComplete(); }, [done]);

  const renderLine = (l, i) => {
    if (l.kind === "blank") return <div key={i} style={{ height: "1.4em" }}>&nbsp;</div>;
    if (l.kind === "sys" || l.kind === "prompt") {
      return <div key={i}><span style={{ color: "var(--accent)" }}>{l.text.split("$")[0]}$</span><span>{l.text.split("$")[1]}</span></div>;
    }
    if (l.kind === "log") {
      const m = l.text.match(/^(\[ \w+ \])(.*)$/);
      if (m) return <div key={i}><span style={{ color: "var(--ok)" }}>{m[1]}</span><span style={{ color: "var(--dim)" }}>{m[2]}</span></div>;
      return <div key={i} style={{ color: "var(--dim)" }}>{l.text}</div>;
    }
    if (l.kind === "head") return <div key={i} style={{ color: "var(--fg)", fontWeight: 700, letterSpacing: "0.04em" }}>{l.text}</div>;
    return <div key={i}>{l.text}</div>;
  };

  return (
    <div className="terminal">
      <div className="terminal-bar">
        <span className="dim">┌─</span>
        <span style={{ color: "var(--accent)" }}>● </span>
        <span>ELVISH · /BIN/SH</span>
        <span className="dim">─ 80×24 ─</span>
        <span className="dim">PID 0x4F2A ─┐</span>
      </div>
      <div className="terminal-body">
        {lines.map(renderLine)}
        <div>
          <span style={{ color: "var(--accent)" }}>elvish:~$</span>{" "}
          <span className="cursor">█</span>
        </div>
      </div>
    </div>
  );
}

window.Terminal = Terminal;
