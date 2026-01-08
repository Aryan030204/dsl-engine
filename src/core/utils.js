/**
 * Utilites for date and time window calculations.
 */

/**
 * Parsing a relative window string into concrete start/end dates.
 * Supported formats:
 * - "avg_prev_N_days_same_hour"
 * - "prev_day_same_hour" / "yesterday_same_hour"
 * - "prev_week_same_hour" / "same_day_last_week"
 * - "prev_24_hours" (Rolling 24h window)
 * - ISO string: "2026-01-01T00:00:00Z"
 * 
 * @param {string} windowDef 
 * @param {string|Date} referenceTime - The 'current' time anchor
 * @returns {Array<Date>} [start, end]
 */
function parseWindow(windowDef, referenceTime = new Date()) {
    const refDate = new Date(referenceTime);

    if (windowDef.includes('avg_prev_')) {
        // e.g. "avg_prev_3_days_same_hour"
        // Regex to parse N
        const daysMatch = windowDef.match(/prev_(\d+)_days/);
        const days = daysMatch ? parseInt(daysMatch[1]) : 1;

        // Start = N days ago (Same time)
        const start = new Date(refDate);
        start.setDate(refDate.getDate() - days);

        // End = Yesterday (Same time + 1 hour) for range? 
        // OR End = Start + 1 hour? No, that's just one sample.
        // The User wants AVERAGE of (D-1, D-2, D-3).
        // So the query range must span from [D-N] to [D-1].

        // Let's return the full span covering N days. 
        // The SQL template will handle filtering "Same Hour" and averaging.

        const end = new Date(refDate); // Until Now (or Yesterday?)
        // Usually baseline end is yesterday.
        // If refDate is Today, we want [Today-3, Today].
        // Let's set End to RefDate (exclusive).
        // Actually, if we want "Same Hour", we essentially want to encompass the previous occurrences.

        // Start: Ref - N days
        // End: Ref (exclusive)
        return [start, refDate];
    }

    // Check if it's an ISO date range "START|END" (Custom format for simplicity)
    if (windowDef.includes('|')) {
        const parts = windowDef.split('|');
        return [new Date(parts[0]), new Date(parts[1])];
    }

    // --- Readable Presets ---
    if (windowDef === 'prev_day_same_hour' || windowDef === 'yesterday_same_hour') {
        const start = new Date(refDate);
        start.setDate(refDate.getDate() - 1);
        const end = new Date(start);
        end.setHours(start.getHours() + 1);
        return [start, end];
    }

    if (windowDef === 'prev_week_same_hour' || windowDef === 'same_day_last_week') {
        const start = new Date(refDate);
        start.setDate(refDate.getDate() - 7);
        const end = new Date(start);
        end.setHours(start.getHours() + 1);
        return [start, end];
    }

    if (windowDef === 'prev_24_hours') {
        const end = new Date(refDate);
        const start = new Date(refDate);
        start.setHours(start.getHours() - 24);
        return [start, end];
    }

    // Check if it is a single ISO date string (assuming 1 hour duration by default or derived)
    // For now, let's assume we return a 1-hour window starting at that time
    if (!isNaN(Date.parse(windowDef))) {
        const start = new Date(windowDef);
        const end = new Date(start);
        end.setHours(end.getHours() + 1);
        return [start, end];
    }

    throw new Error(`Unknown window definition: ${windowDef}`);
}

module.exports = {
    parseWindow
};
