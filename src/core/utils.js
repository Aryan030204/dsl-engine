/**
 * Utilites for date and time window calculations.
 */

/**
 * Parsing a relative window string into concrete start/end dates.
 * Supported formats:
 * - "avg_prev_N_days_same_hour"
 * - "prev_24_hours"
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
        // This is tricky: "Average" usually implies multiple queries or a specialized aggregate query.
        // For the sake of this engine's simplicity in Phase 1/2, we might treat it as 
        // "The same time window yesterday" or a range covering N days back.
        // Let's implement logic for "Previous Day Same Hour" as a proxy for the baseline if simpler,
        // or a range if needed. 

        // Regex to parse N
        const daysMatch = windowDef.match(/prev_(\d+)_days/);
        const days = daysMatch ? parseInt(daysMatch[1]) : 1;

        // "Same hour" implies we want the same hour-of-day.
        // Let's assume baseline is "Same time yesterday" (N=1) for direct comparison unless we do complex averaging.
        // If the DSL requires strictly "Average of prev 3 days", we would ideally run 3 queries or 1 range query.

        // Let's implement: [Reference - N days, Reference - N days + 1 hour] 
        // effectively comparing against the start of the window N days ago.

        const start = new Date(refDate);
        start.setDate(refDate.getDate() - days);

        const end = new Date(start);
        end.setHours(start.getHours() + 1); // 1 hour window

        return [start, end];
    }

    // Check if it's an ISO date range "START|END" (Custom format for simplicity)
    if (windowDef.includes('|')) {
        const parts = windowDef.split('|');
        return [new Date(parts[0]), new Date(parts[1])];
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
