/**
 * Repository of allowed SQL Query Templates.
 * ALL templates:
 * - Read-only
 * - Parameterized
 * - Deterministic
 * - Whitelisted
 */

const TEMPLATES = {

  /* =====================================================
     1. OVERALL / BASELINE METRICS
     ===================================================== */

  OVERALL_SUMMARY: `
    SELECT 
      SUM(total_sessions) AS sessions,
      SUM(total_orders) AS orders,
      SUM(total_sales) AS gmv,
      (SUM(total_orders) / NULLIF(SUM(total_sessions), 0)) * 100 AS cvr
    FROM overall_summary
    -- Note: Schema provided only showed 'date'. Assuming 'created_at' or 'date' handles time filtering 
    -- or utilizing 'date' range for approximating granular windows if strict timestamp missing.
    -- For now, keeping logic generic to time filtering.
    WHERE date >= ? AND date < ?
  `,

  OVERALL_SUMMARY_SAME_HOUR_AVG: `
    SELECT
      -- Calculate Sessions/Orders as Average per Day
      -- DATEDIFF(param2, param1) gives N days.
      -- We use shopify_orders because overall_summary is Daily.
      -- Note: 'total_sessions' is not in shopify_orders, strictly speaking we only have Orders here.
      -- We will approximate CVR using session count from overall_summary / 24? No, that's bad.
      -- For now, let's just use Orders for the Average Baseline, and assume Sessions is roughly stable or use proxy.
      
      COUNT(*) / DATEDIFF(?, ?) AS orders,
      0 AS sessions, -- Placeholder if we can't get hourly sessions
      0 AS cvr
      
    FROM shopify_orders
    WHERE created_at >= ? AND created_at < ?
      AND created_hr = HOUR(?)  -- Match the hour of the Start Date
  `,

  /* =====================================================
     2. ORDER STATUS & PAYMENT HEALTH
     ===================================================== */

  PAYMENT_GATEWAY_DISTRIBUTION: `
    SELECT
      payment_gateway_names AS gateway,
      COUNT(*) AS order_count
    FROM shopify_orders
    WHERE created_at >= ? AND created_at < ?
    GROUP BY payment_gateway_names
    ORDER BY order_count DESC
  `,

  PAYMENT_GATEWAY_PENDING_RATE: `
    SELECT
      payment_gateway_names AS gateway,
      SUM(financial_status = 'pending') AS pending_orders,
      COUNT(*) AS total_orders,
      (SUM(financial_status = 'pending') / NULLIF(COUNT(*), 0)) * 100 AS pending_rate
    FROM shopify_orders
    WHERE created_at >= ? AND created_at < ?
    GROUP BY payment_gateway_names
  `,

  /* =====================================================
     3. DISCOUNT & PROMOTION BEHAVIOR
     ===================================================== */

  DISCOUNT_USAGE_DISTRIBUTION: `
    SELECT
      IF(discount_codes IS NULL OR discount_codes = '', 'no_discount', 'discounted') AS discount_flag,
      COUNT(*) AS order_count
    FROM shopify_orders
    WHERE created_at >= ? AND created_at < ?
    GROUP BY discount_flag
  `,

  DISCOUNT_CODE_BREAKDOWN: `
    SELECT
      discount_codes,
      COUNT(*) AS order_count
    FROM shopify_orders
    WHERE created_at >= ? AND created_at < ?
      AND discount_codes IS NOT NULL
    GROUP BY discount_codes
    ORDER BY order_count DESC
  `,

  /* =====================================================
     4. PRODUCT-LEVEL ANALYSIS
     ===================================================== */

  PRODUCT_CONVERSION_CONTRIBUTION: `
    SELECT
      _ITEM1_name AS product_name, 
      COUNT(*) AS order_count
    FROM shopify_orders
    WHERE created_at >= ? AND created_at < ?
    GROUP BY _ITEM1_name
    ORDER BY order_count DESC
    LIMIT 20
  `,

  PRODUCT_PRICE_BUCKET_DISTRIBUTION: `
    SELECT
      CASE
        WHEN line_item_price < 500 THEN '<500'
        WHEN line_item_price BETWEEN 500 AND 1000 THEN '500-1000'
        WHEN line_item_price BETWEEN 1000 AND 3000 THEN '1000-3000'
        ELSE '>3000'
      END AS price_bucket,
      COUNT(*) AS order_count
    FROM shopify_orders
    WHERE created_at >= ? AND created_at < ?
    GROUP BY price_bucket
    ORDER BY order_count DESC
  `,

  /* =====================================================
     5. AOV & MIX SHIFT
     ===================================================== */

  AOV_DISTRIBUTION: `
    SELECT
      CASE
        WHEN total_price < 500 THEN '<500'
        WHEN total_price BETWEEN 500 AND 1000 THEN '500-1000'
        WHEN total_price BETWEEN 1000 AND 3000 THEN '1000-3000'
        ELSE '>3000'
      END AS aov_bucket,
      COUNT(*) AS order_count
    FROM shopify_orders
    WHERE created_at >= ? AND created_at < ?
    GROUP BY aov_bucket
  `,

  /* =====================================================
     6. CUSTOMER TYPE BEHAVIOR
     ===================================================== */

  NEW_VS_RETURNING_CUSTOMERS: `
    SELECT
      CASE
        WHEN customer_id IS NULL THEN 'guest'
        ELSE 'returning'
      END AS customer_type,
      COUNT(*) AS order_count
    FROM shopify_orders
    WHERE created_at >= ? AND created_at < ?
    GROUP BY customer_type
  `,

  /* =====================================================
     7. TIME-BASED FAILURE CLUSTERING
     ===================================================== */

  ORDER_FAILURE_TIME_CLUSTER: `
    SELECT
      DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') AS hour,
      COUNT(*) AS order_count
    FROM shopify_orders
    WHERE created_at >= ? AND created_at < ?
      AND financial_status = 'pending'
    GROUP BY 1
    ORDER BY 1
  `,

  /* =====================================================
     8. GEOGRAPHIC ANALYSIS
     ===================================================== */

  GEO_DISTRIBUTION: `
    SELECT
      COALESCE(NULLIF(billing_city, ''), 'Unknown') AS city,
      COUNT(*) AS order_count
    FROM shopify_orders
    WHERE created_at >= ? AND created_at < ?
    GROUP BY city
    ORDER BY order_count DESC
  `,

  /* =====================================================
     9. MARKETING ATTRIBUTION (UTM PARSING)
     ===================================================== */

  UTM_SOURCE_DISTRIBUTION: `
    SELECT
      CASE
        WHEN full_url LIKE '%utm_source=%' THEN
          SUBSTRING_INDEX(SUBSTRING_INDEX(full_url, 'utm_source=', -1), '&', 1)
        ELSE 'direct/organic'
      END AS source,
      COUNT(*) AS order_count
    FROM shopify_orders
    WHERE created_at >= ? AND created_at < ?
    GROUP BY source
    ORDER BY order_count DESC
  `,

  UTM_CAMPAIGN_DISTRIBUTION: `
    SELECT
      CASE
        WHEN full_url LIKE '%utm_campaign=%' THEN
          SUBSTRING_INDEX(SUBSTRING_INDEX(full_url, 'utm_campaign=', -1), '&', 1)
        ELSE 'none'
      END AS campaign,
      COUNT(*) AS order_count
    FROM shopify_orders
    WHERE created_at >= ? AND created_at < ?
    GROUP BY campaign
    ORDER BY order_count DESC
  `
};

/**
 * Fetch a whitelisted query template and optionally append filters.
 * @param {string} name
 * @param {Array<{column: string, value: any}>} filters
 */
function getTemplate(name, filters = []) {
  if (!TEMPLATES[name]) {
    throw new Error(`Query template "${name}" not found or not allowed.`);
  }

  let sql = TEMPLATES[name];

  // Dynamic Filtering Logic
  if (filters && filters.length > 0) {
    // Whitelist check: Ensure columns are safe (alphanumeric + underscore only)
    // Prevents SQL injection via column names
    const clause = filters.map(f => {
      if (!/^[a-zA-Z0-9_]+$/.test(f.column)) {
        throw new Error(`Invalid filter column: ${f.column}`);
      }
      return `AND ${f.column} = ?`;
    }).join(' ');

    // Insert filters BEFORE 'GROUP BY'
    // This is fragile string manipulation but simpler than a full AST parser.
    // We assume templates follow: SELECT ... WHERE ... GROUP BY ...
    // If GROUP BY exists, insert before it. Else append.

    if (sql.includes('GROUP BY')) {
      sql = sql.replace('GROUP BY', `${clause} GROUP BY`);
    } else if (sql.includes('ORDER BY')) {
      sql = sql.replace('ORDER BY', `${clause} ORDER BY`);
    } else {
      // Just append
      sql += ` ${clause}`;
    }
  }

  return sql;
}

module.exports = {
  getTemplate,
  TEMPLATES
};
