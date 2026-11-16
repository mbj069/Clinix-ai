// Local-time helpers for doctor availability. Sitting hours are stored in
// the hospital's local time, so "available now" must use the browser clock,
// not the server's UTC clock.
export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function localToday() {
  const d = new Date();
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const now = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return { date, dayOfWeek: d.getDay(), now };
}

/** Status of a doctor's sitting hours today, from the local clock. */
export function availabilityStatus(scheduleToday, now) {
  if (!scheduleToday) return { label: 'Not sitting today', cls: '' };
  if (now < scheduleToday.startTime) return { label: `Starts ${scheduleToday.startTime}`, cls: 'scheduled' };
  if (now > scheduleToday.endTime) return { label: 'Done for today', cls: '' };
  return { label: 'Available now', cls: 'active' };
}

/** Is a HH:MM time inside a doctor's sitting hours for a given weekday? */
export function isWithinHours(schedules, doctorId, dayOfWeek, time) {
  const s = schedules.find((x) => x.doctorId === doctorId && x.dayOfWeek === dayOfWeek);
  if (!s) return { within: null, schedule: null };
  return { within: time >= s.startTime && time <= s.endTime, schedule: s };
}
