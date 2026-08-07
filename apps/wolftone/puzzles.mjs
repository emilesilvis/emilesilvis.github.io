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
      { focus: 'palette', title: 'Place the Quill', body: 'The Commission shows the input sound phrase for QI. Select Quill ×1 in the tray, then place it on the left side of the board.' },
      { focus: 'palette', title: 'Place the Resonator', body: 'The Commission shows the sound that RI must receive. Select Resonator ×1 in the tray, then place it on the right side of the board.' },
      { focus: 'palette', title: 'Connect them', body: 'Select Track ∞. Click the Quill’s output socket, then click the Resonator’s input socket. The shortest clear Track appears.' },
      { focus: 'board', title: 'Sound becomes one marble', body: 'At tick 1, the Quill transcribes each sound phrase into one word marble. The glass swirls together every note colour, while its sound bar preserves the exact order.' },
      { focus: 'board', title: 'Read every direction', body: 'The sound bar always reads A·B from left to right, whether its marble travels east, west, north, or south. Track chevrons show where the word is moving.' },
      { focus: 'transport', title: 'Run and listen', body: 'Press Run. The Resonator turns a matching word marble into sound waves. A different word sounds sour and fails the performance. Select the Track afterwards to read its travel time in the Inspector.' },
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
      { focus: 'palette', title: 'Add one note', body: 'Place a Mould on the board. It adds one selected note to the tail of each word marble. Select the Mould to choose that note in the Inspector.' },
      { focus: 'commission', title: 'Solve every performance', body: 'This commission has two different input sound phrases. The same machine must deliver the target word marble to the Resonator in both.' },
      { focus: 'inspector', title: 'Add a C note', body: 'A Mould starts set to A. Set this one to C because both target words end in C. If the result is wrong, the report shows the word that arrived.' },
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
      { focus: 'palette', title: 'Remove the lead note', body: 'A Damper removes the lead note from a word marble. Moulds add at the tail; Dampers remove from the front.' },
      { focus: 'board', title: 'Empty words wait', body: 'A Damper cannot process an empty word marble, so it waits there. If the machine stops, the report identifies the waiting part and the reason.' },
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
      { focus: 'palette', title: 'Join two words', body: 'A Unison waits for one word marble in each input, then joins the lead word followed by the tail word into one marble.' },
      { focus: 'board', title: 'Input order matters', body: 'Connect the top Quill to the lead input and the bottom Quill to the tail input. Swapping them reverses the order of the two words.' },
      { focus: 'board', title: 'Correct the first connection', body: 'Connect the top Quill first. If its Track reaches the wrong Unison input, select that Track and drag its glowing endpoint to the free input instead of deleting it. Then connect the bottom Quill.' },
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
      { focus: 'palette', title: 'Split by position', body: 'A Splitter makes two word marbles: the first k notes go to head and the remaining notes go to rest. A word shorter than k waits at the Splitter.' },
      { focus: 'inspector', title: 'Cut after 2 notes', body: 'Both target words contain two notes, so set k to 2. Connect both outputs; the Splitter waits if either is unconnected.' },
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
      { focus: 'palette', title: 'Route by the lead note', body: 'A Tuning Fork checks the lead note on the sound bar. A matching word marble exits through match (=); every other word, including an empty one, exits through other (≠).' },
      { focus: 'commission', title: 'Use one machine for both routes', body: 'Each performance has a different input sound and target Resonator. The machine must inspect the lead note to choose the correct route.' },
      { focus: 'board', title: 'Unused Resonators stay silent', body: 'A Resonator without a target sound in the current performance must receive no word marble. Sending one to it fails the performance.' },
      { focus: 'inspector', title: 'Peek preserves the word', body: 'In Peek mode, the Tuning Fork reads the lead note without removing it. Match A to the upper Resonator and send other (≠) to the lower one.' },
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
      { focus: 'board', title: 'Build the loop in peek mode', body: 'Place a fork set to A. Connect match (=) back to its input and other (≠) to the resonator. Run Aria. Because peek does not remove the A, the loop repeats without finishing.' },
      { focus: 'inspector', title: 'Switch to Bite mode', body: 'In Bite mode, the Tuning Fork removes a matching lead note before sending the remaining word through match (=).' },
      { focus: 'board', title: 'Run the loop again', body: 'Each pass removes one leading A. Aria needs two passes, Encore needs one, and Coda goes directly through other (≠).' },
      { focus: 'inspector', title: 'Compare Peek and Bite', body: 'Bite shortens the word, so the loop eventually finishes. Peek leaves it unchanged, so this loop cannot finish.' },
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
      { focus: 'board', title: 'Connect one word to each side', body: 'Connect the label word marble to input A and the payload word marble to input B. The Coupling waits until both arrive, then releases both in the same tick.' },
      { focus: 'inspector', title: 'Read the other lead note', body: 'Each side reads the lead note on the other word. Set “B decides A” to A. Connect BL to the hall of A and BR to the hall of B.' },
      { focus: 'board', title: 'Merge the label outputs', body: 'Place a Junction. Connect AL and AR to its A and B inputs, then connect its output to the spent-labels resonator. Every physical port accepts one track.' },
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
      { focus: 'board', title: 'Arrival order sets the pairs', body: 'The Unison and Tuning Fork are already on the board. With direct tracks, the nearby lead word reaches the Unison first and both pairs are wrong.' },
      { focus: 'palette', title: 'Add a delay', body: 'A Valve holds a word marble for a selected number of ticks, then releases it unchanged. Route only the nearby lead word through it.' },
      { focus: 'inspector', title: 'Set the delay', body: 'Start with a one-tick delay and press Run. Increase it until the farther lead word reaches the Unison first.' },
      { focus: 'board', title: 'Deliver both pairs', body: 'The farther lead word must pair with the first theme. The delayed lead word must then pair with the second. Track length also adds delay.' },
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
      { focus: 'board', title: 'Merge each pair', body: 'Use one Junction to merge A and B into the lead input, and another to merge C and D into the tail input. Every physical port accepts one track. Track travel time determines arrival order.' },
      { focus: 'commission', title: 'The direct pairs are wrong', body: 'With direct connections, A and C arrive first and form A·C. The targets are A·D and B·C, so A must arrive later.' },
      { focus: 'palette', title: 'Delay A', body: 'Route A through a valve. Increase its delay until B pairs with C first and A pairs with D second. Use the event log to check the arrival order.' },
      { focus: 'board', title: 'Route the two results', body: 'Send the unison output through a fork set to peek A. Connect match (=) to the A·D resonator and other (≠) to the B·C resonator. A longer track can replace the valve because track length also adds delay.' },
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
      { focus: 'commission', title: 'Check all three performances', body: 'The lead note is A or B and selects the target Resonator. Remove that note and send the remaining word marble to the selected target.' },
      { focus: 'palette', title: 'Choose peek or bite', body: 'With peek, place a damper after each fork output. With bite, the A is removed on match (=), so only other (≠) needs a damper for B.' },
      { focus: 'board', title: 'Build either solution', body: 'Both approaches solve the commission. Bite mode needs one damper; peek mode needs one on each route.' },
    ],
  },
];
