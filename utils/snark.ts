function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getGreeting(name: string | null, hour: number): string {
  const n = name ?? 'you';
  if (hour < 12) {
    return pickRandom([
      `Morning, ${n}. The pills aren't going to take themselves.`,
      `Good morning, ${n}. Rise and medicate.`,
      `Morning, ${n}. Coffee first, then meds. Or meds first. Your call.`,
      `Hey ${n}. Another day, another dose.`,
      `Morning, ${n}. Let's get this over with.`,
    ]);
  } else if (hour < 18) {
    return pickRandom([
      `Afternoon, ${n}. Still alive? Good.`,
      `Hey ${n}. Midday check-in. How's the pill situation?`,
      `Afternoon, ${n}. Don't forget your meds exist.`,
      `${n}, it's the afternoon. You know what that means.`,
      `Afternoon, ${n}. Hydrate. Medicate. Repeat.`,
    ]);
  } else {
    return pickRandom([
      `Evening, ${n}. Time to medicate the chaos.`,
      `Evening, ${n}. Almost done for the day.`,
      `Hey ${n}. Evening meds won't take themselves.`,
      `Good evening, ${n}. One last push.`,
      `Evening, ${n}. The finish line is in sight.`,
    ]);
  }
}

export function getSnark(input: {
  name: string | null;
  takenToday: number;
  expectedToday: number;
  pendingNow: number;
  hour: number;
}): string {
  const { name, takenToday, expectedToday, pendingNow, hour } = input;
  const n = name ?? 'you';

  // Night overdue
  if (hour >= 21 && pendingNow > 0) {
    return pickRandom([
      `It's late. Take your pills before you forget AGAIN.`,
      `${n}, it's almost midnight. The meds are judging you.`,
      `Late night, ${n}. Still have doses pending. Classic.`,
      `The clock is ticking, ${n}. Meds. Now.`,
      `${n}, your future self will thank you. Take them.`,
    ]);
  }

  // All done
  if (expectedToday > 0 && takenToday >= expectedToday) {
    return pickRandom([
      `100% taken. Look at you, functioning like a real person.`,
      `All done, ${n}. Genuinely impressed.`,
      `${n} completed all doses. Therapist would be proud.`,
      `Full adherence. You're basically a role model now.`,
      `Done and done. ${n} wins today.`,
    ]);
  }

  // Empty — no scheduled, no as-needed taken
  if (expectedToday === 0 && takenToday === 0) {
    return pickRandom([
      `Nothing scheduled. Either you're healthy or lying.`,
      `No meds today? Living on the edge, ${n}.`,
      `Free day, ${n}. Or you forgot to add your meds.`,
      `Nothing on the schedule. Suspicious.`,
      `No doses today. Enjoy the freedom, ${n}.`,
    ]);
  }

  // Empty with as-needed taken
  if (expectedToday === 0 && takenToday > 0) {
    return pickRandom([
      `Just the as-needed today. Live dangerously.`,
      `As-needed only, ${n}. Keeping it casual.`,
      `PRN life, ${n}. Respect.`,
      `No schedule, just vibes and as-needed doses.`,
    ]);
  }

  // On track (rate >= 0.8 but pending > 0)
  const rate = expectedToday > 0 ? takenToday / expectedToday : 0;
  if (rate >= 0.8 && pendingNow > 0) {
    return pickRandom([
      `${n}, you're crushing it. Don't blow it now.`,
      `Almost there, ${n}. Don't get lazy.`,
      `So close, ${n}. Finish what you started.`,
      `${n} is on a roll. Keep going.`,
      `Nearly perfect, ${n}. One more to go.`,
    ]);
  }

  // Behind (rate < 0.5 with pending)
  if (rate < 0.5 && pendingNow > 0) {
    return pickRandom([
      `${n}, your meds are filing a missing-persons report.`,
      `${n}, the pills have been waiting. Awkward.`,
      `Behind schedule, ${n}. The meds noticed.`,
      `${n}, this is a wellness app, not a suggestion box.`,
      `Your adherence rate is having a rough day, ${n}.`,
    ]);
  }

  // Default / mid-range
  return pickRandom([
    `Keep going, ${n}. You've got this.`,
    `${n}, progress is progress.`,
    `Doing okay, ${n}. Could be worse.`,
    `${n}, the meds appreciate the effort.`,
    `Halfway there, ${n}. Don't stop now.`,
  ]);
}

export function getStreakSnark(streak: number): string {
  if (streak === 0) {
    return pickRandom([
      `Zero day streak. Bold strategy.`,
      `Streak: 0. Every legend starts somewhere.`,
      `No streak yet. Today's a good day to start.`,
      `Zero days. The only way is up.`,
    ]);
  }
  if (streak <= 2) {
    return pickRandom([
      `Tiny streak. Don't get cocky.`,
      `${streak} day${streak > 1 ? 's' : ''}. A start. Barely.`,
      `${streak} day streak. Promising. Don't ruin it.`,
      `${streak} day${streak > 1 ? 's' : ''} in. Keep it going.`,
    ]);
  }
  if (streak <= 6) {
    return pickRandom([
      `${streak} days. Look at you go.`,
      `${streak} day streak. Respect.`,
      `${streak} days strong. Impressive.`,
      `${streak} days in a row. You're on a roll.`,
    ]);
  }
  return pickRandom([
    `${streak} day streak. Therapist would be proud.`,
    `${streak} days. You're basically a professional now.`,
    `${streak} day streak. Genuinely impressive.`,
    `${streak} days. The meds are proud of you.`,
    `${streak} day streak. Don't stop now.`,
  ]);
}
