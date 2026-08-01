// The walkthrough ladder: eleven authored levels placed at their chapter
// seams, each introducing or consolidating one idea. Triage states the design
// thesis. Every level carries a hidden reference build used by tests and the
// separate reference-review mode.
//
// A case is a PERFORMANCE: per-quill seed words, per-resonator target words.
// A resonator with no target in a performance must stay silent.

export const PUZZLES = [
  {
    id: 'first-resonance',
    title: 'First Resonance',
    chapter: 'I · Études',
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
      { focus: 'board', title: 'Strings carry words', body: 'A string carries a word made from the notes A, B, C, and D. Here the word is A·B. Wires move the entire word between parts.' },
      { focus: 'board', title: 'The quill sends the seed', body: 'At tick 1, the quill sends the seed word shown above it. Seeds can change between performances, but your machine stays the same.' },
      { focus: 'board', title: 'Match the target', body: 'The resonator accepts only the target word shown above it. If it receives a different word, the performance fails.' },
      { focus: 'transport', title: 'Connect and run', body: 'Drag from the quill’s output on the right to the resonator’s input on the left. Then press Run. The number on the wire is its travel time in ticks.' },
    ],
  },

  {
    id: 'the-mould',
    title: 'The Mould',
    chapter: 'I · Études',
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
      { focus: 'palette', title: 'Append one note', body: 'Place a mould on the board. It appends one selected note to each word: w becomes w·a. Select the mould to choose the note in the inspector.' },
      { focus: 'commission', title: 'Solve every performance', body: 'This commission has two performances with different seeds. The same machine must produce the target word in both.' },
      { focus: 'inspector', title: 'Set the note to C', body: 'A mould starts set to A. Set this one to C because both targets end in C. If the result is wrong, the report shows the word that arrived.' },
    ],
  },

  {
    id: 'the-damper',
    title: 'The Damper',
    chapter: 'I · Études',
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
      { focus: 'palette', title: 'Remove the first note', body: 'A damper removes the first note from a word: a·w becomes w. Moulds append at the end; dampers remove from the beginning.' },
      { focus: 'board', title: 'Empty words wait', body: 'A damper cannot process an empty word, so the word waits there. If the machine stops, the report identifies the waiting part and the reason.' },
    ],
  },

  {
    id: 'unison',
    title: 'Unison',
    chapter: 'II · Duets',
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
      { focus: 'palette', title: 'Join two words', body: 'A unison waits for one word in each input, then outputs the lead word followed by the tail word: (w, v) becomes w·v.' },
      { focus: 'board', title: 'Input order matters', body: 'Connect the top quill to the lead input and the bottom quill to the tail input. Swapping the inputs reverses the order of the two words.' },
    ],
  },

  {
    id: 'the-splitter',
    title: 'The Splitter',
    chapter: 'II · Duets',
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
      { focus: 'palette', title: 'Split by position', body: 'A splitter sends the first k notes to the head output and the remaining notes to the rest output. A word shorter than k waits at the splitter.' },
      { focus: 'inspector', title: 'Set k to 2', body: 'Both targets are two notes long, so set k to 2. Connect both outputs; the splitter waits if either output is unconnected.' },
    ],
  },

  {
    id: 'the-tuning-fork',
    title: 'The Tuning Fork',
    chapter: 'III · Sight-reading',
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
      { focus: 'palette', title: 'Route by the first note', body: 'A fork checks the first note. A matching word exits left; every other word, including an empty word, exits right.' },
      { focus: 'commission', title: 'Use one machine for both routes', body: 'Each performance has a different seed and target resonator. The machine must inspect the first note to choose the correct route.' },
      { focus: 'board', title: 'Unused resonators stay empty', body: 'A resonator without a target in the current performance must receive no word. Sending a word to it fails the performance.' },
      { focus: 'inspector', title: 'Peek keeps the word unchanged', body: 'In peek mode, the fork checks the first note without removing it. Set the fork to A. Connect the left output to the upper resonator and the right output to the lower one.' },
    ],
  },

  {
    id: 'the-wolfs-bite',
    title: "The Wolf's Bite",
    chapter: 'IV · Wolf notes',
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
      { focus: 'board', title: 'Build the loop in peek mode', body: 'Place a fork set to A. Connect its left output back to its input and its right output to the resonator. Run Aria. Because peek does not remove the A, the loop repeats without finishing.' },
      { focus: 'inspector', title: 'Switch to bite mode', body: 'In bite mode, the fork removes a matching first note before sending the word left: A·w becomes w. Select the fork and change its mode from peek to bite.' },
      { focus: 'board', title: 'Run the loop again', body: 'Each pass removes one leading A. Aria needs two passes, Encore needs one, and Coda goes directly to the right output.' },
      { focus: 'inspector', title: 'Compare peek and bite', body: 'Bite changes the word, so the loop eventually finishes. Peek leaves the word unchanged, so this loop cannot finish.' },
    ],
  },

  {
    id: 'the-coupling',
    title: 'The Coupling',
    chapter: 'V · Entanglements',
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
      { focus: 'commission', title: 'Check both performances', body: 'The top quill sends the label: A in Aria and B in Encore. The bottom quill sends C·D. Route the payload to the resonator named by the label and route the label to the spent-labels resonator.' },
      { focus: 'board', title: 'Connect one word to each side', body: 'Connect the label to input A and the payload to input B. The coupling waits until both words arrive, then releases both in the same tick.' },
      { focus: 'inspector', title: 'Route using the other word', body: 'Each side checks the first note of the word on the other side. Set “B tests” to A. Connect BL to the hall of A and BR to the hall of B.' },
      { focus: 'board', title: 'Connect the label outputs', body: 'Connect both label outputs, AL and AR, to the spent-labels resonator. Multiple wires can connect to one input. Then press Run.' },
    ],
  },

  {
    id: 'valve-race',
    title: 'The Valve',
    chapter: 'VI · Tempo',
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
      { focus: 'board', title: 'Arrival order sets the pairs', body: 'The unison and fork are already on the board. With direct connections, the nearby lead word reaches the unison first and both pairs are wrong.' },
      { focus: 'palette', title: 'Add a delay', body: 'A valve holds a word for a selected number of ticks, then passes it through unchanged. Route only the nearby lead word through the valve.' },
      { focus: 'inspector', title: 'Set the delay', body: 'Start with a one-tick delay and press Run. Increase the delay until the farther lead word reaches the unison first.' },
      { focus: 'board', title: 'Deliver both pairs', body: 'The farther lead word must pair with the first theme. The delayed lead word must then pair with the second theme. Wire length also adds delay, so a longer route can replace the valve.' },
    ],
  },

  // Preserve the old ID so existing browser saves for this unchanged puzzle
  // still load after its title and campaign position change.
  {
    id: 'the-valve',
    title: 'Tempo I: Crossed Pairs',
    chapter: 'VI · Tempo',
    board: { cols: 11, rows: 7 },
    fixed: [
      { id: 'q1', kind: 'quill', x: 4, y: 3, label: 'A: too early' },
      { id: 'q2', kind: 'quill', x: 1, y: 1, label: 'B: far away' },
      { id: 'q3', kind: 'quill', x: 4, y: 5, label: 'C: near tail' },
      { id: 'q4', kind: 'quill', x: 1, y: 5, label: 'D: far tail' },
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
      { focus: 'board', title: 'Connect both inputs', body: 'Connect A and B to the lead input, and C and D to the tail input. The unison joins the first word in each input queue. Wire travel time determines their arrival order.' },
      { focus: 'commission', title: 'The direct pairs are wrong', body: 'With direct connections, A and C arrive first and form A·C. The targets are A·D and B·C, so A must arrive later.' },
      { focus: 'palette', title: 'Delay A', body: 'Route A through a valve. Increase its delay until B pairs with C first and A pairs with D second. Use the event log to check the arrival order.' },
      { focus: 'board', title: 'Route the two results', body: 'Send the unison output through a fork set to peek A. Connect the left output to the A·D resonator and the right output to the B·C resonator. A longer wire can replace the valve because wire length also adds delay.' },
    ],
  },

  {
    id: 'triage',
    title: 'Triage',
    chapter: 'IV · Wolf notes',
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
      { focus: 'commission', title: 'Check all three performances', body: 'The first note is A or B and selects the target resonator. Remove that note and send the remaining word to the selected target.' },
      { focus: 'palette', title: 'Choose peek or bite', body: 'With peek, place a damper after each fork output. With bite, the A is removed on the left output, so only the right output needs a damper for B.' },
      { focus: 'board', title: 'Build either solution', body: 'Both approaches solve the commission. Bite mode needs one damper; peek mode needs one on each route.' },
    ],
  },
];
