declare module 'google-trends-api' {
    interface InterestOverTimeOptions {
        keyword: string | string[];
        startTime?: Date;
        endTime?: Date;
        geo?: string;
        hl?: string;
        timezone?: number;
        category?: number;
    }

    interface RelatedQueriesOptions {
        keyword: string | string[];
        startTime?: Date;
        endTime?: Date;
        geo?: string;
        hl?: string;
        timezone?: number;
        category?: number;
    }

    function interestOverTime(options: InterestOverTimeOptions): Promise<string>;
    function relatedQueries(options: RelatedQueriesOptions): Promise<string>;
    function interestByRegion(options: InterestOverTimeOptions): Promise<string>;
    function relatedTopics(options: RelatedQueriesOptions): Promise<string>;
    function dailyTrends(options: { geo?: string; trendDate?: Date }): Promise<string>;
    function realTimeTrends(options: { geo?: string; category?: string }): Promise<string>;
    function autoComplete(options: { keyword: string }): Promise<string>;

    export default {
        interestOverTime,
        relatedQueries,
        interestByRegion,
        relatedTopics,
        dailyTrends,
        realTimeTrends,
        autoComplete
    };
}
