// The walkthrough ladder: eleven authored levels placed at their chapter
// seams, each introducing or consolidating one idea. Triage states the design
// thesis. Every level carries a hidden reference build;
// the ladder test proves each one resonates on every performance, which is
// what makes the walkthrough's "place the reference build" button honest.
//
// A case is a PERFORMANCE: per-quill seed words, per-resonator target words.
// A resonator with no target in a performance must stay silent.

export const PUZZLES = [
  {
    id: 'first-resonance',
    title: 'First Resonance',
    chapter: 'I · Études',
    assignment: 'Wire the quill to the resonator and press Run. The seed already matches the target — this level is about moving a string, not rewriting it.',
    board: { cols: 9, rows: 5 },
    fixed: [
      { id: 'q1', kind: 'quill', x: 1, y: 2 },
      { id: 'r1', kind: 'resonator', x: 7, y: 2 },
    ],
    palette: {},
    cases: [
      { name: 'Aria', seeds: { q1: 'AB' }, targets: { r1: 'AB' } },
    ],
    reference: {
      parts: [],
      wires: [{ from: { part: 'q1', port: 'out' }, to: { part: 'r1', port: 'in' } }],
    },
    walkthrough: [
      { focus: 'board', title: 'A string is a word', body: 'The notes A, B, C, D are the alphabet. A string carries a word of them — here A·B — and travels the wires as one object. Parts rewrite the word; the board only moves it.' },
      { focus: 'board', title: 'The quill sounds once', body: 'At tick 1 the quill sounds its seed word onto its out wire. The seed belongs to the performance, not to your machine — later commissions change it under you.' },
      { focus: 'board', title: 'The resonator is the goal', body: 'It accepts exactly the target word printed beside it. The right word rings true. Any other word is a sour note, and the performance fails on the spot.' },
      { focus: 'transport', title: 'Wire it and run', body: 'Drag from the quill’s right-edge port to the resonator’s left-edge port, then press Run. The chip on the wire is its travel time in ticks — distance is time here.' },
    ],
  },

  {
    id: 'the-mould',
    title: 'The Mould',
    chapter: 'I · Études',
    assignment: 'The target is one note longer than the seed. A mould appends a fixed note to the tail of whatever passes through it.',
    board: { cols: 9, rows: 5 },
    fixed: [
      { id: 'q1', kind: 'quill', x: 1, y: 2 },
      { id: 'r1', kind: 'resonator', x: 7, y: 2 },
    ],
    palette: { mould: 1 },
    cases: [
      { name: 'Aria', seeds: { q1: 'AB' }, targets: { r1: 'ABC' } },
      { name: 'Encore', seeds: { q1: 'DB' }, targets: { r1: 'DBC' } },
    ],
    reference: {
      parts: [{ id: 'm1', kind: 'mould', x: 4, y: 2, config: { note: 'C' } }],
      wires: [
        { from: { part: 'q1', port: 'out' }, to: { part: 'm1', port: 'in' } },
        { from: { part: 'm1', port: 'out' }, to: { part: 'r1', port: 'in' } },
      ],
    },
    walkthrough: [
      { focus: 'palette', title: 'The mould appends', body: 'Take the mould from the palette and place it on the board: it adds one fixed note to the TAIL — w becomes w·a. Click it and pick which note in the inspector.' },
      { focus: 'commission', title: 'One machine, every performance', body: 'This commission has two performances with different seeds. Your one machine must ring true on both. Run plays the selected performance; Run all judges the commission.' },
      { focus: 'inspector', title: 'Configure, then run', body: 'The mould starts set to A. The target ends in C, whatever the seed — so set the mould to C. If you forget, the sour note will tell you exactly what arrived.' },
    ],
  },

  {
    id: 'the-damper',
    title: 'The Damper',
    chapter: 'I · Études',
    assignment: 'Both seeds carry one stray note at the head. A damper removes the head note, whatever it is.',
    board: { cols: 9, rows: 5 },
    fixed: [
      { id: 'q1', kind: 'quill', x: 1, y: 2 },
      { id: 'r1', kind: 'resonator', x: 7, y: 2 },
    ],
    palette: { damper: 1 },
    cases: [
      { name: 'Aria', seeds: { q1: 'DAB' }, targets: { r1: 'AB' } },
      { name: 'Encore', seeds: { q1: 'CAB' }, targets: { r1: 'AB' } },
    ],
    reference: {
      parts: [{ id: 'd1', kind: 'damper', x: 4, y: 2 }],
      wires: [
        { from: { part: 'q1', port: 'out' }, to: { part: 'd1', port: 'in' } },
        { from: { part: 'd1', port: 'out' }, to: { part: 'r1', port: 'in' } },
      ],
    },
    walkthrough: [
      { focus: 'palette', title: 'The damper takes the head', body: 'a·w becomes w. The damper is the mould’s opposite end: moulds write at the tail, dampers take from the head. A string is a queue, and that asymmetry is the whole game.' },
      { focus: 'board', title: 'It needs a head to take', body: 'An empty string stalls a damper — there is nothing to remove, so the word waits there forever. When a run goes silent, the report names the part that is waiting and why.' },
    ],
  },

  {
    id: 'unison',
    title: 'Unison',
    chapter: 'II · Duets',
    assignment: 'Two quills, one target. A unison holds two strings until both arrive, then joins them — the lead seat’s word comes first.',
    board: { cols: 9, rows: 5 },
    fixed: [
      { id: 'q1', kind: 'quill', x: 1, y: 1 },
      { id: 'q2', kind: 'quill', x: 1, y: 3 },
      { id: 'r1', kind: 'resonator', x: 7, y: 2 },
    ],
    palette: { unison: 1 },
    cases: [
      { name: 'Aria', seeds: { q1: 'AB', q2: 'CD' }, targets: { r1: 'ABCD' } },
      { name: 'Encore', seeds: { q1: 'BA', q2: 'DC' }, targets: { r1: 'BADC' } },
    ],
    reference: {
      parts: [{ id: 'u1', kind: 'unison', x: 4, y: 2 }],
      wires: [
        { from: { part: 'q1', port: 'out' }, to: { part: 'u1', port: 'lead' } },
        { from: { part: 'q2', port: 'out' }, to: { part: 'u1', port: 'tail' } },
        { from: { part: 'u1', port: 'out' }, to: { part: 'r1', port: 'in' } },
      ],
    },
    walkthrough: [
      { focus: 'palette', title: 'Two in, one out', body: 'The unison waits until a string sits in each seat, then releases one merged string: the lead seat’s word, then the tail seat’s. (w, v) becomes w·v.' },
      { focus: 'board', title: 'Seats are not symmetric', body: 'Wire the top quill into the lead seat and the bottom into the tail. Swap them and the word comes out backwards — try it once; the sour note names exactly what it got.' },
    ],
  },

  {
    id: 'the-splitter',
    title: 'The Splitter',
    chapter: 'II · Duets',
    assignment: 'One string in, two products out. A splitter cuts at a fixed count k — set k in the inspector, and land both halves.',
    board: { cols: 9, rows: 5 },
    fixed: [
      { id: 'q1', kind: 'quill', x: 1, y: 2 },
      { id: 'r1', kind: 'resonator', x: 7, y: 1 },
      { id: 'r2', kind: 'resonator', x: 7, y: 3 },
    ],
    palette: { splitter: 1 },
    cases: [
      { name: 'Aria', seeds: { q1: 'ABCD' }, targets: { r1: 'AB', r2: 'CD' } },
      { name: 'Encore', seeds: { q1: 'DDAB' }, targets: { r1: 'DD', r2: 'AB' } },
    ],
    reference: {
      parts: [{ id: 's1', kind: 'splitter', x: 4, y: 2, config: { k: 2 } }],
      wires: [
        { from: { part: 'q1', port: 'out' }, to: { part: 's1', port: 'in' } },
        { from: { part: 's1', port: 'head' }, to: { part: 'r1', port: 'in' } },
        { from: { part: 's1', port: 'rest' }, to: { part: 'r2', port: 'in' } },
      ],
    },
    walkthrough: [
      { focus: 'palette', title: 'The cut is at a count, not a note', body: 'w·v becomes (w, v) where w is the first k notes. The head exit carries those k; the rest exit carries the remainder. A string shorter than k stalls — there is no such cut.' },
      { focus: 'inspector', title: 'Set k, land both halves', body: 'Both targets are two notes long, so cut at k = 2. Both exits must be wired: a splitter will not fire while either half has nowhere to go.' },
    ],
  },

  {
    id: 'the-tuning-fork',
    title: 'The Tuning Fork',
    chapter: 'III · Sight-reading',
    assignment: 'The two performances start on different notes and want different halls. The fork is the first part that reads.',
    board: { cols: 9, rows: 5 },
    fixed: [
      { id: 'q1', kind: 'quill', x: 1, y: 2 },
      { id: 'r1', kind: 'resonator', x: 7, y: 1, label: 'hall of A' },
      { id: 'r2', kind: 'resonator', x: 7, y: 3, label: 'the other hall' },
    ],
    palette: { fork: 1 },
    cases: [
      { name: 'Aria', seeds: { q1: 'ACC' }, targets: { r1: 'ACC' } },
      { name: 'Encore', seeds: { q1: 'BCC' }, targets: { r2: 'BCC' } },
    ],
    reference: {
      parts: [{ id: 'f1', kind: 'fork', x: 4, y: 2, config: { note: 'A', mode: 'peek' } }],
      wires: [
        { from: { part: 'q1', port: 'out' }, to: { part: 'f1', port: 'in' } },
        { from: { part: 'f1', port: 'left' }, to: { part: 'r1', port: 'in' } },
        { from: { part: 'f1', port: 'right' }, to: { part: 'r2', port: 'in' } },
      ],
    },
    walkthrough: [
      { focus: 'palette', title: 'The first part that READS', body: 'Every part so far rewrites blindly. The fork looks at the head: left exactly when the head is the fork’s note; everything else — wrong head, empty string — exits right.' },
      { focus: 'commission', title: 'No straight pipe serves this', body: 'The seed differs per performance and so does the hall that must ring. A machine with no read cannot do it. This is where solutions start being logic.' },
      { focus: 'board', title: 'A hall with no target stays SILENT', body: 'New rule, and it cuts: in each performance, a hall with no printed target must receive nothing at all. One stray string into a silent hall is a sour note — from here on, where the wrong strings go matters as much as where the right ones do.' },
      { focus: 'inspector', title: 'Peek leaves the word alone', body: 'The fork is set to peek: it reads the head and passes the whole word through untouched. Set its note to A, aim left at the upper hall, right at the lower.' },
    ],
  },

  {
    id: 'the-wolfs-bite',
    title: "The Wolf's Bite",
    chapter: 'IV · Wolf notes',
    assignment: 'Strip every leading A, however many there are. One fork, one loop — and a decision the spec left open.',
    board: { cols: 9, rows: 5 },
    fixed: [
      { id: 'q1', kind: 'quill', x: 1, y: 2 },
      { id: 'r1', kind: 'resonator', x: 7, y: 2 },
    ],
    palette: { fork: 1 },
    cases: [
      { name: 'Aria', seeds: { q1: 'AABC' }, targets: { r1: 'BC' } },
      { name: 'Encore', seeds: { q1: 'ABC' }, targets: { r1: 'BC' } },
      { name: 'Coda', seeds: { q1: 'BC' }, targets: { r1: 'BC' } },
    ],
    reference: {
      parts: [{ id: 'f1', kind: 'fork', x: 4, y: 2, config: { note: 'A', mode: 'consume' } }],
      wires: [
        { from: { part: 'q1', port: 'out' }, to: { part: 'f1', port: 'in' } },
        { from: { part: 'f1', port: 'left' }, to: { part: 'f1', port: 'in' } },
        { from: { part: 'f1', port: 'right' }, to: { part: 'r1', port: 'in' } },
      ],
    },
    walkthrough: [
      { focus: 'board', title: 'Build the loop with peek first', body: 'Place a fork on A. Wire its left exit back into its own in port, its right exit to the resonator. Run the Aria. Watch the event log: the same A is read forever, and the run never ends.' },
      { focus: 'inspector', title: 'The open decision', body: 'Should a fork CONSUME the note it reads? The spec left this open. In consume mode a matched head is bitten off as it exits left: a_f·w becomes w. Flip the fork’s mode in the inspector.' },
      { focus: 'board', title: 'Now the loop makes progress', body: 'Each pass around the loop bites one A off the head. The first performance takes two bites, the second one, the third none. One machine, three different run lengths — the read is doing the counting.' },
      { focus: 'inspector', title: 'Note your verdict', body: 'Destructive read means fewer parts — this level needs no damper. Peek is easier to teach but cannot loop. Which felt right in the hand? That answer goes in FINDINGS.md; it is what this level is for.' },
    ],
  },

  {
    id: 'the-coupling',
    title: 'The Coupling',
    chapter: 'V · Entanglements',
    assignment: 'A label and a payload. The coupling holds both strings until both arrive, then routes each by reading the OTHER one’s head.',
    board: { cols: 10, rows: 7 },
    fixed: [
      { id: 'q1', kind: 'quill', x: 2, y: 2, label: 'the label' },
      { id: 'q2', kind: 'quill', x: 2, y: 4, label: 'the payload' },
      { id: 'r1', kind: 'resonator', x: 8, y: 1, label: 'spent labels' },
      { id: 'r2', kind: 'resonator', x: 8, y: 3, label: 'hall of A' },
      { id: 'r3', kind: 'resonator', x: 8, y: 5, label: 'hall of B' },
    ],
    palette: { coupling: 1 },
    cases: [
      { name: 'Aria', seeds: { q1: 'A', q2: 'CD' }, targets: { r2: 'CD', r1: 'A' } },
      { name: 'Encore', seeds: { q1: 'B', q2: 'CD' }, targets: { r3: 'CD', r1: 'B' } },
    ],
    reference: {
      parts: [{ id: 'c1', kind: 'coupling', x: 5, y: 3, config: { noteA: 'A', noteB: 'A' } }],
      wires: [
        { from: { part: 'q1', port: 'out' }, to: { part: 'c1', port: 'inA' } },
        { from: { part: 'q2', port: 'out' }, to: { part: 'c1', port: 'inB' } },
        { from: { part: 'c1', port: 'outAL' }, to: { part: 'r1', port: 'in' } },
        { from: { part: 'c1', port: 'outAR' }, to: { part: 'r1', port: 'in' } },
        { from: { part: 'c1', port: 'outBL' }, to: { part: 'r2', port: 'in' } },
        { from: { part: 'c1', port: 'outBR' }, to: { part: 'r3', port: 'in' } },
      ],
    },
    walkthrough: [
      { focus: 'commission', title: 'Read both performances first', body: 'The top quill sounds a one-note LABEL — A in the first performance, B in the second. The bottom quill sounds the payload C·D. The payload must reach the hall the label names, and the spent label goes to its own bin. One machine, both routes.' },
      { focus: 'board', title: 'Sync: one string per side', body: 'Wire the label into in-port A and the payload into in-port B. The coupling holds whichever string arrives first until the other is there, then releases both in the same tick.' },
      { focus: 'inspector', title: 'The crossed read', body: 'Each string exits by reading the OTHER side’s head. Select the coupling and set “B tests” to A. Then wire exit BL to the hall of A and exit BR to the hall of B: the payload turns left exactly when the label reads A.' },
      { focus: 'board', title: 'Spend the label, then Run all', body: 'Wire BOTH exits AL and AR into the spent-labels bin — two wires into one port is allowed, so side A’s own test note never matters. Run all: the same machine must ring the hall of A in the Aria and the hall of B in the Encore.' },
    ],
  },

  {
    id: 'valve-race',
    title: 'The Valve',
    chapter: 'VI · Tempo',
    assignment: 'Two lead voices, two themes, two required duets. Delay the eager voice so the patient voice takes the first theme and the eager voice takes the second.',
    board: { cols: 11, rows: 7 },
    fixed: [
      { id: 'q1', kind: 'quill', x: 4, y: 1, label: 'the eager voice' },
      { id: 'q2', kind: 'quill', x: 1, y: 3, label: 'the patient voice' },
      { id: 'q3', kind: 'quill', x: 4, y: 5, label: 'first theme' },
      { id: 'q4', kind: 'quill', x: 1, y: 5, label: 'second theme' },
      { id: 'u1', kind: 'unison', x: 5, y: 3 },
      { id: 'f1', kind: 'fork', x: 7, y: 3, config: { note: 'B', mode: 'peek' } },
      { id: 'r1', kind: 'resonator', x: 9, y: 2, label: 'patient duet' },
      { id: 'r2', kind: 'resonator', x: 9, y: 4, label: 'eager duet' },
    ],
    palette: { valve: 1 },
    cases: [
      { name: 'Aria', seeds: { q1: 'A', q2: 'B', q3: 'C', q4: 'D' }, targets: { r1: 'BC', r2: 'AD' } },
      { name: 'Encore', seeds: { q1: 'A', q2: 'B', q3: 'D', q4: 'C' }, targets: { r1: 'BD', r2: 'AC' } },
    ],
    reference: {
      parts: [{ id: 'v1', kind: 'valve', x: 5, y: 1, config: { delay: 2 } }],
      wires: [
        { from: { part: 'q1', port: 'out' }, to: { part: 'v1', port: 'in' } },
        { from: { part: 'v1', port: 'out' }, to: { part: 'u1', port: 'lead' } },
        { from: { part: 'q2', port: 'out' }, to: { part: 'u1', port: 'lead' } },
        { from: { part: 'q3', port: 'out' }, to: { part: 'u1', port: 'tail' } },
        { from: { part: 'q4', port: 'out' }, to: { part: 'u1', port: 'tail' } },
        { from: { part: 'u1', port: 'out' }, to: { part: 'f1', port: 'in' } },
        { from: { part: 'f1', port: 'left' }, to: { part: 'r1', port: 'in' } },
        { from: { part: 'f1', port: 'right' }, to: { part: 'r2', port: 'in' } },
      ],
    },
    walkthrough: [
      { focus: 'board', title: 'A race for one seat', body: 'The unison and sorting fork are already on the board. Both lead voices and both themes must perform. Wired directly, the nearby eager voice reaches the lead queue first, so both duets get the wrong partner.' },
      { focus: 'palette', title: 'Time folded into one cell', body: 'A valve passes a word through unchanged after holding it for a chosen number of ticks. Route only the eager voice through the valve.' },
      { focus: 'inspector', title: 'Find the smallest winning hold', body: 'Start at one tick and Run all. Then raise the hold until the patient voice reaches the lead queue first. The event log names both arrivals.' },
      { focus: 'board', title: 'Delay, do not dispose', body: 'The patient voice takes the first theme; the delayed eager voice must still take the second. Both halls are required, so every emitted word leaves the machine. Distance is also delay, making the valve a compact convenience rather than unique logic.' },
    ],
  },

  // Preserve the old ID so existing browser saves for this unchanged puzzle
  // still load after its title and campaign position change.
  {
    id: 'the-valve',
    title: 'Tempo I — Crossed Pairs',
    chapter: 'VI · Tempo',
    assignment: 'Four notes, two seats, two products. The early A pairs with the wrong partner — hold it back and cross the pairs.',
    board: { cols: 11, rows: 7 },
    fixed: [
      { id: 'q1', kind: 'quill', x: 4, y: 3, label: 'A — too early' },
      { id: 'q2', kind: 'quill', x: 1, y: 1, label: 'B — far away' },
      { id: 'q3', kind: 'quill', x: 4, y: 5, label: 'C — near tail' },
      { id: 'q4', kind: 'quill', x: 1, y: 5, label: 'D — far tail' },
      { id: 'r1', kind: 'resonator', x: 10, y: 3, label: 'hall of A·D' },
      { id: 'r2', kind: 'resonator', x: 10, y: 5, label: 'hall of B·C' },
    ],
    palette: { unison: 1, valve: 1, fork: 1 },
    cases: [
      { name: 'Aria', seeds: { q1: 'A', q2: 'B', q3: 'C', q4: 'D' }, targets: { r1: 'AD', r2: 'BC' } },
    ],
    reference: {
      parts: [
        { id: 'v1', kind: 'valve', x: 5, y: 2, config: { delay: 4 } },
        { id: 'u1', kind: 'unison', x: 6, y: 4 },
        { id: 'f1', kind: 'fork', x: 8, y: 4, config: { note: 'A', mode: 'peek' } },
      ],
      wires: [
        { from: { part: 'q1', port: 'out' }, to: { part: 'v1', port: 'in' } },
        { from: { part: 'v1', port: 'out' }, to: { part: 'u1', port: 'lead' } },
        { from: { part: 'q2', port: 'out' }, to: { part: 'u1', port: 'lead' } },
        { from: { part: 'q3', port: 'out' }, to: { part: 'u1', port: 'tail' } },
        { from: { part: 'q4', port: 'out' }, to: { part: 'u1', port: 'tail' } },
        { from: { part: 'u1', port: 'out' }, to: { part: 'f1', port: 'in' } },
        { from: { part: 'f1', port: 'left' }, to: { part: 'r1', port: 'in' } },
        { from: { part: 'f1', port: 'right' }, to: { part: 'r2', port: 'in' } },
      ],
    },
    walkthrough: [
      { focus: 'board', title: 'Two seats, four notes', body: 'Wire A and B into the lead seat, C and D into the tail. The unison pairs whoever is first in each queue, so the chips — travel time — decide the pairs. Both products leave by the same out wire.' },
      { focus: 'commission', title: 'Left alone, the pairs are wrong', body: 'A is near and C is near: A·C forms first and rings sour in the hall of A·D. The commission wants the CROSS — A·D and B·C — and both halls must ring, so leaving A unwired just starves its hall.' },
      { focus: 'palette', title: 'The valve crosses the pairs', body: 'A valve holds a string for a set number of ticks, then passes it on unchanged. Route A through one and raise the hold until B takes the first seat, leaving D as A’s partner. The event log shows the arrival order — read it, then adjust.' },
      { focus: 'board', title: 'Sort the two products', body: 'One wire carries both products in turn, so end with a read: a peeking fork on A sends A·D to its hall, everything else to the other. And know what the valve is: travel time folded into one cell. Every race it wins, clever placement could also win — this level included. It is a convenience, never a necessity, and the Tempo commissions say so out loud.' },
    ],
  },

  {
    id: 'triage',
    title: 'Triage',
    chapter: 'IV · Wolf notes',
    assignment: 'The commission: strip the header note and deliver the body to that header’s hall. Two different builds solve this — pick your logic.',
    board: { cols: 9, rows: 5 },
    fixed: [
      { id: 'q1', kind: 'quill', x: 1, y: 2 },
      { id: 'r1', kind: 'resonator', x: 7, y: 1, label: 'hall of A' },
      { id: 'r2', kind: 'resonator', x: 7, y: 3, label: 'hall of B' },
    ],
    palette: { fork: 2, damper: 2 },
    cases: [
      { name: 'Aria', seeds: { q1: 'ACD' }, targets: { r1: 'CD' } },
      { name: 'Encore', seeds: { q1: 'BCD' }, targets: { r2: 'CD' } },
      { name: 'Coda', seeds: { q1: 'ADD' }, targets: { r1: 'DD' } },
    ],
    reference: {
      parts: [
        { id: 'f1', kind: 'fork', x: 4, y: 2, config: { note: 'A', mode: 'consume' } },
        { id: 'd1', kind: 'damper', x: 5, y: 3 },
      ],
      wires: [
        { from: { part: 'q1', port: 'out' }, to: { part: 'f1', port: 'in' } },
        { from: { part: 'f1', port: 'left' }, to: { part: 'r1', port: 'in' } },
        { from: { part: 'f1', port: 'right' }, to: { part: 'd1', port: 'in' } },
        { from: { part: 'd1', port: 'out' }, to: { part: 'r2', port: 'in' } },
      ],
    },
    walkthrough: [
      { focus: 'commission', title: 'Read the whole commission first', body: 'Three performances. The header note — A or B — names the hall; the body follows it. Every performance must both lose its header and reach the right hall.' },
      { focus: 'palette', title: 'Two builds, same commission', body: 'A peeking fork with a damper on each exit reads then strips. A biting fork strips the A itself and needs one damper, on the right branch only, for the B case. Same commission, different logic.' },
      { focus: 'board', title: 'This is the thesis', body: 'In Opus Magnum two solutions differ in choreography. Here they differ in logic — which parts read, and what the reading spends. Build whichever you see first; the reference shows the biting build.' },
    ],
  },
];
