// Browser-independent recital sequencing. The UI owns timers and run state;
// this module only records which performances have been heard in this cycle.

export function makeRecital(startCase) {
  return {
    startCase,
    completed: new Set(),
    filled: false,
    paused: false,
    failed: false,
  };
}

export function recordRecitalPass(recital, caseIndex, caseCount) {
  recital.completed.add(caseIndex);
  const filledNow = !recital.filled && recital.completed.size === caseCount;
  if (filledNow) recital.filled = true;
  recital.failed = false;
  return {
    nextCase: (caseIndex + 1) % caseCount,
    filledNow,
  };
}
