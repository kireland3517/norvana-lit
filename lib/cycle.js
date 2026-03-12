/**
 * NORVANA cycle logic.
 *
 * A "cycle" runs from the Friday after one area meeting to the Thursday of
 * the next area meeting. The area meeting is the FIRST THURSDAY of each month.
 *
 * Example:
 *   Meeting: Thu Mar 6 2026
 *   Next meeting: Thu Apr 2 2026
 *   Cycle: Fri Mar 7 2026 → Thu Apr 2 2026
 *   Label: "Mar–Apr 2026"
 */

/**
 * Returns the first Thursday of a given year/month (0-indexed month).
 */
function firstThursdayOf(year, month) {
  const d = new Date(year, month, 1);
  // Thursday = 4
  const offset = (4 - d.getDay() + 7) % 7;
  return new Date(year, month, 1 + offset);
}

/**
 * Adds days to a date, returns new Date.
 */
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/**
 * Formats a Date as YYYY-MM-DD.
 */
function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const MONTH_NAMES = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec'
];

/**
 * Given a date, returns the current cycle object:
 * {
 *   start_date: 'YYYY-MM-DD',   // Friday after previous meeting
 *   end_date:   'YYYY-MM-DD',   // Thursday of next meeting (meeting_date)
 *   meeting_date: 'YYYY-MM-DD', // first Thursday of some month
 *   label: 'Mar–Apr 2026'
 * }
 */
export function getCurrentCycle(now = new Date()) {
  // Work with date-only (ignore time)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Find first Thursday of the current month
  const thisMonthMeeting = firstThursdayOf(today.getFullYear(), today.getMonth());

  let meetingDate;
  if (today <= thisMonthMeeting) {
    // We're before or on this month's meeting — the active cycle ends on this meeting
    meetingDate = thisMonthMeeting;
  } else {
    // We're after this month's meeting — the active cycle ends on next month's meeting
    const nextMonth = today.getMonth() === 11
      ? new Date(today.getFullYear() + 1, 0, 1)
      : new Date(today.getFullYear(), today.getMonth() + 1, 1);
    meetingDate = firstThursdayOf(nextMonth.getFullYear(), nextMonth.getMonth());
  }

  // Previous meeting = first Thursday of the month before meetingDate
  const prevMeetingMonth = meetingDate.getMonth() === 0
    ? new Date(meetingDate.getFullYear() - 1, 11, 1)
    : new Date(meetingDate.getFullYear(), meetingDate.getMonth() - 1, 1);
  const prevMeeting = firstThursdayOf(prevMeetingMonth.getFullYear(), prevMeetingMonth.getMonth());

  const startDate = addDays(prevMeeting, 1); // Friday after previous meeting

  // Label: "Mar–Apr 2026" (start month – meeting month year)
  const startMonthName = MONTH_NAMES[startDate.getMonth()];
  const endMonthName   = MONTH_NAMES[meetingDate.getMonth()];
  const endYear        = meetingDate.getFullYear();
  const label = startMonthName === endMonthName
    ? `${startMonthName} ${endYear}`
    : `${startMonthName}–${endMonthName} ${endYear}`;

  return {
    start_date:   toISO(startDate),
    end_date:     toISO(meetingDate),
    meeting_date: toISO(meetingDate),
    label
  };
}
