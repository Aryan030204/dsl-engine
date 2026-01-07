/**
 * Simple Structured Logger
 * Format: [ISO_TIME] [LEVEL] [CONTEXT] Message
 */
class Logger {
    constructor(context) {
        this.context = context || 'System';
    }

    static create(context) {
        return new Logger(context);
    }

    info(message, data) {
        this._log('INFO', message, data);
    }

    warn(message, data) {
        this._log('WARN', message, data);
    }

    error(message, error) {
        this._log('ERROR', message, error);
    }

    debug(message, data) {
        // Uncomment to enable verbose debug logs if needed, 
        // or toggle based on env var. For now always showing for user debugging.
        this._log('DEBUG', message, data);
    }

    _log(level, message, data = '') {
        const timestamp = new Date().toISOString();
        let meta = '';

        if (data) {
            if (data instanceof Error) {
                meta = `\nStackTrace: ${data.stack}`;
            } else if (typeof data === 'object') {
                try {
                    meta = `\n${JSON.stringify(data, null, 2)}`;
                } catch (e) {
                    meta = String(data);
                }
            } else {
                meta = String(data);
            }
        }

        console.log(`[${timestamp}] [${level}] [${this.context}] ${message} ${meta}`);
    }
}

module.exports = Logger;
