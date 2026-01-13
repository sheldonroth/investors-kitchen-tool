/**
 * Statistical Utility Functions
 * Improved based on red team audit recommendations
 */

// Log-transform views/velocity for better distribution handling
export function logTransform(value: number): number {
    return Math.log(value + 1);
}

// Inverse log-transform for display
export function expTransform(logValue: number): number {
    return Math.exp(logValue) - 1;
}

// Calculate mean of log-transformed values
export function logMean(values: number[]): number {
    if (values.length === 0) return 0;
    const logValues = values.map(logTransform);
    return logValues.reduce((sum, v) => sum + v, 0) / logValues.length;
}

// Calculate standard deviation of log-transformed values
export function logStdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const logValues = values.map(logTransform);
    const mean = logValues.reduce((sum, v) => sum + v, 0) / logValues.length;
    const squaredDiffs = logValues.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / logValues.length);
}

// Median calculation
export function median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Median Absolute Deviation (MAD) - robust alternative to standard deviation
export function medianAbsoluteDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    const med = median(values);
    const absoluteDeviations = values.map(v => Math.abs(v - med));
    return median(absoluteDeviations);
}

// Modified Z-score using MAD (robust to outliers)
// Formula: 0.6745 * (x - median) / MAD
// The 0.6745 constant makes MAD comparable to stddev for normal distributions
export function modifiedZScore(value: number, values: number[]): number {
    const med = median(values);
    const mad = medianAbsoluteDeviation(values);
    if (mad === 0) return 0;
    return 0.6745 * (value - med) / mad;
}

// Log-transformed modified Z-score (best for view counts)
export function logModifiedZScore(value: number, values: number[]): number {
    const logValues = values.map(logTransform);
    const logValue = logTransform(value);
    return modifiedZScore(logValue, logValues);
}

// Confidence interval for mean difference (using t-distribution approximation)
export function meanDifferenceCI(group1: number[], group2: number[], confidence: number = 0.95): {
    difference: number;
    lowerBound: number;
    upperBound: number;
    significant: boolean;
    sampleSufficient: boolean;
} {
    const n1 = group1.length;
    const n2 = group2.length;

    // Require minimum sample size of 5 per group
    const sampleSufficient = n1 >= 5 && n2 >= 5;

    if (n1 === 0 || n2 === 0) {
        return { difference: 0, lowerBound: 0, upperBound: 0, significant: false, sampleSufficient: false };
    }

    const mean1 = group1.reduce((sum, v) => sum + v, 0) / n1;
    const mean2 = group2.reduce((sum, v) => sum + v, 0) / n2;
    const difference = mean1 - mean2;

    const var1 = group1.reduce((sum, v) => sum + Math.pow(v - mean1, 2), 0) / (n1 - 1 || 1);
    const var2 = group2.reduce((sum, v) => sum + Math.pow(v - mean2, 2), 0) / (n2 - 1 || 1);

    const standardError = Math.sqrt(var1 / n1 + var2 / n2);

    // t-value for 95% CI (approximation for large samples)
    const tValue = confidence === 0.95 ? 1.96 : 1.645;

    const lowerBound = difference - tValue * standardError;
    const upperBound = difference + tValue * standardError;

    // Significant if CI doesn't cross zero
    const significant = (lowerBound > 0) || (upperBound < 0);

    return {
        difference: Math.round(difference * 100) / 100,
        lowerBound: Math.round(lowerBound * 100) / 100,
        upperBound: Math.round(upperBound * 100) / 100,
        significant,
        sampleSufficient
    };
}

// Calculate pattern lift with significance test
export function calculatePatternLift(
    viewsWithPattern: number[],
    viewsWithoutPattern: number[]
): {
    lift: number;
    avgWith: number;
    avgWithout: number;
    pValue: number;
    significant: boolean;
    sampleSize: { with: number; without: number };
} {
    const n1 = viewsWithPattern.length;
    const n2 = viewsWithoutPattern.length;

    if (n1 < 3 || n2 < 3) {
        return {
            lift: 1,
            avgWith: 0,
            avgWithout: 0,
            pValue: 1,
            significant: false,
            sampleSize: { with: n1, without: n2 }
        };
    }

    // Use log-transformed values for comparison
    const logWith = viewsWithPattern.map(logTransform);
    const logWithout = viewsWithoutPattern.map(logTransform);

    const mean1 = logWith.reduce((sum, v) => sum + v, 0) / n1;
    const mean2 = logWithout.reduce((sum, v) => sum + v, 0) / n2;

    const var1 = logWith.reduce((sum, v) => sum + Math.pow(v - mean1, 2), 0) / (n1 - 1);
    const var2 = logWithout.reduce((sum, v) => sum + Math.pow(v - mean2, 2), 0) / (n2 - 1);

    // Welch's t-test
    const pooledSE = Math.sqrt(var1 / n1 + var2 / n2);
    const tStat = pooledSE > 0 ? (mean1 - mean2) / pooledSE : 0;

    // Approximate p-value using normal approximation for large samples
    const pValue = 2 * (1 - normalCDF(Math.abs(tStat)));

    // Calculate lift in original scale
    const avgWith = Math.round(viewsWithPattern.reduce((sum, v) => sum + v, 0) / n1);
    const avgWithout = Math.round(viewsWithoutPattern.reduce((sum, v) => sum + v, 0) / n2);
    const lift = avgWithout > 0 ? Math.round((avgWith / avgWithout) * 100) / 100 : 1;

    return {
        lift,
        avgWith,
        avgWithout,
        pValue: Math.round(pValue * 1000) / 1000,
        significant: pValue < 0.1,
        sampleSize: { with: n1, without: n2 }
    };
}

// Normal CDF approximation for p-value calculation
function normalCDF(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
}

// Character-level readability for short text (better than Flesch-Kincaid for titles)
export function characterReadability(text: string): {
    score: number;
    avgWordLength: number;
    commonWordRatio: number;
    wordCount: number;
    interpretation: string;
} {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;

    if (wordCount === 0) {
        return { score: 0, avgWordLength: 0, commonWordRatio: 0, wordCount: 0, interpretation: 'Empty' };
    }

    // Average word length (shorter = more accessible)
    const avgWordLength = Math.round((words.reduce((sum, w) => sum + w.replace(/[^a-zA-Z]/g, '').length, 0) / wordCount) * 10) / 10;

    // Common word ratio (using top 500 most common English words)
    const commonWords = new Set([
        'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with',
        'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
        'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if',
        'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him',
        'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than',
        'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two',
        'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give',
        'day', 'most', 'us', 'is', 'was', 'are', 'were', 'been', 'has', 'had', 'did', 'does', 'being',
        'best', 'top', 'why', 'free', 'easy', 'fast', 'simple', 'watch', 'learn', 'start', 'stop', 'try',
        'never', 'always', 'every', 'real', 'true', 'secret', 'amazing', 'ultimate', 'complete', 'guide'
    ]);

    const commonCount = words.filter(w => commonWords.has(w.toLowerCase().replace(/[^a-z]/g, ''))).length;
    const commonWordRatio = Math.round((commonCount / wordCount) * 100) / 100;

    // Score: lower avgWordLength and higher commonWordRatio = more readable
    // Normalized to 0-100 scale
    const lengthScore = Math.max(0, 100 - (avgWordLength - 3) * 15);
    const commonScore = commonWordRatio * 100;
    const score = Math.round((lengthScore * 0.6 + commonScore * 0.4));

    let interpretation: string;
    if (score >= 70) interpretation = 'Very accessible';
    else if (score >= 50) interpretation = 'Accessible';
    else if (score >= 30) interpretation = 'Moderate';
    else interpretation = 'Complex vocabulary';

    return { score, avgWordLength, commonWordRatio, wordCount, interpretation };
}

// Niche-normalized velocity
export function nicheNormalizedVelocity(
    velocity: number,
    nicheVelocities: number[]
): {
    raw: number;
    normalized: number;
    percentile: number;
    interpretation: string;
} {
    const logVelocity = logTransform(velocity);
    const logNicheVelocities = nicheVelocities.map(logTransform);

    const nicheMean = logNicheVelocities.reduce((sum, v) => sum + v, 0) / logNicheVelocities.length;
    const nicheStd = Math.sqrt(logNicheVelocities.reduce((sum, v) => sum + Math.pow(v - nicheMean, 2), 0) / logNicheVelocities.length);

    const normalized = nicheStd > 0 ? (logVelocity - nicheMean) / nicheStd : 0;

    // Calculate percentile
    const sorted = [...nicheVelocities, velocity].sort((a, b) => a - b);
    const rank = sorted.indexOf(velocity);
    const percentile = Math.round((rank / sorted.length) * 100);

    let interpretation: string;
    if (normalized >= 2) interpretation = 'Exceptional for this niche';
    else if (normalized >= 1) interpretation = 'Above average for niche';
    else if (normalized >= -1) interpretation = 'Typical for niche';
    else interpretation = 'Below niche average';

    return {
        raw: Math.round(velocity),
        normalized: Math.round(normalized * 100) / 100,
        percentile,
        interpretation
    };
}
