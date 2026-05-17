// ELVISH — blog/changelog data (static preview; live site uses content/blog/*.md)
const ENTRIES = [
  {
    date: "26.05.03", time: "12:00",
    type: "notes",
    title: "Welcome to the log",
    body: (
      <>
        <p>This is the default entry. Replace it with your own posts under <code>content/blog/</code> (or publish via the API when MongoDB is configured). Detached OpenPGP signatures are optional but supported.</p>
      </>
    ),
    tags: ["notes"],
    bytes: "1KB", reach: "—"
  }
];

window.ENTRIES = ENTRIES;
